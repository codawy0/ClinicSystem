using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class Patient : IVersionedEntity, IAuditableEntity
{
    public int Id { get; set; }

    [MaxLength(30)]
    public string FileNumber { get; set; } = string.Empty;

    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string SearchName { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(30)]
    public string NormalizedPhone { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? SecondaryPhone { get; set; }

    [MaxLength(14)]
    public string? NationalId { get; set; }

    public PatientGender Gender { get; set; }

    public DateOnly? BirthDate { get; set; }

    public int? ApproximateAgeYears { get; set; }

    public int? GuardianPatientId { get; set; }

    public BloodType? BloodType { get; set; }

    public bool IsPregnant { get; set; } = false;

    public bool IsLactating { get; set; } = false;

    public long Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    // Navigations
    public Patient? GuardianPatient { get; set; }
    public ICollection<Patient> Dependents { get; set; } = new List<Patient>();
    public ICollection<PatientAllergy> Allergies { get; set; } = new List<PatientAllergy>();
    public ICollection<PatientChronicCondition> ChronicConditions { get; set; } = new List<PatientChronicCondition>();
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<MedicalVisit> MedicalVisits { get; set; } = new List<MedicalVisit>();
    public ICollection<PatientAttachment> Attachments { get; set; } = new List<PatientAttachment>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}
