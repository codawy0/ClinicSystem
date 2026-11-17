using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Invoices;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class TreasuryLedgerTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private IBookingWriteLock _bookingWriteLock = null!;

    private User _doctor = null!;
    private User _cashier = null!;
    private User _receptionist = null!;
    private Patient _patient = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_treasury_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _bookingWriteLock = new BookingWriteLock();

        _doctor = new User { Username = "doc_treasury", PasswordHash = "h", FullName = "د. تامر فؤاد", Role = UserRole.Doctor };
        _cashier = new User { Username = "cashier_treasury", PasswordHash = "h", FullName = "أحمد المحاسب", Role = UserRole.Admin };
        _receptionist = new User { Username = "rec_treasury", PasswordHash = "h", FullName = "نورهان موظفة", Role = UserRole.Receptionist };
        _patient = new Patient { FileNumber = "F-TR-1001", FullName = "محمد مصطفى", Phone = "01099887766", Gender = PatientGender.Male };

        context.Users.AddRange(_doctor, _cashier, _receptionist);
        context.Patients.Add(_patient);
        await context.SaveChangesAsync();
    }

    public Task DisposeAsync()
    {
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            var wal = $"{_dbFilePath}-wal";
            if (File.Exists(wal)) File.Delete(wal);
            var shm = $"{_dbFilePath}-shm";
            if (File.Exists(shm)) File.Delete(shm);
        }
        catch
        {
            // ignored
        }
        return Task.CompletedTask;
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private InvoicesController CreateController(ClinicDbContext context, User user)
    {
        var controller = new InvoicesController(
            context,
            _bookingWriteLock,
            NullLogger<InvoicesController>.Instance);

        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }

    private async Task<Shift> SeedOpenShiftAsync(ClinicDbContext context, User user, long openingBalance = 100_000L)
    {
        var shift = new Shift
        {
            UserId = user.Id,
            BusinessDate = DateOnly.FromDateTime(DateTime.UtcNow),
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = openingBalance,
            ExpectedClosingCashPiastres = openingBalance,
            IsClosed = false
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();
        return shift;
    }

    private async Task<Invoice> SeedInvoiceAsync(ClinicDbContext context, long totalPiastres, long paidPiastres = 0L, long refundedPiastres = 0L, InvoiceStatus status = InvoiceStatus.Unpaid)
    {
        var invoice = new Invoice
        {
            PatientId = _patient.Id,
            TotalPiastres = totalPiastres,
            DiscountPiastres = 0L,
            NetTotalPiastres = totalPiastres,
            PaidPiastres = paidPiastres,
            RefundedPiastres = refundedPiastres,
            RemainingPiastres = Math.Max(0L, totalPiastres - paidPiastres),
            Status = status,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Invoices.Add(invoice);
        await context.SaveChangesAsync();
        return invoice;
    }

    [Fact]
    public async Task PartialPayment_UnpaidToPartial_UpdatesBalanceAndRecordsTransaction()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _cashier, 50_000L);
        var invoice = await SeedInvoiceAsync(context, 50_000L); // 500 EGP

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 20_000L, // 200 EGP
            PaymentMethod = PaymentMethod.Cash
        }, null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PaymentResponseDto>().Subject;

        dto.Status.Should().Be(InvoiceStatus.Partial);
        dto.AmountPaidPiastres.Should().Be(20_000L);
        dto.TotalPaidPiastres.Should().Be(20_000L);
        dto.RemainingPiastres.Should().Be(30_000L);
        dto.ExpectedClosingCashPiastres.Should().Be(70_000L); // 50,000 + 20,000

        // Verify DB persistence
        await using var verifyContext = CreateDbContext();
        var savedInvoice = await verifyContext.Invoices.FindAsync(invoice.Id);
        savedInvoice!.Status.Should().Be(InvoiceStatus.Partial);
        savedInvoice.PaidPiastres.Should().Be(20_000L);
        savedInvoice.RemainingPiastres.Should().Be(30_000L);

        var savedShift = await verifyContext.Shifts.FindAsync(shift.Id);
        savedShift!.ExpectedClosingCashPiastres.Should().Be(70_000L);

        var tx = await verifyContext.FinancialTransactions.FirstOrDefaultAsync(t => t.InvoiceId == invoice.Id);
        tx.Should().NotBeNull();
        tx!.AmountPiastres.Should().Be(20_000L);
        tx.Type.Should().Be(TransactionType.Payment);
        tx.PaymentMethod.Should().Be(PaymentMethod.Cash);
    }

    [Fact]
    public async Task PartialPayment_PartialToPaid_CompletesInvoiceBalance()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _cashier, 70_000L);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 20_000L, status: InvoiceStatus.Partial);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 30_000L,
            PaymentMethod = PaymentMethod.Instapay
        }, null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PaymentResponseDto>().Subject;

        dto.Status.Should().Be(InvoiceStatus.Paid);
        dto.TotalPaidPiastres.Should().Be(50_000L);
        dto.RemainingPiastres.Should().Be(0L);
        // Instapay should NOT increase cash drawer
        dto.ExpectedClosingCashPiastres.Should().Be(70_000L);

        await using var verifyContext = CreateDbContext();
        var savedInvoice = await verifyContext.Invoices.FindAsync(invoice.Id);
        savedInvoice!.Status.Should().Be(InvoiceStatus.Paid);
        savedInvoice.RemainingPiastres.Should().Be(0L);
    }

    [Fact]
    public async Task PartialPayment_Overpayment_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 20_000L, status: InvoiceStatus.Partial);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 35_000L // 350 EGP > 300 EGP remaining
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("OVERPAYMENT_NOT_ALLOWED");
    }

    [Fact]
    public async Task PartialPayment_ZeroOrNegativeAmount_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 0L
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
    }

    [Fact]
    public async Task PartialPayment_OnVoidedInvoice_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L, status: InvoiceStatus.Voided);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 10_000L
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("INVOICE_ALREADY_VOIDED");
    }

    [Fact]
    public async Task PartialPayment_WithoutActiveShift_MustBeRejectedWithShiftRequired()
    {
        await using var context = CreateDbContext();
        // Do NOT seed shift for cashier
        var invoice = await SeedInvoiceAsync(context, 50_000L);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 10_000L
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("SHIFT_REQUIRED");
    }

    [Fact]
    public async Task PartialPayment_WithIdempotencyKey_DuplicateRequestReturnsExistingTx()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier, 100_000L);
        var invoice = await SeedInvoiceAsync(context, 50_000L);

        var controller = CreateController(context, _cashier);
        string idemKey = "IDEM-PAY-TEST-001";

        // First attempt
        var response1 = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 20_000L,
            PaymentMethod = PaymentMethod.Cash,
            IdempotencyKey = idemKey
        }, null);

        var dto1 = response1.Result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<PaymentResponseDto>().Subject;

        // Duplicate replay attempt
        var response2 = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 20_000L,
            PaymentMethod = PaymentMethod.Cash,
            IdempotencyKey = idemKey
        }, null);

        var dto2 = response2.Result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<PaymentResponseDto>().Subject;

        dto2.TransactionId.Should().Be(dto1.TransactionId);
        dto2.TotalPaidPiastres.Should().Be(20_000L);

        await using var verifyContext = CreateDbContext();
        var txCount = await verifyContext.FinancialTransactions.CountAsync(t => t.InvoiceId == invoice.Id);
        txCount.Should().Be(1, "Idempotent payment should not create duplicate transaction rows");
    }

    [Fact]
    public async Task PartialPayment_WithStaleVersion_MustReturn409Conflict()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L);
        invoice.Version = 3;
        await context.SaveChangesAsync();

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = 10_000L,
            Version = 2 // Stale version
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task Refund_ValidPartialRefund_UpdatesRefundedPiastresAndAdjustsShiftCash()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _cashier, 100_000L);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 30_000L, status: InvoiceStatus.Partial);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordRefund(invoice.Id, new RecordRefundRequestDto
        {
            AmountPiastres = 10_000L,
            PaymentMethod = PaymentMethod.Cash,
            Reason = "إلغاء إجراء بناء على طلب المريض"
        }, null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<RefundResponseDto>().Subject;

        dto.RefundedAmountPiastres.Should().Be(10_000L);
        dto.TotalRefundedPiastres.Should().Be(10_000L);
        dto.TotalPaidPiastres.Should().Be(30_000L);
        dto.NetCollectedPiastres.Should().Be(20_000L);
        dto.ExpectedClosingCashPiastres.Should().Be(90_000L); // 100,000 - 10,000

        await using var verifyContext = CreateDbContext();
        var savedInvoice = await verifyContext.Invoices.FindAsync(invoice.Id);
        savedInvoice!.RefundedPiastres.Should().Be(10_000L);

        var savedShift = await verifyContext.Shifts.FindAsync(shift.Id);
        savedShift!.ExpectedClosingCashPiastres.Should().Be(90_000L);

        var audit = await verifyContext.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == invoice.Id.ToString() && a.Action == "Refund");
        audit.Should().NotBeNull();
    }

    [Fact]
    public async Task Refund_InvariantViolation_ExceedingTotalPaid_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 30_000L, refundedPiastres: 10_000L, status: InvoiceStatus.Partial);

        var controller = CreateController(context, _cashier);
        // Remaining unrefunded is 20,000. Trying to refund 25,000 -> Total refund would be 35,000 > 30,000 paid
        var response = await controller.RecordRefund(invoice.Id, new RecordRefundRequestDto
        {
            AmountPiastres = 25_000L,
            Reason = "محاولة استرداد أكبر من المدفوع"
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("REFUND_EXCEEDS_PAID_AMOUNT");
    }

    [Fact]
    public async Task Refund_OnUnpaidInvoice_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 0L, status: InvoiceStatus.Unpaid);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordRefund(invoice.Id, new RecordRefundRequestDto
        {
            AmountPiastres = 5_000L,
            Reason = "استرداد غير صالح"
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("REFUND_EXCEEDS_PAID_AMOUNT");
    }

    [Fact]
    public async Task Refund_WithoutReason_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _cashier);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 20_000L, status: InvoiceStatus.Partial);

        var controller = CreateController(context, _cashier);
        var response = await controller.RecordRefund(invoice.Id, new RecordRefundRequestDto
        {
            AmountPiastres = 5_000L,
            Reason = "   " // Empty/whitespace reason
        }, null);

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("REFUND_REASON_REQUIRED");
    }

    [Fact]
    public async Task Void_ByDoctorOrAdmin_ReversesInvoiceAndShiftCashAndCreatesReversalTransaction()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _doctor, 100_000L);
        var invoice = await SeedInvoiceAsync(context, 40_000L, paidPiastres: 40_000L, status: InvoiceStatus.Paid);

        // Record initial payment transaction for this invoice
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            InvoiceId = invoice.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 40_000L,
            CreatedByUserId = _doctor.Id,
            CreatedAtUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);
        var response = await controller.VoidInvoice(invoice.Id, new VoidInvoiceRequestDto
        {
            Reason = "تم تسجيل الفاتورة بالخطأ"
        });

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<VoidInvoiceResponseDto>().Subject;

        dto.Status.Should().Be(InvoiceStatus.Voided);
        dto.CashReversedPiastres.Should().Be(40_000L);
        dto.ExpectedClosingCashPiastres.Should().Be(60_000L); // 100,000 - 40,000

        await using var verifyContext = CreateDbContext();
        var savedInvoice = await verifyContext.Invoices.FindAsync(invoice.Id);
        savedInvoice!.Status.Should().Be(InvoiceStatus.Voided);
        savedInvoice.RemainingPiastres.Should().Be(0L);

        var reversalTx = await verifyContext.FinancialTransactions
            .FirstOrDefaultAsync(t => t.InvoiceId == invoice.Id && t.Type == TransactionType.VoidReversal);
        reversalTx.Should().NotBeNull();
        reversalTx!.AmountPiastres.Should().Be(40_000L);

        var audit = await verifyContext.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityId == invoice.Id.ToString() && a.Action == "Void");
        audit.Should().NotBeNull();
    }

    [Fact]
    public async Task Void_InvoiceWithPriorRefund_OnlyReversesNetUnrefundedCash()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _doctor, 100_000L);
        var invoice = await SeedInvoiceAsync(context, 50_000L, paidPiastres: 50_000L, refundedPiastres: 10_000L, status: InvoiceStatus.Paid);

        // Initial payment: 50,000 Cash
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            InvoiceId = invoice.Id,
            Type = TransactionType.Payment,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 50_000L,
            CreatedByUserId = _doctor.Id,
            CreatedAtUtc = DateTime.UtcNow
        });

        // Prior refund: 10,000 Cash
        context.FinancialTransactions.Add(new FinancialTransaction
        {
            ShiftId = shift.Id,
            InvoiceId = invoice.Id,
            Type = TransactionType.Refund,
            PaymentMethod = PaymentMethod.Cash,
            AmountPiastres = 10_000L,
            CreatedByUserId = _doctor.Id,
            CreatedAtUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);
        var response = await controller.VoidInvoice(invoice.Id, new VoidInvoiceRequestDto
        {
            Reason = "إلغاء نهائي بعد استرداد جزئي"
        });

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<VoidInvoiceResponseDto>().Subject;

        // Net cash was 50,000 - 10,000 = 40,000. Only 40,000 should be reversed!
        dto.CashReversedPiastres.Should().Be(40_000L);
        dto.ExpectedClosingCashPiastres.Should().Be(60_000L); // 100,000 - 40,000
    }

    [Fact]
    public async Task Void_AlreadyVoidedInvoice_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _doctor);
        var invoice = await SeedInvoiceAsync(context, 50_000L, status: InvoiceStatus.Voided);

        var controller = CreateController(context, _doctor);
        var response = await controller.VoidInvoice(invoice.Id, new VoidInvoiceRequestDto
        {
            Reason = "محاولة إلغاء ثانية"
        });

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("INVOICE_ALREADY_VOIDED");
    }

    [Fact]
    public async Task Void_WithoutReason_MustBeRejectedWith400()
    {
        await using var context = CreateDbContext();
        await SeedOpenShiftAsync(context, _doctor);
        var invoice = await SeedInvoiceAsync(context, 50_000L, status: InvoiceStatus.Paid);

        var controller = CreateController(context, _doctor);
        var response = await controller.VoidInvoice(invoice.Id, new VoidInvoiceRequestDto
        {
            Reason = "   "
        });

        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var probDetails = problem.Value.Should().BeOfType<ProblemDetails>().Subject;
        probDetails.Title.Should().Be("VOID_REASON_REQUIRED");
    }

    [Fact]
    public async Task Piastres64BitOverflowPrevention_HandlesMassiveValuesSafely()
    {
        await using var context = CreateDbContext();
        // 50 Million EGP = 5,000,000,000 Piastres (exceeds int32 max: 2,147,483,647)
        long massiveTotal = 5_000_000_000L;
        long payment1 = 3_000_000_000L;
        long payment2 = 2_000_000_000L;

        var shift = await SeedOpenShiftAsync(context, _cashier, 10_000_000_000L);
        var invoice = await SeedInvoiceAsync(context, massiveTotal);

        var controller = CreateController(context, _cashier);
        var res1 = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = payment1,
            PaymentMethod = PaymentMethod.Card
        }, null);

        var dto1 = res1.Result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<PaymentResponseDto>().Subject;
        dto1.TotalPaidPiastres.Should().Be(payment1);
        dto1.RemainingPiastres.Should().Be(payment2);

        var res2 = await controller.RecordPayment(invoice.Id, new RecordPaymentRequestDto
        {
            AmountPiastres = payment2,
            PaymentMethod = PaymentMethod.Card
        }, null);

        var dto2 = res2.Result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<PaymentResponseDto>().Subject;
        dto2.Status.Should().Be(InvoiceStatus.Paid);
        dto2.TotalPaidPiastres.Should().Be(massiveTotal);
        dto2.RemainingPiastres.Should().Be(0L);
    }

    [Fact]
    public async Task TransactionLedger_FiltersAndComputesAccurateAggregates()
    {
        await using var context = CreateDbContext();
        var shift = await SeedOpenShiftAsync(context, _cashier, 50_000L);

        // Add diverse transactions
        context.FinancialTransactions.AddRange(
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 30_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Instapay, AmountPiastres = 20_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.VodafoneCash, AmountPiastres = 15_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Card, AmountPiastres = 25_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Refund, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 5_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.Expense, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 8_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow },
            new FinancialTransaction { ShiftId = shift.Id, Type = TransactionType.VoidReversal, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 4_000L, CreatedByUserId = _cashier.Id, CreatedAtUtc = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context, _cashier);
        var response = await controller.GetTransactionLedger(null, null, shift.Id, null, null, null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var report = okResult.Value.Should().BeOfType<TreasuryLedgerReportDto>().Subject;

        report.TotalCashPaymentsPiastres.Should().Be(30_000L);
        report.TotalInstapayPaymentsPiastres.Should().Be(20_000L);
        report.TotalVodafoneCashPaymentsPiastres.Should().Be(15_000L);
        report.TotalCardPaymentsPiastres.Should().Be(25_000L);
        report.TotalRefundsPiastres.Should().Be(5_000L);
        report.TotalExpensesPiastres.Should().Be(8_000L);
        report.TotalVoidReversalsPiastres.Should().Be(4_000L);

        // Gross: (30 + 20 + 15 + 25) - 5 (refund) - 4 (reversal) = 90 - 9 = 81,000
        report.NetGrossRevenuePiastres.Should().Be(81_000L);

        // Physical Cash: 30,000 in - (5,000 + 8,000 + 4,000) out = 13,000
        report.NetPhysicalCashInDrawerPiastres.Should().Be(13_000L);
    }
}
