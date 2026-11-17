using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class Appointment : IVersionedEntity, IAuditableEntity
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    public int DoctorUserId { get; set; }

    public int ServiceId { get; set; }

    public DateOnly BusinessDate { get; set; }

    public int? QueueNumber { get; set; }

    public BookingType BookingType { get; set; } = BookingType.WalkIn;

    public bool IsUrgent { get; set; } = false;

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Booked;

    public bool IsConsultation { get; set; } = false;

    public int? ParentExamAppointmentId { get; set; }

    public DateTime? ArrivedAtUtc { get; set; }

    public DateTime? CalledAtUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    public long CallSequence { get; set; } = 0L;

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }

    [MaxLength(100)]
    public string? CallIdempotencyKey { get; set; }

    public long Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigations
    public Patient Patient { get; set; } = null!;
    public User Doctor { get; set; } = null!;
    public ServiceCatalog Service { get; set; } = null!;
    public Appointment? ParentExamAppointment { get; set; }
    public ICollection<Appointment> FollowUpConsultations { get; set; } = new List<Appointment>();
    public ICollection<AppointmentStatusHistory> StatusHistories { get; set; } = new List<AppointmentStatusHistory>();
    public MedicalVisit? MedicalVisit { get; set; }
    public Invoice? Invoice { get; set; }
}
