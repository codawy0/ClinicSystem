using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Hubs;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.MedicalVisits;
using Clinic.Api.Models.SignalR;

namespace Clinic.Api.Controllers;

[Route("api/visits")]
[Authorize]
public class MedicalVisitsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly IBookingWriteLock _bookingWriteLock;
    private readonly IHubContext<QueueHub, IQueueClient> _hubContext;
    private readonly ILogger<MedicalVisitsController> _logger;

    public MedicalVisitsController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        IBookingWriteLock bookingWriteLock,
        IHubContext<QueueHub, IQueueClient> hubContext,
        ILogger<MedicalVisitsController> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _bookingWriteLock = bookingWriteLock;
        _hubContext = hubContext;
        _logger = logger;
    }

    public MedicalVisitsController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        IHubContext<QueueHub, IQueueClient> hubContext,
        ILogger<MedicalVisitsController> logger)
        : this(context, businessDateService, new BookingWriteLock(), hubContext, logger)
    {
    }

    [HttpGet("patient/{patientId:int}")]
    public async Task<ActionResult<PagedResult<MedicalVisitSummaryDto>>> GetPatientVisits(
        int patientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var baseQuery = _context.MedicalVisits
            .Include(v => v.Appointment)
            .Include(v => v.Doctor)
            .Include(v => v.Addenda)
            .Where(v => v.PatientId == patientId);

        var totalCount = await baseQuery.CountAsync();

        var items = await baseQuery
            .OrderByDescending(v => v.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new MedicalVisitSummaryDto
            {
                Id = v.Id,
                AppointmentId = v.AppointmentId,
                BusinessDate = v.Appointment.BusinessDate,
                DoctorName = v.Doctor.FullName,
                Diagnosis = v.Diagnosis,
                ChiefComplaint = v.ChiefComplaint,
                IsDraft = v.IsDraft,
                CompletedAtUtc = v.CompletedAtUtc,
                BpSystolic = v.BpSystolic,
                BpDiastolic = v.BpDiastolic,
                PulseBpm = v.PulseBpm,
                TempCelsius = v.TempCelsius,
                WeightKg = v.WeightKg,
                HeightCm = v.HeightCm,
                Bmi = v.WeightKg.HasValue && v.HeightCm.HasValue && v.HeightCm.Value > 0
                    ? Math.Round(v.WeightKg.Value / ((v.HeightCm.Value / 100m) * (v.HeightCm.Value / 100m)), 2)
                    : null,
                CreatedAtUtc = v.CreatedAtUtc,
                AddendaCount = v.Addenda.Count
            })
            .ToListAsync();

        return Ok(new PagedResult<MedicalVisitSummaryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MedicalVisitDetailDto>> GetVisitById(int id)
    {
        var visit = await _context.MedicalVisits
            .Include(v => v.Appointment)
            .Include(v => v.Doctor)
            .Include(v => v.Patient)
            .Include(v => v.PrescriptionItems)
            .Include(v => v.ClinicalRequests)
            .Include(v => v.Addenda)
                .ThenInclude(a => a.AuthorUser)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (visit == null)
        {
            return NotFound("الزيارة الطبية غير موجودة");
        }

        return Ok(MapToDetailDto(visit));
    }

    [HttpPost("init-or-get")]
    public async Task<ActionResult<MedicalVisitDetailDto>> InitOrGetVisit([FromBody] InitVisitRequestDto request)
    {
        int userId = GetCurrentUserId();

        var existingVisit = await _context.MedicalVisits
            .Include(v => v.Appointment)
            .Include(v => v.Doctor)
            .Include(v => v.Patient)
            .Include(v => v.Addenda)
                .ThenInclude(a => a.AuthorUser)
            .FirstOrDefaultAsync(v => v.AppointmentId == request.AppointmentId);

        if (existingVisit != null)
        {
            return Ok(MapToDetailDto(existingVisit));
        }

        var appointment = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId);

        if (appointment == null)
        {
            return NotFound("الموعد غير موجود");
        }

        var visit = new MedicalVisit
        {
            AppointmentId = appointment.Id,
            PatientId = appointment.PatientId,
            DoctorUserId = appointment.DoctorUserId,
            IsDraft = true,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.MedicalVisits.Add(visit);

        // Transition appointment to InNursing if in Waiting or Booked
        bool transitionedToNursing = false;
        if (appointment.Status == AppointmentStatus.Waiting || appointment.Status == AppointmentStatus.Booked)
        {
            var oldStatus = appointment.Status;
            appointment.Status = AppointmentStatus.InNursing;
            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                AppointmentId = appointment.Id,
                FromStatus = oldStatus.ToString(),
                ToStatus = AppointmentStatus.InNursing.ToString(),
                ChangedByUserId = userId > 0 ? userId : appointment.DoctorUserId,
                Reason = "بدء تجهيز المريض وقياس العلامات الحيوية",
                ChangedAtUtc = DateTime.UtcNow
            });
            transitionedToNursing = true;
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Concurrency race: another request initialized the visit at the same time
            var raceVisit = await _context.MedicalVisits
                .Include(v => v.Appointment)
                .Include(v => v.Doctor)
                .Include(v => v.Patient)
                .Include(v => v.Addenda)
                    .ThenInclude(a => a.AuthorUser)
                .FirstOrDefaultAsync(v => v.AppointmentId == request.AppointmentId);

            if (raceVisit != null)
            {
                return Ok(MapToDetailDto(raceVisit));
            }

            throw;
        }

        if (transitionedToNursing)
        {
            await BroadcastQueueUpdatedAsync(appointment.BusinessDate);
        }

        // Reload navigations if not populated
        visit.Appointment = appointment;
        visit.Patient = appointment.Patient;
        visit.Doctor = appointment.Doctor;

        return Ok(MapToDetailDto(visit));
    }

    [HttpPut("{id:int}/vitals")]
    public async Task<ActionResult<MedicalVisitDetailDto>> UpdateVitals(int id, [FromBody] UpdateVitalsRequestDto request)
    {
        int userId = GetCurrentUserId();

        var visit = await _context.MedicalVisits
            .Include(v => v.Appointment)
            .Include(v => v.Patient)
            .Include(v => v.Doctor)
            .Include(v => v.Addenda)
                .ThenInclude(a => a.AuthorUser)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (visit == null)
        {
            return NotFound("الزيارة الطبية غير موجودة");
        }

        // 1. Immutability Check: if completed, reject
        if (!visit.IsDraft || visit.CompletedAtUtc.HasValue)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "VISIT_ALREADY_COMPLETED",
                detail: "لا يمكن تعديل العلامات الحيوية لزيارة طبية مكتملة ومغلقة.");
        }

        // 2. Concurrency Check: verify Version matches
        if (visit.Version != request.Version)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات الزيارة الطبية من قبل مستخدم أو شاشة أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        // Update vitals
        visit.BpSystolic = request.BpSystolic;
        visit.BpDiastolic = request.BpDiastolic;
        visit.PulseBpm = request.PulseBpm;
        visit.TempCelsius = request.TempCelsius;
        visit.BloodSugarMgDl = request.BloodSugarMgDl;
        visit.BloodSugarType = request.BloodSugarType;
        visit.Spo2Pct = request.Spo2Pct;
        visit.WeightKg = request.WeightKg;
        visit.HeightCm = request.HeightCm;
        visit.LmpDate = request.LmpDate;

        if (request.ChiefComplaint != null)
        {
            visit.ChiefComplaint = request.ChiefComplaint;
        }

        if (request.NurseNotes != null)
        {
            visit.NurseNotes = request.NurseNotes;
        }

        if (request.IsPregnant.HasValue && visit.Patient != null)
        {
            visit.Patient.IsPregnant = request.IsPregnant.Value;
        }

        if (request.IsLactating.HasValue && visit.Patient != null)
        {
            visit.Patient.IsLactating = request.IsLactating.Value;
        }

        bool queueStatusChanged = false;
        DateOnly businessDate = visit.Appointment?.BusinessDate ?? _businessDateService.GetCurrentBusinessDate();

        if (request.MarkNursePrepComplete && visit.Appointment != null &&
            (visit.Appointment.Status == AppointmentStatus.InNursing || visit.Appointment.Status == AppointmentStatus.Booked))
        {
            var oldStatus = visit.Appointment.Status;
            visit.Appointment.Status = AppointmentStatus.Waiting;
            _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
            {
                AppointmentId = visit.Appointment.Id,
                FromStatus = oldStatus.ToString(),
                ToStatus = AppointmentStatus.Waiting.ToString(),
                ChangedByUserId = userId > 0 ? userId : visit.DoctorUserId,
                Reason = "اكتمال تجهيز المريض ونقله لقائمة انتظار الطبيب",
                ChangedAtUtc = DateTime.UtcNow
            });
            queueStatusChanged = true;
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات الزيارة الطبية من قبل مستخدم أو شاشة أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        // Broadcast SignalR events
        try
        {
            await _hubContext.Clients.Group(QueueHub.ClinicGroup).VitalsUpdated(new VitalsUpdatedDto
            {
                AppointmentId = visit.AppointmentId,
                PatientId = visit.PatientId,
                TimestampUtc = DateTime.UtcNow
            });

            if (queueStatusChanged)
            {
                await BroadcastQueueUpdatedAsync(businessDate);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast SignalR events after updating vitals");
        }

        return Ok(MapToDetailDto(visit));
    }

    [HttpPut("{id:int}/draft")]
    public async Task<ActionResult<MedicalVisitDetailDto>> AutosaveDraftNotes(int id, [FromBody] AutosaveDraftNotesRequestDto request)
    {
        var visit = await _context.MedicalVisits
            .Include(v => v.Appointment)
            .Include(v => v.Patient)
            .Include(v => v.Doctor)
            .Include(v => v.Addenda)
                .ThenInclude(a => a.AuthorUser)
            .FirstOrDefaultAsync(v => v.Id == id);

        if (visit == null)
        {
            return NotFound("الزيارة الطبية غير موجودة");
        }

        // 1. Immutability Check: if completed, reject
        if (!visit.IsDraft || visit.CompletedAtUtc.HasValue)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "VISIT_ALREADY_COMPLETED",
                detail: "لا يمكن تعديل مسودة الملاحظات الطبية لزيارة طبية مكتملة ومغلقة.");
        }

        // 2. Concurrency Check: verify Version matches
        if (visit.Version != request.Version)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات الزيارة الطبية من قبل مستخدم أو شاشة أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        if (request.ChiefComplaint != null) visit.ChiefComplaint = request.ChiefComplaint;
        if (request.Examination != null) visit.Examination = request.Examination;
        if (request.Diagnosis != null) visit.Diagnosis = request.Diagnosis;
        if (request.Icd10Code != null) visit.Icd10Code = request.Icd10Code;
        if (request.DoctorPrivateNotes != null) visit.DoctorPrivateNotes = request.DoctorPrivateNotes;
        if (request.SpecialtyDataJson != null) visit.SpecialtyDataJson = request.SpecialtyDataJson;
        if (request.NextVisitDate != null) visit.NextVisitDate = request.NextVisitDate;
        if (request.NurseNotes != null) visit.NurseNotes = request.NurseNotes;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات الزيارة الطبية من قبل مستخدم أو شاشة أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        return Ok(MapToDetailDto(visit));
    }

    [HttpPost("{id:int}/addenda")]
    public async Task<ActionResult<VisitAddendumDto>> AddAddendum(int id, [FromBody] CreateAddendumRequestDto request)
    {
        int userId = GetCurrentUserId();

        if (string.IsNullOrWhiteSpace(request.NoteText))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "VALIDATION_ERROR",
                Detail = "نص الملاحظة الإلحاقية مطلوب ولا يمكن أن يكون فارغاً."
            });
        }

        var visit = await _context.MedicalVisits.FindAsync(id);
        if (visit == null)
        {
            return NotFound("الزيارة الطبية غير موجودة");
        }

        var authorUser = await _context.Users.FindAsync(userId > 0 ? userId : visit.DoctorUserId);

        var addendum = new VisitAddendum
        {
            MedicalVisitId = visit.Id,
            AuthorUserId = authorUser?.Id ?? visit.DoctorUserId,
            NoteText = request.NoteText.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.VisitAddenda.Add(addendum);
        await _context.SaveChangesAsync();

        var dto = new VisitAddendumDto
        {
            Id = addendum.Id,
            MedicalVisitId = addendum.MedicalVisitId,
            AuthorUserId = addendum.AuthorUserId,
            AuthorName = authorUser?.FullName ?? "",
            AuthorRole = authorUser?.Role.ToString() ?? "",
            NoteText = addendum.NoteText,
            CreatedAtUtc = addendum.CreatedAtUtc
        };

        return CreatedAtAction(nameof(GetVisitById), new { id = visit.Id }, dto);
    }

    [HttpPost("{id:int}/complete")]
    public async Task<ActionResult<MedicalVisitDetailDto>> CompleteConsultation(
        int id,
        [FromBody] CompleteVisitRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int callerId = GetCurrentUserId();

        return await _bookingWriteLock.ExecuteAsync<ActionResult<MedicalVisitDetailDto>>(async () =>
        {
            var visit = await _context.MedicalVisits
                .Include(v => v.Appointment)
                .Include(v => v.Patient)
                .Include(v => v.Doctor)
                .Include(v => v.PrescriptionItems)
                .Include(v => v.ClinicalRequests)
                .Include(v => v.Addenda)
                    .ThenInclude(a => a.AuthorUser)
                .FirstOrDefaultAsync(v => v.Id == id);

            if (visit == null)
            {
                return NotFound("الزيارة الطبية غير موجودة");
            }

            // 1. Idempotency Check: if already completed, return existing completed visit safely
            if (!visit.IsDraft || visit.CompletedAtUtc.HasValue)
            {
                return Ok(MapToDetailDto(visit));
            }

            // 2. Concurrency Check: optimistic version token match
            if (visit.Version != request.Version)
            {
                return Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "CONCURRENCY_CONFLICT",
                    detail: "تم تعديل بيانات الزيارة الطبية من قبل مستخدم أو شاشة أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
            }

            // 3. Snapshot Prescriptions
            if (request.PrescriptionItems != null && request.PrescriptionItems.Count > 0)
            {
                var drugIds = request.PrescriptionItems
                    .Where(p => p.DrugId.HasValue)
                    .Select(p => p.DrugId!.Value)
                    .Distinct()
                    .ToList();

                var drugsDict = await _context.Drugs
                    .Where(d => drugIds.Contains(d.Id))
                    .ToDictionaryAsync(d => d.Id);

                foreach (var p in request.PrescriptionItems)
                {
                    Drug? drug = (p.DrugId.HasValue && drugsDict.TryGetValue(p.DrugId.Value, out var d)) ? d : null;

                    var item = new PrescriptionItem
                    {
                        MedicalVisitId = visit.Id,
                        DrugId = p.DrugId,
                        DrugNameSnapshot = !string.IsNullOrWhiteSpace(p.DrugName) ? p.DrugName.Trim() : (drug?.TradeName ?? string.Empty),
                        ActiveIngredientSnapshot = !string.IsNullOrWhiteSpace(p.ActiveIngredient) ? p.ActiveIngredient.Trim().ToLowerInvariant() : drug?.ActiveIngredient,
                        StrengthSnapshot = !string.IsNullOrWhiteSpace(p.Strength) ? p.Strength.Trim() : drug?.Strength,
                        FormSnapshot = !string.IsNullOrWhiteSpace(p.Form) ? p.Form.Trim() : drug?.Form.ToString(),
                        Dosage = p.Dosage.Trim(),
                        Timing = p.Timing.Trim(),
                        Duration = p.Duration.Trim(),
                        Notes = p.Notes?.Trim(),
                        WarningOverridden = p.WarningOverridden,
                        OverrideReason = p.OverrideReason?.Trim()
                    };

                    visit.PrescriptionItems.Add(item);
                }
            }

            // 4. Create Clinical Request Items (Lab & Radiology)
            if (request.ClinicalRequests != null && request.ClinicalRequests.Count > 0)
            {
                foreach (var req in request.ClinicalRequests)
                {
                    var cr = new ClinicalRequestItem
                    {
                        MedicalVisitId = visit.Id,
                        RequestType = req.RequestType,
                        CatalogCode = req.CatalogCode?.Trim(),
                        NameAr = req.NameAr.Trim(),
                        NameEn = req.NameEn?.Trim(),
                        Notes = req.Notes?.Trim()
                    };

                    visit.ClinicalRequests.Add(cr);
                }
            }

            // 5. Update Clinical Notes
            if (request.ChiefComplaint != null) visit.ChiefComplaint = request.ChiefComplaint;
            if (request.Examination != null) visit.Examination = request.Examination;
            if (request.Diagnosis != null) visit.Diagnosis = request.Diagnosis;
            if (request.Icd10Code != null) visit.Icd10Code = request.Icd10Code;
            if (request.DoctorPrivateNotes != null) visit.DoctorPrivateNotes = request.DoctorPrivateNotes;
            if (request.SpecialtyDataJson != null) visit.SpecialtyDataJson = request.SpecialtyDataJson;
            if (request.NextVisitDate != null) visit.NextVisitDate = request.NextVisitDate;

            // 6. Complete Visit
            visit.IsDraft = false;
            visit.CompletedAtUtc = DateTime.UtcNow;

            // 7. Transition Appointment to Completed
            if (visit.Appointment != null && visit.Appointment.Status != AppointmentStatus.Completed)
            {
                var oldStatus = visit.Appointment.Status;
                visit.Appointment.Status = AppointmentStatus.Completed;
                visit.Appointment.CompletedAtUtc = DateTime.UtcNow;

                _context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
                {
                    AppointmentId = visit.Appointment.Id,
                    FromStatus = oldStatus.ToString(),
                    ToStatus = AppointmentStatus.Completed.ToString(),
                    ChangedByUserId = callerId > 0 ? callerId : visit.DoctorUserId,
                    Reason = "إتمام الكشف الطبي وتوثيق الروشتة والفحوصات",
                    ChangedAtUtc = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            // 8. Broadcast QueueUpdated
            if (visit.Appointment != null)
            {
                await BroadcastQueueUpdatedAsync(visit.Appointment.BusinessDate);
            }

            return Ok(MapToDetailDto(visit));
        });
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

    private static MedicalVisitDetailDto MapToDetailDto(MedicalVisit v)
    {
        decimal? bmi = VitalsEvaluator.CalculateBmi(v.WeightKg, v.HeightCm);
        string? bmiCategory = VitalsEvaluator.GetBmiCategory(bmi);
        var alerts = VitalsEvaluator.Evaluate(
            v.BpSystolic,
            v.BpDiastolic,
            v.PulseBpm,
            v.TempCelsius,
            v.BloodSugarMgDl,
            v.Spo2Pct,
            bmi);

        return new MedicalVisitDetailDto
        {
            Id = v.Id,
            AppointmentId = v.AppointmentId,
            PatientId = v.PatientId,
            DoctorUserId = v.DoctorUserId,
            DoctorName = v.Doctor?.FullName ?? "",
            BusinessDate = v.Appointment?.BusinessDate ?? DateOnly.MinValue,
            QueueNumber = v.Appointment?.QueueNumber,
            IsDraft = v.IsDraft,
            BpSystolic = v.BpSystolic,
            BpDiastolic = v.BpDiastolic,
            PulseBpm = v.PulseBpm,
            TempCelsius = v.TempCelsius,
            BloodSugarMgDl = v.BloodSugarMgDl,
            BloodSugarType = v.BloodSugarType,
            Spo2Pct = v.Spo2Pct,
            WeightKg = v.WeightKg,
            HeightCm = v.HeightCm,
            Bmi = bmi,
            BmiCategory = bmiCategory,
            LmpDate = v.LmpDate,
            IsPregnant = v.Patient?.IsPregnant ?? false,
            IsLactating = v.Patient?.IsLactating ?? false,
            ChiefComplaint = v.ChiefComplaint,
            NurseNotes = v.NurseNotes,
            Examination = v.Examination,
            Diagnosis = v.Diagnosis,
            Icd10Code = v.Icd10Code,
            DoctorPrivateNotes = v.DoctorPrivateNotes,
            SpecialtyDataJson = v.SpecialtyDataJson,
            NextVisitDate = v.NextVisitDate,
            CompletedAtUtc = v.CompletedAtUtc,
            Version = v.Version,
            CreatedAtUtc = v.CreatedAtUtc,
            UpdatedAtUtc = v.UpdatedAtUtc,
            Alerts = alerts,
            Addenda = v.Addenda.Select(a => new VisitAddendumDto
            {
                Id = a.Id,
                MedicalVisitId = a.MedicalVisitId,
                AuthorUserId = a.AuthorUserId,
                AuthorName = a.AuthorUser?.FullName ?? "",
                AuthorRole = a.AuthorUser?.Role.ToString() ?? "",
                NoteText = a.NoteText,
                CreatedAtUtc = a.CreatedAtUtc
            }).OrderBy(a => a.CreatedAtUtc).ToList(),
            PrescriptionItems = (v.PrescriptionItems ?? new List<PrescriptionItem>()).Select(p => new PrescriptionItemDto
            {
                Id = p.Id,
                MedicalVisitId = p.MedicalVisitId,
                DrugId = p.DrugId,
                DrugNameSnapshot = p.DrugNameSnapshot,
                StrengthSnapshot = p.StrengthSnapshot,
                FormSnapshot = p.FormSnapshot,
                ActiveIngredientSnapshot = p.ActiveIngredientSnapshot,
                Dosage = p.Dosage,
                Timing = p.Timing,
                Duration = p.Duration,
                Notes = p.Notes,
                WarningOverridden = p.WarningOverridden,
                OverrideReason = p.OverrideReason
            }).ToList(),
            ClinicalRequests = (v.ClinicalRequests ?? new List<ClinicalRequestItem>()).Select(r => new ClinicalRequestItemDto
            {
                Id = r.Id,
                MedicalVisitId = r.MedicalVisitId,
                RequestType = r.RequestType,
                CatalogCode = r.CatalogCode,
                NameAr = r.NameAr,
                NameEn = r.NameEn,
                Notes = r.Notes,
                ResultSummary = r.ResultSummary
            }).ToList(),
            Patient = v.Patient != null ? new PatientSummaryDto
            {
                Id = v.Patient.Id,
                FileNumber = v.Patient.FileNumber,
                FullName = v.Patient.FullName,
                Phone = v.Patient.Phone,
                Gender = v.Patient.Gender,
                BirthDate = v.Patient.BirthDate,
                ApproximateAgeYears = v.Patient.ApproximateAgeYears,
                BloodType = v.Patient.BloodType,
                IsPregnant = v.Patient.IsPregnant,
                IsLactating = v.Patient.IsLactating
            } : null
        };
    }
}
