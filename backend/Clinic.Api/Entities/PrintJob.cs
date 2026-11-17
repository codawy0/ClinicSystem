using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class PrintJob : IAuditableEntity
{
    public int Id { get; set; }

    public PrintJobTargetRole TargetRole { get; set; }

    public PrintDocumentType DocumentType { get; set; }

    public string PayloadJson { get; set; } = string.Empty;

    public PrintJobStatus Status { get; set; } = PrintJobStatus.Pending;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
