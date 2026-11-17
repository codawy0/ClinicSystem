using System.ComponentModel.DataAnnotations;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class AppointmentStatusHistory : IAuditableEntity
{
    public int Id { get; set; }

    public int AppointmentId { get; set; }

    [MaxLength(50)]
    public string? FromStatus { get; set; }

    [MaxLength(50)]
    public string ToStatus { get; set; } = string.Empty;

    public int ChangedByUserId { get; set; }

    [MaxLength(255)]
    public string? Reason { get; set; }

    public DateTime ChangedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigations
    public Appointment Appointment { get; set; } = null!;
    public User ChangedByUser { get; set; } = null!;
}
