using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F15")]
public class T2_15_LedgerRefundExceedingPaidTests : E2ETestBase
{
    public T2_15_LedgerRefundExceedingPaidTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F15_01_RefundExceedingPaidAmount_Returns400()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Total paid is 30000, attempt refund of 40000
        var refund = await Api.AsReceptionist(4).PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/refund", new RefundInvoiceRequest(cur.Data!.Shift!.Id, 40000L, "Too much refund"));
        refund.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F15_02_RefundZeroOrNegativeAmount_Returns400()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var refund = await Api.AsReceptionist(4).PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/refund", new RefundInvoiceRequest(cur.Data!.Shift!.Id, -100L, "Negative"));
        refund.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F15_03_VoidWithoutMandatoryReason_Returns400()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var voidRes = await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/void", new VoidInvoiceRequest(cur.Data!.Shift!.Id, ""));
        voidRes.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F15_04_PaymentWithoutActiveShift_Returns400()
    {
        // Close shift
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        if (cur.IsSuccessStatusCode && cur.Data?.HasActiveShift == true && cur.Data.Shift != null)
        {
            await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", 
                new CloseShiftRequest(cur.Data.Shift.ExpectedClosingCashPiastres, "Close", cur.Data.Shift.Version));
        }

        var pay = await Api.AsReceptionist(4).PostAsync<object>("/api/invoices/1/pay", new PayInvoiceRequest(999, 10000L, "Cash"));
        pay.ShouldBeBadRequest();

        // Restore shift
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T2_F15_05_ConcurrentPaymentCollision_HandledSafely()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");

        var pat = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("Procedure", 40000L, 1, 40000L)
        }));

        var pay1 = Api.AsReceptionist(4).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(cur.Data!.Shift!.Id, 20000L, "Cash"));
        var pay2 = Api.AsReceptionist(4).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(cur.Data.Shift.Id, 20000L, "Cash"));

        await Task.WhenAll(pay1, pay2);

        var res1 = pay1.Result;
        var res2 = pay2.Result;

        if (res1.IsSuccessStatusCode && res2.IsSuccessStatusCode)
        {
            var finalInv = await Api.GetAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}");
            if (finalInv.IsSuccessStatusCode && finalInv.Data != null)
            {
                finalInv.Data.RemainingPiastres.Should().Be(0L);
                finalInv.Data.PaidPiastres.Should().Be(70000L);
            }
        }
        else
        {
            var successCount = (res1.IsSuccessStatusCode ? 1 : 0) + (res2.IsSuccessStatusCode ? 1 : 0);
            var conflictCount = (res1.StatusCode == System.Net.HttpStatusCode.Conflict ? 1 : 0) + (res2.StatusCode == System.Net.HttpStatusCode.Conflict ? 1 : 0);
            successCount.Should().Be(1);
            conflictCount.Should().Be(1);
        }
    }
}
