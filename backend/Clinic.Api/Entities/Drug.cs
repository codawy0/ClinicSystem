using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class Drug : IAuditableEntity
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string TradeName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string SearchTradeName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string ActiveIngredient { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Strength { get; set; } = string.Empty;

    public DrugForm Form { get; set; }

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(100)]
    public string? DefaultDosage { get; set; }

    [MaxLength(100)]
    public string? DefaultTiming { get; set; }

    [MaxLength(100)]
    public string? DefaultDuration { get; set; }

    public bool AvoidInPregnancy { get; set; } = false;

    public bool AvoidInLactation { get; set; } = false;

    [MaxLength(10)]
    public string? PregnancyCategory { get; set; }

    public bool IsDiscontinued { get; set; } = false;

    public bool IsDemoSeed { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigations
    public ICollection<PrescriptionItem> PrescriptionItems { get; set; } = new List<PrescriptionItem>();
}
