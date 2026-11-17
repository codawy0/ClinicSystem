using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_13_ConsultationEligibilityWindowTests : E2ETestBase
{
    public T3_13_ConsultationEligibilityWindowTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ConsultationEligibility_WithinWindowEnablesFreeBooking_AndConsumingBlocksSecond()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // 1. Initial Exam completed
        var exam = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{exam.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        // 2. Check eligibility: should be eligible with ~14 days remaining
        var elig1 = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data.Id}/consultation-eligibility");
        elig1.EnsureSuccess();
        elig1.Data!.IsEligible.Should().BeTrue();
        elig1.Data.ParentExamAppointmentId.Should().Be(exam.Data.Id);

        // 3. Book free consultation (0 EGP)
        var consultBooking = TestDataBuilder.BuildBooking(pat.Data.Id, parentExamId: exam.Data.Id);
        var consultApt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", consultBooking);
        consultApt.EnsureSuccess();
        consultApt.Data!.IsConsultation.Should().BeTrue();
        consultApt.Data.AmountPaidPiastres.Should().Be(0L);

        // 4. Complete consultation visit
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{consultApt.Data.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        // 5. Re-check: now consumed max consultations
        var elig2 = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data.Id}/consultation-eligibility");
        elig2.EnsureSuccess();
        elig2.Data!.IsEligible.Should().BeFalse();
        elig2.Data.Reason.Should().Be("MAX_CONSULTATIONS_CONSUMED");
    }
}
