using System.ComponentModel.DataAnnotations;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PrescriptionItem : IAuditableEntity
{
    public int Id { get; set; }

    public int MedicalVisitId { get; set; }

    public int? DrugId { get; set; }

    [MaxLength(150)]
    public string DrugNameSnapshot { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? StrengthSnapshot { get; set; }

    [MaxLength(50)]
    public string? FormSnapshot { get; set; }

    [MaxLength(150)]
    public string? ActiveIngredientSnapshot { get; set; }

    [MaxLength(100)]
    public string Dosage { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Timing { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Duration { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public bool WarningOverridden { get; set; } = false;

    public string? OverrideReason { get; set; }

    // Navigations
    public MedicalVisit MedicalVisit { get; set; } = null!;
    public Drug? Drug { get; set; }
}
