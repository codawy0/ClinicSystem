using System.IO.Compression;
using System.Security.Claims;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Infrastructure.Storage;
using Clinic.Api.Models.Backup;
using Clinic.Api.Services;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class SqliteOnlineBackupTests : IAsyncLifetime
{
    private string _testDir = string.Empty;
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _admin = null!;

    public async Task InitializeAsync()
    {
        _testDir = Path.Combine(Path.GetTempPath(), $"clinic_backup_test_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_testDir);

        _dbFilePath = Path.Combine(_testDir, "clinic.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _admin = new User
        {
            Username = "admin_backup",
            PasswordHash = "h",
            FullName = "مسؤول النظام",
            Role = UserRole.Admin
        };
        context.Users.Add(_admin);
        await context.SaveChangesAsync();
    }

    public Task DisposeAsync()
    {
        try
        {
            SqliteConnection.ClearAllPools();
            if (Directory.Exists(_testDir))
            {
                Directory.Delete(_testDir, true);
            }
        }
        catch
        {
            // ignored
        }
        return Task.CompletedTask;
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private BackupController CreateController(ClinicDbContext context)
    {
        var storageOptions = Options.Create(new ClinicStorageOptions { DataRoot = _testDir });
        var controller = new BackupController(
            context,
            storageOptions,
            NullLogger<BackupController>.Instance);

        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, _admin.Id.ToString()),
            new Claim(ClaimTypes.Name, _admin.Username),
            new Claim(ClaimTypes.Role, _admin.Role.ToString())
        };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }

    [Fact]
    public async Task OnlineBackup_ShouldSucceedDuringConcurrentReadersAndWriters()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        // Pre-seed some records
        for (int i = 0; i < 50; i++)
        {
            context.Patients.Add(new Patient
            {
                FileNumber = $"F-CONC-{i:D4}",
                FullName = $"مريض متزامن {i}",
                Phone = $"0109999{i:D4}",
                Gender = PatientGender.Male
            });
        }
        await context.SaveChangesAsync();

        var cts = new CancellationTokenSource();
        var exceptions = new System.Collections.Concurrent.ConcurrentBag<Exception>();

        // Launch 10 concurrent reader/writer tasks
        var backgroundTasks = Enumerable.Range(0, 10).Select(workerId => Task.Run(async () =>
        {
            int counter = 0;
            while (!cts.Token.IsCancellationRequested)
            {
                try
                {
                    await using var workerContext = CreateDbContext();
                    if (counter % 2 == 0)
                    {
                        // Writer: insert new patient
                        workerContext.Patients.Add(new Patient
                        {
                            FileNumber = $"F-W{workerId}-{counter:D4}",
                            FullName = $"مريض جديد {workerId}_{counter}",
                            Phone = $"011{workerId:D2}{counter:D5}",
                            Gender = PatientGender.Female
                        });
                        await workerContext.SaveChangesAsync();
                    }
                    else
                    {
                        // Reader: query patients
                        var count = await workerContext.Patients.CountAsync();
                        count.Should().BeGreaterThan(0);
                    }
                    counter++;
                    await Task.Delay(5, cts.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    exceptions.Add(ex);
                }
            }
        })).ToArray();

        // While workers are hammering the database, trigger Online Hot Backup!
        await Task.Delay(50); // let workers ramp up
        var backupResponse = await controller.CreateBackup();

        // Stop background workers
        cts.Cancel();
        await Task.WhenAll(backgroundTasks);

        // Verify no worker encountered SQLITE_BUSY or crashed
        exceptions.Should().BeEmpty("Concurrent readers and writers must never experience SQLITE_BUSY during hot backup");

        var okResult = backupResponse.Result.Should().BeOfType<OkObjectResult>().Subject;
        var backupInfo = okResult.Value.Should().BeOfType<BackupInfoDto>().Subject;

        backupInfo.FileName.Should().StartWith("clinic_backup_");
        backupInfo.FileSizeBytes.Should().BeGreaterThan(0);
        backupInfo.IntegrityStatus.Should().Be("ok");
        backupInfo.Sha256Hash.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task OnlineBackup_ShouldPassIntegrityCheckAndProduceValidZipArchive()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        // Seed some data
        context.Patients.Add(new Patient
        {
            FileNumber = "F-INT-001",
            FullName = "مريض فحص النزاهة",
            Phone = "01000000001",
            Gender = PatientGender.Male
        });
        await context.SaveChangesAsync();

        var response = await controller.CreateBackup();
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var backupInfo = okResult.Value.Should().BeOfType<BackupInfoDto>().Subject;

        var backupsDir = Path.Combine(_testDir, "backups");
        var zipPath = Path.Combine(backupsDir, backupInfo.FileName);
        File.Exists(zipPath).Should().BeTrue();

        // Extract and verify archive contents
        string extractDir = Path.Combine(_testDir, $"extract_{Guid.NewGuid():N}");
        ZipFile.ExtractToDirectory(zipPath, extractDir);

        File.Exists(Path.Combine(extractDir, "clinic.db")).Should().BeTrue();
        File.Exists(Path.Combine(extractDir, "backup_manifest.json")).Should().BeTrue();

        // Verify integrity on extracted clinic.db
        var extractedDbPath = Path.Combine(extractDir, "clinic.db");
        await using (var conn = new SqliteConnection($"Data Source={extractedDbPath};Mode=ReadOnly;"))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "PRAGMA integrity_check;";
            var result = (string?)(await cmd.ExecuteScalarAsync());
            result.Should().Be("ok");
        }

        // Verify manifest
        var manifestJson = await File.ReadAllTextAsync(Path.Combine(extractDir, "backup_manifest.json"));
        var manifest = JsonSerializer.Deserialize<BackupManifestDto>(manifestJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        manifest.Should().NotBeNull();
        manifest!.IntegrityStatus.Should().Be("ok");
        manifest.UncompressedSizeBytes.Should().BeGreaterThan(0);
    }

    [Fact]
    public void BackupDownload_ShouldPreventDirectoryTraversal()
    {
        using var context = CreateDbContext();
        var controller = CreateController(context);

        // Test dangerous traversal patterns
        var res1 = controller.DownloadBackup("../../secret.txt");
        res1.Should().BeOfType<BadRequestObjectResult>();

        var res2 = controller.DownloadBackup("..\\windows\\system.ini");
        res2.Should().BeOfType<BadRequestObjectResult>();

        var res3 = controller.DownloadBackup("subfolder/backup.zip");
        res3.Should().BeOfType<BadRequestObjectResult>();

        var res4 = controller.DownloadBackup("invalid_ext.exe");
        res4.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task BackupRestore_ShouldValidateIntegrityAndTakePreRestoreEmergencySnapshot()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        // State 1: 1 patient
        context.Patients.Add(new Patient
        {
            FileNumber = "F-RESTORE-001",
            FullName = "مريض الحالة الأولى",
            Phone = "01000000010",
            Gender = PatientGender.Male
        });
        await context.SaveChangesAsync();

        // Create backup of State 1
        var createRes = await controller.CreateBackup();
        var backup1 = createRes.Result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<BackupInfoDto>().Subject;

        // State 2: Add more patients
        context.Patients.Add(new Patient
        {
            FileNumber = "F-RESTORE-002",
            FullName = "مريض الحالة الثانية",
            Phone = "01000000020",
            Gender = PatientGender.Female
        });
        await context.SaveChangesAsync();

        var state2Count = await context.Patients.CountAsync();
        state2Count.Should().Be(2);

        // Restore State 1
        var restoreRes = await controller.RestoreBackup(new RestoreBackupRequestDto
        {
            FileName = backup1.FileName
        });

        var okRestore = restoreRes.Result.Should().BeOfType<OkObjectResult>().Subject;
        var restoreDto = okRestore.Value.Should().BeOfType<RestoreBackupResponseDto>().Subject;

        restoreDto.Success.Should().BeTrue();
        restoreDto.PreRestoreEmergencyBackupFileName.Should().NotBeNullOrWhiteSpace();
        restoreDto.PreRestoreEmergencyBackupFileName.Should().StartWith("clinic_pre_restore_emergency_");

        // Verify pre-restore emergency file exists
        var backupsDir = Path.Combine(_testDir, "backups");
        File.Exists(Path.Combine(backupsDir, restoreDto.PreRestoreEmergencyBackupFileName!)).Should().BeTrue();

        // Verify database restored to State 1
        SqliteConnection.ClearAllPools();
        await using var verifyContext = CreateDbContext();
        var restoredCount = await verifyContext.Patients.CountAsync();
        restoredCount.Should().Be(1);
        var p = await verifyContext.Patients.FirstAsync();
        p.FileNumber.Should().Be("F-RESTORE-001");
    }

    [Fact]
    public async Task SqliteMaintenanceService_ShouldExecutePassiveCheckpoint()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ClinicStorage:DataRoot"] = _testDir,
                ["ClinicStorage:MaintenanceIntervalMinutes"] = "1"
            })
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        var sp = services.BuildServiceProvider();

        var maintenanceService = new SqliteMaintenanceService(
            sp,
            configuration,
            NullLogger<SqliteMaintenanceService>.Instance);

        bool success = await maintenanceService.ExecuteMaintenanceAsync(CancellationToken.None);
        success.Should().BeTrue();
    }
}
