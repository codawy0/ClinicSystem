using System.ComponentModel.DataAnnotations;

namespace Clinic.Api.Models.Shifts;

public class OpenShiftRequestDto
{
    [Range(0, long.MaxValue, ErrorMessage = "رصيد البداية يجب أن يكون صفراً أو أكثر")]
    public long OpeningBalancePiastres { get; set; } = 0L;

    public string? Notes { get; set; }
}

public class RecordExpenseRequestDto
{
    [Range(1, long.MaxValue, ErrorMessage = "المبلغ يجب أن يكون أكبر من صفر")]
    public long AmountPiastres { get; set; }

    [Required(ErrorMessage = "تصنيف المصروف مطلوب")]
    public string Category { get; set; } = string.Empty;

    [Required(ErrorMessage = "بيان المصروف مطلوب")]
    public string Description { get; set; } = string.Empty;

    public string? IdempotencyKey { get; set; }
}

public class CloseShiftRequestDto
{
    public int? ShiftId { get; set; }

    [Range(0, long.MaxValue, ErrorMessage = "المبلغ الفعلي يجب ألا يكون سالباً")]
    public long ActualClosingCashPiastres { get; set; }

    public string? ClosingNotes { get; set; }

    [Required]
    public long Version { get; set; }
}

public class ShiftSummaryDto
{
    public int ShiftId { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateOnly BusinessDate { get; set; }
    public DateTime OpenedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public long OpeningBalancePiastres { get; set; }
    public long CashPaymentsPiastres { get; set; }
    public long CashRefundsPiastres { get; set; }
    public long CashExpensesPiastres { get; set; }
    public long ExpectedClosingCashPiastres { get; set; }
    public long TotalInstapayPiastres { get; set; }
    public long TotalVodafoneCashPiastres { get; set; }
    public long TotalCardPiastres { get; set; }
    public long TotalNonCashPiastres { get; set; }
    public long TotalRevenuePiastres { get; set; }
    public int TransactionsCount { get; set; }
    public bool IsClosed { get; set; }
    public long? ActualClosingCashPiastres { get; set; }
    public long? CashDifferencePiastres { get; set; }
    public string? DifferenceType { get; set; }
    public string? ClosingNotes { get; set; }
    public long Version { get; set; }
}

public class CurrentShiftStatusDto
{
    public bool HasActiveShift { get; set; }
    public ShiftSummaryDto? Shift { get; set; }
}

public class ShiftCloseResponseDto
{
    public int ShiftId { get; set; }
    public long ExpectedClosingCashPiastres { get; set; }
    public long ActualClosingCashPiastres { get; set; }
    public long CashDifferencePiastres { get; set; }
    public string DifferenceType { get; set; } = "Balanced"; // "Surplus", "Shortage", "Balanced"
    public DateTime ClosedAtUtc { get; set; }
    public long Version { get; set; }
}
