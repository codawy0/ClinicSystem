using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_06_ConsultationCompletionAndInvoiceTests : E2ETestBase
{
    public T3_06_ConsultationCompletionAndInvoiceTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ConsultationCompletion_FreezesMedicalRecord_AndAllowsPostExamPayment()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Add procedure making remaining balance 20000 Piastres
        await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("ECG", 20000L, 1, 20000L)
        }));

        // Advance to doctor and complete
        await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        complete.EnsureSuccess();

        // Cashier collects remaining balance
        var pay = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 20000L, "Cash"));
        pay.EnsureSuccess();
        pay.Data!.Status.Should().Be("Paid");
        pay.Data.RemainingPiastres.Should().Be(0L);
    }
}
