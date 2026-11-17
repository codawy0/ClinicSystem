using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F08")]
public class T1_08_PatientCrudTests : E2ETestBase
{
    public T1_08_PatientCrudTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F08_01_CreatePatient_AutoGeneratesFileNumber()
    {
        var req = new CreatePatientRequest(
            FullName: "محمد إبراهيم السيد",
            Phone: "01012345678",
            Gender: "Male",
            BirthDate: "1985-05-12"
        );
        var res = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", req);
        res.EnsureSuccess();
        res.Data!.FileNumber.Should().NotBeNullOrEmpty();
        res.Data.SearchName.Should().Be("محمد ابراهيم السيد");
        res.Data.NormalizedPhone.Should().Be("01012345678");
        res.Data.Version.Should().Be(1);
    }

    [Fact]
    public async Task T1_F08_02_GetPatientById_ReturnsFullProfile()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest(
            FullName: "مريض اختبار الحساسية",
            Phone: "01099887766",
            Gender: "Male",
            Allergies: new List<string> { "penicillin" }
        ));
        pat.EnsureSuccess();

        var getRes = await Api.AsReceptionist().GetAsync<PatientResponse>($"/api/patients/{pat.Data!.Id}");
        getRes.EnsureSuccess();
        getRes.Data!.Id.Should().Be(pat.Data.Id);
        getRes.Data.Allergies.Should().Contain(a => a.ActiveIngredient == "penicillin");
    }

    [Fact]
    public async Task T1_F08_03_UpdatePatient_IncrementsVersion()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        pat.EnsureSuccess();

        var updateReq = new UpdatePatientRequest(
            FullName: pat.Data!.FullName,
            Phone: pat.Data.Phone,
            SecondaryPhone: "01199887766",
            Gender: "Male",
            BirthDate: pat.Data.BirthDate,
            ApproximateAgeYears: pat.Data.ApproximateAgeYears,
            Version: pat.Data.Version
        );

        var updateRes = await Api.AsReceptionist().PutAsync<PatientResponse>($"/api/patients/{pat.Data.Id}", updateReq);
        updateRes.EnsureSuccess();
        updateRes.Data!.Version.Should().Be(2);
    }

    [Fact]
    public async Task T1_F08_04_FamilyLookup_SharedPhoneReturnsAllMembers()
    {
        var sharedPhone = "01099998888";
        var mother = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("أم محمد أحمد", sharedPhone));
        mother.EnsureSuccess();

        var child1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("طفل 1 محمد", sharedPhone, GuardianPatientId: mother.Data!.Id));
        child1.EnsureSuccess();

        var child2 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("طفل 2 محمد", sharedPhone, GuardianPatientId: mother.Data!.Id));
        child2.EnsureSuccess();

        var search = await Api.AsReceptionist().GetAsync<List<PatientResponse>>($"/api/patients/search?q={sharedPhone}");
        search.EnsureSuccess();
        search.Data.Should().Contain(p => p.Id == mother.Data!.Id);
        search.Data.Should().Contain(p => p.Id == child1.Data!.Id);
        search.Data.Should().Contain(p => p.Id == child2.Data!.Id);
    }

    [Fact]
    public async Task T1_F08_05_ConsultationEligibility_EligibleWithin14Days()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        apt.EnsureSuccess();

        var elig = await Api.AsReceptionist().GetAsync<ConsultationEligibilityResponse>($"/api/patients/{pat.Data.Id}/consultation-eligibility");
        elig.EnsureSuccess();
        elig.Data!.IsEligible.Should().BeTrue();
        elig.Data.DaysRemaining.Should().BeGreaterThan(0);
    }
}
