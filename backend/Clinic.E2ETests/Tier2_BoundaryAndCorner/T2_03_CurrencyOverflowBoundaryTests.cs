using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F03")]
public class T2_03_CurrencyOverflowBoundaryTests : E2ETestBase
{
    public T2_03_CurrencyOverflowBoundaryTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F03_01_NegativeExpenseAmount_Rejected()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var res = await Api.AsReceptionist(4).PostAsync<object>(
            "/api/shifts/expense", 
            new RecordExpenseRequest(-5000L, "Supplies", "Invalid negative expense"));
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F03_02_ZeroExpenseAmount_Rejected()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var res = await Api.AsReceptionist(4).PostAsync<object>(
            "/api/shifts/expense", 
            new RecordExpenseRequest(0L, "Supplies", "Invalid zero expense"));
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F03_03_DiscountExceedingInvoiceTotal_Clamped()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // Discount exceeding total (35000 on 30000 total) is clamped to totalPiastres so NetTotal is never negative
        var res = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>(
            "/api/appointments", 
            TestDataBuilder.BuildBooking(pat.Data!.Id, discountPiastres: 35000L));
        res.EnsureSuccess();
        res.Data!.NetTotalPiastres.Should().Be(0L);
        res.Data.DiscountPiastres.Should().BeLessThanOrEqualTo(30000L);
    }

    [Fact]
    public async Task T2_F03_04_NegativeDiscount_Rejected()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // Negative discount must be rejected with 400 Bad Request via [Range(0, long.MaxValue)]
        var res = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>(
            "/api/appointments", 
            TestDataBuilder.BuildBooking(pat.Data!.Id, discountPiastres: -5000L));
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F03_05_LargeFinancialValue_64BitIntegrity()
    {
        // Close prior shift if open
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        if (cur.IsSuccessStatusCode && cur.Data?.HasActiveShift == true && cur.Data.Shift != null)
        {
            await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", 
                new CloseShiftRequest(cur.Data.Shift.ExpectedClosingCashPiastres, "Reset", cur.Data.Shift.Version));
        }

        // 10 billion Piastres = 100,000,000 EGP (exceeds 32-bit signed int max of 2,147,483,647)
        long largeValue = 10_000_000_000L;
        var openRes = await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(largeValue));
        openRes.EnsureSuccess();

        var curRes = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        curRes.EnsureSuccess();
        curRes.Data!.Shift!.OpeningBalancePiastres.Should().Be(
            largeValue, 
            "Financial fields must be stored as 64-bit integer Piastres in SQLite and EF Core without 32-bit truncation");

        // Clean up: close shift and restore standard balance
        await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", 
            new CloseShiftRequest(largeValue, "Clean", curRes.Data.Shift.Version));
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    // --- Staged Tests for Phase 4 (Treasury & Financial Ledger) ---

    [Fact]
    [Trait("Stage", "3")]
    [Trait("Phase", "4")]
    [Trait("Feature", "F15")]
    public async Task T2_F03_P4_01_ZeroPaymentAmount_Rejected()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var res = await Api.AsReceptionist(4).PostAsync<object>(
            $"/api/invoices/{apt.Data!.InvoiceId}/pay", 
            new PayInvoiceRequest(cur.Data!.Shift!.Id, 0L, "Cash"));
        res.ShouldBeBadRequest();
    }

    [Fact]
    [Trait("Stage", "3")]
    [Trait("Phase", "4")]
    [Trait("Feature", "F15")]
    public async Task T2_F03_P4_02_PaymentExceedingRemaining_Rejected()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Invoice is paid in full at booking (remaining = 0); attempting further payment must be rejected with 400 Bad Request
        var res = await Api.AsReceptionist(4).PostAsync<object>(
            $"/api/invoices/{apt.Data!.InvoiceId}/pay", 
            new PayInvoiceRequest(cur.Data!.Shift!.Id, 50000L, "Cash"));
        res.ShouldBeBadRequest();
    }
}
