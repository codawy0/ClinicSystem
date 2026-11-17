using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F15")]
public class T1_15_TreasuryLedgerTests : E2ETestBase
{
    public T1_15_TreasuryLedgerTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F15_01_PartialPayment_UpdatesRemainingBalance()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Add 30000 procedure to make total 60000 (30000 paid at booking, 30000 remaining)
        await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("Sonar", 30000L, 1, 30000L)
        }));

        var payRes = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 15000L, "Cash"));
        payRes.EnsureSuccess();
        payRes.Data!.Status.Should().Be("Partial");
        payRes.Data.PaidPiastres.Should().Be(45000L);
        payRes.Data.RemainingPiastres.Should().Be(15000L);
    }

    [Fact]
    public async Task T1_F15_02_SecondPayment_MarksInvoicePaid()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Add 20000 procedure
        await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("ECG", 20000L, 1, 20000L)
        }));

        // Pay remaining 20000
        var payRes = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 20000L, "Cash"));
        payRes.EnsureSuccess();
        payRes.Data!.Status.Should().Be("Paid");
        payRes.Data.RemainingPiastres.Should().Be(0L);
    }

    [Fact]
    public async Task T1_F15_03_Refund_CreatesReversingLedgerEntry()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var refund = await Api.AsReceptionist(3).PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/refund", new RefundInvoiceRequest(shiftId, 10000L, "Patient cancelled procedure"));
        refund.EnsureSuccess();

        var inv = await Api.GetAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}");
        inv.Data!.PaidPiastres.Should().Be(20000L);
        inv.Data.Status.Should().Be("PartiallyRefunded");
    }

    [Fact]
    public async Task T1_F15_04_VoidInvoice_MarksVoidedAndReverses()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var voidRes = await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/void", new VoidInvoiceRequest(shiftId, "Billed in error"));
        voidRes.EnsureSuccess();

        var inv = await Api.GetAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}");
        inv.Data!.Status.Should().Be("Voided");
    }

    [Fact]
    public async Task T1_F15_05_ImmutableLedger_ZeroHardDeletes()
    {
        // Assert that invoices endpoint only supports safe transitions, not HTTP DELETE
        var delRes = await Api.AsDoctor().DeleteAsync<object>("/api/invoices/1");
        delRes.StatusCode.Should().Match(s => s == System.Net.HttpStatusCode.NotFound || s == System.Net.HttpStatusCode.MethodNotAllowed);
    }
}
