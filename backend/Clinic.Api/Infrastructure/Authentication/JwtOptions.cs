namespace Clinic.Api.Infrastructure.Authentication;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = "ClinicManagementSystemSuperSecretKey2026!MustBeAtLeast32BytesLongForHmacSha256";
    public string Issuer { get; set; } = "ClinicSystem";
    public string Audience { get; set; } = "ClinicSystemClients";
    public int ExpiryHours { get; set; } = 12;
}
