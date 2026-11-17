namespace Clinic.Api.Infrastructure.Storage;

public record FileValidationResult(
    bool IsValid,
    string? MimeType,
    string? FileExtension,
    string? ErrorCode,
    string? ErrorMessage)
{
    public static FileValidationResult Success(string mimeType, string fileExtension) =>
        new(true, mimeType, fileExtension, null, null);

    public static FileValidationResult Failure(string errorCode, string errorMessage) =>
        new(false, null, null, errorCode, errorMessage);
}

public static class FileSecurityValidator
{
    public const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10,485,760 bytes (10MB)

    // Magic Byte Signatures
    private static readonly byte[] JpegHeader = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] PdfHeader = [0x25, 0x50, 0x44, 0x46]; // %PDF
    private static readonly byte[] RiffHeader = [0x52, 0x49, 0x46, 0x46]; // RIFF
    private static readonly byte[] WebpHeader = [0x57, 0x45, 0x42, 0x50]; // WEBP

    public static FileValidationResult Validate(Stream stream, string? fileName, long length)
    {
        if (length <= 0)
        {
            return FileValidationResult.Failure("FILE_EMPTY", "الملف المرفق فارغ.");
        }

        if (length > MaxFileSizeBytes)
        {
            return FileValidationResult.Failure("FILE_TOO_LARGE", "حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).");
        }

        var header = new byte[16];
        long originalPosition = stream.CanSeek ? stream.Position : 0;
        int bytesRead;

        try
        {
            bytesRead = stream.Read(header, 0, header.Length);
        }
        finally
        {
            if (stream.CanSeek)
            {
                stream.Position = originalPosition;
            }
        }

        if (bytesRead < 3)
        {
            return FileValidationResult.Failure("INVALID_FILE_TYPE", "رأس الملف غير مكتمل أو غير صالح.");
        }

        // 1. JPEG (FF D8 FF)
        if (bytesRead >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            return FileValidationResult.Success("image/jpeg", ".jpg");
        }

        // 2. PNG (89 50 4E 47 0D 0A 1A 0A)
        if (bytesRead >= 8 && header.Take(8).SequenceEqual(PngHeader))
        {
            return FileValidationResult.Success("image/png", ".png");
        }

        // 3. PDF (25 50 44 46)
        if (bytesRead >= 4 && header.Take(4).SequenceEqual(PdfHeader))
        {
            return FileValidationResult.Success("application/pdf", ".pdf");
        }

        // 4. WebP (RIFF at 0..3 and WEBP at 8..11)
        if (bytesRead >= 12 &&
            header.Take(4).SequenceEqual(RiffHeader) &&
            header.Skip(8).Take(4).SequenceEqual(WebpHeader))
        {
            return FileValidationResult.Success("image/webp", ".webp");
        }

        return FileValidationResult.Failure("INVALID_FILE_TYPE",
            "نوع الملف غير مدعوم أو لا يطابق محتواه. الأنواع المسموح بها هي: JPEG, PNG, WebP, PDF.");
    }
}
