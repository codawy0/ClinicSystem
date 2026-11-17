namespace Clinic.Api.Infrastructure.Storage;

public interface IAttachmentStorageService
{
    string GetAttachmentsDirectory();
    string GetPhysicalFilePath(string storageFileName);
    Task<string> SaveAttachmentAsync(Stream stream, string storageFileName, CancellationToken cancellationToken = default);
    bool FileExists(string storageFileName);
    bool DeleteFile(string storageFileName);
}
