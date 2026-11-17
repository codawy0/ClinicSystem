using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Models.ClinicalProfile;

namespace Clinic.Api.Controllers;

[Route("api/clinical-profile")]
[Authorize]
public class PatientClinicalProfileController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly ILogger<PatientClinicalProfileController> _logger;

    public PatientClinicalProfileController(
        ClinicDbContext context,
        ILogger<PatientClinicalProfileController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("{patientId:int}")]
    public async Task<ActionResult<PatientClinicalProfileDto>> GetProfile(int patientId)
    {
        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.ChronicConditions)
            .FirstOrDefaultAsync(p => p.Id == patientId);

        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        return Ok(new PatientClinicalProfileDto
        {
            PatientId = patient.Id,
            FileNumber = patient.FileNumber,
            FullName = patient.FullName,
            Gender = patient.Gender,
            ApproximateAgeYears = patient.ApproximateAgeYears,
            BirthDate = patient.BirthDate,
            BloodType = patient.BloodType,
            IsPregnant = patient.IsPregnant,
            IsLactating = patient.IsLactating,
            Allergies = patient.Allergies.Select(a => new PatientAllergyDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                ActiveIngredient = a.ActiveIngredient,
                AllergyName = a.AllergyName,
                Severity = a.Severity,
                Notes = a.Notes,
                CreatedAtUtc = a.CreatedAtUtc
            }).ToList(),
            ChronicConditions = patient.ChronicConditions.Select(c => new PatientChronicConditionDto
            {
                Id = c.Id,
                PatientId = c.PatientId,
                ConditionCode = c.ConditionCode,
                ConditionName = c.ConditionName,
                Notes = c.Notes,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList()
        });
    }

    [HttpPost("{patientId:int}/allergies")]
    public async Task<ActionResult<PatientAllergyDto>> AddAllergy(int patientId, [FromBody] AddPatientAllergyRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var patient = await _context.Patients.FindAsync(patientId);
        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        string normalizedIngredient = request.ActiveIngredient.Trim().ToLowerInvariant();

        var allergy = new PatientAllergy
        {
            PatientId = patientId,
            ActiveIngredient = normalizedIngredient,
            AllergyName = string.IsNullOrWhiteSpace(request.AllergyName) ? request.ActiveIngredient.Trim() : request.AllergyName.Trim(),
            Severity = request.Severity,
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.PatientAllergies.Add(allergy);
        await _context.SaveChangesAsync();

        var dto = new PatientAllergyDto
        {
            Id = allergy.Id,
            PatientId = allergy.PatientId,
            ActiveIngredient = allergy.ActiveIngredient,
            AllergyName = allergy.AllergyName,
            Severity = allergy.Severity,
            Notes = allergy.Notes,
            CreatedAtUtc = allergy.CreatedAtUtc
        };

        return CreatedAtAction(nameof(GetProfile), new { patientId }, dto);
    }

    [HttpDelete("{patientId:int}/allergies/{allergyId:int}")]
    public async Task<IActionResult> DeleteAllergy(int patientId, int allergyId)
    {
        var allergy = await _context.PatientAllergies
            .FirstOrDefaultAsync(a => a.Id == allergyId && a.PatientId == patientId);

        if (allergy == null)
        {
            return NotFound("الحساسية الدوائية غير موجودة لهذا المريض");
        }

        _context.PatientAllergies.Remove(allergy);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{patientId:int}/chronic-conditions")]
    public async Task<ActionResult<PatientChronicConditionDto>> AddChronicCondition(int patientId, [FromBody] AddPatientChronicConditionRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var patient = await _context.Patients.FindAsync(patientId);
        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        var condition = new PatientChronicCondition
        {
            PatientId = patientId,
            ConditionCode = request.ConditionCode?.Trim() ?? string.Empty,
            ConditionName = request.ConditionName.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.PatientChronicConditions.Add(condition);
        await _context.SaveChangesAsync();

        var dto = new PatientChronicConditionDto
        {
            Id = condition.Id,
            PatientId = condition.PatientId,
            ConditionCode = condition.ConditionCode,
            ConditionName = condition.ConditionName,
            Notes = condition.Notes,
            CreatedAtUtc = condition.CreatedAtUtc
        };

        return CreatedAtAction(nameof(GetProfile), new { patientId }, dto);
    }

    [HttpDelete("{patientId:int}/chronic-conditions/{conditionId:int}")]
    public async Task<IActionResult> DeleteChronicCondition(int patientId, int conditionId)
    {
        var condition = await _context.PatientChronicConditions
            .FirstOrDefaultAsync(c => c.Id == conditionId && c.PatientId == patientId);

        if (condition == null)
        {
            return NotFound("المرض المزمن غير موجود لهذا المريض");
        }

        _context.PatientChronicConditions.Remove(condition);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
