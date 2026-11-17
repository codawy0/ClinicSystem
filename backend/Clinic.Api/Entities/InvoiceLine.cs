using System.ComponentModel.DataAnnotations;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class InvoiceLine : IAuditableEntity
{
    public int Id { get; set; }

    public int InvoiceId { get; set; }

    public int? ServiceId { get; set; }

    [MaxLength(150)]
    public string Description { get; set; } = string.Empty;

    public int Quantity { get; set; } = 1;

    public long UnitPricePiastres { get; set; }

    public long TotalPricePiastres { get; set; }

    // Navigations
    public Invoice Invoice { get; set; } = null!;
    public ServiceCatalog? Service { get; set; }
}
