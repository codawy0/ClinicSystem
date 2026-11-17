using Microsoft.AspNetCore.Authentication;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Data;
using Clinic.Api.Hubs;
using Clinic.Api.Infrastructure;
using Clinic.Api.Infrastructure.Authentication;
using Clinic.Api.Infrastructure.Storage;
using Clinic.Api.Services;

var app = Program.CreateWebApplication(args);
await Program.InitializeDatabaseAsync(app);
await app.RunAsync();

public partial class Program
{
    public static WebApplication CreateWebApplication(string[]? args = null, Action<WebApplicationBuilder>? configureBuilder = null)
    {
        var builder = WebApplication.CreateBuilder(args ?? Array.Empty<string>());
        configureBuilder?.Invoke(builder);

        // 1. Storage & Data Directory Configuration
        var dataRoot = builder.Configuration.GetValue<string>("ClinicStorage:DataRoot") ?? "./.clinic-data";
        if (!Path.IsPathRooted(dataRoot))
        {
            dataRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, dataRoot));
        }
        Directory.CreateDirectory(dataRoot);

        var dbPath = Path.Combine(dataRoot, "clinic.db");
        var connectionString = $"Data Source={dbPath};";

        // 2. Core Services Registration
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(Program).Assembly)
            .AddControllersAsServices();
        builder.Services.AddSignalR();

        builder.Services.AddTransient<Clinic.Api.Controllers.MedicalVisitsController>(sp =>
            new Clinic.Api.Controllers.MedicalVisitsController(
                sp.GetRequiredService<ClinicDbContext>(),
                sp.GetRequiredService<IBusinessDateService>(),
                sp.GetRequiredService<IBookingWriteLock>(),
                sp.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<QueueHub, Clinic.Api.Hubs.IQueueClient>>(),
                sp.GetRequiredService<ILogger<Clinic.Api.Controllers.MedicalVisitsController>>()));

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

        // Storage Services
        builder.Services.Configure<ClinicStorageOptions>(builder.Configuration.GetSection(ClinicStorageOptions.SectionName));
        builder.Services.AddSingleton<IAttachmentStorageService, AttachmentStorageService>();
        builder.Services.AddHostedService<SqliteMaintenanceService>();

        builder.Services.AddDbContext<ClinicDbContext>((sp, options) =>
        {
            var pragmaInterceptor = sp.GetRequiredService<SqlitePragmaInterceptor>();
            options.UseSqlite(connectionString)
                   .AddInterceptors(pragmaInterceptor);
        });

        var app = builder.Build();

        // ============================================================================
        // 4. Middleware & SPA Static Files Pipeline
        // ============================================================================

        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        // A. Serve Static Files from wwwroot (Compiled React SPA)
        // UseDefaultFiles must precede UseStaticFiles to rewrite "/" to "/index.html"
        app.UseDefaultFiles();
        app.UseStaticFiles();

        // B. Routing & Security
        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        // C. Mapped Endpoints (Controllers, Hubs, Health Checks)
        app.MapControllers();
        app.MapHub<QueueHub>("/hubs/queue");

        // Dedicated Health Endpoint for Desktop Shell Readiness Polling
        app.MapGet("/api/health", () => Results.Ok(new
        {
            status = "Healthy",
            timestamp = DateTime.UtcNow
        }));

        // D. SPA Fallback Routing with Strict API/Hub Namespace Protection
        // Prevent SPA fallback from intercepting unmatched /api or /hubs requests
        app.Map("/api/{**catch-all}", () => Results.NotFound(new
        {
            status = 404,
            title = "NOT_FOUND",
            detail = "The requested API endpoint does not exist."
        }));

        app.Map("/hubs/{**catch-all}", () => Results.NotFound(new
        {
            status = 404,
            title = "NOT_FOUND",
            detail = "The requested SignalR hub does not exist."
        }));

        // Route all other unmatched client-side navigation paths to index.html
        app.MapFallbackToFile("index.html");

        return app;
    }

    public static async Task InitializeDatabaseAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        try
        {
            var connectionString = context.Database.GetConnectionString() ?? "Data Source=clinic.db;";
            await using (var conn = new SqliteConnection(connectionString))
            {
                await conn.OpenAsync();
                await using var walCmd = conn.CreateCommand();
                walCmd.CommandText = "PRAGMA journal_mode = WAL;";
                await walCmd.ExecuteNonQueryAsync();
            }

            await context.Database.EnsureCreatedAsync();
            await DbSeeder.SeedAsync(context, app.Environment, passwordHasher, logger);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred during database initialization or seeding.");
            throw;
        }
    }
}
