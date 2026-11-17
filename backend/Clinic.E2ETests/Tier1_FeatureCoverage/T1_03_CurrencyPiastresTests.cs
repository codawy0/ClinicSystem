using Clinic.Api.Data;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F03")]
public class T1_03_CurrencyPiastresTests : E2ETestBase
{
    public T1_03_CurrencyPiastresTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F03_01_ServiceCatalog_DefaultPricesStoredInPiastres()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var catalog = await context.ServiceCatalogs.ToListAsync();
        catalog.Should().Contain(c => c.NameAr.Contains("كشف") && c.DefaultPricePiastres == 30000L); // 300 EGP
    }

    [Fact]
    public async Task T1_F03_02_InvoiceLine_ExactMultiplication()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // Book appointment with exam (30000 Piastres) + SONAR procedure (ID 4: 20000 Piastres)
        var booking = new BookAppointmentRequest
        {
            PatientId = pat.Data!.Id,
            DoctorUserId = 2,
            ServiceId = 1,
            BookingType = "WalkIn",
            PaymentMethod = "Cash",
            ProcedureIds = new List<int> { 4 }
        };
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", booking);
        apt.EnsureSuccess();

        // Total: 30000 + 20000 = 50000 Piastres (500 EGP)
        apt.Data!.NetTotalPiastres.Should().Be(50000L);

        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var inv = await context.Invoices.Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == apt.Data.InvoiceId);
        inv.Should().NotBeNull();
        inv!.TotalPiastres.Should().Be(50000L);
        inv.Lines.Should().HaveCount(2);
    }

    [Fact]
    public async Task T1_F03_03_Invoice_NetTotalWithDiscount()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var booking = TestDataBuilder.BuildBooking(pat.Data!.Id, discountPiastres: 5000L, discountReason: "Colleague");
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", booking);
        apt.EnsureSuccess();

        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var inv = await context.Invoices.FirstOrDefaultAsync(i => i.Id == apt.Data!.InvoiceId);
        inv.Should().NotBeNull();
        inv!.TotalPiastres.Should().Be(30000L);
        inv.DiscountPiastres.Should().Be(5000L);
        inv.NetTotalPiastres.Should().Be(25000L);
    }

    [Fact]
    public async Task T1_F03_04_Shift_CashDrawerMathExactness()
    {
        // Ensure shift is open for receptionist (user 4)
        await EnsureShiftOpenAsync(4, 50000L);
        var curBefore = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        curBefore.EnsureSuccess();
        var baseCash = curBefore.Data!.Shift!.ExpectedClosingCashPiastres;

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, paymentMethod: "Cash"));
        apt.EnsureSuccess();

        var exp = await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/expense", new RecordExpenseRequest(10000L, "Supplies", "Paper"));
        exp.EnsureSuccess();

        var curAfter = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        curAfter.EnsureSuccess();
        // + 30000 cash appointment - 10000 expense = + 20000 Piastres net
        curAfter.Data!.Shift!.ExpectedClosingCashPiastres.Should().Be(baseCash + 30000L - 10000L);
    }

    [Fact]
    public async Task T1_F03_05_FractionalPiastres_SumPrecision()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var beforeShift = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        beforeShift.EnsureSuccess();
        var initialCash = beforeShift.Data!.Shift!.ExpectedClosingCashPiastres;

        // Record 10 sequential petty cash expenses of 50 Piastres (0.50 EGP) each
        for (int i = 0; i < 10; i++)
        {
            var expRes = await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/expense", 
                new RecordExpenseRequest(50L, "Stationery", $"Fractional precision expense {i}"));
            expRes.EnsureSuccess();
        }

        var afterShift = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        afterShift.EnsureSuccess();

        // 10 * 50 = 500 Piastres (5.00 EGP) exact integer subtraction with zero floating-point drift
        afterShift.Data!.Shift!.ExpectedClosingCashPiastres.Should().Be(initialCash - 500L);
    }
}
