using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Drugs;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize]
public class DrugsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly ILogger<DrugsController> _logger;

    public DrugsController(ClinicDbContext context, ILogger<DrugsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<ActionResult<List<DrugSummaryDto>>> Search([FromQuery] string? q, [FromQuery] int limit = 20)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        if (string.IsNullOrWhiteSpace(q))
        {
            var topDrugs = await _context.Drugs
                .AsNoTracking()
                .Where(d => !d.IsDiscontinued)
                .OrderBy(d => d.TradeName)
                .Take(limit)
                .Select(d => MapToSummaryDto(d))
                .ToListAsync();

            return Ok(topDrugs);
        }

        var normalizedQuery = ArabicNormalizer.NormalizeText(q).Trim();
        var lowerQuery = q.Trim().ToLowerInvariant();

        var query = _context.Drugs
            .AsNoTracking()
            .Where(d => !d.IsDiscontinued);

        var allActive = await query.ToListAsync();

        var matched = allActive
            .Where(d =>
                (!string.IsNullOrEmpty(d.SearchTradeName) && d.SearchTradeName.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(d.TradeName) && d.TradeName.Contains(lowerQuery, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(d.ActiveIngredient) && d.ActiveIngredient.Contains(lowerQuery, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(d.Category) && d.Category.Contains(lowerQuery, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(d => d.TradeName.StartsWith(q.Trim(), StringComparison.OrdinalIgnoreCase) ||
                                    (!string.IsNullOrEmpty(d.SearchTradeName) && d.SearchTradeName.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase)))
            .ThenBy(d => d.TradeName)
            .Take(limit)
            .Select(d => MapToSummaryDto(d))
            .ToList();

        return Ok(matched);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DrugDetailDto>> GetById(int id)
    {
        var drug = await _context.Drugs.FindAsync(id);
        if (drug == null)
        {
            return NotFound("الدواء غير موجود");
        }

        return Ok(MapToDetailDto(drug));
    }

    [HttpPost]
    public async Task<ActionResult<DrugDetailDto>> Create([FromBody] CreateDrugRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var drug = new Drug
        {
            TradeName = request.TradeName.Trim(),
            ActiveIngredient = request.ActiveIngredient.Trim(),
            Strength = request.Strength.Trim(),
            Form = request.Form,
            Category = request.Category?.Trim(),
            DefaultDosage = request.DefaultDosage?.Trim(),
            DefaultTiming = request.DefaultTiming?.Trim(),
            DefaultDuration = request.DefaultDuration?.Trim(),
            AvoidInPregnancy = request.AvoidInPregnancy,
            AvoidInLactation = request.AvoidInLactation,
            PregnancyCategory = request.PregnancyCategory?.Trim().ToUpperInvariant(),
            IsDiscontinued = false,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.Drugs.Add(drug);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = drug.Id }, MapToDetailDto(drug));
    }

    [HttpPost("safety-check")]
    public async Task<ActionResult<DrugSafetyCheckResultDto>> CheckSafety([FromBody] DrugSafetyCheckRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .FirstOrDefaultAsync(p => p.Id == request.PatientId);

        if (patient == null)
        {
            return NotFound("المريض غير موجود");
        }

        var result = new DrugSafetyCheckResultDto();

        if (request.DrugIds == null || request.DrugIds.Count == 0)
        {
            return Ok(result);
        }

        var drugs = await _context.Drugs
            .Where(d => request.DrugIds.Contains(d.Id))
            .ToListAsync();

        bool isPregnant = request.IsPregnant ?? patient.IsPregnant;
        bool isLactating = request.IsLactating ?? patient.IsLactating;

        // 1. Allergy conflicts
        foreach (var drug in drugs)
        {
            var drugAi = (drug.ActiveIngredient ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(drugAi)) continue;

            foreach (var allergy in patient.Allergies)
            {
                var allergyAi = (allergy.ActiveIngredient ?? string.Empty).Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(allergyAi)) continue;

                if (drugAi == allergyAi || drugAi.Contains(allergyAi) || allergyAi.Contains(drugAi))
                {
                    string severity = allergy.Severity == AllergySeverity.Severe ? "Severe" : "Moderate";
                    result.Warnings.Add(new SafetyWarningDto
                    {
                        DrugId = drug.Id,
                        DrugName = drug.TradeName,
                        ActiveIngredient = drug.ActiveIngredient ?? string.Empty,
                        Severity = severity,
                        Type = "Allergy",
                        MessageAr = $"المريض يعاني من حساسية تجاه المادة الفعالة ({drug.ActiveIngredient}) الموجودة في دواء ({drug.TradeName}). درجة خطورة الحساسية: {allergy.Severity}.",
                        RequiresOverride = true
                    });
                }
            }
        }

        // 2. Pregnancy contraindications
        if (isPregnant)
        {
            foreach (var drug in drugs)
            {
                bool isSevere = drug.AvoidInPregnancy ||
                                string.Equals(drug.PregnancyCategory, "D", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(drug.PregnancyCategory, "X", StringComparison.OrdinalIgnoreCase);

                if (isSevere)
                {
                    result.Warnings.Add(new SafetyWarningDto
                    {
                        DrugId = drug.Id,
                        DrugName = drug.TradeName,
                        ActiveIngredient = drug.ActiveIngredient ?? string.Empty,
                        Severity = "Severe",
                        Type = "Pregnancy",
                        MessageAr = $"يحذر استخدام دواء ({drug.TradeName}) أثناء فترة الحمل لتأثيره الخطير على سلامة الجنين (تصنيف الحمل: {drug.PregnancyCategory ?? "D/X"}).",
                        RequiresOverride = true
                    });
                }
                else if (string.Equals(drug.PregnancyCategory, "C", StringComparison.OrdinalIgnoreCase))
                {
                    result.Warnings.Add(new SafetyWarningDto
                    {
                        DrugId = drug.Id,
                        DrugName = drug.TradeName,
                        ActiveIngredient = drug.ActiveIngredient ?? string.Empty,
                        Severity = "Moderate",
                        Type = "Pregnancy",
                        MessageAr = $"يجب الحذر عند وصف دواء ({drug.TradeName}) أثناء الحمل لعدم كفاية الدراسات الأمنية (تصنيف الحمل C).",
                        RequiresOverride = true
                    });
                }
            }
        }

        // 3. Lactation contraindications
        if (isLactating)
        {
            foreach (var drug in drugs)
            {
                if (drug.AvoidInLactation)
                {
                    result.Warnings.Add(new SafetyWarningDto
                    {
                        DrugId = drug.Id,
                        DrugName = drug.TradeName,
                        ActiveIngredient = drug.ActiveIngredient ?? string.Empty,
                        Severity = "Moderate",
                        Type = "Lactation",
                        MessageAr = $"يحذر استخدام دواء ({drug.TradeName}) أثناء الرضاعة الطبيعية لإفرازه في لبن الأم.",
                        RequiresOverride = true
                    });
                }
            }
        }

        // 4. Duplicate active ingredient detection
        var duplicateGroups = drugs
            .GroupBy(d => (d.ActiveIngredient ?? string.Empty).Trim().ToLowerInvariant())
            .Where(g => !string.IsNullOrEmpty(g.Key) && g.Count() > 1)
            .ToList();

        foreach (var group in duplicateGroups)
        {
            var firstDrug = group.First();
            var tradeNames = string.Join(" + ", group.Select(d => d.TradeName));
            result.Warnings.Add(new SafetyWarningDto
            {
                DrugId = firstDrug.Id,
                DrugName = tradeNames,
                ActiveIngredient = group.Key,
                Severity = "Moderate",
                Type = "DuplicateIngredient",
                MessageAr = $"تكرار المادة الفعالة ({group.Key}) في أكثر من دواء ضمن الوصفة: ({tradeNames}). قد يؤدي ذلك إلى مضاعفات الجرعة المفرطة.",
                RequiresOverride = true
            });
        }

        // 5. Discontinued status
        foreach (var drug in drugs)
        {
            if (drug.IsDiscontinued)
            {
                result.Warnings.Add(new SafetyWarningDto
                {
                    DrugId = drug.Id,
                    DrugName = drug.TradeName,
                    ActiveIngredient = drug.ActiveIngredient ?? string.Empty,
                    Severity = "Severe",
                    Type = "Discontinued",
                    MessageAr = $"دواء ({drug.TradeName}) تم إيقاف تداوله في الصيدليات (Discontinued). يرجى اختيار بديل علاجي متاح.",
                    RequiresOverride = true
                });
            }
        }

        return Ok(result);
    }

    private static DrugSummaryDto MapToSummaryDto(Drug d)
    {
        return new DrugSummaryDto
        {
            Id = d.Id,
            TradeName = d.TradeName,
            ActiveIngredient = d.ActiveIngredient,
            Strength = d.Strength,
            Form = d.Form,
            Category = d.Category,
            DefaultDosage = d.DefaultDosage,
            DefaultTiming = d.DefaultTiming,
            DefaultDuration = d.DefaultDuration,
            AvoidInPregnancy = d.AvoidInPregnancy,
            AvoidInLactation = d.AvoidInLactation,
            PregnancyCategory = d.PregnancyCategory,
            IsDiscontinued = d.IsDiscontinued
        };
    }

    private static DrugDetailDto MapToDetailDto(Drug d)
    {
        return new DrugDetailDto
        {
            Id = d.Id,
            TradeName = d.TradeName,
            ActiveIngredient = d.ActiveIngredient,
            Strength = d.Strength,
            Form = d.Form,
            Category = d.Category,
            DefaultDosage = d.DefaultDosage,
            DefaultTiming = d.DefaultTiming,
            DefaultDuration = d.DefaultDuration,
            AvoidInPregnancy = d.AvoidInPregnancy,
            AvoidInLactation = d.AvoidInLactation,
            PregnancyCategory = d.PregnancyCategory,
            IsDiscontinued = d.IsDiscontinued,
            CreatedAtUtc = d.CreatedAtUtc
        };
    }
}
