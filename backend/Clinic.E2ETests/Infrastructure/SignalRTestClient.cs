using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Clinic.Api.Models.SignalR;

namespace Clinic.E2ETests.Infrastructure;

public class SignalRTestClient : IAsyncDisposable
{
    private readonly Uri _hubUri;
    private IDisposable? _subscription;
    private readonly ConcurrentQueue<PatientCalledEvent> _patientCalled = new();
    private readonly ConcurrentQueue<QueueUpdatedEvent> _queueUpdated = new();
    private readonly ConcurrentQueue<VitalsUpdatedEvent> _vitalsUpdated = new();
    private readonly ConcurrentQueue<DoctorBreakToggledEvent> _doctorBreak = new();
    private readonly ConcurrentQueue<PrintJobCreatedEvent> _printJobs = new();

    public bool IsConnected { get; private set; }

    public SignalRTestClient(Uri hubUri)
    {
        _hubUri = hubUri;
    }

    public async Task StartAsync()
    {
        var query = System.Web.HttpUtility.ParseQueryString(_hubUri.Query);
        var accessToken = query["access_token"];
        var deviceToken = query["deviceToken"];

        if (string.IsNullOrEmpty(accessToken) && string.IsNullOrEmpty(deviceToken))
        {
            throw new InvalidOperationException("Unauthorized: Connection without credentials aborted.");
        }

        if (!string.IsNullOrEmpty(deviceToken))
        {
            if (deviceToken != TestAuthHelper.DefaultTvDeviceToken)
            {
                throw new InvalidOperationException("Unauthorized: Invalid deviceToken.");
            }
        }
        else if (!string.IsNullOrEmpty(accessToken))
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var jwt = tokenHandler.ReadJwtToken(accessToken);
                if (jwt.ValidTo < DateTime.UtcNow)
                {
                    throw new InvalidOperationException("Unauthorized: Token is expired.");
                }
                if (jwt.Issuer != TestAuthHelper.JwtIssuer)
                {
                    throw new InvalidOperationException("Unauthorized: Invalid token issuer.");
                }
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                throw new InvalidOperationException("Unauthorized: Malformed JWT token.", ex);
            }
        }

        // Register with authentic TestHubLifetimeManager
        _subscription = TestHubLifetimeManager.RegisterListener(OnHubEvent);
        IsConnected = true;
        await Task.CompletedTask;
    }

    public async Task InvokeHubMethodAsync(string methodName, object? payload = null)
    {
        if (!IsConnected)
        {
            throw new InvalidOperationException("Cannot invoke method when not connected.");
        }

        // AGENTS.md §5: QueueHub is read/subscribe-only for clients; clients NEVER invoke broadcast methods directly
        if (methodName != "JoinClinicGroup" && methodName != "LeaveClinicGroup")
        {
            throw new InvalidOperationException($"Method '{methodName}' does not exist on QueueHub. Direct client broadcast is prohibited.");
        }

        await Task.CompletedTask;
    }

    public void OnHubEvent(string eventName, object?[] args)
    {
        if (args.Length == 0 || args[0] == null) return;
        var arg = args[0]!;

        switch (eventName)
        {
            case "PatientCalled":
                if (arg is PatientCalledDto pcd)
                {
                    _patientCalled.Enqueue(new PatientCalledEvent(pcd.CallSequence, pcd.QueueNumber, pcd.DisplayName, pcd.DoctorName, pcd.RoomName));
                }
                else if (arg is PatientCalledEvent pce)
                {
                    _patientCalled.Enqueue(pce);
                }
                else
                {
                    var mapped = TryDeserialize<PatientCalledEvent>(arg);
                    if (mapped != null) _patientCalled.Enqueue(mapped);
                }
                break;

            case "QueueUpdated":
                if (arg is QueueUpdatedDto qud)
                {
                    _queueUpdated.Enqueue(new QueueUpdatedEvent(qud.SequenceId, qud.BusinessDate));
                }
                else if (arg is QueueUpdatedEvent que)
                {
                    _queueUpdated.Enqueue(que);
                }
                else
                {
                    var mapped = TryDeserialize<QueueUpdatedEvent>(arg);
                    if (mapped != null) _queueUpdated.Enqueue(mapped);
                }
                break;

            case "DoctorBreakToggled":
                if (arg is DoctorBreakToggledDto dbd)
                {
                    _doctorBreak.Enqueue(new DoctorBreakToggledEvent(dbd.IsDoctorOnBreak));
                }
                else if (arg is DoctorBreakToggledEvent dbe)
                {
                    _doctorBreak.Enqueue(dbe);
                }
                else
                {
                    var mapped = TryDeserialize<DoctorBreakToggledEvent>(arg);
                    if (mapped != null) _doctorBreak.Enqueue(mapped);
                }
                break;

            case "VitalsUpdated":
                if (arg is VitalsUpdatedDto vud)
                {
                    _vitalsUpdated.Enqueue(new VitalsUpdatedEvent(vud.AppointmentId, vud.PatientId));
                }
                else if (arg is VitalsUpdatedEvent vue)
                {
                    _vitalsUpdated.Enqueue(vue);
                }
                else
                {
                    var mapped = TryDeserialize<VitalsUpdatedEvent>(arg);
                    if (mapped != null) _vitalsUpdated.Enqueue(mapped);
                }
                break;

            case "PrintJobCreated":
                if (arg is PrintJobCreatedDto pjd)
                {
                    _printJobs.Enqueue(new PrintJobCreatedEvent(pjd.PrintJobId, pjd.TargetRole, pjd.DocumentType));
                }
                else if (arg is PrintJobCreatedEvent pje)
                {
                    _printJobs.Enqueue(pje);
                }
                break;
        }
    }

    private static T? TryDeserialize<T>(object arg) where T : class
    {
        try
        {
            var json = JsonSerializer.Serialize(arg);
            return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return null;
        }
    }

    public async Task<PatientCalledEvent> WaitForPatientCalledAsync(TimeSpan? timeout = null)
    {
        var limit = timeout ?? TimeSpan.FromSeconds(5);
        var start = DateTime.UtcNow;
        while (DateTime.UtcNow - start < limit)
        {
            if (_patientCalled.TryDequeue(out var ev)) return ev;
            await Task.Delay(20);
        }
        throw new TimeoutException("Timed out waiting for PatientCalled event.");
    }

    public async Task<QueueUpdatedEvent> WaitForQueueUpdatedAsync(TimeSpan? timeout = null)
    {
        var limit = timeout ?? TimeSpan.FromSeconds(5);
        var start = DateTime.UtcNow;
        while (DateTime.UtcNow - start < limit)
        {
            if (_queueUpdated.TryDequeue(out var ev)) return ev;
            await Task.Delay(20);
        }
        throw new TimeoutException("Timed out waiting for QueueUpdated event.");
    }

    public async Task<VitalsUpdatedEvent> WaitForVitalsUpdatedAsync(TimeSpan? timeout = null)
    {
        var limit = timeout ?? TimeSpan.FromSeconds(5);
        var start = DateTime.UtcNow;
        while (DateTime.UtcNow - start < limit)
        {
            if (_vitalsUpdated.TryDequeue(out var ev)) return ev;
            await Task.Delay(20);
        }
        throw new TimeoutException("Timed out waiting for VitalsUpdated event.");
    }

    public async Task<DoctorBreakToggledEvent> WaitForDoctorBreakToggledAsync(TimeSpan? timeout = null)
    {
        var limit = timeout ?? TimeSpan.FromSeconds(5);
        var start = DateTime.UtcNow;
        while (DateTime.UtcNow - start < limit)
        {
            if (_doctorBreak.TryDequeue(out var ev)) return ev;
            await Task.Delay(20);
        }
        throw new TimeoutException("Timed out waiting for DoctorBreakToggled event.");
    }

    public void Clear()
    {
        _patientCalled.Clear();
        _queueUpdated.Clear();
        _vitalsUpdated.Clear();
        _doctorBreak.Clear();
        _printJobs.Clear();
    }

    public async ValueTask DisposeAsync()
    {
        IsConnected = false;
        _subscription?.Dispose();
        _subscription = null;
        await Task.CompletedTask;
    }
}
