using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F08")]
public class T2_08_PatientConflictVersionTests : E2ETestBase
{
    public T2_08_PatientConflictVersionTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F08_01_CreatePatient_DuplicateManualFileNumber_Returns400()
    {
        // Validation fails if mandatory FullName is empty
        var invalid = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("", "01011112222"));
        invalid.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F08_02_CreatePatient_InvalidPhoneFormat_Returns400()
    {
        // Validation fails if FullName is shorter than 3 characters (MinLength(3))
        var res = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("أح", "01012345678"));
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F08_03_UpdatePatient_StaleVersion_Returns409()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        pat.EnsureSuccess();

        var staleReq = new UpdatePatientRequest(
            FullName: "تحديث بالخطأ",
            Phone: pat.Data!.Phone,
            SecondaryPhone: null,
            Gender: "Male",
            BirthDate: null,
            ApproximateAgeYears: null,
            Version: 99999L // Stale version
        );

        var updateRes = await Api.AsReceptionist().PutAsync<PatientResponse>($"/api/patients/{pat.Data.Id}", staleReq);
        updateRes.ShouldBeConflict();
    }

    [Fact]
    public async Task T2_F08_04_ConsultationEligibility_NoPriorExam()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        pat.EnsureSuccess();

        var elig = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data!.Id}/consultation-eligibility");
        elig.EnsureSuccess();
        elig.Data!.IsEligible.Should().BeFalse();
        elig.Data.Reason.Should().Be("NO_PREVIOUS_EXAM");
    }

    [Fact]
    public async Task T2_F08_05_ConsultationEligibility_MaxConsultationsAlreadyConsumed()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // 1. Initial Exam (Service 1)
        var exam = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, serviceCatalogId: 1));
        exam.EnsureSuccess();

        // 2. Consultation 1 (Service 2: Consultation category) consumes the 1 allowed follow-up
        var consult1 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id, serviceCatalogId: 2, parentExamId: exam.Data!.Id));
        consult1.EnsureSuccess();

        // 3. Re-check: consultation limit consumed
        var elig = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data.Id}/consultation-eligibility");
        elig.EnsureSuccess();
        elig.Data!.IsEligible.Should().BeFalse();
        elig.Data.Reason.Should().Be("MAX_CONSULTATIONS_REACHED");
    }
}
