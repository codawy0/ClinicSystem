using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_02_FamilyPhoneAndAppointmentTests : E2ETestBase
{
    public T3_02_FamilyPhoneAndAppointmentTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task FamilySharedPhone_ReturnsAllMembers_AndAllowsConsecutiveBookings()
    {
        await EnsureShiftOpenAsync();

        var phoneRaw = "+201012345678";
        var phoneIndic = "٠١٠١٢٣٤٥٦٧٨";
        var phoneNormalized = "01012345678";

        // Register Mother & 2 Children sharing same phone
        var mother = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("فاطمة محمود علي", phoneRaw, Gender: "Female", BirthDate: "1988-05-12"));
        mother.EnsureSuccess();

        var son = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("علي أحمد حسن", phoneNormalized, GuardianPatientId: mother.Data!.Id, Gender: "Male", ApproximateAgeYears: 7));
        son.EnsureSuccess();

        var daughter = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("سارة أحمد حسن", phoneIndic, GuardianPatientId: mother.Data.Id, Gender: "Female", ApproximateAgeYears: 4));
        daughter.EnsureSuccess();

        // Search by unnormalized phone returns all 3
        var search1 = await Api.AsReceptionist().GetAsync<List<PatientResponse>>($"/api/patients/search?q={Uri.EscapeDataString(phoneRaw)}");
        search1.EnsureSuccess();
        search1.Data!.Count.Should().BeGreaterOrEqualTo(3);

        // Search by Arabic-Indic phone returns all 3
        var search2 = await Api.AsReceptionist().GetAsync<List<PatientResponse>>($"/api/patients/search?q={Uri.EscapeDataString(phoneIndic)}");
        search2.EnsureSuccess();
        search2.Data!.Count.Should().BeGreaterOrEqualTo(3);

        // Book consecutive appointments
        var aptSon = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(son.Data!.Id));
        aptSon.EnsureSuccess();

        var aptDaughter = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(daughter.Data!.Id));
        aptDaughter.EnsureSuccess();

        aptDaughter.Data!.QueueNumber!.Value.Should().BeGreaterThan(aptSon.Data!.QueueNumber!.Value);
    }
}
