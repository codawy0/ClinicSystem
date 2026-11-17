using System.ComponentModel.DataAnnotations;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PrescriptionTemplate : IAuditableEntity
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string TemplateName { get; set; } = string.Empty;

    public string? DefaultDiagnosis { get; set; }

    public string ItemsJson { get; set; } = string.Empty;

    public string? LabRadiologyOrdersJson { get; set; }

    public int DoctorUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public User Doctor { get; set; } = null!;
}
