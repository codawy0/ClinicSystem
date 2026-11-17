using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_05_DrugAllergyOverrideAndAuditTrailTests : E2ETestBase
{
    public T4_05_DrugAllergyOverrideAndAuditTrailTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task DrugSafetyOverride_BlocksUntilJustified_AndPersistsInAuditLog()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("هدى سمير (حساسية)", gender: "Female"));

        // 1. Nurse records allergy to sulfa
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("sulfa", "Sulfonamide Hypersensitivity", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        // 2. Book appointment
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id));

        // 3. Safety check flags allergy
        var safetyCheck = await Api.AsDoctor().PostAsync<DrugSafetyCheckResponse>("/api/drugs/check-safety", new DrugSafetyCheckRequest(
            pat.Data.Id,
            new List<SafetyCheckItem> { new(4, "sulfa") }
        ));
        safetyCheck.EnsureSuccess();
        safetyCheck.Data!.Warnings.Should().Contain(w => w.Type == "AllergyConflict" && w.RequiresOverride);

        // 4. Attempt finalize without override -> 400 Bad Request
        var unoverridden = new CompleteVisitRequest(new List<PrescriptionItemInput>
        {
            new(4, "Bactrim DS", "1 tab", "every 12h", "10 days", WarningOverridden: false)
        });
        var failComplete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", unoverridden);
        failComplete.ShouldBeBadRequest();

        // 5. Finalize with mandatory clinical override justification
        var justification = "Patient underwent oral desensitization protocol under immunologist; culture shows cotrimoxazole exclusive susceptibility.";
        var overridden = new CompleteVisitRequest(new List<PrescriptionItemInput>
        {
            new(4, "Bactrim DS", "1 tab", "every 12h", "10 days", WarningOverridden: true, OverrideReason: justification)
        });
        var successComplete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data.Id}/complete", overridden);
        successComplete.EnsureSuccess();

        // 6. Verify permanent audit log entry in database
        using var conn = new SqliteConnection(Fixture.ConnectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Action, DiffJson FROM AuditLogs WHERE EntityName = 'PrescriptionItem' AND EntityId = 4 ORDER BY Id DESC LIMIT 1;";
        using var reader = cmd.ExecuteReader();
        reader.Read().Should().BeTrue();
        reader.GetString(0).Should().Be("DrugSafetyOverride");
        reader.GetString(1).Should().Contain("desensitization protocol");
    }
}
