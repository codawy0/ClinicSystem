using System.ComponentModel.DataAnnotations;

namespace Clinic.Api.Models.Backup;

public class BackupInfoDto
{
    public string FileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public string IntegrityStatus { get; set; } = "ok";
    public DateTime CreatedAtUtc { get; set; }
}

public class RestoreBackupRequestDto
{
    [Required(ErrorMessage = "اسم ملف النسخة الاحتياطية إلزامي.")]
    [RegularExpression(@"^[a-zA-Z0-9_\-\.]+\.zip$", ErrorMessage = "اسم ملف النسخة الاحتياطية غير صالح.")]
    public string FileName { get; set; } = string.Empty;
}

public class RestoreBackupResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string RestoredFromFileName { get; set; } = string.Empty;
    public string? PreRestoreEmergencyBackupFileName { get; set; }
    public DateTime RestoredAtUtc { get; set; }
}

public class BackupManifestDto
{
    public string Version { get; set; } = "1.0";
    public DateTime CreatedAtUtc { get; set; }
    public long UncompressedSizeBytes { get; set; }
    public string DbSha256 { get; set; } = string.Empty;
    public string IntegrityStatus { get; set; } = "ok";
}
