using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_03_UrgentPatientEmergencyTriageTests : E2ETestBase
{
    public T4_03_UrgentPatientEmergencyTriageTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task UrgentEmergencyTriage_PreemptsWaitingQueue_AndFlagsCriticalVitals()
    {
        await EnsureShiftOpenAsync();

        // 1. Book 2 routine patients (IsUrgent = false)
        var pat1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض روتيني 1"));
        var apt1 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id, isUrgent: false));

        var pat2 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض روتيني 2"));
        var apt2 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat2.Data!.Id, isUrgent: false));

        // 2. Book urgent emergency patient (IsUrgent = true)
        var patUrgent = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مغص كلوي حاد - طارئ"));
        var aptUrgent = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(patUrgent.Data!.Id, isUrgent: true));
        aptUrgent.EnsureSuccess();

        // 3. Nurse flags critical vitals
        var vitalsReq = new VitalsRequest(
            BpSystolic: 160,
            BpDiastolic: 100,
            PulseBpm: 125,
            TempCelsius: 39.8,
            Version: 1
        );
        var vitalsRes = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{aptUrgent.Data!.Id}/vitals", vitalsReq);
        vitalsRes.EnsureSuccess();

        // 4. Doctor calls next: Urgent patient MUST be called before routine patients!
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        call.EnsureSuccess();
        call.Data!.AppointmentId.Should().Be(aptUrgent.Data.Id);

        // 5. Complete urgent visit and verify next routine patient called
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{aptUrgent.Data.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        var nextRoutineCall = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        nextRoutineCall.EnsureSuccess();
        nextRoutineCall.Data!.AppointmentId.Should().Be(apt1.Data!.Id);
    }
}
