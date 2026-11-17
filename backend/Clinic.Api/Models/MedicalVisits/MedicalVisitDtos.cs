using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.MedicalVisits;

public class InitVisitRequestDto
{
    [Required]
    public int AppointmentId { get; set; }
}

public class InitOrGetVisitRequestDto : InitVisitRequestDto
{
}

public class UpdateVitalsRequestDto
{
    [Required]
    public long Version { get; set; }

    [Range(40, 300)]
    public int? BpSystolic { get; set; }

    [Range(30, 200)]
    public int? BpDiastolic { get; set; }

    [Range(20, 300)]
    public int? PulseBpm { get; set; }

    [Range(30.0, 45.0)]
    public decimal? TempCelsius { get; set; }

    [Range(10, 1000)]
    public int? BloodSugarMgDl { get; set; }

    public BloodSugarType? BloodSugarType { get; set; }

    [Range(40, 100)]
    public int? Spo2Pct { get; set; }

    [Range(1.0, 500.0)]
    public decimal? WeightKg { get; set; }

    [Range(30.0, 250.0)]
    public decimal? HeightCm { get; set; }

    public DateOnly? LmpDate { get; set; }

    public string? ChiefComplaint { get; set; }

    public string? NurseNotes { get; set; }

    public bool? IsPregnant { get; set; }

    public bool? IsLactating { get; set; }

    public bool MarkNursePrepComplete { get; set; } = false;
}

public class SaveVitalsRequestDto : UpdateVitalsRequestDto
{
}

public class AutosaveDraftNotesRequestDto
{
    [Required]
    public long Version { get; set; }

    public string? ChiefComplaint { get; set; }
    public string? Examination { get; set; }
    public string? Diagnosis { get; set; }
    [MaxLength(20)]
    public string? Icd10Code { get; set; }
    public string? DoctorPrivateNotes { get; set; }
    public string? SpecialtyDataJson { get; set; }
    public DateOnly? NextVisitDate { get; set; }
    public string? NurseNotes { get; set; }
}

public class UpdateVisitDraftRequestDto : AutosaveDraftNotesRequestDto
{
}

public class CreateAddendumRequestDto
{
    [Required]
    public string NoteText { get; set; } = string.Empty;
}

