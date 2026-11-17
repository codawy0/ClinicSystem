using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Analytics;

public class DoctorKpiResponseDto
{
    // Date Range metadata
    public DateTime StartDateUtc { get; set; }
    public DateTime EndDateUtc { get; set; }
    public int? DoctorId { get; set; }
    public string? DoctorName { get; set; }

    // Revenue & Invoicing (64-bit integer Piastres)
    public long GrossRevenuePiastres { get; set; }
    public long ForegoneDiscountsPiastres { get; set; }
    public long NetBilledRevenuePiastres { get; set; }

    // Collections by Payment Method
    public long CashCollectedPiastres { get; set; }
    public long InstapayCollectedPiastres { get; set; }
    public long VodafoneCashCollectedPiastres { get; set; }
    public long CardCollectedPiastres { get; set; }
    public long TotalDigitalCollectedPiastres { get; set; }
    public long TotalCollectedRevenuePiastres { get; set; }

    // Outflows & Net Profitability
    public long TotalRefundedPiastres { get; set; }
    public long PettyCashExpensesPiastres { get; set; }
    public long NetCashFlowPiastres { get; set; }
    public long NetAccrualProfitPiastres { get; set; }

    // Volume & Operational Efficiency
    public int TotalAppointments { get; set; }
    public int UniquePatients { get; set; }
    public int CompletedVisits { get; set; }
    public int CancelledAppointments { get; set; }
    public double AverageConsultationDurationMinutes { get; set; }
    public double AverageWaitTimeMinutes { get; set; }

    // Breakdowns & Trends
    public List<DiscountReasonBreakdownDto> DiscountReasons { get; set; } = new();
    public List<DailyKpiTrendDto> DailyTrends { get; set; } = new();
}

public class DiscountReasonBreakdownDto
{
    public DiscountReason Reason { get; set; }
    public int Count { get; set; }
    public long TotalPiastres { get; set; }
}

public class DailyKpiTrendDto
{
    public DateOnly Date { get; set; }
    public long GrossPiastres { get; set; }
    public long NetPiastres { get; set; }
    public long CollectedPiastres { get; set; }
    public int ConsultationsCount { get; set; }
    public int PatientsCount { get; set; }
}
