using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Patients;

public class CreatePatientRequestDto
{
    [Required(ErrorMessage = "اسم المريض مطلوب")]
    [MinLength(3, ErrorMessage = "اسم المريض يجب أن يتكون من 3 أحرف على الأقل")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "رقم الهاتف مطلوب")]
    public string Phone { get; set; } = string.Empty;

    public string? SecondaryPhone { get; set; }
    public string? NationalId { get; set; }
    public PatientGender Gender { get; set; } = PatientGender.Male;
    public DateOnly? BirthDate { get; set; }
    public int? ApproximateAgeYears { get; set; }
    public int? GuardianPatientId { get; set; }
    public BloodType? BloodType { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
    public List<string>? Allergies { get; set; }
    public List<string>? ChronicConditions { get; set; }
}

public class UpdatePatientRequestDto
{
    [Required(ErrorMessage = "اسم المريض مطلوب")]
    [MinLength(3, ErrorMessage = "اسم المريض يجب أن يتكون من 3 أحرف على الأقل")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "رقم الهاتف مطلوب")]
    public string Phone { get; set; } = string.Empty;

    public string? SecondaryPhone { get; set; }
    public string? NationalId { get; set; }
    public PatientGender Gender { get; set; }
    public DateOnly? BirthDate { get; set; }
    public int? ApproximateAgeYears { get; set; }
    public int? GuardianPatientId { get; set; }
    public BloodType? BloodType { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
    public List<string>? Allergies { get; set; }
    public List<string>? ChronicConditions { get; set; }

    [Required]
    public long Version { get; set; }
}

public class PatientAllergyDto
{
    public int Id { get; set; }
    public string ActiveIngredient { get; set; } = string.Empty;
    public string AllergyName { get; set; } = string.Empty;
    public AllergySeverity Severity { get; set; }
    public string? Notes { get; set; }
}

public class PatientChronicConditionDto
{
    public int Id { get; set; }
    public string ConditionCode { get; set; } = string.Empty;
    public string ConditionName { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class PatientRecentAppointmentDto
{
    public int Id { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public AppointmentStatus Status { get; set; }
    public bool IsConsultation { get; set; }
}

public class PatientDto
{
    public int Id { get; set; }
    public string FileNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? SecondaryPhone { get; set; }
    public string? NationalId { get; set; }
    public PatientGender Gender { get; set; }
    public DateOnly? BirthDate { get; set; }
    public int? ApproximateAgeYears { get; set; }
    public int? GuardianPatientId { get; set; }
    public string? GuardianName { get; set; }
    public BloodType? BloodType { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public long Version { get; set; }

    public List<PatientAllergyDto> Allergies { get; set; } = new();
    public List<PatientChronicConditionDto> ChronicConditions { get; set; } = new();
    public List<PatientRecentAppointmentDto> RecentAppointments { get; set; } = new();
}

public class PatientSearchResultDto
{
    public PatientDto Patient { get; set; } = null!;
    public List<PatientDto> FamilyMembers { get; set; } = new();
}

public class ConsultationEligibilityDto
{
    public bool IsEligible { get; set; }
    public int? ParentExamAppointmentId { get; set; }
    public DateOnly? ExamDate { get; set; }
    public int? DaysSinceExam { get; set; }
    public int? DaysRemaining { get; set; }
    public int ConsumedConsultations { get; set; }
    public int MaxConsultations { get; set; }
    public string? Reason { get; set; } // "EXPIRED", "MAX_CONSULTATIONS_REACHED", "NO_PREVIOUS_EXAM", null
}
