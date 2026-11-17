using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Clinic.Api.Infrastructure.Storage;

namespace Clinic.Api.Services;

public class SqliteMaintenanceService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SqliteMaintenanceService> _logger;
    private readonly TimeSpan _interval;

    public SqliteMaintenanceService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<SqliteMaintenanceService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;

        int intervalMinutes = configuration.GetValue<int>("ClinicStorage:MaintenanceIntervalMinutes", 15);
        _interval = TimeSpan.FromMinutes(Math.Max(1, intervalMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SQLite Maintenance Background Service started. Interval: {Interval} minutes", _interval.TotalMinutes);

        // Run initial checkpoint after short startup delay
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExecuteMaintenanceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Unexpected error during background SQLite maintenance checkpoint.");
            }

            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("SQLite Maintenance Background Service stopping.");
    }

    public async Task<bool> ExecuteMaintenanceAsync(CancellationToken cancellationToken = default)
    {
        var dataRoot = _configuration.GetValue<string>("ClinicStorage:DataRoot") ?? "./.clinic-data";
        var dbPath = Path.Combine(dataRoot, "clinic.db");
        var connectionString = $"Data Source={dbPath};";

        try
        {
            await using var conn = new SqliteConnection(connectionString);
            await conn.OpenAsync(cancellationToken);

            // Execute non-blocking PASSIVE WAL checkpoint
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "PRAGMA wal_checkpoint(PASSIVE);";

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                int busy = reader.GetInt32(0);
                int log = reader.GetInt32(1);
                int checkpointed = reader.GetInt32(2);

                _logger.LogDebug("SQLite WAL PASSIVE checkpoint executed. Busy: {Busy}, Log frames: {Log}, Checkpointed: {Checkpointed}",
                    busy, log, checkpointed);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to execute SQLite WAL maintenance checkpoint.");
            return false;
        }
    }
}
