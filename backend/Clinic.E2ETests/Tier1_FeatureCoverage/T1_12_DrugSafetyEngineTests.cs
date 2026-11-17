using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F12")]
public class T1_12_DrugSafetyEngineTests : E2ETestBase
{
    public T1_12_DrugSafetyEngineTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F12_01_DrugCreateAndSearch_Success()
    {
        var drug = new CreateDrugRequest("Klaricid", "clarithromycin", "500mg", "Tablet");
        var createRes = await Api.AsDoctor().PostAsync<DrugResponse>("/api/drugs", drug);
        createRes.EnsureSuccess();

        var searchRes = await Api.GetAsync<List<DrugResponse>>("/api/drugs/search?q=klaricid");
        searchRes.EnsureSuccess();
        searchRes.Data.Should().Contain(d => d.TradeName == "Klaricid");
    }

    [Fact]
    public async Task T1_F12_02_SafetyCheck_CleanProfile_NoWarnings()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data!.Id,
            Items: new List<SafetyCheckItem> { new(2, "paracetamol") }
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().BeEmpty();
    }

    [Fact]
    public async Task T1_F12_03_SafetyCheck_AllergyConflict_Detected()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("amoxicillin", "Amoxicillin Allergy", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data.Id,
            Items: new List<SafetyCheckItem> { new(1, "amoxicillin") }
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "AllergyConflict" && w.Severity == "Severe" && w.RequiresOverride);
    }

    [Fact]
    public async Task T1_F12_04_SafetyCheck_PregnancyContraindication_Detected()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient(gender: "Female"));
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data!.Id,
            Items: new List<SafetyCheckItem> { new(4, "sulfa") }, // Bactrim DS has avoidInPregnancy = true
            IsPregnant: true
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "PregnancyWarning" && w.Severity == "Severe");
    }

    [Fact]
    public async Task T1_F12_05_SafetyCheck_DuplicateActiveIngredient_Detected()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data!.Id,
            Items: new List<SafetyCheckItem>
            {
                new(2, "paracetamol"), // Panadol
                new(3, "paracetamol")  // Paramol
            }
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "DuplicateIngredient");
    }
}
