using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Invoices;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize]
public class InvoicesController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBookingWriteLock _bookingWriteLock;
    private readonly ILogger<InvoicesController> _logger;

    public InvoicesController(
        ClinicDbContext context,
        IBookingWriteLock bookingWriteLock,
        ILogger<InvoicesController> logger)
    {
        _context = context;
        _bookingWriteLock = bookingWriteLock;
        _logger = logger;
    }

    // GET /api/invoices
    [HttpGet]
    public async Task<ActionResult<List<InvoiceListDto>>> GetInvoices(
        [FromQuery] int? patientId,
        [FromQuery] InvoiceStatus? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Invoices.AsNoTracking()
            .Include(i => i.Patient)
            .Include(i => i.Appointment).ThenInclude(a => a!.Doctor)
            .Include(i => i.Lines)
            .Include(i => i.Transactions)
            .AsQueryable();

        if (patientId.HasValue)
            query = query.Where(i => i.PatientId == patientId.Value);

        if (status.HasValue)
            query = query.Where(i => i.Status == status.Value);

        if (startDate.HasValue)
            query = query.Where(i => i.CreatedAtUtc >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(i => i.CreatedAtUtc <= endDate.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            if (int.TryParse(term, out var idVal))
            {
                query = query.Where(i => i.Id == idVal || i.Patient.FullName.Contains(term) || i.Patient.Phone.Contains(term));
            }
            else
            {
                var norm = ArabicNormalizer.NormalizeText(term);
                query = query.Where(i => i.Patient.SearchName.Contains(norm) || i.Patient.Phone.Contains(term));
            }
        }

        var list = await query
            .OrderByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(list.Select(MapToListDto).ToList());
    }

    // GET /api/invoices/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<InvoiceDetailDto>> GetInvoiceById(int id)
    {
        var invoice = await _context.Invoices.AsNoTracking()
            .Include(i => i.Patient)
            .Include(i => i.Appointment).ThenInclude(a => a!.Doctor)
            .Include(i => i.ApprovedByUser)
            .Include(i => i.Lines)
            .Include(i => i.Transactions).ThenInclude(t => t.CreatedByUser)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice == null)
            return NotFound("الفاتورة غير موجودة.");

        return Ok(MapToDetailDto(invoice));
    }

    // POST /api/invoices/{id}/payments
    [HttpPost("{id:int}/payments")]
    public async Task<ActionResult<PaymentResponseDto>> RecordPayment(
        int id,
        [FromBody] RecordPaymentRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        int userId = GetCurrentUserId();

        // 1. Shift Guard: Verify active shift exists
        var activeShift = await _context.Shifts.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (activeShift == null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "SHIFT_REQUIRED",
                detail: "يجب فتح وردية نقدية نشطة أولاً قبل تسجيل التحصيل المالي.");
        }

        // 2. Idempotency Check
        string? idempotencyKey = !string.IsNullOrWhiteSpace(headerIdempotencyKey)
            ? headerIdempotencyKey.Trim()
            : request.IdempotencyKey?.Trim();

        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var existingTx = await _context.FinancialTransactions
                .Include(t => t.Invoice)
                .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey && t.InvoiceId == id);

            if (existingTx != null && existingTx.Invoice != null)
            {
                var currentShift = await _context.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == activeShift.Id);
                return Ok(new PaymentResponseDto
                {
                    InvoiceId = id,
                    TransactionId = existingTx.Id,
                    AmountPaidPiastres = existingTx.AmountPiastres,
                    TotalPaidPiastres = existingTx.Invoice.PaidPiastres,
                    RemainingPiastres = existingTx.Invoice.RemainingPiastres,
                    Status = existingTx.Invoice.Status,
                    PaymentMethod = existingTx.PaymentMethod,
                    ExpectedClosingCashPiastres = currentShift?.ExpectedClosingCashPiastres ?? 0,
                    InvoiceVersion = existingTx.Invoice.Version,
                    CreatedAtUtc = existingTx.CreatedAtUtc
                });
            }
        }

        // 3. Concurrency serialization under BookingWriteLock
        return await _bookingWriteLock.ExecuteAsync<ActionResult<PaymentResponseDto>>(async () =>
        {
            var invoice = await _context.Invoices
                .Include(i => i.Transactions)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null)
                return NotFound("الفاتورة غير موجودة.");

            if (invoice.Status == InvoiceStatus.Voided)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVOICE_ALREADY_VOIDED",
                    detail: "لا يمكن سداد مبالغ على فاتورة ملغاة.");
            }

            if (invoice.RemainingPiastres == 0L)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVOICE_ALREADY_PAID",
                    detail: "الفاتورة مسددة بالكامل بالفعل.");
            }

            if (request.Version.HasValue && invoice.Version != request.Version.Value)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "تم تعديل بيانات الفاتورة من قبل مستخدم آخر. يرجى التحديث والمحاولة مجدداً.");
            }

            if (request.AmountPiastres <= 0)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVALID_PAYMENT_AMOUNT",
                    detail: "مبلغ السداد يجب أن يكون أكبر من صفر.");
            }

            if (request.AmountPiastres > invoice.RemainingPiastres)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "OVERPAYMENT_NOT_ALLOWED",
                    detail: "مبلغ السداد يتجاوز الرصيد المتبقي المطلوب للفاتورة.");
            }

            var shift = await _context.Shifts.FirstOrDefaultAsync(s => s.Id == activeShift.Id && !s.IsClosed);
            if (shift == null)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "SHIFT_REQUIRED",
                    detail: "الوردية النقدية مغلقة أو غير متاحة.");
            }

            // Update Invoice
            invoice.PaidPiastres += request.AmountPiastres;
            invoice.RemainingPiastres -= request.AmountPiastres;
            invoice.Status = invoice.RemainingPiastres == 0L ? InvoiceStatus.Paid : InvoiceStatus.Partial;
            invoice.UpdatedAtUtc = DateTime.UtcNow;

            // Create Transaction
            var transaction = new FinancialTransaction
            {
                ShiftId = shift.Id,
                InvoiceId = invoice.Id,
                Type = TransactionType.Payment,
                PaymentMethod = request.PaymentMethod,
                AmountPiastres = request.AmountPiastres,
                ReferenceNumber = request.ReferenceNumber,
                Description = !string.IsNullOrWhiteSpace(request.Notes) ? request.Notes.Trim() : $"دفعة سداد للفاتورة #{invoice.Id}",
                CreatedByUserId = userId,
                CreatedAtUtc = DateTime.UtcNow,
                IdempotencyKey = idempotencyKey
            };
            _context.FinancialTransactions.Add(transaction);

            // Update shift drawer if cash
            if (request.PaymentMethod == PaymentMethod.Cash)
            {
                shift.ExpectedClosingCashPiastres += request.AmountPiastres;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "حدث تعارض أثناء حفظ عملية السداد. يرجى المحاولة مجدداً.");
            }

            return Ok(new PaymentResponseDto
            {
                InvoiceId = invoice.Id,
                TransactionId = transaction.Id,
                AmountPaidPiastres = request.AmountPiastres,
                TotalPaidPiastres = invoice.PaidPiastres,
                RemainingPiastres = invoice.RemainingPiastres,
                Status = invoice.Status,
                PaymentMethod = transaction.PaymentMethod,
                ExpectedClosingCashPiastres = shift.ExpectedClosingCashPiastres,
                InvoiceVersion = invoice.Version,
                CreatedAtUtc = transaction.CreatedAtUtc
            });
        });
    }

    // POST /api/invoices/{id}/refund
    [HttpPost("{id:int}/refund")]
    public async Task<ActionResult<RefundResponseDto>> RecordRefund(
        int id,
        [FromBody] RecordRefundRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "REFUND_REASON_REQUIRED",
                detail: "سبب الاسترداد إلزامي.");
        }

        int userId = GetCurrentUserId();

        // 1. Shift Guard
        var activeShift = await _context.Shifts.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (activeShift == null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "SHIFT_REQUIRED",
                detail: "يجب فتح وردية نقدية نشطة أولاً لإجراء عملية الاسترداد.");
        }

        string? idempotencyKey = !string.IsNullOrWhiteSpace(headerIdempotencyKey)
            ? headerIdempotencyKey.Trim()
            : request.IdempotencyKey?.Trim();

        return await _bookingWriteLock.ExecuteAsync<ActionResult<RefundResponseDto>>(async () =>
        {
            var invoice = await _context.Invoices
                .Include(i => i.Transactions)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null)
                return NotFound("الفاتورة غير موجودة.");

            if (invoice.Status == InvoiceStatus.Voided)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVOICE_ALREADY_VOIDED",
                    detail: "لا يمكن استرداد مبالغ من فاتورة ملغاة.");
            }

            if (request.Version.HasValue && invoice.Version != request.Version.Value)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "تم تعديل بيانات الفاتورة من قبل مستخدم آخر.");
            }

            if (request.AmountPiastres <= 0)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVALID_REFUND_AMOUNT",
                    detail: "مبلغ الاسترداد يجب أن يكون أكبر من صفر.");
            }

            // Strict Invariant: TotalRefundedPiastres <= TotalPaidPiastres
            if (invoice.RefundedPiastres + request.AmountPiastres > invoice.PaidPiastres)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "REFUND_EXCEEDS_PAID_AMOUNT",
                    detail: "مبلغ الاسترداد المطلوب يتجاوز إجمالي المبلغ المدفوع للفاتورة.");
            }

            var shift = await _context.Shifts.FirstOrDefaultAsync(s => s.Id == activeShift.Id && !s.IsClosed);
            if (shift == null)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "SHIFT_REQUIRED",
                    detail: "الوردية النقدية مغلقة.");
            }

            // Update Invoice
            invoice.RefundedPiastres += request.AmountPiastres;
            invoice.UpdatedAtUtc = DateTime.UtcNow;

            // Create Transaction
            var transaction = new FinancialTransaction
            {
                ShiftId = shift.Id,
                InvoiceId = invoice.Id,
                Type = TransactionType.Refund,
                PaymentMethod = request.PaymentMethod,
                AmountPiastres = request.AmountPiastres,
                ReferenceNumber = request.ReferenceNumber,
                Description = $"استرداد للفاتورة #{invoice.Id}: {request.Reason.Trim()}",
                CreatedByUserId = userId,
                CreatedAtUtc = DateTime.UtcNow,
                IdempotencyKey = idempotencyKey
            };
            _context.FinancialTransactions.Add(transaction);

            // Update shift drawer if cash
            if (request.PaymentMethod == PaymentMethod.Cash)
            {
                shift.ExpectedClosingCashPiastres -= request.AmountPiastres;
            }

            // Audit Log
            _context.AuditLogs.Add(new AuditLog
            {
                ActorUserId = userId,
                Action = "Refund",
                EntityName = nameof(Invoice),
                EntityId = invoice.Id.ToString(),
                DiffJson = JsonSerializer.Serialize(new
                {
                    InvoiceId = invoice.Id,
                    RefundAmountPiastres = request.AmountPiastres,
                    TotalRefundedPiastres = invoice.RefundedPiastres,
                    TotalPaidPiastres = invoice.PaidPiastres,
                    Reason = request.Reason.Trim(),
                    PaymentMethod = request.PaymentMethod.ToString(),
                    RefundedAtUtc = DateTime.UtcNow
                }),
                CreatedAtUtc = DateTime.UtcNow
            });

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "حدث تعارض أثناء تسجيل الاسترداد.");
            }

            return Ok(new RefundResponseDto
            {
                InvoiceId = invoice.Id,
                TransactionId = transaction.Id,
                RefundedAmountPiastres = request.AmountPiastres,
                TotalRefundedPiastres = invoice.RefundedPiastres,
                TotalPaidPiastres = invoice.PaidPiastres,
                NetCollectedPiastres = invoice.PaidPiastres - invoice.RefundedPiastres,
                RemainingPiastres = invoice.RemainingPiastres,
                Status = invoice.Status,
                PaymentMethod = transaction.PaymentMethod,
                ExpectedClosingCashPiastres = shift.ExpectedClosingCashPiastres,
                InvoiceVersion = invoice.Version,
                CreatedAtUtc = transaction.CreatedAtUtc
            });
        });
    }

    // POST /api/invoices/{id}/void
    [HttpPost("{id:int}/void")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<ActionResult<VoidInvoiceResponseDto>> VoidInvoice(
        int id,
        [FromBody] VoidInvoiceRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "VOID_REASON_REQUIRED",
                detail: "سبب إلغاء الفاتورة إلزامي.");
        }

        int userId = GetCurrentUserId();

        // 1. Shift Guard
        var activeShift = await _context.Shifts.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (activeShift == null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "SHIFT_REQUIRED",
                detail: "يجب فتح وردية نقدية نشطة أولاً لإلغاء الفاتورة وتسجيل القيود العكسية.");
        }

        return await _bookingWriteLock.ExecuteAsync<ActionResult<VoidInvoiceResponseDto>>(async () =>
        {
            var invoice = await _context.Invoices
                .Include(i => i.Transactions)
                .Include(i => i.Appointment)
                .FirstOrDefaultAsync(i => i.Id == id);

            if (invoice == null)
                return NotFound("الفاتورة غير موجودة.");

            if (invoice.Status == InvoiceStatus.Voided)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "INVOICE_ALREADY_VOIDED",
                    detail: "الفاتورة ملغاة بالفعل.");
            }

            if (request.Version.HasValue && invoice.Version != request.Version.Value)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "تم تعديل بيانات الفاتورة من قبل مستخدم آخر.");
            }

            var shift = await _context.Shifts.FirstOrDefaultAsync(s => s.Id == activeShift.Id && !s.IsClosed);
            if (shift == null)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "SHIFT_REQUIRED",
                    detail: "الوردية النقدية مغلقة.");
            }

            // Calculate Net Collections per payment method that need reversal
            long cashPaid = invoice.Transactions
                .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == PaymentMethod.Cash)
                .Sum(t => t.AmountPiastres);
            long cashRefunded = invoice.Transactions
                .Where(t => t.Type == TransactionType.Refund && t.PaymentMethod == PaymentMethod.Cash)
                .Sum(t => t.AmountPiastres);
            long netCashCollected = Math.Max(0L, cashPaid - cashRefunded);

            List<int> reversalTransactionIds = new();

            // Reverse Cash if any net cash was collected
            if (netCashCollected > 0)
            {
                shift.ExpectedClosingCashPiastres -= netCashCollected;

                var cashReversal = new FinancialTransaction
                {
                    ShiftId = shift.Id,
                    InvoiceId = invoice.Id,
                    Type = TransactionType.VoidReversal,
                    PaymentMethod = PaymentMethod.Cash,
                    AmountPiastres = netCashCollected,
                    Description = $"قيد عكسي نقدي لإلغاء الفاتورة #{invoice.Id}: {request.Reason.Trim()}",
                    CreatedByUserId = userId,
                    CreatedAtUtc = DateTime.UtcNow
                };
                _context.FinancialTransactions.Add(cashReversal);
            }

            // Reverse Digital Payment methods if any net digital amount was collected
            foreach (var method in new[] { PaymentMethod.Instapay, PaymentMethod.VodafoneCash, PaymentMethod.Card })
            {
                long digitalPaid = invoice.Transactions
                    .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == method)
                    .Sum(t => t.AmountPiastres);
                long digitalRefunded = invoice.Transactions
                    .Where(t => t.Type == TransactionType.Refund && t.PaymentMethod == method)
                    .Sum(t => t.AmountPiastres);
                long netDigital = Math.Max(0L, digitalPaid - digitalRefunded);

                if (netDigital > 0)
                {
                    var digitalReversal = new FinancialTransaction
                    {
                        ShiftId = shift.Id,
                        InvoiceId = invoice.Id,
                        Type = TransactionType.VoidReversal,
                        PaymentMethod = method,
                        AmountPiastres = netDigital,
                        Description = $"قيد عكسي إلكتروني ({method}) لإلغاء الفاتورة #{invoice.Id}: {request.Reason.Trim()}",
                        CreatedByUserId = userId,
                        CreatedAtUtc = DateTime.UtcNow
                    };
                    _context.FinancialTransactions.Add(digitalReversal);
                }
            }

            // Update Invoice state
            invoice.Status = InvoiceStatus.Voided;
            invoice.RemainingPiastres = 0L;
            invoice.UpdatedAtUtc = DateTime.UtcNow;

            // Audit Log
            _context.AuditLogs.Add(new AuditLog
            {
                ActorUserId = userId,
                Action = "Void",
                EntityName = nameof(Invoice),
                EntityId = invoice.Id.ToString(),
                DiffJson = JsonSerializer.Serialize(new
                {
                    InvoiceId = invoice.Id,
                    TotalPiastres = invoice.TotalPiastres,
                    PaidPiastres = invoice.PaidPiastres,
                    RefundedPiastres = invoice.RefundedPiastres,
                    CashReversedPiastres = netCashCollected,
                    Reason = request.Reason.Trim(),
                    VoidedAtUtc = DateTime.UtcNow
                }),
                CreatedAtUtc = DateTime.UtcNow
            });

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "حدث تعارض أثناء إلغاء الفاتورة.");
            }

            return Ok(new VoidInvoiceResponseDto
            {
                InvoiceId = invoice.Id,
                Status = invoice.Status,
                TotalPiastres = invoice.TotalPiastres,
                PaidPiastres = invoice.PaidPiastres,
                RefundedPiastres = invoice.RefundedPiastres,
                CashReversedPiastres = netCashCollected,
                ExpectedClosingCashPiastres = shift.ExpectedClosingCashPiastres,
                InvoiceVersion = invoice.Version,
                VoidedAtUtc = DateTime.UtcNow
            });
        });
    }

    // GET /api/invoices/transactions (and /api/treasury/transactions)
    [HttpGet("transactions")]
    [Route("/api/treasury/transactions")]
    public async Task<ActionResult<TreasuryLedgerReportDto>> GetTransactionLedger(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int? shiftId,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] TransactionType? type,
        [FromQuery] int? userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.FinancialTransactions.AsNoTracking()
            .Include(t => t.CreatedByUser)
            .Include(t => t.Invoice).ThenInclude(i => i!.Patient)
            .AsQueryable();

        if (startDate.HasValue) query = query.Where(t => t.CreatedAtUtc >= startDate.Value);
        if (endDate.HasValue) query = query.Where(t => t.CreatedAtUtc <= endDate.Value);
        if (shiftId.HasValue) query = query.Where(t => t.ShiftId == shiftId.Value);
        if (paymentMethod.HasValue) query = query.Where(t => t.PaymentMethod == paymentMethod.Value);
        if (type.HasValue) query = query.Where(t => t.Type == type.Value);
        if (userId.HasValue) query = query.Where(t => t.CreatedByUserId == userId.Value);

        var allMatching = await query.ToListAsync();

        long cashIn = allMatching.Where(t => t.PaymentMethod == PaymentMethod.Cash && t.Type == TransactionType.Payment).Sum(t => t.AmountPiastres);
        long instapay = allMatching.Where(t => t.PaymentMethod == PaymentMethod.Instapay && t.Type == TransactionType.Payment).Sum(t => t.AmountPiastres);
        long vodafone = allMatching.Where(t => t.PaymentMethod == PaymentMethod.VodafoneCash && t.Type == TransactionType.Payment).Sum(t => t.AmountPiastres);
        long card = allMatching.Where(t => t.PaymentMethod == PaymentMethod.Card && t.Type == TransactionType.Payment).Sum(t => t.AmountPiastres);
        long refunds = allMatching.Where(t => t.Type == TransactionType.Refund).Sum(t => t.AmountPiastres);
        long expenses = allMatching.Where(t => t.Type == TransactionType.Expense).Sum(t => t.AmountPiastres);
        long voidReversals = allMatching.Where(t => t.Type == TransactionType.VoidReversal).Sum(t => t.AmountPiastres);

        long cashOut = allMatching.Where(t => t.PaymentMethod == PaymentMethod.Cash && 
            (t.Type == TransactionType.Refund || t.Type == TransactionType.Expense || t.Type == TransactionType.VoidReversal))
            .Sum(t => t.AmountPiastres);

        var pagedItems = allMatching
            .OrderByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TreasuryTransactionDto
            {
                Id = t.Id,
                ShiftId = t.ShiftId,
                InvoiceId = t.InvoiceId,
                PatientName = t.Invoice?.Patient?.FullName,
                Type = t.Type,
                PaymentMethod = t.PaymentMethod,
                AmountPiastres = t.AmountPiastres,
                ExpenseCategory = t.ExpenseCategory,
                ReferenceNumber = t.ReferenceNumber,
                Description = t.Description,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByUserName = t.CreatedByUser?.FullName ?? string.Empty,
                CreatedAtUtc = t.CreatedAtUtc,
                IdempotencyKey = t.IdempotencyKey
            })
            .ToList();

        return Ok(new TreasuryLedgerReportDto
        {
            TotalCashPaymentsPiastres = cashIn,
            TotalInstapayPaymentsPiastres = instapay,
            TotalVodafoneCashPaymentsPiastres = vodafone,
            TotalCardPaymentsPiastres = card,
            TotalRefundsPiastres = refunds,
            TotalExpensesPiastres = expenses,
            TotalVoidReversalsPiastres = voidReversals,
            NetGrossRevenuePiastres = (cashIn + instapay + vodafone + card) - refunds - voidReversals,
            NetPhysicalCashInDrawerPiastres = cashIn - cashOut,
            TotalCount = allMatching.Count,
            Transactions = pagedItems
        });
    }

    private static InvoiceListDto MapToListDto(Invoice i) => new()
    {
        Id = i.Id,
        AppointmentId = i.AppointmentId,
        PatientId = i.PatientId,
        PatientName = i.Patient.FullName,
        PatientPhone = i.Patient.Phone,
        DoctorName = i.Appointment?.Doctor?.FullName,
        TotalPiastres = i.TotalPiastres,
        DiscountPiastres = i.DiscountPiastres,
        DiscountReason = i.DiscountReason,
        NetTotalPiastres = i.NetTotalPiastres,
        PaidPiastres = i.PaidPiastres,
        RefundedPiastres = i.RefundedPiastres,
        RemainingPiastres = i.RemainingPiastres,
        Status = i.Status,
        LinesCount = i.Lines.Count,
        TransactionsCount = i.Transactions.Count,
        CreatedAtUtc = i.CreatedAtUtc,
        Version = i.Version
    };

    private static InvoiceDetailDto MapToDetailDto(Invoice i)
    {
        var listDto = MapToListDto(i);
        return new InvoiceDetailDto
        {
            Id = listDto.Id,
            AppointmentId = listDto.AppointmentId,
            PatientId = listDto.PatientId,
            PatientName = listDto.PatientName,
            PatientPhone = listDto.PatientPhone,
            DoctorName = listDto.DoctorName,
            TotalPiastres = listDto.TotalPiastres,
            DiscountPiastres = listDto.DiscountPiastres,
            DiscountReason = listDto.DiscountReason,
            NetTotalPiastres = listDto.NetTotalPiastres,
            PaidPiastres = listDto.PaidPiastres,
            RefundedPiastres = listDto.RefundedPiastres,
            RemainingPiastres = listDto.RemainingPiastres,
            Status = listDto.Status,
            LinesCount = listDto.LinesCount,
            TransactionsCount = listDto.TransactionsCount,
            CreatedAtUtc = listDto.CreatedAtUtc,
            Version = listDto.Version,
            ApprovedByUserName = i.ApprovedByUser?.FullName,
            Lines = i.Lines.Select(l => new InvoiceLineDto
            {
                Id = l.Id,
                ServiceId = l.ServiceId,
                Description = l.Description,
                Quantity = l.Quantity,
                UnitPricePiastres = l.UnitPricePiastres,
                TotalPricePiastres = l.TotalPricePiastres
            }).ToList(),
            Transactions = i.Transactions.OrderByDescending(t => t.Id).Select(t => new TreasuryTransactionDto
            {
                Id = t.Id,
                ShiftId = t.ShiftId,
                InvoiceId = t.InvoiceId,
                Type = t.Type,
                PaymentMethod = t.PaymentMethod,
                AmountPiastres = t.AmountPiastres,
                ExpenseCategory = t.ExpenseCategory,
                ReferenceNumber = t.ReferenceNumber,
                Description = t.Description,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByUserName = t.CreatedByUser?.FullName ?? string.Empty,
                CreatedAtUtc = t.CreatedAtUtc,
                IdempotencyKey = t.IdempotencyKey
            }).ToList()
        };
    }
}
