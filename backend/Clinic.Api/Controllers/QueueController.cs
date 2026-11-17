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
using Clinic.Api.Models.Queue;
using Clinic.Api.Models.SignalR;
using Clinic.Api.Services;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
public class QueueController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly IBookingWriteLock _bookingWriteLock;
    private readonly IHubContext<QueueHub, IQueueClient> _hubContext;
    private readonly ILogger<QueueController> _logger;

    public QueueController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        IBookingWriteLock bookingWriteLock,
        IHubContext<QueueHub, IQueueClient> hubContext,
        ILogger<QueueController> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _bookingWriteLock = bookingWriteLock;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("call-next")]
    [Authorize(Roles = "Doctor,AssistantDoctor")]
    public async Task<ActionResult<CallNextResponseDto>> CallNext(
        [FromBody] CallNextRequestDto request,
        [FromHeader(Name = "Idempotency-Key")] string? headerIdempotencyKey)
    {
        int callerId = GetCurrentUserId();
        var today = _businessDateService.GetCurrentBusinessDate();

        string? idempotencyKey = !string.IsNullOrWhiteSpace(headerIdempotencyKey)
            ? headerIdempotencyKey.Trim()
            : request.IdempotencyKey?.Trim();

        return await _bookingWriteLock.ExecuteAsync<ActionResult<CallNextResponseDto>>(async () =>
        {
            var doctor = await _context.Users.FindAsync(request.DoctorUserId);
            if (doctor == null)
            {
                return NotFound("الطبيب غير موجود");
            }

            var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync()
                ?? new ClinicSetting();

            // 0. Preempt call-next if doctor is on break
            if (setting.IsDoctorOnBreak)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "DOCTOR_ON_BREAK",
                    detail: "الطبيب في استراحة حالياً.");
            }

            // Idempotency check: if an appointment was already called today with this idempotency key, return it immediately
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var existingCalled = await _context.Appointments
                    .Include(a => a.Patient)
                    .Include(a => a.Doctor)
                    .FirstOrDefaultAsync(a => a.BusinessDate == today &&
                        (a.CallIdempotencyKey == idempotencyKey || a.IdempotencyKey == idempotencyKey));

                if (existingCalled != null)
                {
                    string existingDisplayName = PrivacyFormatter.FormatPatientName(
                        existingCalled.Patient.FullName,
                        existingCalled.QueueNumber ?? 0,
                        setting.TvPrivacyMode);

                    return Ok(new CallNextResponseDto
                    {
                        AppointmentId = existingCalled.Id,
                        QueueNumber = existingCalled.QueueNumber ?? 0,
                        PatientName = existingCalled.Patient.FullName,
                        DisplayName = existingDisplayName,
                        DoctorName = existingCalled.Doctor?.FullName ?? doctor.FullName,
                        RoomName = "غرفة الكشف الرئيسية",
                        CallSequence = existingCalled.CallSequence,
                        CalledAtUtc = existingCalled.CalledAtUtc ?? DateTime.UtcNow
                    });
                }
            }

            // 1. If another patient is currently WithDoctor for this doctor, mark Completed
            var currentActive = await _context.Appointments
                .Where(a => a.DoctorUserId == request.DoctorUserId &&
                            a.BusinessDate == today &&
                            a.Status == AppointmentStatus.WithDoctor)
                .ToListAsync();

            foreach (var active in currentActive)
            {
                active.Status = AppointmentStatus.Completed;
                active.CompletedAtUtc = DateTime.UtcNow;

                _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
                {
                    AppointmentId = active.Id,
                    FromStatus = AppointmentStatus.WithDoctor.ToString(),
                    ToStatus = AppointmentStatus.Completed.ToString(),
                    ChangedByUserId = callerId,
                    Reason = "إتمام الكشف تلقائياً عند استدعاء الحالة التالية",
                    ChangedAtUtc = DateTime.UtcNow
                });
            }

            // 2. Query next waiting patient: IsUrgent DESC, QueueNumber ASC
            var nextAppt = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.Doctor)
                .Include(a => a.Service)
                .Where(a => a.DoctorUserId == request.DoctorUserId &&
                            a.BusinessDate == today &&
                            a.Status == AppointmentStatus.Waiting)
                .OrderByDescending(a => a.IsUrgent)
                .ThenBy(a => a.QueueNumber)
                .FirstOrDefaultAsync();

            if (nextAppt == null)
            {
                await _context.SaveChangesAsync();
                await BroadcastQueueUpdatedAsync(today);
                return NotFound("لا يوجد مرضى في قائمة الانتظار حالياً");
            }

            // 3. Monotonic CallSequence
            long maxSeq = await _context.Appointments.MaxAsync(a => (long?)a.CallSequence) ?? 0;
            long nextSeq = maxSeq + 1;

            string oldStatus = nextAppt.Status.ToString();
            nextAppt.Status = AppointmentStatus.WithDoctor;
            nextAppt.CalledAtUtc = DateTime.UtcNow;
            nextAppt.CallSequence = nextSeq;
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                nextAppt.CallIdempotencyKey = idempotencyKey;
                if (string.IsNullOrEmpty(nextAppt.IdempotencyKey))
                {
                    nextAppt.IdempotencyKey = idempotencyKey;
                }
            }

            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                AppointmentId = nextAppt.Id,
                FromStatus = oldStatus,
                ToStatus = AppointmentStatus.WithDoctor.ToString(),
                ChangedByUserId = callerId,
                Reason = "استدعاء المريض إلى غرفة الكشف",
                ChangedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            // 4. Privacy-formatted display name
            string displayName = PrivacyFormatter.FormatPatientName(
                nextAppt.Patient.FullName,
                nextAppt.QueueNumber ?? 0,
                setting.TvPrivacyMode);

            string roomName = "غرفة الكشف الرئيسية";

            var calledEvent = new PatientCalledDto
            {
                CallSequence = nextSeq,
                QueueNumber = nextAppt.QueueNumber ?? 0,
                DisplayName = displayName,
                DoctorName = doctor.FullName,
                RoomName = roomName,
                AppointmentId = nextAppt.Id,
                CalledAtUtc = nextAppt.CalledAtUtc.Value
            };

            // 5. Broadcast to SignalR
            await _hubContext.Clients.Group(QueueHub.ClinicGroup).PatientCalled(calledEvent);
            await BroadcastQueueUpdatedAsync(today);

            _logger.LogInformation("CallNext: Patient #{PatientId} (Queue: {Queue}) called by Dr. {Doctor} (Seq: {Seq})",
                nextAppt.PatientId, nextAppt.QueueNumber, doctor.FullName, nextSeq);

            return Ok(new CallNextResponseDto
            {
                AppointmentId = nextAppt.Id,
                QueueNumber = nextAppt.QueueNumber ?? 0,
                PatientName = nextAppt.Patient.FullName,
                DisplayName = displayName,
                DoctorName = doctor.FullName,
                RoomName = roomName,
                CallSequence = nextSeq,
                CalledAtUtc = nextAppt.CalledAtUtc.Value
            });
        });
    }

    [HttpPost("{id:int}/recall")]
    [Authorize]
    public async Task<IActionResult> Recall(int id)
    {
        int callerId = GetCurrentUserId();

        return await _bookingWriteLock.ExecuteAsync<IActionResult>(async () =>
        {
            var appt = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.Doctor)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appt == null)
            {
                return NotFound("الموعد غير موجود");
            }

            var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync()
                ?? new ClinicSetting();

            long maxSeq = await _context.Appointments.MaxAsync(a => (long?)a.CallSequence) ?? 0;
            long nextSeq = maxSeq + 1;

            appt.CallSequence = nextSeq;
            appt.CalledAtUtc = DateTime.UtcNow;

            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                AppointmentId = appt.Id,
                FromStatus = appt.Status.ToString(),
                ToStatus = appt.Status.ToString(),
                ChangedByUserId = callerId,
                Reason = "إعادة استدعاء المريض للتنبيه الصوتي",
                ChangedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            string displayName = PrivacyFormatter.FormatPatientName(
                appt.Patient.FullName,
                appt.QueueNumber ?? 0,
                setting.TvPrivacyMode);

            string roomName = "غرفة الكشف الرئيسية";

            var calledEvent = new PatientCalledDto
            {
                CallSequence = nextSeq,
                QueueNumber = appt.QueueNumber ?? 0,
                DisplayName = displayName,
                DoctorName = appt.Doctor?.FullName ?? "",
                RoomName = roomName,
                AppointmentId = appt.Id,
                CalledAtUtc = DateTime.UtcNow
            };

            await _hubContext.Clients.Group(QueueHub.ClinicGroup).PatientCalled(calledEvent);

            return Ok(new { success = true, callSequence = nextSeq });
        });
    }

    [HttpPost("{id:int}/skip")]
    [Authorize]
    public async Task<IActionResult> Skip(int id, [FromBody] SkipRequestDto? request)
    {
        int callerId = GetCurrentUserId();

        var appt = await _context.Appointments.FindAsync(id);
        if (appt == null)
        {
            return NotFound("الموعد غير موجود");
        }

        string oldStatus = appt.Status.ToString();
        appt.Status = AppointmentStatus.Skipped;

        _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = oldStatus,
            ToStatus = AppointmentStatus.Skipped.ToString(),
            ChangedByUserId = callerId,
            Reason = request?.Reason ?? "تم تجاوز المريض لعدم التواجد في الاستراحة",
            ChangedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await BroadcastQueueUpdatedAsync(appt.BusinessDate);

        _logger.LogInformation("Appointment #{ApptId} skipped", id);
        return Ok(new { success = true, status = appt.Status.ToString() });
    }

    [HttpPost("{id:int}/return-from-skip")]
    [Authorize]
    public async Task<IActionResult> ReturnFromSkip(int id, [FromBody] ReturnFromSkipRequestDto? request)
    {
        int callerId = GetCurrentUserId();

        var appt = await _context.Appointments.FindAsync(id);
        if (appt == null)
        {
            return NotFound("الموعد غير موجود");
        }

        string oldStatus = appt.Status.ToString();
        appt.Status = AppointmentStatus.Waiting;

        _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = oldStatus,
            ToStatus = AppointmentStatus.Waiting.ToString(),
            ChangedByUserId = callerId,
            Reason = request?.Reason ?? "عودة المريض من التجاوز إلى قائمة الانتظار",
            ChangedAtUtc = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await BroadcastQueueUpdatedAsync(appt.BusinessDate);

        _logger.LogInformation("Appointment #{ApptId} returned from skip to Waiting", id);
        return Ok(new { success = true, status = appt.Status.ToString(), queueNumber = appt.QueueNumber });
    }

    [HttpPost("doctor-break")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> ToggleDoctorBreak([FromBody] DoctorBreakRequestDto? request)
    {
        var setting = await _context.ClinicSettings.FirstOrDefaultAsync();
        if (setting == null)
        {
            return NotFound("إعدادات العيادة غير موجودة");
        }

        if (request?.IsDoctorOnBreak.HasValue == true)
        {
            setting.IsDoctorOnBreak = request.IsDoctorOnBreak.Value;
        }
        else
        {
            setting.IsDoctorOnBreak = !setting.IsDoctorOnBreak;
        }

        await _context.SaveChangesAsync();

        var notification = new DoctorBreakToggledDto
        {
            IsDoctorOnBreak = setting.IsDoctorOnBreak,
            Message = request?.Message ?? (setting.IsDoctorOnBreak ? "الطبيب في استراحة قصيرة" : null),
            TimestampUtc = DateTime.UtcNow
        };

        await _hubContext.Clients.Group(QueueHub.ClinicGroup).DoctorBreakToggled(notification);

        _logger.LogInformation("Doctor break toggled to {IsOnBreak}", setting.IsDoctorOnBreak);
        return Ok(notification);
    }

    [HttpGet("tv-state")]
    [AllowAnonymous]
    public async Task<ActionResult<TvStateDto>> GetTvState()
    {
        var today = _businessDateService.GetCurrentBusinessDate();
        var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync()
            ?? new ClinicSetting();

        // 1. Current called patient (WithDoctor)
        var currentCalledAppt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .Where(a => a.BusinessDate == today && a.Status == AppointmentStatus.WithDoctor)
            .OrderByDescending(a => a.CalledAtUtc)
            .FirstOrDefaultAsync();

        PatientCalledDto? currentCalled = null;
        if (currentCalledAppt != null)
        {
            string roomName = "غرفة الكشف الرئيسية";

            currentCalled = new PatientCalledDto
            {
                CallSequence = currentCalledAppt.CallSequence,
                QueueNumber = currentCalledAppt.QueueNumber ?? 0,
                DisplayName = PrivacyFormatter.FormatPatientName(
                    currentCalledAppt.Patient.FullName,
                    currentCalledAppt.QueueNumber ?? 0,
                    setting.TvPrivacyMode),
                DoctorName = currentCalledAppt.Doctor?.FullName ?? setting.DoctorName,
                RoomName = roomName,
                AppointmentId = currentCalledAppt.Id,
                CalledAtUtc = currentCalledAppt.CalledAtUtc ?? DateTime.UtcNow
            };
        }

        // 2. Upcoming waiting patients (top 5)
        var waitingAppts = await _context.Appointments
            .Include(a => a.Patient)
            .Where(a => a.BusinessDate == today && a.Status == AppointmentStatus.Waiting)
            .OrderByDescending(a => a.IsUrgent)
            .ThenBy(a => a.QueueNumber)
            .Take(5)
            .ToListAsync();

        var upcoming = waitingAppts.Select(a => new UpcomingPatientDto
        {
            AppointmentId = a.Id,
            QueueNumber = a.QueueNumber ?? 0,
            DisplayName = PrivacyFormatter.FormatPatientName(a.Patient.FullName, a.QueueNumber ?? 0, setting.TvPrivacyMode),
            IsUrgent = a.IsUrgent
        }).ToList();

        return Ok(new TvStateDto
        {
            CurrentCalled = currentCalled,
            UpcomingWaiting = upcoming,
            IsDoctorOnBreak = setting.IsDoctorOnBreak,
            BreakMessage = setting.IsDoctorOnBreak ? "الطبيب في استراحة قصيرة" : null,
            ClinicName = setting.ClinicName,
            DoctorName = setting.DoctorName,
            Specialty = setting.Specialty
        });
    }

    [HttpGet("today")]
    [Authorize]
    public async Task<ActionResult<List<AppointmentDto>>> GetTodayQueue([FromQuery] int? doctorId, [FromQuery] AppointmentStatus? status)
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

    [HttpGet("board")]
    [Authorize]
    public async Task<ActionResult<QueueBoardDto>> GetLiveBoard([FromQuery] int? doctorId)
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

        var appts = await query
            .OrderBy(a => a.QueueNumber ?? int.MaxValue)
            .ThenBy(a => a.Id)
            .ToListAsync();

        var board = new QueueBoardDto
        {
            BusinessDate = today,
            Booked = appts.Where(a => a.Status == AppointmentStatus.Booked).Select(MapToAppointmentDto).ToList(),
            Waiting = appts.Where(a => a.Status == AppointmentStatus.Waiting)
                .OrderByDescending(a => a.IsUrgent)
                .ThenBy(a => a.QueueNumber)
                .Select(MapToAppointmentDto).ToList(),
            InNursing = appts.Where(a => a.Status == AppointmentStatus.InNursing).Select(MapToAppointmentDto).ToList(),
            WithDoctor = appts.Where(a => a.Status == AppointmentStatus.WithDoctor).Select(MapToAppointmentDto).ToList(),
            Skipped = appts.Where(a => a.Status == AppointmentStatus.Skipped).Select(MapToAppointmentDto).ToList(),
            Completed = appts.Where(a => a.Status == AppointmentStatus.Completed).Select(MapToAppointmentDto).ToList()
        };

        return Ok(board);
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
            _logger.LogWarning(ex, "Failed to broadcast QueueUpdated");
        }
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
