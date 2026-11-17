using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F06")]
public class T2_06_AuthExpiryAndForbiddenTests : E2ETestBase
{
    public T2_06_AuthExpiryAndForbiddenTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F06_01_Login_InvalidPassword_Returns401()
    {
        var res = await Api.PostAsync<LoginResponse>("/api/auth/login", new LoginRequest("doctor", "WrongPassword"));
        res.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task T2_F06_02_Login_NonExistentUsername_Returns401()
    {
        var res = await Api.PostAsync<LoginResponse>("/api/auth/login", new LoginRequest("ghost_user", "Password123!"));
        res.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task T2_F06_03_ProtectedEndpoint_ExpiredToken_Returns401()
    {
        var expired = TestAuthHelper.ExpiredToken();
        var res = await Api.SetToken(expired).GetAsync<ShiftResponse>("/api/shifts/current");
        res.ShouldBeUnauthorized();
    }

    [Fact]
    public async Task T2_F06_04_RoleAuthorization_ReceptionistAccessingDoctorEndpoint_Returns403()
    {
        // Receptionist attempts to toggle doctor break (Doctor-only Phase 2 endpoint)
        var res = await Api.AsReceptionist().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        res.StatusCode.Should().Be(System.Net.HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task T2_F06_05_MalformedToken_Returns401()
    {
        var malformed = TestAuthHelper.MalformedToken();
        var res = await Api.SetToken(malformed).GetAsync<ShiftResponse>("/api/shifts/current");
        res.ShouldBeUnauthorized();
    }
}
