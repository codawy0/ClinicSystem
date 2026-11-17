using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_01_FullPatientConsultationJourneyTests : E2ETestBase
{
    public T4_01_FullPatientConsultationJourneyTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task FullOutpatientJourney_AcrossReceptionistNurseDoctorAndCashier()
    {
        // 1. Shift guard verification & opening
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));
        var openShift = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(20000L)); // 200 EGP opening
        openShift.EnsureSuccess();

        // 2. Register patient
        var patientReq = new CreatePatientRequest("محمود حسن النجار", "01234567890", Gender: "Male", ApproximateAgeYears: 42);
        var patient = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", patientReq);
        patient.EnsureSuccess();

        // 3. Connect TV display client
        await using var tvClient = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        tvClient.Clear();

        // 4. Book Walk-in Exam: 30000 Piastres (300 EGP) paid in Cash
        var bookingReq = TestDataBuilder.BuildBooking(patient.Data!.Id, bookingType: "WalkIn", paymentMethod: "Cash");
        var appointment = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", bookingReq);
        appointment.EnsureSuccess();
        appointment.Data!.QueueNumber.Should().NotBeNull();
        appointment.Data.Status.Should().Be("Waiting");

        var qUpdated = await tvClient.WaitForQueueUpdatedAsync(TimeSpan.FromSeconds(3));
        qUpdated.Should().NotBeNull();

        // 5. Nurse vitals intake
        var vitalsReq = new VitalsRequest(
            BpSystolic: 120,
            BpDiastolic: 80,
            PulseBpm: 72,
            TempCelsius: 37.0,
            WeightKg: 82.0,
            BloodSugarMgDl: 105,
            BloodSugarType: "Random",
            IsPregnant: false,
            IsLactating: false,
            Version: 1
        );
        var vitalsRes = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{appointment.Data.Id}/vitals", vitalsReq);
        vitalsRes.EnsureSuccess();
        vitalsRes.Data!.Version.Should().Be(2);

        // 6. Doctor calls next patient
        tvClient.Clear();
        var callNext = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        callNext.EnsureSuccess();
        callNext.Data!.AppointmentId.Should().Be(appointment.Data.Id);

        var calledEvent = await tvClient.WaitForPatientCalledAsync(TimeSpan.FromSeconds(3));
        calledEvent.Should().NotBeNull();
        calledEvent.DisplayName.Should().Be("محمود ح."); // TV privacy formatted

        // 7. Doctor examination notes & draft autosave
        var draftReq = new DraftVisitRequest(
            ChiefComplaint: "Severe burning epigastric pain after meals",
            Examination: "Epigastric tenderness on deep palpation, abdomen soft",
            Diagnosis: "GERD / Gastritis",
            Version: 2
        );
        var draftRes = await Api.AsDoctor().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{appointment.Data.Id}/draft", draftReq);
        draftRes.EnsureSuccess();
        draftRes.Data!.Version.Should().Be(3);

        // 8. E-Prescription template & completion
        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 2, DrugName: "Panadol", Dosage: "1 tab", Timing: "after meals", Duration: "5 days"),
                new(DrugId: 5, DrugName: "Glucophage", Dosage: "1 tab", Timing: "daily", Duration: "14 days")
            }
        );
        var completeRes = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{appointment.Data.Id}/complete", completeReq);
        completeRes.EnsureSuccess();

        // 9. Verify frozen snapshot
        var history = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{patient.Data.Id}");
        var finalVisit = history.Data!.Items.First();
        finalVisit.IsDraft.Should().BeFalse();
        finalVisit.CompletedAtUtc.Should().NotBeNull();
        finalVisit.PrescriptionItems!.Count.Should().Be(2);

        // 10. Treasury reconciliation: 20000 opening + 30000 exam = 50000 Piastres
        var shift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        shift.EnsureSuccess();
        shift.Data!.ExpectedClosingCashPiastres.Should().Be(50000L);
    }
}
