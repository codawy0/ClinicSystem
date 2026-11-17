using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PatientAllergy : IAuditableEntity
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    [MaxLength(150)]
    public string ActiveIngredient { get; set; } = string.Empty;

    [MaxLength(150)]
    public string AllergyName { get; set; } = string.Empty;

    public AllergySeverity Severity { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public Patient Patient { get; set; } = null!;
}
