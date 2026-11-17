using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class ClinicalRequestItem : IAuditableEntity
{
    public int Id { get; set; }

    public int MedicalVisitId { get; set; }

    public RequestType RequestType { get; set; }

    [MaxLength(50)]
    public string? CatalogCode { get; set; }

    [MaxLength(150)]
    public string NameAr { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? NameEn { get; set; }

    public string? Notes { get; set; }

    public string? ResultSummary { get; set; }

    // Navigation
    public MedicalVisit MedicalVisit { get; set; } = null!;
}
