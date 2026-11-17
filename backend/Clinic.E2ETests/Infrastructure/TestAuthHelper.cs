using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Clinic.E2ETests.Infrastructure;

public static class TestAuthHelper
{
    public const string JwtSecret = "ClinicManagementSystemSuperSecretKey2026!MustBeAtLeast32BytesLongForHmacSha256";
    public const string JwtIssuer = "ClinicSystem";
    public const string JwtAudience = "ClinicSystemClients";
    public const string DefaultTvDeviceToken = "tv-waiting-room-secret-token";

    public static string GenerateToken(
        string username,
        string role,
        int userId = 2,
        string fullName = "د. حازم القاضي",
        int expireMinutes = 120)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim("FullName", fullName),
            new Claim("UserId", userId.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expireMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string AdminToken(int userId = 1, string username = "admin")
        => GenerateToken(username, "Admin", userId, "مدير النظام");

    public static string DoctorToken(int userId = 2, string username = "doctor")
        => GenerateToken(username, "Doctor", userId, "د. حازم القاضي");

    public static string AssistantDoctorToken(int userId = 5, string username = "assistant")
        => GenerateToken(username, "AssistantDoctor", userId, "د. أحمد كمال");

    public static string NurseToken(int userId = 3, string username = "nurse")
        => GenerateToken(username, "Nurse", userId, "منى السيد");

    public static string ReceptionistToken(int userId = 4, string username = "receptionist")
        => GenerateToken(username, "Receptionist", userId, "سارة محمود");

    public static string ExpiredToken(string role = "Doctor")
        => GenerateToken("expired_user", role, 999, "منتهي الصلاحية", expireMinutes: -60);

    public static string MalformedToken()
        => "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid_signature_here";
}
