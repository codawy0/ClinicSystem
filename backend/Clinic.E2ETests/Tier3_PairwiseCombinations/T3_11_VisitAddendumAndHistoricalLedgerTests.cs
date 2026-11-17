using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_11_VisitAddendumAndHistoricalLedgerTests : E2ETestBase
{
    public T3_11_VisitAddendumAndHistoricalLedgerTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task CompletedVisit_RejectsDirectMutations_AndPreservesAuditTrailViaAddenda()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Complete visit
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        complete.EnsureSuccess();

        // Direct mutation fails
        var mutate = await Api.AsDoctor().PutAsync<object>($"/api/visits/appointment/{apt.Data.Id}/draft", new DraftVisitRequest("New Complaint", null, null, 1));
        mutate.ShouldBeBadRequest();

        // Add addendum
        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        var visitId = hist.Data!.Items.First().Id;

        var addendum = await Api.AsDoctor().PostAsync<VisitAddendumDto>($"/api/visits/{visitId}/addendum", new AddendumRequest("Patient reported resolution of symptoms on Day 4"));
        addendum.EnsureSuccess();

        var updatedHist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        updatedHist.Data!.Items.First().Addenda.Should().Contain(a => a.NoteText.Contains("resolution of symptoms"));
    }
}
