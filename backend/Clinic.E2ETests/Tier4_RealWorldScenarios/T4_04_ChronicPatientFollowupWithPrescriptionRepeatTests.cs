using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_04_ChronicPatientFollowupWithPrescriptionRepeatTests : E2ETestBase
{
    public T4_04_ChronicPatientFollowupWithPrescriptionRepeatTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ChronicFollowUp_VerifiesConsultationEligibility_AndRepeatsPrescription()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("حاج علي التميمي (مزمن)", age: 62));

        // 1. Visit 1 (Initial Exam): Diagnosed with DM2 & Hypertension
        var examApt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        var initialRx = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 5, DrugName: "Glucophage", Dosage: "1 tab", Timing: "daily", Duration: "30 days"),
                new(DrugId: 6, DrugName: "Concor", Dosage: "1 tab", Timing: "morning", Duration: "30 days")
            },
            Diagnosis: "Type 2 Diabetes Mellitus & Essential Hypertension"
        );
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{examApt.Data!.Id}/complete", initialRx);

        // 2. Follow-up 7 days later: check consultation eligibility
        var elig = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data.Id}/consultation-eligibility");
        elig.EnsureSuccess();
        elig.Data!.IsEligible.Should().BeTrue();
        elig.Data.DaysRemaining.Should().BeGreaterThan(0);

        // 3. Book Free Consultation ($0 EGP)
        var consultApt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id, parentExamId: examApt.Data.Id));
        consultApt.EnsureSuccess();
        consultApt.Data!.AmountPaidPiastres.Should().Be(0L);

        // 4. Doctor inspects history and repeats Rx with adjusted Glucophage dosage
        var history = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        var previousRx = history.Data!.Items.First(v => v.AppointmentId == examApt.Data.Id).PrescriptionItems!;

        // Repeat with adjusted dosage for Glucophage (twice daily)
        var followUpRx = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 5, DrugName: "Glucophage", Dosage: "1 tab", Timing: "twice daily", Duration: "30 days"),
                new(DrugId: 6, DrugName: "Concor", Dosage: "1 tab", Timing: "morning", Duration: "30 days")
            },
            Diagnosis: "Type 2 DM (Uncontrolled) - Dosage increased"
        );
        var completeFollowUp = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{consultApt.Data.Id}/complete", followUpRx);
        completeFollowUp.EnsureSuccess();

        // 5. Verify snapshot immutability
        var updatedHistory = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        var examVisit = updatedHistory.Data!.Items.First(v => v.AppointmentId == examApt.Data.Id);
        var consultVisit = updatedHistory.Data.Items.First(v => v.AppointmentId == consultApt.Data.Id);

        examVisit.PrescriptionItems!.First(d => d.DrugId == 5).Timing.Should().Be("daily");
        consultVisit.PrescriptionItems!.First(d => d.DrugId == 5).Timing.Should().Be("twice daily");
    }
}
