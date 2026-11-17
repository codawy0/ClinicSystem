using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_05_PatientAllergyAndDrugPrescriptionTests : E2ETestBase
{
    public T3_05_PatientAllergyAndDrugPrescriptionTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task PatientAllergy_BlocksCompletionWithoutOverride_ThenAuditsWhenOverridden()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // 1. Record structured allergy to amoxicillin
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("amoxicillin", "Penicillin Anaphylaxis", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        // 2. Run safety check for Augmentin
        var safetyCheck = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", new DrugSafetyCheckRequest(
            pat.Data.Id,
            new List<SafetyCheckItem> { new(1, "amoxicillin") }
        ));
        safetyCheck.EnsureSuccess();
        safetyCheck.Data!.Warnings.Should().Contain(w => w.Type == "AllergyConflict" && w.RequiresOverride);

        // 3. Book appointment
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id));

        // 4. Attempt completion without override -> 400 Bad Request
        var unoverridden = new CompleteVisitRequest(new List<PrescriptionItemInput>
        {
            new(1, "Augmentin", "1 tab q12h", "After meals", "7 days", WarningOverridden: false)
        });
        var failComplete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", unoverridden);
        failComplete.ShouldBeBadRequest();

        // 5. Complete with clinical override
        var overridden = new CompleteVisitRequest(new List<PrescriptionItemInput>
        {
            new(1, "Augmentin", "1 tab q12h", "After meals", "7 days", WarningOverridden: true, OverrideReason: "Skin test negative; supervised in clinic")
        });
        var successComplete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data.Id}/complete", overridden);
        successComplete.EnsureSuccess();

        // 6. Verify frozen snapshot
        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        var visit = hist.Data!.Items.First();
        visit.IsDraft.Should().BeFalse();
        visit.PrescriptionItems!.First().WarningOverridden.Should().BeTrue();
    }
}
