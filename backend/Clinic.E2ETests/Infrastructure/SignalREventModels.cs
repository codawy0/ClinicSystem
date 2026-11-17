namespace Clinic.E2ETests.Infrastructure;

public record PatientCalledEvent(long CallSequence, int QueueNumber, string DisplayName, string DoctorName, string RoomName);
public record QueueUpdatedEvent(long SequenceId, DateOnly BusinessDate);
public record VitalsUpdatedEvent(int AppointmentId, int PatientId);
public record DoctorBreakToggledEvent(bool IsDoctorOnBreak);
public record PrintJobCreatedEvent(int PrintJobId, string TargetRole, string DocumentType);
