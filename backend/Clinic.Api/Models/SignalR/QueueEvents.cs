namespace Clinic.Api.Models.SignalR;

public class QueueUpdatedDto
{
    public long SequenceId { get; set; }
    public DateOnly BusinessDate { get; set; }
    public int WaitingCount { get; set; }
    public int InNursingCount { get; set; }
    public int WithDoctorCount { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public class PatientCalledDto
{
    public long CallSequence { get; set; }
    public int QueueNumber { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public int AppointmentId { get; set; }
    public DateTime CalledAtUtc { get; set; } = DateTime.UtcNow;
}

public class VitalsUpdatedDto
{
    public int AppointmentId { get; set; }
    public int PatientId { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public class DoctorBreakToggledDto
{
    public bool IsDoctorOnBreak { get; set; }
    public string? Message { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public class PrintJobCreatedDto
{
    public int PrintJobId { get; set; }
    public string TargetRole { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
