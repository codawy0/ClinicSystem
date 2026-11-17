using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_15_PartialRefundAndCashDrawerSyncTests : E2ETestBase
{
    public T3_15_PartialRefundAndCashDrawerSyncTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task PartialRefund_DecrementsDrawerExpectedCash_AndRejectsInvalidRefunds()
    {
        await EnsureShiftOpenAsync(3, 100000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // 1. Negative: refund exceeds paid -> 400
        var overRefund = await Api.AsReceptionist(3).PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/refund", new RefundInvoiceRequest(shiftId, 60000L, "Too much"));
        overRefund.ShouldBeBadRequest();

        // 2. Negative: missing mandatory reason -> 400
        var emptyReason = await Api.AsReceptionist(3).PostAsync<object>($"/api/invoices/{apt.Data.InvoiceId}/refund", new RefundInvoiceRequest(shiftId, 10000L, ""));
        emptyReason.ShouldBeBadRequest();

        // 3. Positive partial refund of 10000
        var beforeShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var refund = await Api.AsReceptionist(3).PostAsync<object>($"/api/invoices/{apt.Data.InvoiceId}/refund", new RefundInvoiceRequest(shiftId, 10000L, "Cancelled extra test"));
        refund.EnsureSuccess();

        // 4. Drawer check: expected cash decremented by 10000
        var afterShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        afterShift.Data!.ExpectedClosingCashPiastres.Should().Be(beforeShift.Data!.ExpectedClosingCashPiastres - 10000L);
    }
}
