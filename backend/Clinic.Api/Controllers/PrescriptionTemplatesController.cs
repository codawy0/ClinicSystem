using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Models.PrescriptionTemplates;

namespace Clinic.Api.Controllers;

[Route("api/prescription-templates")]
[Authorize]
public class PrescriptionTemplatesController : ApiControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ClinicDbContext _context;
    private readonly ILogger<PrescriptionTemplatesController> _logger;

    public PrescriptionTemplatesController(ClinicDbContext context, ILogger<PrescriptionTemplatesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<PrescriptionTemplateSummaryDto>>> GetAll()
    {
        int callerId = GetCurrentUserId();

        var templates = await _context.PrescriptionTemplates
            .AsNoTracking()
            .Where(t => t.DoctorUserId == callerId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync();

        var dtos = templates.Select(t =>
        {
            var items = DeserializeItems(t.ItemsJson);
            var orders = DeserializeOrders(t.LabRadiologyOrdersJson);

            return new PrescriptionTemplateSummaryDto
            {
                Id = t.Id,
                TemplateName = t.TemplateName,
                DefaultDiagnosis = t.DefaultDiagnosis,
                ItemsCount = items.Count,
                OrdersCount = orders.Count,
                CreatedAtUtc = t.CreatedAtUtc
            };
        }).ToList();

        return Ok(dtos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrescriptionTemplateDetailDto>> GetById(int id)
    {
        int callerId = GetCurrentUserId();

        var template = await _context.PrescriptionTemplates
            .Include(t => t.Doctor)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null)
        {
            return NotFound("قالب الروشتة غير موجود");
        }

        // Privacy isolation: doctor can only see their own templates
        if (template.DoctorUserId != callerId)
        {
            return NotFound("قالب الروشتة غير موجود");
        }

        var items = DeserializeItems(template.ItemsJson);
        var orders = DeserializeOrders(template.LabRadiologyOrdersJson);

        var dto = new PrescriptionTemplateDetailDto
        {
            Id = template.Id,
            TemplateName = template.TemplateName,
            DefaultDiagnosis = template.DefaultDiagnosis,
            DoctorUserId = template.DoctorUserId,
            DoctorName = template.Doctor?.FullName ?? string.Empty,
            Items = items,
            LabRadiologyOrders = orders,
            CreatedAtUtc = template.CreatedAtUtc
        };

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<PrescriptionTemplateDetailDto>> Create([FromBody] CreatePrescriptionTemplateRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (string.IsNullOrWhiteSpace(request.TemplateName))
        {
            return BadRequest("اسم القالب مطلوب ولا يمكن أن يكون فارغاً");
        }

        int callerId = GetCurrentUserId();
        var doctorUser = await _context.Users.FindAsync(callerId);

        var template = new PrescriptionTemplate
        {
            TemplateName = request.TemplateName.Trim(),
            DefaultDiagnosis = request.DefaultDiagnosis?.Trim(),
            DoctorUserId = callerId,
            ItemsJson = JsonSerializer.Serialize(request.Items ?? new List<TemplateItemDto>(), JsonOptions),
            LabRadiologyOrdersJson = JsonSerializer.Serialize(request.LabRadiologyOrders ?? new List<TemplateClinicalRequestDto>(), JsonOptions),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.PrescriptionTemplates.Add(template);
        await _context.SaveChangesAsync();

        var dto = new PrescriptionTemplateDetailDto
        {
            Id = template.Id,
            TemplateName = template.TemplateName,
            DefaultDiagnosis = template.DefaultDiagnosis,
            DoctorUserId = template.DoctorUserId,
            DoctorName = doctorUser?.FullName ?? string.Empty,
            Items = request.Items ?? new List<TemplateItemDto>(),
            LabRadiologyOrders = request.LabRadiologyOrders ?? new List<TemplateClinicalRequestDto>(),
            CreatedAtUtc = template.CreatedAtUtc
        };

        return CreatedAtAction(nameof(GetById), new { id = template.Id }, dto);
    }

    [HttpPost("from-visit/{visitId:int}")]
    public async Task<ActionResult<PrescriptionTemplateDetailDto>> CreateFromVisit(
        int visitId,
        [FromBody] CreateTemplateFromVisitRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (string.IsNullOrWhiteSpace(request.TemplateName))
        {
            return BadRequest("اسم القالب مطلوب ولا يمكن أن يكون فارغاً");
        }

        var visit = await _context.MedicalVisits
            .Include(v => v.PrescriptionItems)
            .Include(v => v.ClinicalRequests)
            .Include(v => v.Doctor)
            .FirstOrDefaultAsync(v => v.Id == visitId);

        if (visit == null)
        {
            return NotFound("الزيارة الطبية غير موجودة");
        }

        int callerId = GetCurrentUserId();

        var items = visit.PrescriptionItems.Select(p => new TemplateItemDto
        {
            DrugId = p.DrugId,
            DrugName = p.DrugNameSnapshot,
            ActiveIngredient = p.ActiveIngredientSnapshot,
            Strength = p.StrengthSnapshot,
            Form = p.FormSnapshot,
            Dosage = p.Dosage,
            Timing = p.Timing,
            Duration = p.Duration,
            Notes = p.Notes
        }).ToList();

        var orders = visit.ClinicalRequests.Select(c => new TemplateClinicalRequestDto
        {
            Type = c.RequestType,
            CatalogCode = c.CatalogCode,
            NameAr = c.NameAr,
            NameEn = c.NameEn,
            Notes = c.Notes
        }).ToList();

        var template = new PrescriptionTemplate
        {
            TemplateName = request.TemplateName.Trim(),
            DefaultDiagnosis = visit.Diagnosis,
            DoctorUserId = callerId > 0 ? callerId : visit.DoctorUserId,
            ItemsJson = JsonSerializer.Serialize(items, JsonOptions),
            LabRadiologyOrdersJson = JsonSerializer.Serialize(orders, JsonOptions),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.PrescriptionTemplates.Add(template);
        await _context.SaveChangesAsync();

        var dto = new PrescriptionTemplateDetailDto
        {
            Id = template.Id,
            TemplateName = template.TemplateName,
            DefaultDiagnosis = template.DefaultDiagnosis,
            DoctorUserId = template.DoctorUserId,
            DoctorName = visit.Doctor?.FullName ?? string.Empty,
            Items = items,
            LabRadiologyOrders = orders,
            CreatedAtUtc = template.CreatedAtUtc
        };

        return CreatedAtAction(nameof(GetById), new { id = template.Id }, dto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var template = await _context.PrescriptionTemplates.FindAsync(id);
        if (template == null)
        {
            return NotFound("قالب الروشتة غير موجود");
        }

        int callerId = GetCurrentUserId();
        if (template.DoctorUserId != callerId)
        {
            return NotFound("قالب الروشتة غير موجود");
        }

        _context.PrescriptionTemplates.Remove(template);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static List<TemplateItemDto> DeserializeItems(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<TemplateItemDto>();
        try
        {
            return JsonSerializer.Deserialize<List<TemplateItemDto>>(json, JsonOptions) ?? new List<TemplateItemDto>();
        }
        catch
        {
            return new List<TemplateItemDto>();
        }
    }

    private static List<TemplateClinicalRequestDto> DeserializeOrders(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<TemplateClinicalRequestDto>();
        try
        {
            return JsonSerializer.Deserialize<List<TemplateClinicalRequestDto>>(json, JsonOptions) ?? new List<TemplateClinicalRequestDto>();
        }
        catch
        {
            return new List<TemplateClinicalRequestDto>();
        }
    }
}
