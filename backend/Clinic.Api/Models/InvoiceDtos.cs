using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Invoices;

public class RecordPaymentRequestDto
{
    [Range(1, long.MaxValue, ErrorMessage = "مبلغ السداد يجب أن يكون أكبر من صفر.")]
    public long AmountPiastres { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public string? IdempotencyKey { get; set; }

    public long? Version { get; set; }
}

public class RecordRefundRequestDto
{
    [Range(1, long.MaxValue, ErrorMessage = "مبلغ الاسترداد يجب أن يكون أكبر من صفر.")]
    public long AmountPiastres { get; set; }

    [Required(ErrorMessage = "سبب الاسترداد إلزامي.")]
    [MinLength(3, ErrorMessage = "سبب الاسترداد يجب ألا يقل عن 3 أحرف.")]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    public string? IdempotencyKey { get; set; }

    public long? Version { get; set; }
}

public class VoidInvoiceRequestDto
{
    [Required(ErrorMessage = "سبب إلغاء الفاتورة إلزامي.")]
    [MinLength(3, ErrorMessage = "سبب الإلغاء يجب ألا يقل عن 3 أحرف.")]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public string? IdempotencyKey { get; set; }

    public long? Version { get; set; }
}

public class PaymentResponseDto
{
    public int InvoiceId { get; set; }
    public int TransactionId { get; set; }
    public long AmountPaidPiastres { get; set; }
    public long TotalPaidPiastres { get; set; }
    public long RemainingPiastres { get; set; }
    public InvoiceStatus Status { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public long ExpectedClosingCashPiastres { get; set; }
    public long InvoiceVersion { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class RefundResponseDto
{
    public int InvoiceId { get; set; }
    public int TransactionId { get; set; }
    public long RefundedAmountPiastres { get; set; }
    public long TotalRefundedPiastres { get; set; }
    public long TotalPaidPiastres { get; set; }
    public long NetCollectedPiastres { get; set; }
    public long RemainingPiastres { get; set; }
    public InvoiceStatus Status { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public long ExpectedClosingCashPiastres { get; set; }
    public long InvoiceVersion { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class VoidInvoiceResponseDto
{
    public int InvoiceId { get; set; }
    public InvoiceStatus Status { get; set; }
    public long TotalPiastres { get; set; }
    public long PaidPiastres { get; set; }
    public long RefundedPiastres { get; set; }
    public long CashReversedPiastres { get; set; }
    public List<int> ReversalTransactionIds { get; set; } = new();
    public long ExpectedClosingCashPiastres { get; set; }
    public long InvoiceVersion { get; set; }
    public DateTime VoidedAtUtc { get; set; }
}

public class InvoiceListDto
{
    public int Id { get; set; }
    public int? AppointmentId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public string? DoctorName { get; set; }
    public long TotalPiastres { get; set; }
    public long DiscountPiastres { get; set; }
    public DiscountReason DiscountReason { get; set; }
    public long NetTotalPiastres { get; set; }
    public long PaidPiastres { get; set; }
    public long RefundedPiastres { get; set; }
    public long RemainingPiastres { get; set; }
    public InvoiceStatus Status { get; set; }
    public int LinesCount { get; set; }
    public int TransactionsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public long Version { get; set; }
}

public class InvoiceDetailDto : InvoiceListDto
{
    public string? ApprovedByUserName { get; set; }
    public List<InvoiceLineDto> Lines { get; set; } = new();
    public List<TreasuryTransactionDto> Transactions { get; set; } = new();
}

public class InvoiceLineDto
{
    public int Id { get; set; }
    public int? ServiceId { get; set; }
    public string Description { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public long UnitPricePiastres { get; set; }
    public long TotalPricePiastres { get; set; }
}

public class TreasuryTransactionDto
{
    public int Id { get; set; }
    public int ShiftId { get; set; }
    public int? InvoiceId { get; set; }
    public string? PatientName { get; set; }
    public TransactionType Type { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public long AmountPiastres { get; set; }
    public string? ExpenseCategory { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Description { get; set; }
    public int CreatedByUserId { get; set; }
    public string CreatedByUserName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string? IdempotencyKey { get; set; }
}

public class TreasuryLedgerReportDto
{
    public long TotalCashPaymentsPiastres { get; set; }
    public long TotalInstapayPaymentsPiastres { get; set; }
    public long TotalVodafoneCashPaymentsPiastres { get; set; }
    public long TotalCardPaymentsPiastres { get; set; }
    public long TotalRefundsPiastres { get; set; }
    public long TotalExpensesPiastres { get; set; }
    public long TotalVoidReversalsPiastres { get; set; }
    public long NetGrossRevenuePiastres { get; set; }
    public long NetPhysicalCashInDrawerPiastres { get; set; }
    public int TotalCount { get; set; }
    public List<TreasuryTransactionDto> Transactions { get; set; } = new();
}
