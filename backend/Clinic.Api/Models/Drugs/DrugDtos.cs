using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Drugs;

public class DrugSummaryDto
{
    public int Id { get; set; }
    public string TradeName { get; set; } = string.Empty;
    public string ActiveIngredient { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public DrugForm Form { get; set; }
    public string? Category { get; set; }
    public string? DefaultDosage { get; set; }
    public string? DefaultTiming { get; set; }
    public string? DefaultDuration { get; set; }
    public bool AvoidInPregnancy { get; set; }
    public bool AvoidInLactation { get; set; }
    public string? PregnancyCategory { get; set; }
    public bool IsPregnancySafe => !AvoidInPregnancy && PregnancyCategory != "D" && PregnancyCategory != "X";
    public bool IsDiscontinued { get; set; }
}

public class DrugDetailDto : DrugSummaryDto
{
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateDrugRequestDto
{
    [Required, MaxLength(150)]
    public string TradeName { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string ActiveIngredient { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Strength { get; set; } = string.Empty;

    [Required]
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
    public string? PregnancyCategory { get; set; }
}

public class DrugSafetyCheckRequestDto
{
    [Required]
    public int PatientId { get; set; }

    [Required]
    public List<int> DrugIds { get; set; } = new();

    public bool? IsPregnant { get; set; }
    public bool? IsLactating { get; set; }
}

public class SafetyWarningDto
{
    public int DrugId { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public string ActiveIngredient { get; set; } = string.Empty;
    public string Severity { get; set; } = "Severe"; // "Severe" | "Moderate" | "Info"
    public string Type { get; set; } = "Allergy";     // "Allergy" | "Pregnancy" | "Lactation" | "DuplicateIngredient" | "Discontinued"
    public string MessageAr { get; set; } = string.Empty;
    public bool RequiresOverride { get; set; } = true;
}

public class DrugSafetyCheckResultDto
{
    public bool HasWarnings => Warnings.Count > 0;
    public bool HasSevereWarnings => Warnings.Any(w => w.Severity == "Severe");
    public bool RequiresOverride => Warnings.Any(w => w.RequiresOverride);
    public List<SafetyWarningDto> Warnings { get; set; } = new();
}
