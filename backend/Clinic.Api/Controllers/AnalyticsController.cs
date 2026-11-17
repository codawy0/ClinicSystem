using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Analytics;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Doctor,Admin")]
public class AnalyticsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly ILogger<AnalyticsController> _logger;

    public AnalyticsController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        ILogger<AnalyticsController> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _logger = logger;
    }

    // GET /api/analytics/kpi
    [HttpGet("kpi")]
    public async Task<ActionResult<DoctorKpiResponseDto>> GetKpi(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int? doctorId)
    {
        int callerUserId = GetCurrentUserId();
        string callerRole = GetCurrentUserRole();

        // 1. Role Scoping Guard
        int? effectiveDoctorId;
        if (callerRole.Equals("Doctor", StringComparison.OrdinalIgnoreCase))
        {
            if (doctorId.HasValue && doctorId.Value != callerUserId)
            {
                return Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "FORBIDDEN_DOCTOR_ACCESS",
                    detail: "لا يمكن للطبيب الاطلاع على مؤشرات أداء طبيب آخر.");
            }
            effectiveDoctorId = callerUserId;
        }
        else
        {
            // Admin can query clinic-wide (null) or specific doctor
            effectiveDoctorId = doctorId;
        }

        // 2. Date Range Resolution
        DateTime startUtc;
        DateTime endUtc;

        if (startDate.HasValue)
        {
            startUtc = DateTime.SpecifyKind(startDate.Value, DateTimeKind.Utc);
        }
        else
        {
            // Default: start of today in Egypt Standard Time converted to UTC
            var today = _businessDateService.GetCurrentBusinessDate();
            startUtc = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue).AddHours(-2), DateTimeKind.Utc);
        }

        if (endDate.HasValue)
        {
            endUtc = DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc);
        }
        else
        {
            endUtc = DateTime.UtcNow;
        }

        if (startUtc > endUtc)
        {
            return BadRequest("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.");
        }

        // Doctor Name lookup if scoped
        string? doctorName = null;
        if (effectiveDoctorId.HasValue)
        {
            var doctorUser = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == effectiveDoctorId.Value);
            doctorName = doctorUser?.FullName;
        }

        // 3. Query Invoices in period
        var invoicesQuery = _context.Invoices.AsNoTracking()
            .Include(i => i.Appointment)
            .Where(i => i.Status != InvoiceStatus.Voided && i.CreatedAtUtc >= startUtc && i.CreatedAtUtc <= endUtc);

        if (effectiveDoctorId.HasValue)
        {
            invoicesQuery = invoicesQuery.Where(i => i.Appointment != null && i.Appointment.DoctorUserId == effectiveDoctorId.Value);
        }

        var invoices = await invoicesQuery.ToListAsync();

        long grossRevenuePiastres = invoices.Sum(i => i.TotalPiastres);
        long foregoneDiscountsPiastres = invoices.Sum(i => i.DiscountPiastres);
        long netBilledRevenuePiastres = invoices.Sum(i => i.NetTotalPiastres);

        // 4. Query Financial Transactions in period
        var txQuery = _context.FinancialTransactions.AsNoTracking()
            .Include(t => t.Invoice).ThenInclude(i => i!.Appointment)
            .Where(t => t.CreatedAtUtc >= startUtc && t.CreatedAtUtc <= endUtc);

        if (effectiveDoctorId.HasValue)
        {
            txQuery = txQuery.Where(t => 
                (t.Invoice != null && t.Invoice.Appointment != null && t.Invoice.Appointment.DoctorUserId == effectiveDoctorId.Value) ||
                (t.Type == TransactionType.Expense && t.CreatedByUserId == effectiveDoctorId.Value));
        }

        var transactions = await txQuery.ToListAsync();

        long cashCollected = transactions
            .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == PaymentMethod.Cash)
            .Sum(t => t.AmountPiastres);

        long instapayCollected = transactions
            .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == PaymentMethod.Instapay)
            .Sum(t => t.AmountPiastres);

        long vodafoneCollected = transactions
            .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == PaymentMethod.VodafoneCash)
            .Sum(t => t.AmountPiastres);

        long cardCollected = transactions
            .Where(t => t.Type == TransactionType.Payment && t.PaymentMethod == PaymentMethod.Card)
            .Sum(t => t.AmountPiastres);

        long totalDigitalCollected = instapayCollected + vodafoneCollected + cardCollected;
        long totalCollectedRevenue = cashCollected + totalDigitalCollected;

        long totalRefunded = transactions
            .Where(t => t.Type == TransactionType.Refund)
            .Sum(t => t.AmountPiastres);

        long pettyCashExpenses = transactions
            .Where(t => t.Type == TransactionType.Expense)
            .Sum(t => t.AmountPiastres);

        long netCashFlow = totalCollectedRevenue - totalRefunded - pettyCashExpenses;
        long netAccrualProfit = netBilledRevenuePiastres - totalRefunded - pettyCashExpenses;

        // 5. Query Appointments in period
        var apptQuery = _context.Appointments.AsNoTracking()
            .Where(a => a.CreatedAtUtc >= startUtc && a.CreatedAtUtc <= endUtc);

        if (effectiveDoctorId.HasValue)
        {
            apptQuery = apptQuery.Where(a => a.DoctorUserId == effectiveDoctorId.Value);
        }

        var appointments = await apptQuery.ToListAsync();

        int totalAppointments = appointments.Count;
        int uniquePatients = appointments.Select(a => a.PatientId).Distinct().Count();
        int completedAppointments = appointments.Count(a => a.Status == AppointmentStatus.Completed);
        int cancelledAppointments = appointments.Count(a => a.Status == AppointmentStatus.Cancelled || a.Status == AppointmentStatus.Skipped);

        // Calculate Average Patient Wait Time
        var waitTimes = appointments
            .Where(a => a.CalledAtUtc.HasValue && (a.ArrivedAtUtc.HasValue || a.CreatedAtUtc != default))
            .Select(a => (a.CalledAtUtc!.Value - (a.ArrivedAtUtc ?? a.CreatedAtUtc)).TotalMinutes)
            .Where(minutes => minutes >= 0)
            .ToList();

        double avgWaitTime = waitTimes.Count > 0 ? Math.Round(waitTimes.Average(), 1) : 0.0;

        // 6. Query Medical Visits in period for Consultation Duration
        var visitsQuery = _context.MedicalVisits.AsNoTracking()
            .Where(v => !v.IsDraft && v.CompletedAtUtc.HasValue && v.CreatedAtUtc >= startUtc && v.CreatedAtUtc <= endUtc);

        if (effectiveDoctorId.HasValue)
        {
            visitsQuery = visitsQuery.Where(v => v.DoctorUserId == effectiveDoctorId.Value);
        }

        var visits = await visitsQuery.ToListAsync();

        var durations = visits
            .Where(v => v.CompletedAtUtc!.Value >= v.CreatedAtUtc)
            .Select(v => (v.CompletedAtUtc!.Value - v.CreatedAtUtc).TotalMinutes)
            .ToList();

        double avgDuration = durations.Count > 0 ? Math.Round(durations.Average(), 1) : 0.0;
        int completedVisits = Math.Max(completedAppointments, visits.Count);

        // 7. Discount Reasons Breakdown
        var discountBreakdown = invoices
            .Where(i => i.DiscountPiastres > 0)
            .GroupBy(i => i.DiscountReason)
            .Select(g => new DiscountReasonBreakdownDto
            {
                Reason = g.Key,
                Count = g.Count(),
                TotalPiastres = g.Sum(i => i.DiscountPiastres)
            })
            .OrderByDescending(b => b.TotalPiastres)
            .ToList();

        // 8. Daily KPI Trends
        var dailyTrends = new List<DailyKpiTrendDto>();
        var invoiceGroups = invoices.GroupBy(i => DateOnly.FromDateTime(i.CreatedAtUtc));
        var apptGroups = appointments.GroupBy(a => a.BusinessDate);
        var txGroups = transactions.Where(t => t.Type == TransactionType.Payment).GroupBy(t => DateOnly.FromDateTime(t.CreatedAtUtc));

        var allDates = invoiceGroups.Select(g => g.Key)
            .Union(apptGroups.Select(g => g.Key))
            .Union(txGroups.Select(g => g.Key))
            .OrderBy(d => d)
            .ToList();

        foreach (var d in allDates)
        {
            var dayInvoices = invoices.Where(i => DateOnly.FromDateTime(i.CreatedAtUtc) == d).ToList();
            var dayAppts = appointments.Where(a => a.BusinessDate == d).ToList();
            var dayTxs = transactions.Where(t => t.Type == TransactionType.Payment && DateOnly.FromDateTime(t.CreatedAtUtc) == d).ToList();

            dailyTrends.Add(new DailyKpiTrendDto
            {
                Date = d,
                GrossPiastres = dayInvoices.Sum(i => i.TotalPiastres),
                NetPiastres = dayInvoices.Sum(i => i.NetTotalPiastres),
                CollectedPiastres = dayTxs.Sum(t => t.AmountPiastres),
                ConsultationsCount = dayAppts.Count(a => a.Status == AppointmentStatus.Completed),
                PatientsCount = dayAppts.Select(a => a.PatientId).Distinct().Count()
            });
        }

        return Ok(new DoctorKpiResponseDto
        {
            StartDateUtc = startUtc,
            EndDateUtc = endUtc,
            DoctorId = effectiveDoctorId,
            DoctorName = doctorName,
            GrossRevenuePiastres = grossRevenuePiastres,
            ForegoneDiscountsPiastres = foregoneDiscountsPiastres,
            NetBilledRevenuePiastres = netBilledRevenuePiastres,
            CashCollectedPiastres = cashCollected,
            InstapayCollectedPiastres = instapayCollected,
            VodafoneCashCollectedPiastres = vodafoneCollected,
            CardCollectedPiastres = cardCollected,
            TotalDigitalCollectedPiastres = totalDigitalCollected,
            TotalCollectedRevenuePiastres = totalCollectedRevenue,
            TotalRefundedPiastres = totalRefunded,
            PettyCashExpensesPiastres = pettyCashExpenses,
            NetCashFlowPiastres = netCashFlow,
            NetAccrualProfitPiastres = netAccrualProfit,
            TotalAppointments = totalAppointments,
            UniquePatients = uniquePatients,
            CompletedVisits = completedVisits,
            CancelledAppointments = cancelledAppointments,
            AverageConsultationDurationMinutes = avgDuration,
            AverageWaitTimeMinutes = avgWaitTime,
            DiscountReasons = discountBreakdown,
            DailyTrends = dailyTrends
        });
    }
}
