using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class User : IAuditableEntity
{
    public int Id { get; set; }

    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public bool IsActive { get; set; } = true;

    public bool MustChangePassword { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    // Navigations
    public ICollection<Shift> Shifts { get; set; } = new List<Shift>();
    public ICollection<Appointment> DoctorAppointments { get; set; } = new List<Appointment>();
    public ICollection<AppointmentStatusHistory> StatusHistories { get; set; } = new List<AppointmentStatusHistory>();
    public ICollection<MedicalVisit> DoctorVisits { get; set; } = new List<MedicalVisit>();
    public ICollection<VisitAddendum> VisitAddenda { get; set; } = new List<VisitAddendum>();
    public ICollection<FinancialTransaction> CreatedTransactions { get; set; } = new List<FinancialTransaction>();
    public ICollection<PatientAttachment> UploadedAttachments { get; set; } = new List<PatientAttachment>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<PrescriptionTemplate> PrescriptionTemplates { get; set; } = new List<PrescriptionTemplate>();
    public ICollection<Invoice> ApprovedInvoices { get; set; } = new List<Invoice>();
}
