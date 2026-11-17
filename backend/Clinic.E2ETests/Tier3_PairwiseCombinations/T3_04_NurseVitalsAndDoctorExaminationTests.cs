using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_04_NurseVitalsAndDoctorExaminationTests : E2ETestBase
{
    public T3_04_NurseVitalsAndDoctorExaminationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task NurseVitals_AndDoctorDrafting_PreserveOptimisticConcurrency()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // 1. Nurse inputs vitals (v1 -> v2)
        var vitalsReq = new VitalsRequest(130, 85, 76, 37.1, WeightKg: 74.0, HeightCm: 172.0, Version: 1);
        var vitalsRes = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/vitals", vitalsReq);
        vitalsRes.EnsureSuccess();
        vitalsRes.Data!.Version.Should().Be(2);

        // 2. Doctor drafts notes (v2 -> v3)
        var draftReq = new DraftVisitRequest("Persistent headache", "Normal neuro exam", "Mild hypertension", Version: 2);
        var draftRes = await Api.AsDoctor().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data.Id}/draft", draftReq);
        draftRes.EnsureSuccess();
        draftRes.Data!.Version.Should().Be(3);

        // 3. Nurse attempts concurrent update with stale v1 -> returns 409 Conflict
        var staleVitals = new VitalsRequest(120, 80, 72, 37.0, Version: 1);
        var conflictRes = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data.Id}/vitals", staleVitals);
        conflictRes.ShouldBeConflict();
    }
}
