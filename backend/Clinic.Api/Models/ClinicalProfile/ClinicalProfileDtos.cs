using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.ClinicalProfile;

public class PatientClinicalProfileDto
{
    public int PatientId { get; set; }
    public string FileNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public PatientGender Gender { get; set; }
    public int? ApproximateAgeYears { get; set; }
    public DateOnly? BirthDate { get; set; }
    public BloodType? BloodType { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
    public List<PatientAllergyDto> Allergies { get; set; } = new();
    public List<PatientChronicConditionDto> ChronicConditions { get; set; } = new();
}

public class PatientAllergyDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string ActiveIngredient { get; set; } = string.Empty;
    public string AllergyName { get; set; } = string.Empty;
    public AllergySeverity Severity { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AddPatientAllergyRequestDto
{
    [Required(ErrorMessage = "المادة الفعالة أو اسم المسبب للحساسية مطلوب")]
    [MaxLength(150)]
    public string ActiveIngredient { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? AllergyName { get; set; }

    public AllergySeverity Severity { get; set; } = AllergySeverity.Moderate;

    public string? Notes { get; set; }
}

public class PatientChronicConditionDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string ConditionCode { get; set; } = string.Empty;
    public string ConditionName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AddPatientChronicConditionRequestDto
{
    [Required(ErrorMessage = "اسم المرض المزمن مطلوب")]
    [MaxLength(150)]
    public string ConditionName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? ConditionCode { get; set; }

    public string? Notes { get; set; }
}
