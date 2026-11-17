using Microsoft.AspNetCore.Http;

namespace Clinic.Api.Models.Attachments;

public class UploadAttachmentRequest
{
    public int PatientId { get; set; }
    public int? MedicalVisitId { get; set; }
    public string? FileType { get; set; }
    public string? Category { get; set; }
    public string? Title { get; set; }
    public IFormFile? File { get; set; }
}

public class AttachmentDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public int? MedicalVisitId { get; set; }
    public string FileType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StorageFileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public long SizeBytes { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public DateTime UploadedAtUtc { get; set; }
}
