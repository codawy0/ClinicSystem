using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class ServiceCatalog : IAuditableEntity
{
    public int Id { get; set; }

    [MaxLength(30)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(100)]
    public string NameAr { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? NameEn { get; set; }

    public ServiceCategory Category { get; set; }

    public long DefaultPricePiastres { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Navigations
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<InvoiceLine> InvoiceLines { get; set; } = new List<InvoiceLine>();
}
