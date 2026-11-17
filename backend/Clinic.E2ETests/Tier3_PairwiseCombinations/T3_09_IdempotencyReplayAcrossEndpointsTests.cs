using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_09_IdempotencyReplayAcrossEndpointsTests : E2ETestBase
{
    public T3_09_IdempotencyReplayAcrossEndpointsTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task IdempotencyKey_GuaranteesSafeReplaysAcrossBookingCallNextAndPayments()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        // 1. Booking Replay
        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var bookKey = Guid.NewGuid().ToString();

        var book1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id), bookKey);
        book1.EnsureSuccess();

        var book2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id), bookKey);
        book2.EnsureSuccess();
        book2.Data!.Id.Should().Be(book1.Data!.Id);

        // 2. Call-Next Replay
        var callKey = Guid.NewGuid().ToString();
        var call1 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1), callKey);
        call1.EnsureSuccess();

        var call2 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1), callKey);
        call2.EnsureSuccess();
        call2.Data!.CallSequence.Should().Be(call1.Data!.CallSequence);

        // 3. Payment Replay
        await Api.AsDoctor().PostAsync<object>($"/api/invoices/{book1.Data.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("Procedure", 10000L, 1, 10000L)
        }));

        var payKey = Guid.NewGuid().ToString();
        var pay1 = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{book1.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 10000L, "Cash"), payKey);
        pay1.EnsureSuccess();

        var pay2 = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{book1.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 10000L, "Cash"), payKey);
        pay2.EnsureSuccess();
        pay2.Data!.PaidPiastres.Should().Be(pay1.Data!.PaidPiastres);
    }
}
