using Clinic.Api.Models.SignalR;

namespace Clinic.Api.Hubs;

public interface IQueueClient
{
    Task QueueUpdated(QueueUpdatedDto notification);
    Task PatientCalled(PatientCalledDto notification);
    Task VitalsUpdated(VitalsUpdatedDto notification);
    Task DoctorBreakToggled(DoctorBreakToggledDto notification);
    Task PrintJobCreated(PrintJobCreatedDto notification);
}
