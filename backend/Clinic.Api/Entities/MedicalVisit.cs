using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class MedicalVisit : IVersionedEntity, IAuditableEntity
{
    public int Id { get; set; }

    public int AppointmentId { get; set; }

    public int PatientId { get; set; }

    public int DoctorUserId { get; set; }

    public bool IsDraft { get; set; } = true;

    public int? BpSystolic { get; set; }

    public int? BpDiastolic { get; set; }

    public decimal? WeightKg { get; set; }

    public decimal? HeightCm { get; set; }

    public decimal? TempCelsius { get; set; }

    public int? BloodSugarMgDl { get; set; }

    public BloodSugarType? BloodSugarType { get; set; }

    public int? PulseBpm { get; set; }

    public int? Spo2Pct { get; set; }

    public DateOnly? LmpDate { get; set; }

    public string? ChiefComplaint { get; set; }

    public string? NurseNotes { get; set; }

    public string? Examination { get; set; }

    public string? Diagnosis { get; set; }

    [MaxLength(20)]
    public string? Icd10Code { get; set; }

    public string? DoctorPrivateNotes { get; set; }

    public string? SpecialtyDataJson { get; set; }

    public DateOnly? NextVisitDate { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    public long Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    // Navigations
    public Appointment Appointment { get; set; } = null!;
    public Patient Patient { get; set; } = null!;
    public User Doctor { get; set; } = null!;
    public ICollection<VisitAddendum> Addenda { get; set; } = new List<VisitAddendum>();
    public ICollection<PrescriptionItem> PrescriptionItems { get; set; } = new List<PrescriptionItem>();
    public ICollection<ClinicalRequestItem> ClinicalRequests { get; set; } = new List<ClinicalRequestItem>();
    public ICollection<PatientAttachment> Attachments { get; set; } = new List<PatientAttachment>();
}
