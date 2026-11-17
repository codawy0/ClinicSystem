using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F11")]
public class T1_11_MedicalVisitsVitalsTests : E2ETestBase
{
    public T1_11_MedicalVisitsVitalsTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F11_01_RecordStandardVitals_Success()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var req = new VitalsRequest(
            BpSystolic: 120,
            BpDiastolic: 80,
            PulseBpm: 72,
            TempCelsius: 37.0,
            BloodSugarMgDl: 100,
            BloodSugarType: "Fasting",
            Version: 1
        );
        var res = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/vitals", req);
        res.EnsureSuccess();
        res.Data!.BpSystolic.Should().Be(120);
        res.Data.Version.Should().Be(2);
    }

    [Fact]
    public async Task T1_F11_02_DraftAutosave_Success()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var req = new DraftVisitRequest(
            ChiefComplaint: "Severe headache",
            Examination: "Normal neuro exam",
            Diagnosis: "Tension headache",
            Version: 1
        );
        var res = await Api.AsDoctor().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/draft", req);
        res.EnsureSuccess();
        res.Data!.Diagnosis.Should().Be("Tension headache");
        res.Data.IsDraft.Should().BeTrue();
    }

    [Fact]
    public async Task T1_F11_03_GetPaginatedPatientHistory_Success()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data!.Id}?page=1&pageSize=5");
        hist.EnsureSuccess();
        hist.Data.Should().NotBeNull();
        hist.Data!.Items.Should().NotBeEmpty();
    }

    [Fact]
    public async Task T1_F11_04_UpdateClinicalAlerts_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var alerts = new ClinicalAlertsRequest(
            Allergies: new List<PatientAllergyDto> { new("penicillin", "Penicillin", "Severe") },
            ChronicConditions: new List<PatientChronicConditionDto> { new("DM2", "Diabetes Type 2") }
        );
        var res = await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", alerts);
        res.EnsureSuccess();

        var profile = await Api.AsReceptionist().GetAsync<PatientResponse>($"/api/patients/{pat.Data.Id}");
        profile.EnsureSuccess();
        profile.Data!.Allergies.Should().Contain(a => a.ActiveIngredient == "penicillin");
    }

    [Fact]
    public async Task T1_F11_05_AddPostCompletionAddendum_Success()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Complete visit
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        // Add addendum
        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data!.Id}");
        var mvId = hist.Data!.Items.First().Id;

        var addendum = await Api.AsDoctor().PostAsync<VisitAddendumDto>($"/api/visits/{mvId}/addendum", new AddendumRequest("Patient called reporting symptom improvement."));
        addendum.EnsureSuccess();
        addendum.Data!.NoteText.Should().Contain("symptom improvement");
    }
}
