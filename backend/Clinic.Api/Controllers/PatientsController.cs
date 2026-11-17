using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Patients;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize]
public class PatientsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IBusinessDateService _businessDateService;
    private readonly ILogger<PatientsController> _logger;

    public PatientsController(
        ClinicDbContext context,
        IBusinessDateService businessDateService,
        ILogger<PatientsController> logger)
    {
        _context = context;
        _businessDateService = businessDateService;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<PatientSearchResultDto>>> Search([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new List<PatientSearchResultDto>());
        }

        string rawQuery = q.Trim();
        string normalizedText = ArabicNormalizer.NormalizeText(rawQuery);
        string normalizedPhone = ArabicNormalizer.NormalizePhone(rawQuery);

        // Find primary matching patients (by SearchName, NormalizedPhone, FileNumber, or NationalId)
        var matchedPatients = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.ChronicConditions)
            .Where(p =>
                p.SearchName.Contains(normalizedText) ||
                p.NormalizedPhone.Contains(normalizedPhone) ||
                p.FileNumber.ToUpper().Contains(rawQuery.ToUpper()) ||
                (p.NationalId != null && p.NationalId.Contains(rawQuery)))
            .Take(20)
            .ToListAsync();

        if (matchedPatients.Count == 0)
        {
            return Ok(new List<PatientSearchResultDto>());
        }

        // Collect all normalized phones and patient IDs to identify shared-phone family members
        var matchedPhones = matchedPatients
            .Where(p => !string.IsNullOrEmpty(p.NormalizedPhone))
            .Select(p => p.NormalizedPhone)
            .Distinct()
            .ToList();

        var matchedIds = matchedPatients.Select(p => p.Id).ToList();

        // Query potential family members sharing the same normalized phone or linked via GuardianPatientId
        var potentialFamily = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.ChronicConditions)
            .Where(p =>
                (matchedPhones.Contains(p.NormalizedPhone) && !string.IsNullOrEmpty(p.NormalizedPhone)) ||
                (p.GuardianPatientId.HasValue && matchedIds.Contains(p.GuardianPatientId.Value)))
            .ToListAsync();

        var results = new List<PatientSearchResultDto>();

        foreach (var patient in matchedPatients)
        {
            var family = potentialFamily
                .Where(f => f.Id != patient.Id &&
                           ((!string.IsNullOrEmpty(patient.NormalizedPhone) && f.NormalizedPhone == patient.NormalizedPhone) ||
                            f.GuardianPatientId == patient.Id ||
                            patient.GuardianPatientId == f.Id))
                .Select(MapToPatientDto)
                .ToList();

            results.Add(new PatientSearchResultDto
            {
                Patient = MapToPatientDto(patient),
                FamilyMembers = family
            });
        }

        return Ok(results);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PatientDto>> GetById(int id)
    {
        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.ChronicConditions)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        var dto = MapToPatientDto(patient);

        // Include recent appointments
        var recentAppts = await _context.Appointments
            .Include(a => a.Doctor)
            .Include(a => a.Service)
            .Where(a => a.PatientId == id)
            .OrderByDescending(a => a.BusinessDate)
            .ThenByDescending(a => a.Id)
            .Take(10)
            .Select(a => new PatientRecentAppointmentDto
            {
                Id = a.Id,
                BusinessDate = a.BusinessDate,
                DoctorName = a.Doctor.FullName,
                ServiceName = a.Service.NameAr,
                Status = a.Status,
                IsConsultation = a.IsConsultation
            })
            .ToListAsync();

        dto.RecentAppointments = recentAppts;

        if (patient.GuardianPatientId.HasValue)
        {
            var guardian = await _context.Patients.FindAsync(patient.GuardianPatientId.Value);
            dto.GuardianName = guardian?.FullName;
        }

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<PatientDto>> Create([FromBody] CreatePatientRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // Generate next sequential FileNumber
        int maxId = await _context.Patients.MaxAsync(p => (int?)p.Id) ?? 0;
        int nextSeq = 1000 + maxId + 1;
        string fileNumber = $"F-{nextSeq}";
        while (await _context.Patients.AnyAsync(p => p.FileNumber == fileNumber))
        {
            nextSeq++;
            fileNumber = $"F-{nextSeq}";
        }

        var patient = new Patient
        {
            FileNumber = fileNumber,
            FullName = request.FullName.Trim(),
            SearchName = ArabicNormalizer.NormalizeText(request.FullName),
            Phone = request.Phone.Trim(),
            NormalizedPhone = ArabicNormalizer.NormalizePhone(request.Phone),
            SecondaryPhone = request.SecondaryPhone?.Trim(),
            NationalId = request.NationalId?.Trim(),
            Gender = request.Gender,
            BirthDate = request.BirthDate,
            ApproximateAgeYears = request.ApproximateAgeYears,
            GuardianPatientId = request.GuardianPatientId,
            BloodType = request.BloodType,
            IsPregnant = request.IsPregnant,
            IsLactating = request.IsLactating,
            CreatedAtUtc = DateTime.UtcNow,
            Version = 1
        };

        if (request.Allergies != null)
        {
            foreach (var allergy in request.Allergies.Where(a => !string.IsNullOrWhiteSpace(a)))
            {
                patient.Allergies.Add(new PatientAllergy
                {
                    AllergyName = allergy.Trim(),
                    ActiveIngredient = allergy.Trim().ToLowerInvariant(),
                    Severity = AllergySeverity.Moderate,
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
        }

        if (request.ChronicConditions != null)
        {
            foreach (var cond in request.ChronicConditions.Where(c => !string.IsNullOrWhiteSpace(c)))
            {
                patient.ChronicConditions.Add(new PatientChronicCondition
                {
                    ConditionCode = "CHRONIC",
                    ConditionName = cond.Trim(),
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
        }

        _context.Patients.Add(patient);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Patient created: #{Id} {FullName} (File: {FileNumber})",
            patient.Id, patient.FullName, patient.FileNumber);

        return CreatedAtAction(nameof(GetById), new { id = patient.Id }, MapToPatientDto(patient));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PatientDto>> Update(int id, [FromBody] UpdatePatientRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.ChronicConditions)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        // Optimistic concurrency check
        if (patient.Version != request.Version)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات المريض من قبل مستخدم أو عملية أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        patient.FullName = request.FullName.Trim();
        patient.SearchName = ArabicNormalizer.NormalizeText(request.FullName);
        patient.Phone = request.Phone.Trim();
        patient.NormalizedPhone = ArabicNormalizer.NormalizePhone(request.Phone);
        patient.SecondaryPhone = request.SecondaryPhone?.Trim();
        patient.NationalId = request.NationalId?.Trim();
        patient.Gender = request.Gender;
        patient.BirthDate = request.BirthDate;
        patient.ApproximateAgeYears = request.ApproximateAgeYears;
        patient.GuardianPatientId = request.GuardianPatientId;
        patient.BloodType = request.BloodType;
        patient.IsPregnant = request.IsPregnant;
        patient.IsLactating = request.IsLactating;

        // Update allergies if specified
        if (request.Allergies != null)
        {
            patient.Allergies.Clear();
            foreach (var allergy in request.Allergies.Where(a => !string.IsNullOrWhiteSpace(a)))
            {
                patient.Allergies.Add(new PatientAllergy
                {
                    PatientId = patient.Id,
                    AllergyName = allergy.Trim(),
                    ActiveIngredient = allergy.Trim().ToLowerInvariant(),
                    Severity = AllergySeverity.Moderate,
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
        }

        // Update chronic conditions if specified
        if (request.ChronicConditions != null)
        {
            patient.ChronicConditions.Clear();
            foreach (var cond in request.ChronicConditions.Where(c => !string.IsNullOrWhiteSpace(c)))
            {
                patient.ChronicConditions.Add(new PatientChronicCondition
                {
                    PatientId = patient.Id,
                    ConditionCode = "CHRONIC",
                    ConditionName = cond.Trim(),
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
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
                detail: "تم تعديل بيانات المريض من قبل مستخدم أو عملية أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }

        _logger.LogInformation("Patient updated: #{Id} {FullName}", patient.Id, patient.FullName);
        return Ok(MapToPatientDto(patient));
    }

    [HttpGet("{id:int}/consultation-eligibility")]
    public async Task<ActionResult<ConsultationEligibilityDto>> GetConsultationEligibility(int id)
    {
        var patientExists = await _context.Patients.AnyAsync(p => p.Id == id);
        if (!patientExists)
        {
            return NotFound("المريض غير موجود");
        }

        var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync();
        int validityDays = setting?.ConsultationValidityDays ?? 14;
        int maxConsultations = setting?.MaxConsultationsPerExam ?? 1;

        var today = _businessDateService.GetCurrentBusinessDate();

        // Find latest exam appointment for this patient
        var lastExam = await _context.Appointments
            .Where(a => a.PatientId == id && !a.IsConsultation && a.Status != AppointmentStatus.Cancelled)
            .OrderByDescending(a => a.BusinessDate)
            .ThenByDescending(a => a.Id)
            .FirstOrDefaultAsync();

        if (lastExam == null)
        {
            return Ok(new ConsultationEligibilityDto
            {
                IsEligible = false,
                ParentExamAppointmentId = null,
                ExamDate = null,
                DaysSinceExam = null,
                DaysRemaining = null,
                ConsumedConsultations = 0,
                MaxConsultations = maxConsultations,
                Reason = "NO_PREVIOUS_EXAM"
            });
        }

        int daysSinceExam = today.DayNumber - lastExam.BusinessDate.DayNumber;
        bool isWithinValidity = daysSinceExam >= 0 && daysSinceExam <= validityDays;

        int consumedConsultations = await _context.Appointments
            .CountAsync(a => a.ParentExamAppointmentId == lastExam.Id && a.Status != AppointmentStatus.Cancelled);

        bool hasRemainingQuota = consumedConsultations < maxConsultations;

        if (!isWithinValidity)
        {
            return Ok(new ConsultationEligibilityDto
            {
                IsEligible = false,
                ParentExamAppointmentId = lastExam.Id,
                ExamDate = lastExam.BusinessDate,
                DaysSinceExam = daysSinceExam,
                DaysRemaining = 0,
                ConsumedConsultations = consumedConsultations,
                MaxConsultations = maxConsultations,
                Reason = "EXPIRED"
            });
        }

        if (!hasRemainingQuota)
        {
            return Ok(new ConsultationEligibilityDto
            {
                IsEligible = false,
                ParentExamAppointmentId = lastExam.Id,
                ExamDate = lastExam.BusinessDate,
                DaysSinceExam = daysSinceExam,
                DaysRemaining = Math.Max(0, validityDays - daysSinceExam),
                ConsumedConsultations = consumedConsultations,
                MaxConsultations = maxConsultations,
                Reason = "MAX_CONSULTATIONS_REACHED"
            });
        }

        return Ok(new ConsultationEligibilityDto
        {
            IsEligible = true,
            ParentExamAppointmentId = lastExam.Id,
            ExamDate = lastExam.BusinessDate,
            DaysSinceExam = daysSinceExam,
            DaysRemaining = Math.Max(0, validityDays - daysSinceExam),
            ConsumedConsultations = consumedConsultations,
            MaxConsultations = maxConsultations,
            Reason = null
        });
    }

    private static PatientDto MapToPatientDto(Patient patient)
    {
        return new PatientDto
        {
            Id = patient.Id,
            FileNumber = patient.FileNumber,
            FullName = patient.FullName,
            Phone = patient.Phone,
            SecondaryPhone = patient.SecondaryPhone,
            NationalId = patient.NationalId,
            Gender = patient.Gender,
            BirthDate = patient.BirthDate,
            ApproximateAgeYears = patient.ApproximateAgeYears,
            GuardianPatientId = patient.GuardianPatientId,
            BloodType = patient.BloodType,
            IsPregnant = patient.IsPregnant,
            IsLactating = patient.IsLactating,
            CreatedAtUtc = patient.CreatedAtUtc,
            Version = patient.Version,
            Allergies = patient.Allergies?.Select(a => new PatientAllergyDto
            {
                Id = a.Id,
                AllergyName = a.AllergyName,
                ActiveIngredient = a.ActiveIngredient,
                Severity = a.Severity,
                Notes = a.Notes
            }).ToList() ?? new(),
            ChronicConditions = patient.ChronicConditions?.Select(c => new PatientChronicConditionDto
            {
                Id = c.Id,
                ConditionCode = c.ConditionCode,
                ConditionName = c.ConditionName,
                Notes = c.Notes
            }).ToList() ?? new()
        };
    }
}
