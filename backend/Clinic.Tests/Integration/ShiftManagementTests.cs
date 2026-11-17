using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class ShiftManagementTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _receptionist = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_shift_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _receptionist = new User
        {
            Username = "recept_shift_user",
            PasswordHash = "hash",
            FullName = "موظف الاستقبال",
            Role = UserRole.Receptionist,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Users.Add(_receptionist);
        await context.SaveChangesAsync();
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    [Fact]
    public async Task OpenShift_WhenNoActiveShift_ShouldPersistSuccessfully()
    {
        await using var context = CreateDbContext();

        var shift = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        shift.Id.Should().BeGreaterThan(0);
        shift.IsClosed.Should().BeFalse();
        shift.OpeningBalancePiastres.Should().Be(50_000L);
    }

    [Fact]
    public async Task OpenSecondShift_WhileFirstIsOpen_ShouldThrowDbUpdateExceptionByFilteredIndex()
    {
        await using var context = CreateDbContext();

        var shift1 = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift1);
        await context.SaveChangesAsync();

        var shift2 = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 20_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift2);

        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task RecordPettyCashExpense_ShouldLinkTransactionToActiveShift()
    {
        await using var context = CreateDbContext();

        var shift = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        var expenseTx = new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Expense,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 5_000L,
            ExpenseCategory = "OfficeSupplies",
            Description = "شراء أدوات مكتبية ونظافة",
            CreatedByUserId = _receptionist.Id,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.FinancialTransactions.Add(expenseTx);
        await context.SaveChangesAsync();

        var loadedShift = await context.Shifts.Include(s => s.Transactions).FirstAsync(s => s.Id == shift.Id);
        loadedShift.Transactions.Should().ContainSingle(t => t.Type == TransactionType.Expense && t.AmountPiastres == 5_000L);
    }

    [Fact]
    public async Task CloseShift_ShouldCalculateDifference_AndMarkClosed()
    {
        await using var context = CreateDbContext();

        var shift = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        // Add 300 EGP cash payment
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 30_000L,
            CreatedByUserId = _receptionist.Id
        });
        await context.SaveChangesAsync();

        // Expected Cash = 50,000 + 30,000 = 80,000 Piastres
        long expected = 80_000L;
        long actualCounted = 78_000L; // 20 EGP shortage

        shift.ExpectedClosingCashPiastres = expected;
        shift.ActualClosingCashPiastres = actualCounted;
        shift.CashDifferencePiastres = actualCounted - expected; // -2,000
        shift.ClosingNotes = "عجز طفيف بقيمة 20 ج.م";
        shift.ClosedAtUtc = DateTime.UtcNow;
        shift.IsClosed = true;

        await context.SaveChangesAsync();

        var closed = await context.Shifts.FirstAsync(s => s.Id == shift.Id);
        closed.IsClosed.Should().BeTrue();
        closed.ClosedAtUtc.Should().NotBeNull();
        closed.CashDifferencePiastres.Should().Be(-2_000L);

        // After closing, user can now open a new shift without violating unique index
        var newShift = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            OpeningBalancePiastres = 20_000L,
            IsClosed = false
        };
        context.Shifts.Add(newShift);
        Func<Task> openNew = async () => await context.SaveChangesAsync();
        await openNew.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ShiftService_GetCurrentShift_ShouldComputeExactDrawerMathAndNonCashTotals()
    {
        await using var context = CreateDbContext();
        var dateService = new BusinessDateService();
        using var bookingWriteLock = new BookingWriteLock();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<Clinic.Api.Services.ShiftService>.Instance;

        var shiftService = new Clinic.Api.Services.ShiftService(context, dateService, bookingWriteLock, logger);

        // Open shift with 500 EGP
        var shift = await shiftService.OpenShiftAsync(_receptionist.Id, 50_000L, "افتتاح الوردية");

        // Record 100 EGP petty cash expense
        await shiftService.RecordExpenseAsync(_receptionist.Id, 10_000L, "نظافة", "شراء أدوات نظافة", null);

        // Add 200 EGP cash payment
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 20_000L,
            CreatedByUserId = _receptionist.Id
        });

        // Add 300 EGP Instapay payment (must NOT affect expected cash)
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Instapay,
            AmountPiastres = 30_000L,
            CreatedByUserId = _receptionist.Id
        });

        // Add 150 EGP Card payment (must NOT affect expected cash)
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Card,
            AmountPiastres = 15_000L,
            CreatedByUserId = _receptionist.Id
        });

        await context.SaveChangesAsync();

        var summary = await shiftService.GetCurrentShiftAsync(_receptionist.Id);

        summary.Should().NotBeNull();
        summary!.OpeningBalancePiastres.Should().Be(50_000L);
        summary.CashPaymentsPiastres.Should().Be(20_000L);
        summary.CashExpensesPiastres.Should().Be(10_000L);
        summary.ExpectedClosingCashPiastres.Should().Be(60_000L); // 500 + 200 - 100 = 600 EGP
        summary.TotalInstapayPiastres.Should().Be(30_000L);
        summary.TotalCardPiastres.Should().Be(15_000L);
        summary.TotalNonCashPiastres.Should().Be(45_000L);
        summary.TotalRevenuePiastres.Should().Be(65_000L); // 200 cash + 450 non-cash = 650 EGP
        summary.TransactionsCount.Should().Be(4);
    }

    [Fact]
    public async Task ShiftService_CloseShift_WithConcurrencyConflict_ShouldThrowDbUpdateConcurrencyException()
    {
        await using var context = CreateDbContext();
        var dateService = new BusinessDateService();
        using var bookingWriteLock = new BookingWriteLock();
        var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<Clinic.Api.Services.ShiftService>.Instance;

        var shiftService = new Clinic.Api.Services.ShiftService(context, dateService, bookingWriteLock, logger);

        var shift = await shiftService.OpenShiftAsync(_receptionist.Id, 25_000L, null);

        // Attempt closing with stale version
        long staleVersion = shift.Version - 1; // 0 != 1

        Func<Task> act = async () => await shiftService.CloseShiftAsync(
            _receptionist.Id, shift.Id, 25_000L, "إغلاق", staleVersion);

        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    public async Task DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            if (File.Exists(_dbFilePath + "-wal")) File.Delete(_dbFilePath + "-wal");
            if (File.Exists(_dbFilePath + "-shm")) File.Delete(_dbFilePath + "-shm");
        }
        catch { }
    }
}
