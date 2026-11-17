using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Data;

namespace Clinic.Api.Hubs;

public class QueueHub : Hub<IQueueClient>
{
    public const string ClinicGroup = "ClinicGroup";
    public const string TvGroup = "TvGroup";

    private readonly ClinicDbContext _context;
    private readonly ILogger<QueueHub> _logger;

    public QueueHub(ClinicDbContext context, ILogger<QueueHub> logger)
    {
        _context = context;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        bool isUserAuthenticated = Context.User?.Identity?.IsAuthenticated == true;

        if (!isUserAuthenticated)
        {
            // Validate TvDeviceToken for unattended waiting room screens
            var deviceToken = httpContext?.Request.Query["deviceToken"].ToString()
                           ?? httpContext?.Request.Query["tvToken"].ToString()
                           ?? httpContext?.Request.Headers["X-Tv-Device-Token"].ToString();

            var setting = await _context.ClinicSettings.AsNoTracking().FirstOrDefaultAsync();
            var validToken = setting?.TvDeviceToken ?? "tv-waiting-room-secret-token";

            if (string.IsNullOrEmpty(deviceToken) || deviceToken != validToken)
            {
                _logger.LogWarning("QueueHub unauthorized connection attempt from {IpAddress}. Aborting.",
                    httpContext?.Connection.RemoteIpAddress);
                Context.Abort();
                return;
            }

            _logger.LogInformation("Waiting Room TV screen authenticated via TvDeviceToken: {ConnectionId}", Context.ConnectionId);
            await Groups.AddToGroupAsync(Context.ConnectionId, TvGroup);
        }
        else
        {
            _logger.LogInformation("Staff user connected to QueueHub: {Username} ({ConnectionId})",
                Context.User?.Identity?.Name, Context.ConnectionId);
        }

        // Always add all valid connections to the common clinic broadcast group
        await Groups.AddToGroupAsync(Context.ConnectionId, ClinicGroup);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected from QueueHub: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    // Subscriptions only - NO broadcast methods callable by clients
    public async Task JoinClinicGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, ClinicGroup);
    }

    public async Task LeaveClinicGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ClinicGroup);
    }
}
