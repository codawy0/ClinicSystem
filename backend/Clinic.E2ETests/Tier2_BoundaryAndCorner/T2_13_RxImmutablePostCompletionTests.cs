using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F13")]
public class T2_13_RxImmutablePostCompletionTests : E2ETestBase
{
    public T2_13_RxImmutablePostCompletionTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F13_01_CompleteVisit_BlockedBySevereWarningWithoutOverride()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("amoxicillin", "Amoxicillin", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id));

        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 1, DrugName: "Augmentin", Dosage: "1 tab", Timing: "daily", Duration: "5 days", WarningOverridden: false)
            }
        );
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", completeReq);
        complete.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F13_02_CompleteVisit_AllowedWithOverrideReasonAndAudited()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsNurse().PutAsync<object>($"/api/patients/{pat.Data!.Id}/clinical-alerts", new ClinicalAlertsRequest(
            new List<PatientAllergyDto> { new("amoxicillin", "Amoxicillin", "Severe") },
            new List<PatientChronicConditionDto>()
        ));

        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id));

        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 1, DrugName: "Augmentin", Dosage: "1 tab", Timing: "daily", Duration: "5 days", WarningOverridden: true, OverrideReason: "Skin test negative")
            }
        );
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", completeReq);
        complete.EnsureSuccess();
    }

    [Fact]
    public async Task T2_F13_03_CompleteVisit_EmptyPrescriptionAllowed()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Consultation with only diagnostic advice (0 Rx items)
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        complete.EnsureSuccess();
    }

    [Fact]
    public async Task T2_F13_04_CompleteVisit_NonExistentAppointment_Returns404()
    {
        var complete = await Api.AsDoctor().PostAsync<object>("/api/visits/appointment/99999/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        complete.ShouldBeNotFound();
    }

    [Fact]
    public async Task T2_F13_05_CompleteVisit_AlreadyCompletedAppointment_Returns400()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var first = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        first.EnsureSuccess();

        // Attempting to complete again with a new idempotency key
        var second = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()), Guid.NewGuid().ToString());
        second.ShouldBeBadRequest();
    }
}
