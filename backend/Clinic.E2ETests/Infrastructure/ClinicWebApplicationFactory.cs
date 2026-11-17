using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Clinic.Api.Data;
using Clinic.Api.Hubs;
using Clinic.Api.Infrastructure;
using Clinic.Api.Infrastructure.Authentication;
using Clinic.Api.Services;

namespace Clinic.E2ETests.Infrastructure;

public class ClinicWebApplicationFactory : IAsyncDisposable
{
    private readonly string _tempDataDir;
    private WebApplication? _app;
    private RequestDelegate? _pipeline;

    public string DataRoot => _tempDataDir;
    public string ConnectionString { get; }
    public IServiceProvider Services => _app?.Services ?? throw new InvalidOperationException("Factory not initialized");
    public Uri BaseAddress { get; } = new Uri("http://localhost/");

    public ClinicWebApplicationFactory(string tempDataDir)
    {
        _tempDataDir = tempDataDir;
        Directory.CreateDirectory(_tempDataDir);
        var dbPath = Path.Combine(_tempDataDir, "clinic.db");
        ConnectionString = $"Data Source={dbPath};";
    }

    public async Task StartAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Development",
            ContentRootPath = _tempDataDir
        });

        builder.Logging.ClearProviders();

        // 1. Storage & AppSettings Configuration
        builder.Configuration["ClinicStorage:DataRoot"] = _tempDataDir;
        builder.Configuration["Jwt:Secret"] = "ClinicManagementSystemSuperSecretKey2026!MustBeAtLeast32BytesLongForHmacSha256";
        builder.Configuration["Jwt:Issuer"] = "ClinicSystem";
        builder.Configuration["Jwt:Audience"] = "ClinicSystemClients";
        builder.Configuration["Jwt:ExpiryHours"] = "12";
        builder.Configuration["ClinicSettings:RolloverHourLocal"] = "5";

        // 2. Core Services Registration from Clinic.Api
        builder.Services.AddControllers()
            .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()))
            .AddApplicationPart(typeof(Clinic.Api.Controllers.AuthController).Assembly)
            .AddControllersAsServices();

        builder.Services.AddSignalR();
        builder.Services.AddSingleton<HubLifetimeManager<QueueHub>, TestHubLifetimeManager>();

        // Authentication & JWT Services
        builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
        builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
        builder.Services.AddAuthentication("Bearer")
            .AddScheme<AuthenticationSchemeOptions, JwtAuthenticationHandler>("Bearer", null);
        builder.Services.AddAuthorization();

        builder.Services.AddSingleton<IBookingWriteLock, BookingWriteLock>();
        builder.Services.AddSingleton<IBusinessDateService>(sp => new BusinessDateService(sp.GetRequiredService<IConfiguration>()));
        builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        builder.Services.AddSingleton<SqlitePragmaInterceptor>();
        builder.Services.AddScoped<IShiftService, ShiftService>();

        builder.Services.AddDbContext<ClinicDbContext>((sp, options) =>
        {
            var pragmaInterceptor = sp.GetRequiredService<SqlitePragmaInterceptor>();
            options.UseSqlite(ConnectionString)
                   .AddInterceptors(pragmaInterceptor);
        });

        _app = builder.Build();

        // 3. Database Initialization & Seeding
        using (var scope = _app.Services.CreateScope())
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<ClinicWebApplicationFactory>>();
            var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

            try
            {
                await using (var conn = new SqliteConnection(ConnectionString))
                {
                    await conn.OpenAsync();
                    await using var walCmd = conn.CreateCommand();
                    walCmd.CommandText = "PRAGMA journal_mode = WAL;";
                    await walCmd.ExecuteNonQueryAsync();
                }

                await context.Database.EnsureCreatedAsync();
                await DbSeeder.SeedAsync(context, _app.Environment, passwordHasher, logger);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error initializing test database.");
                throw;
            }
        }

        // 4. Middleware & Routing
        _app.UseRouting();
        _app.UseAuthentication();
        _app.UseAuthorization();

        _app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.MapHub<QueueHub>("/hubs/queue");
            endpoints.MapGet("/api/health", () => Results.Ok(new
            {
                status = "Healthy",
                timestamp = DateTime.UtcNow
            }));
            endpoints.MapGet("/api/system/health", (IBusinessDateService bds) => Results.Ok(new
            {
                status = "Healthy",
                businessDate = bds.GetCurrentBusinessDate().ToString("yyyy-MM-dd"),
                databaseEngine = "SQLite",
                walMode = true
            }));
        });

        _pipeline = ((IApplicationBuilder)_app).Build();
    }

    public HttpClient CreateClient()
    {
        if (_pipeline == null || _app == null)
            throw new InvalidOperationException("Factory not initialized");
        var handler = new InMemoryHttpMessageHandler(_pipeline, _app.Services);
        return new HttpClient(handler) { BaseAddress = BaseAddress };
    }

    public async ValueTask DisposeAsync()
    {
        if (_app != null)
        {
            await _app.DisposeAsync();
        }
    }
}
