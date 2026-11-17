using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F06")]
public class T1_06_AuthJwtTests : E2ETestBase
{
    public T1_06_AuthJwtTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F06_01_DoctorLogin_ReturnsTokenAndSettings()
    {
        var response = await Api.PostAsync<LoginResponse>("/api/auth/login", new LoginRequest("doctor", "Doctor@123"));
        response.EnsureSuccess();
        response.Data.Should().NotBeNull();
        response.Data!.Token.Should().NotBeNullOrEmpty();
        response.Data.User.Role.Should().Be("Doctor");
        response.Data.ClinicSettings.Should().NotBeNull();
    }

    [Fact]
    public async Task T1_F06_02_ReceptionistLogin_ReturnsToken()
    {
        var response = await Api.PostAsync<LoginResponse>("/api/auth/login", new LoginRequest("receptionist", "Recept@123"));
        response.EnsureSuccess();
        response.Data!.User.Role.Should().Be("Receptionist");
        response.Data.User.MustChangePassword.Should().BeTrue();
    }

    [Fact]
    public async Task T1_F06_03_JwtToken_ContainsRequiredClaims()
    {
        var loginRes = await Api.PostAsync<LoginResponse>("/api/auth/login", new LoginRequest("doctor", "Doctor@123"));
        loginRes.EnsureSuccess();

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(loginRes.Data!.Token);

        jwt.Claims.Should().Contain(c => (c.Type == "role" || c.Type == ClaimTypes.Role) && c.Value == "Doctor");
        jwt.Claims.Should().Contain(c => (c.Type == "unique_name" || c.Type == ClaimTypes.Name) && c.Value == "doctor");
        jwt.Claims.Should().Contain(c => c.Type == "nameid" || c.Type == "UserId" || c.Type == ClaimTypes.NameIdentifier);
        jwt.ValidTo.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task T1_F06_04_ChangePassword_Success()
    {
        // Change password and verify
        var change = await Api.AsDoctor().PostAsync<object>("/api/auth/change-password", new ChangePasswordRequest("Doctor@123", "NewSecret2026!"));
        change.EnsureSuccess();

        // Restore password so subsequent tests continue cleanly
        var revert = await Api.AsDoctor().PostAsync<object>("/api/auth/change-password", new ChangePasswordRequest("NewSecret2026!", "Doctor@123"));
        revert.EnsureSuccess();
    }

    [Fact]
    public async Task T1_F06_05_DevAccounts_AvailableInDevelopment()
    {
        var res = await Api.GetAsync<List<DevAccountDto>>("/api/auth/dev-accounts");
        res.EnsureSuccess();
        res.Data.Should().Contain(a => a.Username == "doctor" && a.Role == "Doctor");
        res.Data.Should().Contain(a => a.Username == "nurse" && a.Role == "Nurse");
        res.Data.Should().Contain(a => a.Username == "receptionist" && a.Role == "Receptionist");
    }

    public record DevAccountDto(string Role, string Username, string Password, string FullName, string Description);
}
