using System.ComponentModel.DataAnnotations;
using Clinic.Api.Models.Appointments;
using Clinic.Api.Models.SignalR;

namespace Clinic.Api.Models.Queue;

public class CallNextRequestDto
{
    [Required]
    public int DoctorUserId { get; set; }

    public string? IdempotencyKey { get; set; }
}

public class CallNextResponseDto
{
    public int AppointmentId { get; set; }
    public int QueueNumber { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public long CallSequence { get; set; }
    public DateTime CalledAtUtc { get; set; }
}

public class SkipRequestDto
{
    public string? Reason { get; set; }
}

public class ReturnFromSkipRequestDto
{
    public string? Reason { get; set; }
}

public class DoctorBreakRequestDto
{
    public bool? IsDoctorOnBreak { get; set; }
    public string? Message { get; set; }
}

public class UpcomingPatientDto
{
    public int AppointmentId { get; set; }
    public int QueueNumber { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public bool IsUrgent { get; set; }
}

public class TvStateDto
{
    public PatientCalledDto? CurrentCalled { get; set; }
    public List<UpcomingPatientDto> UpcomingWaiting { get; set; } = new();
    public bool IsDoctorOnBreak { get; set; }
    public string? BreakMessage { get; set; }
    public string ClinicName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
}

public class QueueBoardDto
{
    public DateOnly BusinessDate { get; set; }
    public List<AppointmentDto> Booked { get; set; } = new();
    public List<AppointmentDto> Waiting { get; set; } = new();
    public List<AppointmentDto> InNursing { get; set; } = new();
    public List<AppointmentDto> WithDoctor { get; set; } = new();
    public List<AppointmentDto> Skipped { get; set; } = new();
    public List<AppointmentDto> Completed { get; set; } = new();
}
