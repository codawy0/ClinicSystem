using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.PrescriptionTemplates;

public class TemplateItemDto
{
    public int? DrugId { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public string? ActiveIngredient { get; set; }
    public string? Strength { get; set; }
    public string? Form { get; set; }
    public string Dosage { get; set; } = string.Empty;
    public string Timing { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class TemplateClinicalRequestDto
{
    public RequestType Type { get; set; }
    public string? CatalogCode { get; set; }
    public string NameAr { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string? Notes { get; set; }
}

public class PrescriptionTemplateSummaryDto
{
    public int Id { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string? DefaultDiagnosis { get; set; }
    public int ItemsCount { get; set; }
    public int OrdersCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class PrescriptionTemplateDetailDto
{
    public int Id { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string? DefaultDiagnosis { get; set; }
    public int DoctorUserId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public List<TemplateItemDto> Items { get; set; } = new();
    public List<TemplateClinicalRequestDto> LabRadiologyOrders { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
}

public class CreatePrescriptionTemplateRequestDto
{
    [Required, MaxLength(150)]
    public string TemplateName { get; set; } = string.Empty;

    public string? DefaultDiagnosis { get; set; }

    [Required]
    public List<TemplateItemDto> Items { get; set; } = new();

    public List<TemplateClinicalRequestDto> LabRadiologyOrders { get; set; } = new();
}

public class CreateTemplateFromVisitRequestDto
{
    [Required, MaxLength(150)]
    public string TemplateName { get; set; } = string.Empty;
}
