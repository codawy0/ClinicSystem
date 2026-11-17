using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Hubs;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Appointments;
using Clinic.Api.Models.SignalR;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize]
public class AppointmentsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly IBookingWriteLock _bookingWriteLock;
    private readonly IHubContext<QueueHub, IQueueClient> _hubContext;
    private readonly ILogger<AppointmentsController> _logger;

    public AppointmentsController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        IBookingWriteLock bookingWriteLock,
        IHubContext<QueueHub, IQueueClient> hubContext,
        ILogger<AppointmentsController> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _bookingWriteLock = bookingWriteLock;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet("today")]
    public async Task<ActionResult<List<AppointmentDto>>> GetTodayAppointments([FromQuery] int? doctorId, [FromQuery] AppointmentStatus? status)
    {
        var today = _businessDateService.GetCurrentBusinessDate();

        var query = _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Include(a => a.Invoice)
                .ThenInclude(i => i!.Transactions)
            .Where(a => a.BusinessDate == today);

        if (doctorId.HasValue)
        {
            query = query.Where(a => a.DoctorUserId == doctorId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        var list = await query
            .OrderBy(a => a.QueueNumber ?? int.MaxValue)
            .ThenBy(a => a.Id)
            .ToListAsync();

        return Ok(list.Select(MapToAppointmentDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<BookAppointmentResponseDto>> BookAppointment(
        [FromBody] BookAppointmentRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int userId = GetCurrentUserId();
        var today = _businessDateService.GetCurrentBusinessDate();

        // 1. SHIFT GUARD: Verify caller has an open active shift
        var activeShift = await _context.Shifts.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsClosed);

        if (activeShift == null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "SHIFT_REQUIRED",
                detail: "يجب فتح وردية نقدية نشطة أولاً قبل تسجيل الكشف والتحصيل المالي.");
        }

        // Determine effective IdempotencyKey
        string? idempotencyKey = !string.IsNullOrWhiteSpace(headerIdempotencyKey)
            ? headerIdempotencyKey.Trim()
            : request.IdempotencyKey?.Trim();

        // Check for idempotency replay
        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var existingAppt = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.Doctor)
                .Include(a => a.Service)
                .Include(a => a.Invoice)
                .FirstOrDefaultAsync(a => a.IdempotencyKey == idempotencyKey);

            if (existingAppt != null)
            {
                var existingInvoice = existingAppt.Invoice;
                var clinicSettings = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync();
                var cashier = await _context.Users.FindAsync(userId);

                return Ok(new BookAppointmentResponseDto
                {
                    AppointmentId = existingAppt.Id,
                    QueueNumber = existingAppt.QueueNumber,
                    Status = existingAppt.Status,
                    BusinessDate = existingAppt.BusinessDate,
                    PatientId = existingAppt.PatientId,
                    PatientName = existingAppt.Patient.FullName,
                    DoctorUserId = existingAppt.DoctorUserId,
                    DoctorName = existingAppt.Doctor.FullName,
                    InvoiceId = existingInvoice?.Id ?? 0,
                    TotalPiastres = existingInvoice?.TotalPiastres ?? 0,
                    DiscountPiastres = existingInvoice?.DiscountPiastres ?? 0,
                    NetTotalPiastres = existingInvoice?.NetTotalPiastres ?? 0,
                    Receipt = BuildReceiptDto(existingAppt, existingInvoice, clinicSettings, cashier?.FullName ?? "")
                });
            }
        }

        // Validate Patient, Doctor, and Service
        var patient = await _context.Patients.FindAsync(request.PatientId);
        if (patient == null) return NotFound("المريض غير موجود");

        var doctor = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.DoctorUserId && (u.Role == UserRole.Doctor || u.Role == UserRole.AssistantDoctor));
        if (doctor == null) return NotFound("الطبيب غير موجود");

        var service = await _context.ServiceCatalogs.FindAsync(request.ServiceId);
        if (service == null) return NotFound("الخدمة غير موجودة");

        List<ServiceCatalog> procedures = new();
        if (request.ProcedureIds != null && request.ProcedureIds.Count > 0)
        {
            procedures = await _context.ServiceCatalogs
                .Where(s => request.ProcedureIds.Contains(s.Id))
                .ToListAsync();
        }

        // Calculate Pricing
        long totalPiastres = service.DefaultPricePiastres + procedures.Sum(p => p.DefaultPricePiastres);
        long discountPiastres = Math.Clamp(request.DiscountAmountPiastres, 0, totalPiastres);
        long netTotalPiastres = totalPiastres - discountPiastres;

        // Perform atomic booking under BookingWriteLock
        return await _bookingWriteLock.ExecuteAsync<ActionResult<BookAppointmentResponseDto>>(async () =>
        {
            // Reload active shift inside write lock to ensure latest Version and prevent concurrency collision
            var shift = await _context.Shifts.FirstOrDefaultAsync(s => s.Id == activeShift.Id);
            if (shift == null || shift.IsClosed)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "SHIFT_REQUIRED",
                    detail: "يجب فتح وردية نقدية نشطة أولاً قبل تسجيل الكشف والتحصيل المالي.");
            }

            int? queueNumber = null;
            if (request.IsWalkIn)
            {
                var maxQueue = await _context.Appointments
                    .Where(a => a.DoctorUserId == request.DoctorUserId && a.BusinessDate == today)
                    .Select(a => (int?)a.QueueNumber)
                    .MaxAsync() ?? 0;

                queueNumber = maxQueue + 1;
            }

            bool isConsultation = service.Category == ServiceCategory.Consultation;

            var appointment = new Appointment
            {
                PatientId = request.PatientId,
                DoctorUserId = request.DoctorUserId,
                ServiceId = request.ServiceId,
                BusinessDate = today,
                QueueNumber = queueNumber,
                BookingType = request.IsWalkIn ? BookingType.WalkIn : BookingType.Advance,
                IsUrgent = request.IsUrgent,
                Status = request.IsWalkIn ? AppointmentStatus.Waiting : AppointmentStatus.Booked,
                IsConsultation = isConsultation,
                ParentExamAppointmentId = request.ParentExamAppointmentId,
                ArrivedAtUtc = request.IsWalkIn ? DateTime.UtcNow : null,
                CreatedAtUtc = DateTime.UtcNow,
                IdempotencyKey = idempotencyKey,
                Version = 1
            };

            _context.Appointments.Add(appointment);

            // Create Invoice
            var invoice = new Invoice
            {
                Appointment = appointment,
                PatientId = request.PatientId,
                TotalPiastres = totalPiastres,
                DiscountPiastres = discountPiastres,
                DiscountReason = request.DiscountReason,
                ApprovedByUserId = discountPiastres > 0 ? userId : null,
                NetTotalPiastres = netTotalPiastres,
                PaidPiastres = netTotalPiastres,
                RemainingPiastres = 0L,
                Status = InvoiceStatus.Paid,
                CreatedAtUtc = DateTime.UtcNow,
                Version = 1
            };
            _context.Invoices.Add(invoice);

            // Add Invoice Line for main service
            _context.InvoiceLines.Add(new InvoiceLine
            {
                Invoice = invoice,
                ServiceId = service.Id,
                Description = service.NameAr,
                Quantity = 1,
                UnitPricePiastres = service.DefaultPricePiastres,
                TotalPricePiastres = service.DefaultPricePiastres
            });

            // Add Invoice Lines for procedures
            foreach (var proc in procedures)
            {
                _context.InvoiceLines.Add(new InvoiceLine
                {
                    Invoice = invoice,
                    ServiceId = proc.Id,
                    Description = proc.NameAr,
                    Quantity = 1,
                    UnitPricePiastres = proc.DefaultPricePiastres,
                    TotalPricePiastres = proc.DefaultPricePiastres
                });
            }

            // Create FinancialTransaction linked to shift
            var transaction = new FinancialTransaction
            {
                ShiftId = shift.Id,
                Invoice = invoice,
                Type = TransactionType.Payment,
                PaymentMethod = request.PaymentMethod,
                AmountPiastres = netTotalPiastres,
                ReferenceNumber = request.PaymentReference,
                Description = $"سداد فاتورة كشف {patient.FullName}",
                CreatedByUserId = userId,
                CreatedAtUtc = DateTime.UtcNow,
                IdempotencyKey = !string.IsNullOrEmpty(idempotencyKey) ? $"tx_{idempotencyKey}" : null
            };
            _context.FinancialTransactions.Add(transaction);

            // Update Shift expected cash if payment is Cash
            if (request.PaymentMethod == PaymentMethod.Cash)
            {
                shift.ExpectedClosingCashPiastres += netTotalPiastres;
            }

            // Status history
            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                Appointment = appointment,
                FromStatus = null,
                ToStatus = appointment.Status.ToString(),
                ChangedByUserId = userId,
                Reason = "حجز وكشف أولي بالاستقبال",
                ChangedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            var clinicSetting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync();
            var cashier = await _context.Users.FindAsync(userId);
            var receipt = BuildReceiptDto(appointment, invoice, clinicSetting, cashier?.FullName ?? "الاستقبال", procedures);

            // Broadcast QueueUpdated to ClinicGroup
            await BroadcastQueueUpdatedAsync(today);

            _logger.LogInformation("Appointment #{ApptId} booked for Patient #{PatientId}. Queue: {QueueNumber}, NetTotal: {Net}",
                appointment.Id, patient.Id, appointment.QueueNumber, netTotalPiastres);

            return Ok(new BookAppointmentResponseDto
            {
                AppointmentId = appointment.Id,
                QueueNumber = appointment.QueueNumber,
                Status = appointment.Status,
                BusinessDate = appointment.BusinessDate,
                PatientId = patient.Id,
                PatientName = patient.FullName,
                DoctorUserId = doctor.Id,
                DoctorName = doctor.FullName,
                InvoiceId = invoice.Id,
                TotalPiastres = invoice.TotalPiastres,
                DiscountPiastres = invoice.DiscountPiastres,
                NetTotalPiastres = invoice.NetTotalPiastres,
                Receipt = receipt
            });
        });
    }

    [HttpPut("{id:int}/check-in")]
    public async Task<ActionResult<AppointmentDto>> CheckIn(int id, [FromBody] CheckInRequestDto? request)
    {
        int userId = GetCurrentUserId();
        var today = _businessDateService.GetCurrentBusinessDate();

        return await _bookingWriteLock.ExecuteAsync<ActionResult<AppointmentDto>>(async () =>
        {
            var appt = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.Doctor)
                .Include(a => a.Service)
                .Include(a => a.Invoice)
                    .ThenInclude(i => i!.Transactions)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appt == null)
            {
                return NotFound("الموعد غير موجود");
            }

            string oldStatus = appt.Status.ToString();

            // Assign QueueNumber if null
            if (!appt.QueueNumber.HasValue)
            {
                var maxQueue = await _context.Appointments
                    .Where(a => a.DoctorUserId == appt.DoctorUserId && a.BusinessDate == today)
                    .Select(a => (int?)a.QueueNumber)
                    .MaxAsync() ?? 0;

                appt.QueueNumber = maxQueue + 1;
            }

            appt.Status = AppointmentStatus.Waiting;
            appt.ArrivedAtUtc = DateTime.UtcNow;

            if (request?.IsUrgent.HasValue == true)
            {
                appt.IsUrgent = request.IsUrgent.Value;
            }

            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                AppointmentId = appt.Id,
                FromStatus = oldStatus,
                ToStatus = AppointmentStatus.Waiting.ToString(),
                ChangedByUserId = userId,
                Reason = "حضور المريض إلى العيادة",
                ChangedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            await BroadcastQueueUpdatedAsync(today);

            _logger.LogInformation("Appointment #{ApptId} checked in. Assigned QueueNumber: {QueueNumber}",
                appt.Id, appt.QueueNumber);

            return Ok(MapToAppointmentDto(appt));
        });
    }

    [HttpPost("{id:int}/urgent")]
    public async Task<ActionResult<AppointmentDto>> ToggleUrgent(int id)
    {
        int userId = GetCurrentUserId();
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Include(a => a.Invoice)
                .ThenInclude(i => i!.Transactions)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appt == null)
        {
            return NotFound("الموعد غير موجود");
        }

        appt.IsUrgent = !appt.IsUrgent;

        _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = appt.Status.ToString(),
            ToStatus = appt.Status.ToString(),
            ChangedByUserId = userId,
            Reason = appt.IsUrgent ? "تم تصنيف الحالة كحالة عاجلة" : "إلغاء تصنيف الحالة كعاجلة",
            ChangedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await BroadcastQueueUpdatedAsync(appt.BusinessDate);

        return Ok(MapToAppointmentDto(appt));
    }

    [HttpPut("{id:int}/start-nursing")]
    public async Task<ActionResult<AppointmentDto>> StartNursing(int id)
    {
        int userId = GetCurrentUserId();
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Include(a => a.Invoice)
                .ThenInclude(i => i!.Transactions)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appt == null)
        {
            return NotFound("الموعد غير موجود");
        }

        var oldStatus = appt.Status;
        appt.Status = AppointmentStatus.InNursing;

        _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = oldStatus.ToString(),
            ToStatus = AppointmentStatus.InNursing.ToString(),
            ChangedByUserId = userId > 0 ? userId : appt.DoctorUserId,
            Reason = "بدء تجهيز المريض وقياس العلامات الحيوية",
            ChangedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await BroadcastQueueUpdatedAsync(appt.BusinessDate);

        return Ok(MapToAppointmentDto(appt));
    }

    [HttpPut("{id:int}/complete-nursing")]
    public async Task<ActionResult<AppointmentDto>> CompleteNursing(int id)
    {
        int userId = GetCurrentUserId();
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Include(a => a.Invoice)
                .ThenInclude(i => i!.Transactions)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appt == null)
        {
            return NotFound("الموعد غير موجود");
        }

        var oldStatus = appt.Status;
        appt.Status = AppointmentStatus.Waiting;

        _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = oldStatus.ToString(),
            ToStatus = AppointmentStatus.Waiting.ToString(),
            ChangedByUserId = userId > 0 ? userId : appt.DoctorUserId,
            Reason = "اكتمال تجهيز المريض وجاهزية الكشف",
            ChangedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await BroadcastQueueUpdatedAsync(appt.BusinessDate);

        return Ok(MapToAppointmentDto(appt));
    }

    private async Task BroadcastQueueUpdatedAsync(DateOnly businessDate)
    {
        try
        {
            var waitingCount = await _context.Appointments
                .CountAsync(a => a.BusinessDate == businessDate && a.Status == AppointmentStatus.Waiting);

            var inNursingCount = await _context.Appointments
                .CountAsync(a => a.BusinessDate == businessDate && a.Status == AppointmentStatus.InNursing);

            var withDoctorCount = await _context.Appointments
                .CountAsync(a => a.BusinessDate == businessDate && a.Status == AppointmentStatus.WithDoctor);

            await _hubContext.Clients.Group(QueueHub.ClinicGroup).QueueUpdated(new QueueUpdatedDto
            {
                BusinessDate = businessDate,
                WaitingCount = waitingCount,
                InNursingCount = inNursingCount,
                WithDoctorCount = withDoctorCount,
                TimestampUtc = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast QueueUpdated to SignalR group");
        }
    }

    private static ThermalReceiptDto BuildReceiptDto(
        Appointment appt,
        Invoice? invoice,
        ClinicSetting? setting,
        string cashierName,
        List<ServiceCatalog>? procedures = null)
    {
        var procNames = procedures?.Select(p => p.NameAr).ToList()
            ?? invoice?.Lines?.Where(l => l.ServiceId != appt.ServiceId).Select(l => l.Description).ToList()
            ?? new List<string>();

        return new ThermalReceiptDto
        {
            ReceiptNumber = $"REC-{(invoice?.Id ?? appt.Id):D5}",
            ClinicName = setting?.ClinicName ?? "العيادة التخصصية",
            DoctorName = appt.Doctor?.FullName ?? setting?.DoctorName ?? "د. الطبيب",
            DoctorTitle = setting?.DoctorTitle ?? "استشاري",
            Specialty = setting?.Specialty ?? "طب عام",
            PatientName = appt.Patient?.FullName ?? "",
            PatientFileNumber = appt.Patient?.FileNumber ?? "",
            Date = DateTime.Now.ToString("yyyy/MM/dd HH:mm"),
            QueueNumber = appt.QueueNumber,
            ServiceName = appt.Service?.NameAr ?? "كشف",
            Procedures = procNames,
            SubTotalPiastres = invoice?.TotalPiastres ?? 0,
            DiscountPiastres = invoice?.DiscountPiastres ?? 0,
            DiscountReason = invoice?.DiscountReason != DiscountReason.None ? invoice?.DiscountReason.ToString() : null,
            NetTotalPiastres = invoice?.NetTotalPiastres ?? 0,
            PaymentMethod = invoice?.Transactions?.FirstOrDefault()?.PaymentMethod.ToString() ?? "Cash",
            CashierName = cashierName
        };
    }

    private static AppointmentDto MapToAppointmentDto(Appointment a)
    {
        var tx = a.Invoice?.Transactions?.FirstOrDefault();

        return new AppointmentDto
        {
            Id = a.Id,
            PatientId = a.PatientId,
            PatientName = a.Patient?.FullName ?? "",
            PatientPhone = a.Patient?.Phone ?? "",
            DoctorUserId = a.DoctorUserId,
            DoctorName = a.Doctor?.FullName ?? "",
            ServiceId = a.ServiceId,
            ServiceName = a.Service?.NameAr ?? "",
            BusinessDate = a.BusinessDate,
            QueueNumber = a.QueueNumber,
            BookingType = a.BookingType,
            IsUrgent = a.IsUrgent,
            Status = a.Status,
            IsConsultation = a.IsConsultation,
            ParentExamAppointmentId = a.ParentExamAppointmentId,
            ArrivedAtUtc = a.ArrivedAtUtc,
            CalledAtUtc = a.CalledAtUtc,
            CompletedAtUtc = a.CompletedAtUtc,
            CallSequence = a.CallSequence,
            Version = a.Version,
            InvoiceId = a.Invoice?.Id,
            TotalPiastres = a.Invoice?.TotalPiastres,
            DiscountPiastres = a.Invoice?.DiscountPiastres,
            NetTotalPiastres = a.Invoice?.NetTotalPiastres,
            PaymentMethod = tx?.PaymentMethod,
            InvoiceStatus = a.Invoice?.Status
        };
    }
}
