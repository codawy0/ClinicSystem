using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Clinic.Api.Data;
using Clinic.Api.Infrastructure.Storage;
using Clinic.Api.Models.Backup;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class BackupController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly ClinicStorageOptions _storageOptions;
    private readonly IWebHostEnvironment? _environment;
    private readonly ILogger<BackupController> _logger;

    public BackupController(
        ClinicDbContext context,
        IOptions<ClinicStorageOptions> storageOptions,
        ILogger<BackupController> logger,
        IWebHostEnvironment? environment = null)
    {
        _context = context;
        _storageOptions = storageOptions.Value;
        _logger = logger;
        _environment = environment;
    }

    private string GetLiveDbPath()
    {
        var dataSource = _context.Database.GetDbConnection().DataSource;
        if (!string.IsNullOrEmpty(dataSource))
        {
            return Path.GetFullPath(dataSource);
        }

        var dataRoot = _storageOptions.DataRoot ?? "./.clinic-data";
        if (!Path.IsPathRooted(dataRoot) && _environment != null)
        {
            dataRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, dataRoot));
        }
        return Path.GetFullPath(Path.Combine(dataRoot, "clinic.db"));
    }

    private string GetBackupsDirectory()
    {
        var liveDb = GetLiveDbPath();
        var dir = Path.GetDirectoryName(liveDb) ?? ".";
        var backupsDir = Path.Combine(dir, "backups");
        Directory.CreateDirectory(backupsDir);
        return Path.GetFullPath(backupsDir);
    }

    // POST /api/backup/create
    [HttpPost("create")]
    public async Task<ActionResult<BackupInfoDto>> CreateBackup()
    {
        try
        {
            var liveDbPath = GetLiveDbPath();
            var backupsDir = GetBackupsDirectory();
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            var zipFileName = $"clinic_backup_{timestamp}.zip";

            var backupInfo = await CreateBackupInternalAsync(liveDbPath, backupsDir, zipFileName);
            return Ok(backupInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create online SQLite backup.");
            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "BACKUP_FAILED",
                detail: $"فشل إنشاء النسخة الاحتياطية: {ex.Message}");
        }
    }

    // GET /api/backup/list
    [HttpGet("list")]
    public async Task<ActionResult<List<BackupInfoDto>>> ListBackups()
    {
        var backupsDir = GetBackupsDirectory();
        var files = Directory.GetFiles(backupsDir, "*.zip");

        var list = new List<BackupInfoDto>();
        foreach (var file in files)
        {
            var fileInfo = new FileInfo(file);
            string hash = string.Empty;
            try
            {
                using var sha = SHA256.Create();
                await using var fs = fileInfo.OpenRead();
                byte[] hashBytes = await sha.ComputeHashAsync(fs);
                hash = Convert.ToHexString(hashBytes).ToLowerInvariant();
            }
            catch
            {
                hash = "unavailable";
            }

            list.Add(new BackupInfoDto
            {
                FileName = fileInfo.Name,
                FileSizeBytes = fileInfo.Length,
                Sha256Hash = hash,
                IntegrityStatus = "ok",
                CreatedAtUtc = fileInfo.CreationTimeUtc
            });
        }

        return Ok(list.OrderByDescending(b => b.CreatedAtUtc).ToList());
    }

    // GET /api/backup/download/{filename}
    [HttpGet("download/{filename}")]
    public IActionResult DownloadBackup(string filename)
    {
        if (string.IsNullOrWhiteSpace(filename))
        {
            return BadRequest("اسم الملف إلزامي.");
        }

        // Directory Traversal Defense
        if (filename.Contains("..") || filename.Contains('/') || filename.Contains('\\'))
        {
            return BadRequest("اسم الملف غير صالح.");
        }

        if (Path.GetFileName(filename) != filename || !filename.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("امتداد أو اسم الملف غير مسموح به.");
        }

        var backupsDir = GetBackupsDirectory();
        var filePath = Path.Combine(backupsDir, filename);
        var fullPath = Path.GetFullPath(filePath);

        if (!fullPath.StartsWith(backupsDir, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("مسار الملف غير مسموح به.");
        }

        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound("ملف النسخة الاحتياطية غير موجود.");
        }

        return PhysicalFile(fullPath, "application/zip", filename);
    }

    // POST /api/backup/restore
    [HttpPost("restore")]
    public async Task<ActionResult<RestoreBackupResponseDto>> RestoreBackup([FromBody] RestoreBackupRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var filename = request.FileName;
        if (filename.Contains("..") || filename.Contains('/') || filename.Contains('\\') ||
            Path.GetFileName(filename) != filename || !filename.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("اسم الملف غير صالح.");
        }

        var backupsDir = GetBackupsDirectory();
        var backupZipPath = Path.Combine(backupsDir, filename);

        if (!System.IO.File.Exists(backupZipPath))
        {
            return NotFound("ملف النسخة الاحتياطية المحدد غير موجود.");
        }

        var liveDbPath = GetLiveDbPath();
        string stagingDir = Path.Combine(backupsDir, $"staging_{Guid.NewGuid():N}");
        string? emergencyBackupFileName = null;

        try
        {
            Directory.CreateDirectory(stagingDir);

            // 1. Extract zip to staging
            ZipFile.ExtractToDirectory(backupZipPath, stagingDir);
            var stagedDbPath = Path.Combine(stagingDir, "clinic.db");

            if (!System.IO.File.Exists(stagedDbPath))
            {
                return BadRequest("ملف النسخة الاحتياطية لا يحتوي على قاعدة بيانات صالحة (clinic.db مفقود).");
            }

            // 2. Integrity check on staged copy
            var stagedConnString = $"Data Source={stagedDbPath};Mode=ReadOnly;Pooling=False;";
            await using (var stagedConn = new SqliteConnection(stagedConnString))
            {
                await stagedConn.OpenAsync();
                await using var checkCmd = stagedConn.CreateCommand();
                checkCmd.CommandText = "PRAGMA integrity_check;";
                var checkResult = (string?)(await checkCmd.ExecuteScalarAsync());

                if (!string.Equals(checkResult, "ok", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest($"فشل فحص سلامة النسخة الاحتياطية: {checkResult}");
                }
            }
            SqliteConnection.ClearAllPools();

            // 3. Pre-Restore Emergency Snapshot of current live database
            var emergencyTimestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            emergencyBackupFileName = $"clinic_pre_restore_emergency_{emergencyTimestamp}.zip";
            await CreateBackupInternalAsync(liveDbPath, backupsDir, emergencyBackupFileName);

            // 4. Apply restore via SQLite Online Backup API (atomic page replacement)
            SqliteConnection.ClearAllPools();

            await using (var stagedConn = new SqliteConnection($"Data Source={stagedDbPath};Mode=ReadOnly;Pooling=False;"))
            await using (var liveConn = new SqliteConnection($"Data Source={liveDbPath};"))
            {
                await stagedConn.OpenAsync();
                await liveConn.OpenAsync();

                stagedConn.BackupDatabase(liveConn);

                await using var checkpointCmd = liveConn.CreateCommand();
                checkpointCmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                await checkpointCmd.ExecuteNonQueryAsync();
            }
            SqliteConnection.ClearAllPools();

            _logger.LogInformation("Database restored successfully from {BackupFile}. Emergency backup: {Emergency}",
                filename, emergencyBackupFileName);

            return Ok(new RestoreBackupResponseDto
            {
                Success = true,
                Message = "تمت استعادة قاعدة البيانات بنجاح.",
                RestoredFromFileName = filename,
                PreRestoreEmergencyBackupFileName = emergencyBackupFileName,
                RestoredAtUtc = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to restore database from {BackupFile}", filename);
            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "RESTORE_FAILED",
                detail: $"فشلت عملية استعادة النسخة الاحتياطية: {ex.Message}");
        }
        finally
        {
            try
            {
                if (Directory.Exists(stagingDir))
                {
                    Directory.Delete(stagingDir, true);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to clean up staging directory {Dir}", stagingDir);
            }
        }
    }

    private static async Task<BackupInfoDto> CreateBackupInternalAsync(string liveDbPath, string backupsDir, string zipFileName)
    {
        var tempSnapshotDb = Path.Combine(backupsDir, $"snapshot_{Guid.NewGuid():N}.db");
        var zipFilePath = Path.Combine(backupsDir, zipFileName);

        try
        {
            // 1. Non-blocking Online Hot Backup via SQLite Online Backup API
            var srcConnString = $"Data Source={liveDbPath};Mode=ReadOnly;Pooling=False;";
            var destConnString = $"Data Source={tempSnapshotDb};Pooling=False;";

            await using (var srcConn = new SqliteConnection(srcConnString))
            await using (var destConn = new SqliteConnection(destConnString))
            {
                await srcConn.OpenAsync();
                await destConn.OpenAsync();

                srcConn.BackupDatabase(destConn);

                // 2. PRAGMA integrity_check on snapshot
                await using var checkCmd = destConn.CreateCommand();
                checkCmd.CommandText = "PRAGMA integrity_check;";
                var integrity = (string?)(await checkCmd.ExecuteScalarAsync());

                if (!string.Equals(integrity, "ok", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"PRAGMA integrity_check returned '{integrity}' on backup snapshot.");
                }
            }
            SqliteConnection.ClearAllPools();

            // 3. Compute uncompressed hash
            string dbSha256;
            long uncompressedSize;
            using (var sha = SHA256.Create())
            await using (var dbFs = System.IO.File.OpenRead(tempSnapshotDb))
            {
                uncompressedSize = dbFs.Length;
                byte[] hash = await sha.ComputeHashAsync(dbFs);
                dbSha256 = Convert.ToHexString(hash).ToLowerInvariant();
            }

            var manifest = new BackupManifestDto
            {
                Version = "1.0",
                CreatedAtUtc = DateTime.UtcNow,
                UncompressedSizeBytes = uncompressedSize,
                DbSha256 = dbSha256,
                IntegrityStatus = "ok"
            };

            // 4. Package into ZIP archive
            if (System.IO.File.Exists(zipFilePath))
            {
                System.IO.File.Delete(zipFilePath);
            }

            using (var zipFs = new FileStream(zipFilePath, FileMode.Create))
            using (var archive = new ZipArchive(zipFs, ZipArchiveMode.Create))
            {
                archive.CreateEntryFromFile(tempSnapshotDb, "clinic.db", CompressionLevel.Optimal);

                var manifestEntry = archive.CreateEntry("backup_manifest.json", CompressionLevel.Optimal);
                await using var entryStream = manifestEntry.Open();
                await JsonSerializer.SerializeAsync(entryStream, manifest, new JsonSerializerOptions { WriteIndented = true });
            }

            // 5. Compute zip file info
            var zipInfo = new FileInfo(zipFilePath);
            string zipSha256;
            using (var sha = SHA256.Create())
            await using (var zfs = zipInfo.OpenRead())
            {
                byte[] hash = await sha.ComputeHashAsync(zfs);
                zipSha256 = Convert.ToHexString(hash).ToLowerInvariant();
            }

            return new BackupInfoDto
            {
                FileName = zipFileName,
                FileSizeBytes = zipInfo.Length,
                Sha256Hash = zipSha256,
                IntegrityStatus = "ok",
                CreatedAtUtc = zipInfo.CreationTimeUtc
            };
        }
        finally
        {
            if (System.IO.File.Exists(tempSnapshotDb))
            {
                try
                {
                    System.IO.File.Delete(tempSnapshotDb);
                }
                catch
                {
                    // ignored
                }
            }
        }
    }
}
