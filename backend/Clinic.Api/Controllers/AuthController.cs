using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Models.Auth;
using Clinic.Api.Services;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
public class AuthController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ClinicDbContext context,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILogger<AuthController> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.Trim().ToLower() && u.IsActive);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for username: {Username}", request.Username);
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "INVALID_CREDENTIALS",
                detail: "اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        var token = _jwtTokenService.GenerateToken(user);

        var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync()
            ?? new Entities.ClinicSetting();

        var response = new LoginResponseDto
        {
            Token = token,
            User = new UserInfoDto
            {
                Id = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Role = user.Role,
                MustChangePassword = user.MustChangePassword
            },
            ClinicSettings = new ClinicSettingSummaryDto
            {
                ClinicName = setting.ClinicName,
                DoctorName = setting.DoctorName,
                DoctorTitle = setting.DoctorTitle,
                Specialty = setting.Specialty,
                ConsultationValidityDays = setting.ConsultationValidityDays,
                MaxConsultationsPerExam = setting.MaxConsultationsPerExam,
                EnableNursingStage = setting.EnableNursingStage,
                TvPrivacyMode = setting.TvPrivacyMode,
                TvDeviceToken = setting.TvDeviceToken,
                IsDoctorOnBreak = setting.IsDoctorOnBreak
            }
        };

        _logger.LogInformation("User {Username} (Role: {Role}) logged in successfully", user.Username, user.Role);
        return Ok(response);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound("المستخدم غير موجود");
        }

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "INVALID_CURRENT_PASSWORD",
                detail: "كلمة المرور الحالية غير صحيحة");
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.MustChangePassword = false;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Password changed successfully for user #{UserId} ({Username})", user.Id, user.Username);
        return Ok(new { success = true, message = "تم تغيير كلمة المرور بنجاح" });
    }

    [HttpGet("dev-accounts")]
    [AllowAnonymous]
    public ActionResult<List<DevAccountDto>> GetDevAccounts()
    {
        var accounts = new List<DevAccountDto>
        {
            new()
            {
                Role = "Admin",
                Username = "admin",
                Password = "Admin@123",
                FullName = "مدير النظام",
                Description = "صلاحيات كاملة لإدارة النظام والإعدادات والمستخدمين"
            },
            new()
            {
                Role = "Doctor",
                Username = "doctor",
                Password = "Doctor@123",
                FullName = "د. استشاري العيادة",
                Description = "كابينة الطبيب، الفحص والروشتة الإلكترونية واستدعاء المرضى"
            },
            new()
            {
                Role = "Nurse",
                Username = "nurse",
                Password = "Nurse@123",
                FullName = "تمريض العيادة",
                Description = "تسجيل العلامات الحيوية وتحضير المرضى"
            },
            new()
            {
                Role = "Receptionist",
                Username = "receptionist",
                Password = "Recept@123",
                FullName = "مسؤول الاستقبال",
                Description = "حجز المواعيد، إدارة الوردية النقدية والدرج وطباعة الإيصالات"
            },
            new()
            {
                Role = "AssistantDoctor",
                Username = "assistant",
                Password = "Doctor@123",
                FullName = "طبيب مساعد",
                Description = "مساعد الطبيب والاستدعاء وتسجيل الحالات"
            }
        };

        return Ok(accounts);
    }
}
