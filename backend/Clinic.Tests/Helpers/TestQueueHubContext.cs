using Microsoft.AspNetCore.SignalR;
using Clinic.Api.Hubs;
using Clinic.Api.Models.SignalR;

namespace Clinic.Tests.Helpers;

public class TestQueueHubContext : IHubContext<QueueHub, IQueueClient>
{
    public TestQueueClient TestClient { get; } = new();

    public IHubClients<IQueueClient> Clients => new TestHubClients(TestClient);
    public IGroupManager Groups => new TestGroupManager();

    private class TestHubClients : IHubClients<IQueueClient>
    {
        private readonly IQueueClient _client;
        public TestHubClients(IQueueClient client) => _client = client;

        public IQueueClient All => _client;
        public IQueueClient AllExcept(IReadOnlyList<string> excludedConnectionIds) => _client;
        public IQueueClient Client(string connectionId) => _client;
        public IQueueClient Clients(IReadOnlyList<string> connectionIds) => _client;
        public IQueueClient Group(string groupName) => _client;
        public IQueueClient GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => _client;
        public IQueueClient Groups(IReadOnlyList<string> groupNames) => _client;
        public IQueueClient User(string userId) => _client;
        public IQueueClient Users(IReadOnlyList<string> userIds) => _client;
    }

    private class TestGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}

public class TestQueueClient : IQueueClient
{
    public List<VitalsUpdatedDto> VitalsUpdatedEvents { get; } = new();
    public List<QueueUpdatedDto> QueueUpdatedEvents { get; } = new();
    public List<PatientCalledDto> PatientCalledEvents { get; } = new();
    public List<DoctorBreakToggledDto> DoctorBreakEvents { get; } = new();
    public List<PrintJobCreatedDto> PrintJobEvents { get; } = new();

    public Task VitalsUpdated(VitalsUpdatedDto notification)
    {
        VitalsUpdatedEvents.Add(notification);
        return Task.CompletedTask;
    }

    public Task QueueUpdated(QueueUpdatedDto notification)
    {
        QueueUpdatedEvents.Add(notification);
        return Task.CompletedTask;
    }

    public Task PatientCalled(PatientCalledDto notification)
    {
        PatientCalledEvents.Add(notification);
        return Task.CompletedTask;
    }

    public Task DoctorBreakToggled(DoctorBreakToggledDto notification)
    {
        DoctorBreakEvents.Add(notification);
        return Task.CompletedTask;
    }

    public Task PrintJobCreated(PrintJobCreatedDto notification)
    {
        PrintJobEvents.Add(notification);
        return Task.CompletedTask;
    }
}
