using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class Invoice : IVersionedEntity, IAuditableEntity
{
    public int Id { get; set; }

    public int? AppointmentId { get; set; }

    public int PatientId { get; set; }

    public long TotalPiastres { get; set; }

    public long DiscountPiastres { get; set; } = 0L;

    public DiscountReason DiscountReason { get; set; } = DiscountReason.None;

    public int? ApprovedByUserId { get; set; }

    public long NetTotalPiastres { get; set; }

    public long PaidPiastres { get; set; } = 0L;

    public long RefundedPiastres { get; set; } = 0L;

    public long RemainingPiastres { get; set; }

    public InvoiceStatus Status { get; set; } = InvoiceStatus.Unpaid;

    public long Version { get; set; } = 1;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    // Navigations
    public Appointment? Appointment { get; set; }
    public Patient Patient { get; set; } = null!;
    public User? ApprovedByUser { get; set; }
    public ICollection<InvoiceLine> Lines { get; set; } = new List<InvoiceLine>();
    public ICollection<FinancialTransaction> Transactions { get; set; } = new List<FinancialTransaction>();
}
