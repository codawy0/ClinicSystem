using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_14_ProcedureAdditionAndInvoiceLineSyncTests : E2ETestBase
{
    public T3_14_ProcedureAdditionAndInvoiceLineSyncTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task AddingProcedures_UpdatesInvoiceTotalAndRemainingBalance_PaidViaVodafoneCash()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var shiftId = cur.Data!.Id;

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Add ECG (15000) + Sonar (20000) = 35000
        var addLines = await Api.AsDoctor().PostAsync<object>($"/api/invoices/{apt.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("رسم قلب (ECG)", 15000L, 1, 15000L),
            new("سونار بطن وحوض", 20000L, 1, 20000L)
        }));
        addLines.EnsureSuccess();

        // Invoice balance check: total 65000, paid 30000, remaining 35000
        var inv = await Api.GetAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}");
        inv.Data!.TotalPiastres.Should().Be(65000L);
        inv.Data.RemainingPiastres.Should().Be(35000L);
        inv.Data.Status.Should().Be("Partial");

        // Pay remaining via VodafoneCash
        var pay = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{apt.Data.InvoiceId}/pay", new PayInvoiceRequest(shiftId, 35000L, "VodafoneCash", "VF-998811"));
        pay.EnsureSuccess();
        pay.Data!.Status.Should().Be("Paid");
        pay.Data.RemainingPiastres.Should().Be(0L);

        // Drawer check: VodafoneCash recorded 35000
        var shift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        shift.Data!.VodafoneCashTotalPiastres.Should().BeGreaterOrEqualTo(35000L);
    }
}
