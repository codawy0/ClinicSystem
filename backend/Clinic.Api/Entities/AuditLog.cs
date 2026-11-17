using System.ComponentModel.DataAnnotations;

namespace Clinic.Api.Entities;

public class AuditLog
{
    public long Id { get; set; }

    public int? ActorUserId { get; set; }

    [MaxLength(50)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(100)]
    public string EntityName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string EntityId { get; set; } = string.Empty;

    public string? DiffJson { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? ActorUser { get; set; }
}
