using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class Shift : IVersionedEntity, IAuditableEntity
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public DateOnly BusinessDate { get; set; }

    public DateTime OpenedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ClosedAtUtc { get; set; }

    public long OpeningBalancePiastres { get; set; }

    public long ExpectedClosingCashPiastres { get; set; }

    public long? ActualClosingCashPiastres { get; set; }

    public long? CashDifferencePiastres { get; set; }

    public bool IsClosed { get; set; } = false;

    public string? ClosingNotes { get; set; }

    public long Version { get; set; } = 1;

    // Navigations
    public User User { get; set; } = null!;
    public ICollection<FinancialTransaction> Transactions { get; set; } = new List<FinancialTransaction>();
}
