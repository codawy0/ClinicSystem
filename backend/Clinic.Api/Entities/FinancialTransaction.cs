using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class FinancialTransaction : IAuditableEntity
{
    public int Id { get; set; }

    public int ShiftId { get; set; }

    public int? InvoiceId { get; set; }

    public TransactionType Type { get; set; }

    [MaxLength(100)]
    public string? ExpenseCategory { get; set; }

    public long AmountPiastres { get; set; }

    public PaymentMethod PaymentMethod { get; set; }

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    public string? Description { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }

    // Navigations
    public Shift Shift { get; set; } = null!;
    public Invoice? Invoice { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
