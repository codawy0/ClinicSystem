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
using Clinic.Api.Models.Analytics;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class DoctorAnalyticsTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private IBusinessDateService _businessDateService = null!;

    private User _doctorA = null!;
    private User _doctorB = null!;
    private User _admin = null!;
    private Patient _patient1 = null!;
    private Patient _patient2 = null!;
    private ServiceCatalog _service = null!;
    private Shift _shift = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_analytics_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _businessDateService = new BusinessDateService();

        _doctorA = new User { Username = "doc_a", PasswordHash = "h", FullName = "د. كريم المصري", Role = UserRole.Doctor };
        _doctorB = new User { Username = "doc_b", PasswordHash = "h", FullName = "د. حازم علام", Role = UserRole.Doctor };
        _admin = new User { Username = "admin_analytic", PasswordHash = "h", FullName = "مدير العيادة", Role = UserRole.Admin };

        _patient1 = new Patient { FileNumber = "F-AN-1001", FullName = "طارق حامد", Phone = "01011112222", Gender = PatientGender.Male };
        _patient2 = new Patient { FileNumber = "F-AN-1002", FullName = "رنا مصطفى", Phone = "01122223333", Gender = PatientGender.Female };

        _service = new ServiceCatalog
        {
            Code = "EXAM_AN",
            NameAr = "كشف عام",
            Category = ServiceCategory.Exam,
            DefaultPricePiastres = 25_000L
        };

        context.Users.AddRange(_doctorA, _doctorB, _admin);
        context.Patients.AddRange(_patient1, _patient2);
        context.ServiceCatalogs.Add(_service);
        await context.SaveChangesAsync();

        _shift = new Shift
        {
            UserId = _admin.Id,
            BusinessDate = DateOnly.FromDateTime(DateTime.UtcNow),
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(_shift);
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

    private AnalyticsController CreateController(ClinicDbContext context, User user)
    {
        var controller = new AnalyticsController(
            context,
            _businessDateService,
            NullLogger<AnalyticsController>.Instance);

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

    [Fact]
    public async Task GetKpi_ShouldCalculateGrossNetDiscountsAccurately()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        // Invoice 1: 50,000 Piastres, discount 5,000 -> Net 45,000
        var inv1 = new Invoice
        {
            PatientId = _patient1.Id,
            TotalPiastres = 50_000L,
            DiscountPiastres = 5_000L,
            DiscountReason = DiscountReason.Charity,
            NetTotalPiastres = 45_000L,
            PaidPiastres = 45_000L,
            Status = InvoiceStatus.Paid,
            CreatedAtUtc = now
        };

        // Invoice 2: 30,000 Piastres, discount 0 -> Net 30,000
        var inv2 = new Invoice
        {
            PatientId = _patient2.Id,
            TotalPiastres = 30_000L,
            DiscountPiastres = 0L,
            NetTotalPiastres = 30_000L,
            PaidPiastres = 30_000L,
            Status = InvoiceStatus.Paid,
            CreatedAtUtc = now
        };

        context.Invoices.AddRange(inv1, inv2);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        kpi.GrossRevenuePiastres.Should().Be(80_000L);
        kpi.ForegoneDiscountsPiastres.Should().Be(5_000L);
        kpi.NetBilledRevenuePiastres.Should().Be(75_000L);
        kpi.DiscountReasons.Should().ContainSingle(d => d.Reason == DiscountReason.Charity && d.TotalPiastres == 5_000L);
    }

    [Fact]
    public async Task GetKpi_ShouldBreakdownCollectedRevenueByPaymentMethod()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        context.FinancialTransactions.AddRange(
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 40_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now },
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Instapay, AmountPiastres = 15_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now },
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.VodafoneCash, AmountPiastres = 10_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now },
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Card, AmountPiastres = 10_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        kpi.CashCollectedPiastres.Should().Be(40_000L);
        kpi.InstapayCollectedPiastres.Should().Be(15_000L);
        kpi.VodafoneCashCollectedPiastres.Should().Be(10_000L);
        kpi.CardCollectedPiastres.Should().Be(10_000L);
        kpi.TotalDigitalCollectedPiastres.Should().Be(35_000L);
        kpi.TotalCollectedRevenuePiastres.Should().Be(75_000L);
    }

    [Fact]
    public async Task GetKpi_ShouldDeductRefundsAndPettyCashExpenses()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        var inv = new Invoice
        {
            PatientId = _patient1.Id,
            TotalPiastres = 60_000L,
            NetTotalPiastres = 60_000L,
            PaidPiastres = 60_000L,
            Status = InvoiceStatus.Paid,
            CreatedAtUtc = now
        };
        context.Invoices.Add(inv);

        context.FinancialTransactions.AddRange(
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Payment, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 60_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now },
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Refund, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 10_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now },
            new FinancialTransaction { ShiftId = _shift.Id, Type = TransactionType.Expense, PaymentMethod = PaymentMethod.Cash, AmountPiastres = 5_000L, CreatedByUserId = _admin.Id, CreatedAtUtc = now }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        kpi.TotalCollectedRevenuePiastres.Should().Be(60_000L);
        kpi.TotalRefundedPiastres.Should().Be(10_000L);
        kpi.PettyCashExpensesPiastres.Should().Be(5_000L);

        // Net Cash Flow: 60,000 - 10,000 - 5,000 = 45,000
        kpi.NetCashFlowPiastres.Should().Be(45_000L);

        // Net Accrual Profit: 60,000 net billed - 10,000 refund - 5,000 expense = 45,000
        kpi.NetAccrualProfitPiastres.Should().Be(45_000L);
    }

    [Fact]
    public async Task GetKpi_ShouldIgnoreVoidedInvoices()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        context.Invoices.AddRange(
            new Invoice { PatientId = _patient1.Id, TotalPiastres = 50_000L, NetTotalPiastres = 50_000L, Status = InvoiceStatus.Paid, CreatedAtUtc = now },
            new Invoice { PatientId = _patient2.Id, TotalPiastres = 40_000L, NetTotalPiastres = 40_000L, Status = InvoiceStatus.Voided, CreatedAtUtc = now }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        // Voided invoice (40,000) must be completely excluded
        kpi.GrossRevenuePiastres.Should().Be(50_000L);
        kpi.NetBilledRevenuePiastres.Should().Be(50_000L);
    }

    [Fact]
    public async Task GetKpi_ShouldCalculateAverageConsultationDurationAndWaitTime()
    {
        await using var context = CreateDbContext();
        var baseTime = DateTime.UtcNow.Date.AddHours(10); // 10:00 AM UTC

        // Appointment 1: Wait 10 minutes (Arrived 10:00, Called 10:10)
        var appt1 = new Appointment
        {
            DoctorUserId = _doctorA.Id,
            PatientId = _patient1.Id,
            ServiceId = _service.Id,
            BusinessDate = DateOnly.FromDateTime(baseTime),
            Status = AppointmentStatus.Completed,
            CreatedAtUtc = baseTime,
            ArrivedAtUtc = baseTime,
            CalledAtUtc = baseTime.AddMinutes(10),
            CompletedAtUtc = baseTime.AddMinutes(25)
        };

        // Appointment 2: Wait 30 minutes (Arrived 10:10, Called 10:40)
        var appt2 = new Appointment
        {
            DoctorUserId = _doctorA.Id,
            PatientId = _patient2.Id,
            ServiceId = _service.Id,
            BusinessDate = DateOnly.FromDateTime(baseTime),
            Status = AppointmentStatus.Completed,
            CreatedAtUtc = baseTime.AddMinutes(10),
            ArrivedAtUtc = baseTime.AddMinutes(10),
            CalledAtUtc = baseTime.AddMinutes(40),
            CompletedAtUtc = baseTime.AddMinutes(65)
        };

        context.Appointments.AddRange(appt1, appt2);
        await context.SaveChangesAsync();

        // Visit 1: 15 minutes (10:00 -> 10:15)
        var visit1 = new MedicalVisit
        {
            AppointmentId = appt1.Id,
            PatientId = _patient1.Id,
            DoctorUserId = _doctorA.Id,
            IsDraft = false,
            CreatedAtUtc = baseTime,
            CompletedAtUtc = baseTime.AddMinutes(15)
        };

        // Visit 2: 25 minutes (10:30 -> 10:55)
        var visit2 = new MedicalVisit
        {
            AppointmentId = appt2.Id,
            PatientId = _patient2.Id,
            DoctorUserId = _doctorA.Id,
            IsDraft = false,
            CreatedAtUtc = baseTime.AddMinutes(30),
            CompletedAtUtc = baseTime.AddMinutes(55)
        };

        context.MedicalVisits.AddRange(visit1, visit2);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(baseTime.AddHours(-1), baseTime.AddHours(5), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        // Average duration: (15 + 25) / 2 = 20.0 minutes
        kpi.AverageConsultationDurationMinutes.Should().Be(20.0);

        // Average wait time: (10 + 30) / 2 = 20.0 minutes
        kpi.AverageWaitTimeMinutes.Should().Be(20.0);

        kpi.TotalAppointments.Should().Be(2);
        kpi.UniquePatients.Should().Be(2);
        kpi.CompletedVisits.Should().Be(2);
    }

    [Fact]
    public async Task GetKpi_DoctorRole_ShouldEnforceDoctorUserIdScoping()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        var controller = CreateController(context, _doctorA);

        // Doctor A querying with Doctor B's ID must be rejected with 403 Forbidden
        var forbiddenResponse = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), _doctorB.Id);
        var problem = forbiddenResponse.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        // Doctor A querying with no doctorId should automatically scope to Doctor A
        var okResponse = await controller.GetKpi(now.AddDays(-1), now.AddDays(1), null);
        var okResult = okResponse.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;
        kpi.DoctorId.Should().Be(_doctorA.Id);
        kpi.DoctorName.Should().Be(_doctorA.FullName);
    }

    [Fact]
    public async Task GetKpi_EmptyDateRange_ShouldReturnZerosSafely()
    {
        await using var context = CreateDbContext();
        var future = DateTime.UtcNow.AddYears(10);

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(future, future.AddDays(1), null);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var kpi = okResult.Value.Should().BeOfType<DoctorKpiResponseDto>().Subject;

        kpi.GrossRevenuePiastres.Should().Be(0L);
        kpi.NetBilledRevenuePiastres.Should().Be(0L);
        kpi.TotalCollectedRevenuePiastres.Should().Be(0L);
        kpi.TotalAppointments.Should().Be(0);
        kpi.AverageConsultationDurationMinutes.Should().Be(0.0);
        kpi.AverageWaitTimeMinutes.Should().Be(0.0);
    }

    [Fact]
    public async Task GetKpi_InvalidDateRange_StartDateAfterEndDate_MustReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var now = DateTime.UtcNow;

        var controller = CreateController(context, _admin);
        var response = await controller.GetKpi(now.AddDays(5), now.AddDays(1), null);

        response.Result.Should().BeOfType<BadRequestObjectResult>();
    }
}
