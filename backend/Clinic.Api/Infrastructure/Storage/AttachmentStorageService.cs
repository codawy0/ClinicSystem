using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace Clinic.Api.Infrastructure.Storage;

public class AttachmentStorageService : IAttachmentStorageService
{
    private readonly string _attachmentsDirectory;

    public AttachmentStorageService(IOptions<ClinicStorageOptions> options, IWebHostEnvironment environment)
    {
        var dataRoot = options.Value.DataRoot ?? "./.clinic-data";
        if (!Path.IsPathRooted(dataRoot))
        {
            dataRoot = Path.GetFullPath(Path.Combine(environment.ContentRootPath, dataRoot));
        }

        var subfolder = options.Value.AttachmentsSubfolder ?? "attachments";
        _attachmentsDirectory = Path.GetFullPath(Path.Combine(dataRoot, subfolder));
        Directory.CreateDirectory(_attachmentsDirectory);
    }

    public AttachmentStorageService(string dataRoot)
    {
        _attachmentsDirectory = Path.GetFullPath(Path.Combine(dataRoot, "attachments"));
        Directory.CreateDirectory(_attachmentsDirectory);
    }

    public string GetAttachmentsDirectory() => _attachmentsDirectory;

    public string GetPhysicalFilePath(string storageFileName)
    {
        var sanitized = Path.GetFileName(storageFileName);
        var fullPath = Path.GetFullPath(Path.Combine(_attachmentsDirectory, sanitized));

        // Ensure that fullPath resides inside _attachmentsDirectory
        var normalizedDir = _attachmentsDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                            + Path.DirectorySeparatorChar;

        if (!fullPath.StartsWith(normalizedDir, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(fullPath, _attachmentsDirectory, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Path traversal detected.");
        }

        return fullPath;
    }

    public async Task<string> SaveAttachmentAsync(Stream stream, string storageFileName, CancellationToken cancellationToken = default)
    {
        var targetPath = GetPhysicalFilePath(storageFileName);
        await using var fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await stream.CopyToAsync(fileStream, cancellationToken);
        return targetPath;
    }

    public bool FileExists(string storageFileName)
    {
        var path = GetPhysicalFilePath(storageFileName);
        return File.Exists(path);
    }

    public bool DeleteFile(string storageFileName)
    {
        var path = GetPhysicalFilePath(storageFileName);
        if (File.Exists(path))
        {
            File.Delete(path);
            return true;
        }
        return false;
    }
}
