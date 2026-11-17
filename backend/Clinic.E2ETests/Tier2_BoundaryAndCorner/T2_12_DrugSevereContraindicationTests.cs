using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F12")]
public class T2_12_DrugSevereContraindicationTests : E2ETestBase
{
    public T2_12_DrugSevereContraindicationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F12_01_SafetyCheck_LactationContraindication_Detected()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient(gender: "Female"));
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data!.Id,
            Items: new List<SafetyCheckItem> { new(4, "sulfa") },
            IsLactating: true
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "LactationWarning");
    }

    [Fact]
    public async Task T2_F12_02_SafetyCheck_DiscontinuedDrugFlagged()
    {
        var discDrug = await Api.AsDoctor().PostAsync<DrugResponse>("/api/drugs", new CreateDrugRequest("OldMed", "old_ing", "10mg", "Tablet", IsDiscontinued: true));
        discDrug.EnsureSuccess();

        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data!.Id,
            Items: new List<SafetyCheckItem> { new(discDrug.Data!.Id, "old_ing") }
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "DiscontinuedDrug");
    }

    [Fact]
    public async Task T2_F12_03_SafetyCheck_MultipleSimultaneousWarnings()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient(gender: "Female"));
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("sulfa", "Sulfa Allergy", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        // Bactrim has allergy AND avoid in pregnancy
        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data.Id,
            Items: new List<SafetyCheckItem> { new(4, "sulfa") },
            IsPregnant: true
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "AllergyConflict");
        check.Data.Warnings.Should().Contain(w => w.Type == "PregnancyWarning");
    }

    [Fact]
    public async Task T2_F12_04_SafetyCheck_CaseInsensitiveIngredientMatching()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("AMOXICILLIN", "Amox Upper Case", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        var req = new DrugSafetyCheckRequest(
            PatientId: pat.Data.Id,
            Items: new List<SafetyCheckItem> { new(1, "amoxicillin") }
        );
        var check = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", req);
        check.EnsureSuccess();
        check.Data!.Warnings.Should().Contain(w => w.Type == "AllergyConflict");
    }

    [Fact]
    public async Task T2_F12_05_DrugImportCsv_InvalidHeaderOrMalformedRows_Rejected()
    {
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent("Invalid,Header,Row\n1,2,3"u8.ToArray()), "file", "bad.csv" }
        };
        var res = await Api.AsDoctor().PostMultipartAsync<object>("/api/drugs/import-csv", form);
        res.ShouldBeBadRequest();
    }
}
