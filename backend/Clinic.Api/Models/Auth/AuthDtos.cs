using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Auth;

public class LoginRequestDto
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class UserInfoDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool MustChangePassword { get; set; }
}

public class ClinicSettingSummaryDto
{
    public string ClinicName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string DoctorTitle { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public int ConsultationValidityDays { get; set; }
    public int MaxConsultationsPerExam { get; set; }
    public bool EnableNursingStage { get; set; }
    public TvPrivacyMode TvPrivacyMode { get; set; }
    public string TvDeviceToken { get; set; } = string.Empty;
    public bool IsDoctorOnBreak { get; set; }
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public UserInfoDto User { get; set; } = null!;
    public ClinicSettingSummaryDto ClinicSettings { get; set; } = null!;
}

public class ChangePasswordRequestDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}

public class DevAccountDto
{
    public string Role { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
