using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Appointments;

public class BookAppointmentRequestDto
{
    [Required]
    public int PatientId { get; set; }

    [Required]
    public int DoctorUserId { get; set; }

    [Required]
    public int ServiceId { get; set; }

    public List<int>? ProcedureIds { get; set; }

    public DiscountReason DiscountReason { get; set; } = DiscountReason.None;

    [Range(0, long.MaxValue)]
    public long DiscountAmountPiastres { get; set; } = 0L;

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;

    public string? PaymentReference { get; set; }

    public bool IsUrgent { get; set; } = false;

    public bool IsWalkIn { get; set; } = true;

    public int? ParentExamAppointmentId { get; set; }

    public string? IdempotencyKey { get; set; }
}

public class ThermalReceiptDto
{
    public string ReceiptNumber { get; set; } = string.Empty;
    public string ClinicName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string DoctorTitle { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PatientFileNumber { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public int? QueueNumber { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public List<string> Procedures { get; set; } = new();
    public long SubTotalPiastres { get; set; }
    public long DiscountPiastres { get; set; }
    public string? DiscountReason { get; set; }
    public long NetTotalPiastres { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string CashierName { get; set; } = string.Empty;
}

public class BookAppointmentResponseDto
{
    public int AppointmentId { get; set; }
    public int? QueueNumber { get; set; }
    public AppointmentStatus Status { get; set; }
    public DateOnly BusinessDate { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public int DoctorUserId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public int InvoiceId { get; set; }
    public long TotalPiastres { get; set; }
    public long DiscountPiastres { get; set; }
    public long NetTotalPiastres { get; set; }
    public ThermalReceiptDto Receipt { get; set; } = null!;
}

public class AppointmentDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public int DoctorUserId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public DateOnly BusinessDate { get; set; }
    public int? QueueNumber { get; set; }
    public BookingType BookingType { get; set; }
    public bool IsUrgent { get; set; }
    public AppointmentStatus Status { get; set; }
    public bool IsConsultation { get; set; }
    public int? ParentExamAppointmentId { get; set; }
    public DateTime? ArrivedAtUtc { get; set; }
    public DateTime? CalledAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public long CallSequence { get; set; }
    public long Version { get; set; }
    public int? InvoiceId { get; set; }
    public long? TotalPiastres { get; set; }
    public long? DiscountPiastres { get; set; }
    public long? NetTotalPiastres { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public InvoiceStatus? InvoiceStatus { get; set; }
}

public class CheckInRequestDto
{
    public bool? IsUrgent { get; set; }
}