public class VisitAddendumDto
{
    public int Id { get; set; }
    public int MedicalVisitId { get; set; }
    public int AuthorUserId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string AuthorRole { get; set; } = string.Empty;
    public string NoteText { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class VitalAlertDto
{
    public string Parameter { get; set; } = string.Empty; // "Bp" | "Pulse" | "Temp" | "BloodSugar" | "Spo2" | "Bmi"
    public string Severity { get; set; } = "Warning";      // "Warning" | "Critical" | "Info"
    public string MessageAr { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

public class VitalAlertsSummaryDto
{
    public bool IsBpHigh { get; set; }
    public bool IsBpLow { get; set; }
    public bool IsPulseHigh { get; set; }
    public bool IsPulseLow { get; set; }
    public bool IsTempHigh { get; set; }
    public bool IsTempLow { get; set; }
    public bool IsGlucoseHigh { get; set; }
    public bool IsGlucoseLow { get; set; }
    public bool IsSpo2Low { get; set; }
    public bool HasAlerts => IsBpHigh || IsBpLow || IsPulseHigh || IsPulseLow || IsTempHigh || IsTempLow || IsGlucoseHigh || IsGlucoseLow || IsSpo2Low;
    public List<VitalAlertDto> Items { get; set; } = new();
}

public class PatientSummaryDto
{
    public int Id { get; set; }
    public string FileNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public PatientGender Gender { get; set; }
    public DateOnly? BirthDate { get; set; }
    public int? ApproximateAgeYears { get; set; }
    public BloodType? BloodType { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
}

public class MedicalVisitDetailDto
{
    public int Id { get; set; }
    public int AppointmentId { get; set; }
    public int PatientId { get; set; }
    public int DoctorUserId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateOnly BusinessDate { get; set; }
    public int? QueueNumber { get; set; }
    public bool IsDraft { get; set; }
    public string Status => (!IsDraft || CompletedAtUtc.HasValue) ? "Completed" : "Draft";

    // Vitals
    public int? BpSystolic { get; set; }
    public int? BpDiastolic { get; set; }
    public int? PulseBpm { get; set; }
    public decimal? TempCelsius { get; set; }
    public int? BloodSugarMgDl { get; set; }
    public BloodSugarType? BloodSugarType { get; set; }
    public int? Spo2Pct { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public string? BmiCategory { get; set; }
    public DateOnly? LmpDate { get; set; }
    public bool IsPregnant { get; set; }
    public bool IsLactating { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? NurseNotes { get; set; }

    // Clinical Notes
    public string? Examination { get; set; }
    public string? Diagnosis { get; set; }
    public string? Icd10Code { get; set; }
    public string? DoctorPrivateNotes { get; set; }
    public string? SpecialtyDataJson { get; set; }
    public DateOnly? NextVisitDate { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public long Version { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    // Child Collections & Alerts
    public VitalAlertsSummaryDto Alerts { get; set; } = new();
    public List<VisitAddendumDto> Addenda { get; set; } = new();
    public List<PrescriptionItemDto> PrescriptionItems { get; set; } = new();
    public List<ClinicalRequestItemDto> ClinicalRequests { get; set; } = new();
    public PatientSummaryDto? Patient { get; set; }
}

public class PrescriptionItemDto
{
    public int Id { get; set; }
    public int MedicalVisitId { get; set; }
    public int? DrugId { get; set; }
    public string DrugNameSnapshot { get; set; } = string.Empty;
    public string? StrengthSnapshot { get; set; }
    public string? FormSnapshot { get; set; }
    public string? ActiveIngredientSnapshot { get; set; }
    public string Dosage { get; set; } = string.Empty;
    public string Timing { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public bool WarningOverridden { get; set; }
    public string? OverrideReason { get; set; }
}

public class ClinicalRequestItemDto
{
    public int Id { get; set; }
    public int MedicalVisitId { get; set; }
    public RequestType RequestType { get; set; }
    public string? CatalogCode { get; set; }
    public string NameAr { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string? Notes { get; set; }
    public string? ResultSummary { get; set; }
}

public class CompleteVisitPrescriptionItemDto
{
    public int? DrugId { get; set; }

    [Required]
    public string DrugName { get; set; } = string.Empty;

    public string? ActiveIngredient { get; set; }
    public string? Strength { get; set; }
    public string? Form { get; set; }

    [Required]
    public string Dosage { get; set; } = string.Empty;

    [Required]
    public string Timing { get; set; } = string.Empty;

    [Required]
    public string Duration { get; set; } = string.Empty;

    public string? Notes { get; set; }
    public bool WarningOverridden { get; set; } = false;
    public string? OverrideReason { get; set; }
}

public class CompleteVisitClinicalRequestDto
{
    [Required]
    public RequestType RequestType { get; set; }

    public string? CatalogCode { get; set; }

    [Required]
    public string NameAr { get; set; } = string.Empty;

    public string? NameEn { get; set; }
    public string? Notes { get; set; }
}

public class CompleteVisitRequestDto
{
    [Required]
    public long Version { get; set; }

    public string? ChiefComplaint { get; set; }
    public string? Examination { get; set; }
    public string? Diagnosis { get; set; }
    public string? Icd10Code { get; set; }
    public string? DoctorPrivateNotes { get; set; }
    public string? SpecialtyDataJson { get; set; }
    public DateOnly? NextVisitDate { get; set; }

    public List<CompleteVisitPrescriptionItemDto> PrescriptionItems { get; set; } = new();
    public List<CompleteVisitClinicalRequestDto> ClinicalRequests { get; set; } = new();
}

public class MedicalVisitSummaryDto
{
    public int Id { get; set; }
    public int AppointmentId { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string? Diagnosis { get; set; }
    public string? ChiefComplaint { get; set; }
    public bool IsDraft { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int? BpSystolic { get; set; }
    public int? BpDiastolic { get; set; }
    public int? PulseBpm { get; set; }
    public decimal? TempCelsius { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int AddendaCount { get; set; }
}

public class VisitSummaryDto : MedicalVisitSummaryDto
{
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public int PageIndex => Page;
}

public class PaginatedListDto<T> : PagedResult<T>
{
}
