using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_07_DisasterRecoveryAndSessionContinuationTests : E2ETestBase
{
    public T4_07_DisasterRecoveryAndSessionContinuationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task DisasterRecovery_OnlineBackupAndRestore_RestoresQueueAndResumesSessionSeamlessly()
    {
        // 1. Setup active clinic session: Shift open with 50000 Piastres
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));
        var openShift = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
        openShift.EnsureSuccess();

        // Patient 1: With Doctor (Queue #1, 30000 Piastres Cash)
        var p1 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض أول تحت الكشف"));
        p1.EnsureSuccess();
        var apt1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p1.Data!.Id, paymentMethod: "Cash"));
        apt1.EnsureSuccess();
        var call1 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        call1.EnsureSuccess();

        // Patient 2: In Nursing / Vitals (Queue #2, 30000 Piastres Cash)
        var p2 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض ثاني بالتمريض"));
        p2.EnsureSuccess();
        var apt2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p2.Data!.Id, paymentMethod: "Cash"));
        apt2.EnsureSuccess();
        var vitalsReq = new VitalsRequest(BpSystolic: 125, BpDiastolic: 82, PulseBpm: 75, TempCelsius: 36.9, WeightKg: 78.0, BloodSugarMgDl: 110, BloodSugarType: "Random", IsPregnant: false, IsLactating: false, Version: 1);
        var vitalsRes = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt2.Data!.Id}/vitals", vitalsReq);
        vitalsRes.EnsureSuccess();

        // Patient 3: Waiting in queue (Queue #3, 30000 Piastres Cash)
        var p3 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض ثالث بالانتظار"));
        p3.EnsureSuccess();
        var apt3 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p3.Data!.Id, paymentMethod: "Cash"));
        apt3.EnsureSuccess();

        // Assert expected cash: 50000 + (3 * 30000) = 140000 Piastres
        var preBackupShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        preBackupShift.EnsureSuccess();
        preBackupShift.Data!.ExpectedClosingCashPiastres.Should().Be(140000L);

        // 2. Hot Online Backup Creation
        using var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", TestAuthHelper.DoctorToken());
        var backupRes = await client.PostAsync("/api/backup/create", null);
        backupRes.EnsureSuccessStatusCode();
        var zipBytes = await backupRes.Content.ReadAsByteArrayAsync();
        zipBytes.Length.Should().BeGreaterThan(0);

        // 3. Mutate post-backup state: Patient 4 booked after backup
        var p4 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض رابع بعد النسخ"));
        p4.EnsureSuccess();
        var apt4 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p4.Data!.Id, paymentMethod: "Cash"));
        apt4.EnsureSuccess();

        var todayMutated = await Api.AsReceptionist(3).GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayMutated.Data.Should().Contain(a => a.Id == apt4.Data!.Id);

        // 4. Disaster Recovery Restoration
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(zipBytes), "file", "disaster_recovery.zip" }
        };
        var restoreRes = await Api.AsDoctor().PostMultipartAsync<object>("/api/backup/restore", form);
        restoreRes.EnsureSuccess();

        // 5. State Continuity Verification
        var todayRestored = await Api.AsReceptionist(3).GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayRestored.EnsureSuccess();
        todayRestored.Data.Should().Contain(a => a.Id == apt1.Data!.Id && a.Status == "WithDoctor");
        todayRestored.Data.Should().Contain(a => a.Id == apt2.Data!.Id);
        todayRestored.Data.Should().Contain(a => a.Id == apt3.Data!.Id && a.Status == "Waiting");
        todayRestored.Data.Should().NotContain(a => a.Id == apt4.Data!.Id); // Post-backup appointment cleanly reverted

        var restoredShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        restoredShift.EnsureSuccess();
        restoredShift.Data!.ExpectedClosingCashPiastres.Should().Be(140000L);

        // 6. Seamless Session Resumption
        // Doctor completes examination for Patient 1
        var completeRes = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt1.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));
        completeRes.EnsureSuccess();

        // Doctor calls Patient 2 next
        var call2 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        call2.EnsureSuccess();
        call2.Data!.AppointmentId.Should().Be(apt2.Data!.Id);
    }
}
