using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PatientAttachment : IAuditableEntity
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    public int? MedicalVisitId { get; set; }

    public AttachmentFileType FileType { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(100)]
    public string StorageFileName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string OriginalFileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string MimeType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public int UploadedByUserId { get; set; }

    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;

    public bool IsDeleted { get; set; } = false;

    // Navigations
    public Patient Patient { get; set; } = null!;
    public MedicalVisit? MedicalVisit { get; set; }
    public User UploadedByUser { get; set; } = null!;
}
