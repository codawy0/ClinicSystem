using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class VisitAddendum : IAuditableEntity
{
    public int Id { get; set; }

    public int MedicalVisitId { get; set; }

    public int AuthorUserId { get; set; }

    public string NoteText { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigations
    public MedicalVisit MedicalVisit { get; set; } = null!;
    public User AuthorUser { get; set; } = null!;
}
