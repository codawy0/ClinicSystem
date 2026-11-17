using System.ComponentModel.DataAnnotations;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PatientChronicCondition : IAuditableEntity
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    [MaxLength(50)]
    public string ConditionCode { get; set; } = string.Empty;

    [MaxLength(150)]
    public string ConditionName { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public Patient Patient { get; set; } = null!;
}
