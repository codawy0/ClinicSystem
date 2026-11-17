using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Shifts;

namespace Clinic.Api.Services;

public class ShiftService : IShiftService
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly IBookingWriteLock _bookingWriteLock;
    private readonly ILogger<ShiftService> _logger;

    public ShiftService(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        IBookingWriteLock bookingWriteLock,
        ILogger<ShiftService> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _bookingWriteLock = bookingWriteLock;
        _logger = logger;
    }

    public async Task<ShiftSummaryDto?> GetCurrentShiftAsync(int userId)
    {
        var shift = await _context.Shifts
            .Include(s => s.User)
            .Include(s => s.Transactions)
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (shift == null) return null;

        return MapToSummary(shift);
    }

    public async Task<Shift> OpenShiftAsync(int userId, long openingBalancePiastres, string? notes)
    {
        // 1. Check if user already has an active shift
        var existingActive = await _context.Shifts
            .AnyAsync(s => s.UserId == userId && !s.IsClosed);

        if (existingActive)
        {
            throw new InvalidOperationException("ACTIVE_SHIFT_EXISTS");
        }

        var businessDate = _businessDateService.GetCurrentBusinessDate();

        var shift = new Shift
        {
            UserId = userId,
            BusinessDate = businessDate,
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = openingBalancePiastres,
            ExpectedClosingCashPiastres = openingBalancePiastres,
            IsClosed = false,
            ClosingNotes = notes,
            Version = 1
        };

        _context.Shifts.Add(shift);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Shift #{ShiftId} opened for user #{UserId} with opening balance {Opening} Piastres on {Date}",
            shift.Id, userId, openingBalancePiastres, businessDate);

        return shift;
    }

    public async Task<FinancialTransaction> RecordExpenseAsync(
        int userId, long amountPiastres, string category, string description, string? idempotencyKey)
    {
        if (amountPiastres <= 0)
        {
            throw new ArgumentException("Expense amount must be positive", nameof(amountPiastres));
        }

        // Check for idempotency replay
        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var existingTx = await _context.FinancialTransactions
                .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
            if (existingTx != null)
            {
                return existingTx;
            }
        }

        var shift = await _context.Shifts
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (shift == null)
        {
            throw new InvalidOperationException("NO_ACTIVE_SHIFT");
        }

        var transaction = new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Expense,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = amountPiastres,
            ExpenseCategory = category,
            Description = description,
            CreatedByUserId = userId,
            CreatedAtUtc = DateTime.UtcNow,
            IdempotencyKey = idempotencyKey
        };

        _context.FinancialTransactions.Add(transaction);

        // Update shift expected cash
        shift.ExpectedClosingCashPiastres -= amountPiastres;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Recorded petty cash expense #{TxId} for {Amount} Piastres in shift #{ShiftId}",
            transaction.Id, amountPiastres, shift.Id);

        return transaction;
    }

    public async Task<ShiftCloseResponseDto> CloseShiftAsync(
        int userId, int shiftId, long actualClosingCashPiastres, string? closingNotes, long version)
    {
        return await _bookingWriteLock.ExecuteAsync(async () =>
        {
            var shift = await _context.Shifts
                .Include(s => s.Transactions)
                .FirstOrDefaultAsync(s => s.Id == shiftId);

            if (shift == null)
            {
                throw new KeyNotFoundException("SHIFT_NOT_FOUND");
            }

            if (shift.UserId != userId)
            {
                // Verify user or admin
                var user = await _context.Users.FindAsync(userId);
                if (user == null || user.Role != UserRole.Admin)
                {
                    throw new UnauthorizedAccessException("UNAUTHORIZED_SHIFT_CLOSE");
                }
            }

            // 1. Optimistic Concurrency check FIRST:
            // Stale version must throw DbUpdateConcurrencyException -> HTTP 409 Conflict,
            // even if another concurrent operation already closed the shift.
            if (shift.Version != version)
            {
                throw new DbUpdateConcurrencyException("CONCURRENCY_CONFLICT");
            }

            // 2. State check SECOND:
            if (shift.IsClosed)
            {
                throw new InvalidOperationException("SHIFT_ALREADY_CLOSED");
            }

            // Calculate exact physical cash formula: Opening + CashPayments - CashRefunds - CashExpenses
            long cashPayments = shift.Transactions
                .Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Payment)
                .Sum(t => t.AmountPiastres);

            long cashRefunds = shift.Transactions
                .Where(t => t.PaymentMethod == PaymentMethod.Cash && (t.Type == TransactionType.Refund || t.Type == TransactionType.VoidReversal))
                .Sum(t => t.AmountPiastres);

            long cashExpenses = shift.Transactions
                .Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Expense)
                .Sum(t => t.AmountPiastres);

            long expectedClosing = shift.OpeningBalancePiastres + cashPayments - cashRefunds - cashExpenses;
            long diff = actualClosingCashPiastres - expectedClosing;

            shift.ExpectedClosingCashPiastres = expectedClosing;
            shift.ActualClosingCashPiastres = actualClosingCashPiastres;
            shift.CashDifferencePiastres = diff;
            shift.ClosingNotes = closingNotes;
            shift.ClosedAtUtc = DateTime.UtcNow;
            shift.IsClosed = true;

            await _context.SaveChangesAsync();

            string diffType = diff switch
            {
                > 0 => "Surplus",
                < 0 => "Shortage",
                _ => "Balanced"
            };

            _logger.LogInformation("Shift #{ShiftId} closed. Expected: {Expected}, Actual: {Actual}, Diff: {Diff} ({Type})",
                shift.Id, expectedClosing, actualClosingCashPiastres, diff, diffType);

            return new ShiftCloseResponseDto
            {
                ShiftId = shift.Id,
                ExpectedClosingCashPiastres = expectedClosing,
                ActualClosingCashPiastres = actualClosingCashPiastres,
                CashDifferencePiastres = diff,
                DifferenceType = diffType,
                ClosedAtUtc = shift.ClosedAtUtc.Value,
                Version = shift.Version
            };
        });
    }

    private static ShiftSummaryDto MapToSummary(Shift shift)
    {
        long cashPayments = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Payment)
            .Sum(t => t.AmountPiastres);

        long cashRefunds = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.Cash && (t.Type == TransactionType.Refund || t.Type == TransactionType.VoidReversal))
            .Sum(t => t.AmountPiastres);

        long cashExpenses = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Expense)
            .Sum(t => t.AmountPiastres);

        long expectedClosing = shift.OpeningBalancePiastres + cashPayments - cashRefunds - cashExpenses;

        long instapay = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.Instapay && t.Type == TransactionType.Payment)
            .Sum(t => t.AmountPiastres);

        long vodafone = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.VodafoneCash && t.Type == TransactionType.Payment)
            .Sum(t => t.AmountPiastres);

        long card = shift.Transactions
            .Where(t => t.PaymentMethod == PaymentMethod.Card && t.Type == TransactionType.Payment)
            .Sum(t => t.AmountPiastres);

        long totalNonCash = instapay + vodafone + card;
        long totalRevenue = cashPayments + totalNonCash;

        string? diffType = null;
        if (shift.CashDifferencePiastres.HasValue)
        {
            diffType = shift.CashDifferencePiastres.Value switch
            {
                > 0 => "Surplus",
                < 0 => "Shortage",
                _ => "Balanced"
            };
        }

        return new ShiftSummaryDto
        {
            ShiftId = shift.Id,
            UserId = shift.UserId,
            Username = shift.User?.Username ?? string.Empty,
            FullName = shift.User?.FullName ?? string.Empty,
            BusinessDate = shift.BusinessDate,
            OpenedAtUtc = shift.OpenedAtUtc,
            ClosedAtUtc = shift.ClosedAtUtc,
            OpeningBalancePiastres = shift.OpeningBalancePiastres,
            CashPaymentsPiastres = cashPayments,
            CashRefundsPiastres = cashRefunds,
            CashExpensesPiastres = cashExpenses,
            ExpectedClosingCashPiastres = expectedClosing,
            TotalInstapayPiastres = instapay,
            TotalVodafoneCashPiastres = vodafone,
            TotalCardPiastres = card,
            TotalNonCashPiastres = totalNonCash,
            TotalRevenuePiastres = totalRevenue,
            TransactionsCount = shift.Transactions.Count,
            IsClosed = shift.IsClosed,
            ActualClosingCashPiastres = shift.ActualClosingCashPiastres,
            CashDifferencePiastres = shift.CashDifferencePiastres,
            DifferenceType = diffType,
            ClosingNotes = shift.ClosingNotes,
            Version = shift.Version
        };
    }
}
