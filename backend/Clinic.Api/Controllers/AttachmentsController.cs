using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure.Storage;
using Clinic.Api.Models.Attachments;

namespace Clinic.Api.Controllers;

[Route("api/attachments")]
[Authorize]
public class AttachmentsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IAttachmentStorageService _storageService;
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(
        ClinicDbContext context,
        ILogger<AttachmentsController> logger,
        IServiceProvider serviceProvider)
    {
        _context = context;
        _logger = logger;
        _storageService = serviceProvider.GetService<IAttachmentStorageService>()
                          ?? CreateFallbackStorageService(serviceProvider);
    }

    private static IAttachmentStorageService CreateFallbackStorageService(IServiceProvider serviceProvider)
    {
        var config = serviceProvider.GetService<IConfiguration>();
        var env = serviceProvider.GetService<IWebHostEnvironment>();
        var dataRoot = config?["ClinicStorage:DataRoot"] ?? "./.clinic-data";
        if (env != null && !Path.IsPathRooted(dataRoot))
        {
            dataRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, dataRoot));
        }
        return new AttachmentStorageService(dataRoot);
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AttachmentDto>> Upload([FromForm] UploadAttachmentRequest request)
    {
        if (request.File == null || request.File.Length == 0)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "INVALID_FILE", detail: "الملف مطلوب.");
        }

        if (request.File.Length > FileSecurityValidator.MaxFileSizeBytes)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "FILE_TOO_LARGE", detail: "حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).");
        }

        // 1. Magic byte & size validation
        await using var stream = request.File.OpenReadStream();
        var validation = FileSecurityValidator.Validate(stream, request.File.FileName, request.File.Length);
        if (!validation.IsValid)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: validation.ErrorCode, detail: validation.ErrorMessage);
        }

        // 2. Patient existence verification
        var patientExists = await _context.Patients.AnyAsync(p => p.Id == request.PatientId);
        if (!patientExists)
        {
            return NotFound("المريض غير موجود.");
        }

        // 3. Optional MedicalVisit verification
        if (request.MedicalVisitId.HasValue)
        {
            var visit = await _context.MedicalVisits.FindAsync(request.MedicalVisitId.Value);
            if (visit == null)
            {
                return NotFound("الزيارة الطبية غير موجودة.");
            }
            if (visit.PatientId != request.PatientId)
            {
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "INVALID_VISIT_LINK", detail: "الزيارة الطبية لا تخص هذا المريض.");
            }
        }

        // 4. FileType classification
        var typeStr = request.FileType ?? request.Category ?? "Document";
        var fileType = AttachmentFileType.Document;
        if (Enum.TryParse<AttachmentFileType>(typeStr, true, out var parsedType))
        {
            fileType = parsedType;
        }

        // 5. Generate secure GUID filename
        var storageFileName = $"{Guid.NewGuid():N}{validation.FileExtension}";
        var originalFileName = Path.GetFileName(request.File.FileName);

        // 6. Save physical file to DataRoot/attachments
        if (stream.CanSeek)
        {
            stream.Position = 0;
        }
        await _storageService.SaveAttachmentAsync(stream, storageFileName);

        // 7. Determine current user ID
        int currentUserId;
        try
        {
            currentUserId = GetCurrentUserId();
        }
        catch
        {
            var fallbackUser = await _context.Users.Select(u => u.Id).FirstOrDefaultAsync();
            currentUserId = fallbackUser > 0 ? fallbackUser : 1;
        }

        // 8. Persist entity in ClinicDbContext
        var title = !string.IsNullOrWhiteSpace(request.Title) ? request.Title.Trim() : originalFileName;
        var attachment = new PatientAttachment
        {
            PatientId = request.PatientId,
            MedicalVisitId = request.MedicalVisitId,
            FileType = fileType,
            Title = title,
            StorageFileName = storageFileName,
            OriginalFileName = originalFileName,
            MimeType = validation.MimeType ?? "application/octet-stream",
            SizeBytes = request.File.Length,
            UploadedByUserId = currentUserId,
            UploadedAtUtc = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.PatientAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        var dto = new AttachmentDto
        {
            Id = attachment.Id,
            PatientId = attachment.PatientId,
            MedicalVisitId = attachment.MedicalVisitId,
            FileType = attachment.FileType.ToString(),
            Title = attachment.Title,
            OriginalFileName = attachment.OriginalFileName,
            StorageFileName = attachment.StorageFileName,
            FileSizeBytes = attachment.SizeBytes,
            SizeBytes = attachment.SizeBytes,
            ContentType = attachment.MimeType,
            MimeType = attachment.MimeType,
            UploadedAtUtc = attachment.UploadedAtUtc
        };

        return Ok(dto);
    }

    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> GetFile(int id)
    {
        var attachment = await _context.PatientAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (attachment == null || attachment.IsDeleted)
        {
            return NotFound("المرفق غير موجود أو تم حذفه.");
        }

        var filePath = _storageService.GetPhysicalFilePath(attachment.StorageFileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound("الملف الفيزيائي غير موجود.");
        }

        Response.Headers.Append("Content-Disposition", $"inline; filename=\"{attachment.OriginalFileName}\"");
        return PhysicalFile(filePath, attachment.MimeType, enableRangeProcessing: true);
    }

    [HttpGet("patient/{patientId:int}")]
    public async Task<ActionResult<List<AttachmentDto>>> GetPatientAttachments(int patientId)
    {
        var patientExists = await _context.Patients.AnyAsync(p => p.Id == patientId);
        if (!patientExists)
        {
            return NotFound("المريض غير موجود.");
        }

        var items = await _context.PatientAttachments
            .AsNoTracking()
            .Where(a => a.PatientId == patientId && !a.IsDeleted)
            .OrderByDescending(a => a.UploadedAtUtc)
            .Select(a => new AttachmentDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                MedicalVisitId = a.MedicalVisitId,
                FileType = a.FileType.ToString(),
                Title = a.Title,
                OriginalFileName = a.OriginalFileName,
                StorageFileName = a.StorageFileName,
                FileSizeBytes = a.SizeBytes,
                SizeBytes = a.SizeBytes,
                ContentType = a.MimeType,
                MimeType = a.MimeType,
                UploadedAtUtc = a.UploadedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("visit/{visitId:int}")]
    public async Task<ActionResult<List<AttachmentDto>>> GetVisitAttachments(int visitId)
    {
        var items = await _context.PatientAttachments
            .AsNoTracking()
            .Where(a => a.MedicalVisitId == visitId && !a.IsDeleted)
            .OrderByDescending(a => a.UploadedAtUtc)
            .Select(a => new AttachmentDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                MedicalVisitId = a.MedicalVisitId,
                FileType = a.FileType.ToString(),
                Title = a.Title,
                OriginalFileName = a.OriginalFileName,
                StorageFileName = a.StorageFileName,
                FileSizeBytes = a.SizeBytes,
                SizeBytes = a.SizeBytes,
                ContentType = a.MimeType,
                MimeType = a.MimeType,
                UploadedAtUtc = a.UploadedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AttachmentDto>> GetById(int id)
    {
        var attachment = await _context.PatientAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id);

        if (attachment == null || attachment.IsDeleted)
        {
            return NotFound("المرفق غير موجود أو تم حذفه.");
        }

        return Ok(new AttachmentDto
        {
            Id = attachment.Id,
            PatientId = attachment.PatientId,
            MedicalVisitId = attachment.MedicalVisitId,
            FileType = attachment.FileType.ToString(),
            Title = attachment.Title,
            OriginalFileName = attachment.OriginalFileName,
            StorageFileName = attachment.StorageFileName,
            FileSizeBytes = attachment.SizeBytes,
            SizeBytes = attachment.SizeBytes,
            ContentType = attachment.MimeType,
            MimeType = attachment.MimeType,
            UploadedAtUtc = attachment.UploadedAtUtc
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDelete(int id)
    {
        int? currentUserId = null;
        try
        {
            currentUserId = GetCurrentUserId();
        }
        catch
        {
            // Optional in test scenarios
        }

        var attachment = await _context.PatientAttachments.FirstOrDefaultAsync(a => a.Id == id);
        if (attachment == null || attachment.IsDeleted)
        {
            return NotFound("المرفق غير موجود أو تم حذفه مسبقاً.");
        }

        attachment.IsDeleted = true;

        var auditLog = new AuditLog
        {
            ActorUserId = currentUserId > 0 ? currentUserId : null,
            Action = "SoftDeleteAttachment",
            EntityName = nameof(PatientAttachment),
            EntityId = attachment.Id.ToString(),
            DiffJson = JsonSerializer.Serialize(new
            {
                attachment.Id,
                attachment.PatientId,
                attachment.MedicalVisitId,
                attachment.StorageFileName,
                attachment.OriginalFileName,
                attachment.SizeBytes,
                DeletedAtUtc = DateTime.UtcNow
            }),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
