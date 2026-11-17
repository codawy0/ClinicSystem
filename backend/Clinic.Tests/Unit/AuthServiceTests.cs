using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure.Authentication;
using Clinic.Api.Services;

namespace Clinic.Tests.Unit;

[Trait("Category", "Unit")]
public class AuthServiceTests
{
    [Fact]
    public void PasswordHasher_ShouldCorrectlyHashAndVerifyPassword()
    {
        var hasher = new Pbkdf2PasswordHasher();
        string rawPassword = "SecureReceptionistPassword@2026";

        string hash = hasher.HashPassword(rawPassword);

        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().NotBe(rawPassword);

        // Verification of correct password
        bool isValid = hasher.VerifyPassword(rawPassword, hash);
        isValid.Should().BeTrue();

        // Verification of incorrect password
        bool isInvalid = hasher.VerifyPassword("WrongPassword!123", hash);
        isInvalid.Should().BeFalse();
    }

    [Fact]
    public void JwtTokenService_ShouldGenerateValidTokenWithRequiredClaims()
    {
        var options = Options.Create(new JwtOptions
        {
            Secret = "TestSecretKeyForJwtTokenGenerationMustBeLongEnough123456!",
            Issuer = "ClinicSystemTest",
            Audience = "ClinicSystemTestClients",
            ExpiryHours = 8
        });

        var tokenService = new JwtTokenService(options);

        var user = new User
        {
            Id = 42,
            Username = "recept_tester",
            FullName = "أحمد محمد كمال",
            Role = UserRole.Receptionist,
            MustChangePassword = true
        };

        string tokenString = tokenService.GenerateToken(user);
        tokenString.Should().NotBeNullOrWhiteSpace();

        // Validate token structure and claims
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(options.Value.Secret);

        var principal = tokenHandler.ValidateToken(tokenString, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidIssuer = options.Value.Issuer,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        }, out var validatedToken);

        principal.Should().NotBeNull();
        principal.FindFirst(ClaimTypes.NameIdentifier)?.Value.Should().Be("42");
        principal.FindFirst(ClaimTypes.Name)?.Value.Should().Be("recept_tester");
        principal.FindFirst(ClaimTypes.Role)?.Value.Should().Be("Receptionist");
        principal.FindFirst("fullName")?.Value.Should().Be("أحمد محمد كمال");
        principal.FindFirst("mustChangePassword")?.Value.Should().Be("true");
    }

    [Fact]
    public void JwtTokenService_WithTamperedToken_ShouldFailValidation()
    {
        var options = Options.Create(new JwtOptions
        {
            Secret = "TestSecretKeyForJwtTokenGenerationMustBeLongEnough123456!",
            Issuer = "ClinicSystemTest",
            Audience = "ClinicSystemTestClients",
            ExpiryHours = 8
        });

        var tokenService = new JwtTokenService(options);
        var user = new User
        {
            Id = 1,
            Username = "doc",
            FullName = "د. الطبيب",
            Role = UserRole.Doctor
        };

        string tokenString = tokenService.GenerateToken(user);

        // Validate with different key -> must throw SecurityTokenSignatureKeyNotFoundException or SecurityTokenInvalidSignatureException
        var wrongKey = Encoding.UTF8.GetBytes("AnotherDifferentSecretKeyThatDoesNotMatchTheOriginalOne123!");
        var tokenHandler = new JwtSecurityTokenHandler();

        Action act = () => tokenHandler.ValidateToken(tokenString, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(wrongKey),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        }, out _);

        act.Should().Throw<SecurityTokenException>();
    }
}
