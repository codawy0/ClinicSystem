using System.Security.Claims;
using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Infrastructure.Storage;
using Clinic.Api.Models.Attachments;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class AttachmentSecurityTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private string _tempDataRoot = string.Empty;

    private User _doctor = null!;
    private User _nurse = null!;
    private User _receptionist = null!;
    private Patient _patient = null!;
    private MedicalVisit _visit = null!;

    public async Task InitializeAsync()
    {
        // 1. Isolated temporary SQLite database
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_attsec_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        // 2. Isolated temporary storage root outside wwwroot & BaseDirectory
        _tempDataRoot = Path.Combine(Path.GetTempPath(), $"clinic_att_data_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDataRoot);
        Directory.CreateDirectory(Path.Combine(_tempDataRoot, "attachments"));

        // 3. Seed users, service catalog & patient
        _doctor = new User { Username = "doc_attsec", PasswordHash = "h", FullName = "د. كريم الهواري", Role = UserRole.Doctor };
        _nurse = new User { Username = "nurse_attsec", PasswordHash = "h", FullName = "سارة أحمد", Role = UserRole.Nurse };
        _receptionist = new User { Username = "rec_attsec", PasswordHash = "h", FullName = "منى محمود", Role = UserRole.Receptionist };
        _patient = new Patient { FileNumber = "P-ATTSEC-001", FullName = "ياسين إبراهيم", Phone = "01012345678", Gender = PatientGender.Male };

        var service = new ServiceCatalog
        {
            Code = "EXAM_ATT",
            NameAr = "كشف باطنة عامة",
            Category = ServiceCategory.Exam,
            DefaultPricePiastres = 25_000L
        };

        context.Users.AddRange(_doctor, _nurse, _receptionist);
        context.Patients.Add(_patient);
        context.ServiceCatalogs.Add(service);
        await context.SaveChangesAsync();

        var appointment = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = _patient.Id,
            ServiceId = service.Id,
            BusinessDate = new DateOnly(2026, 11, 17),
            QueueNumber = 1,
            Status = AppointmentStatus.WithDoctor,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();

        _visit = new MedicalVisit
        {
            AppointmentId = appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.MedicalVisits.Add(_visit);
        await context.SaveChangesAsync();
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private AttachmentsController CreateController(ClinicDbContext context, User? user = null)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IAttachmentStorageService>(new AttachmentStorageService(_tempDataRoot));
        var serviceProvider = services.BuildServiceProvider();

        var controller = new AttachmentsController(
            context,
            NullLogger<AttachmentsController>.Instance,
            serviceProvider);

        var httpContext = new DefaultHttpContext();
        if (user != null)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }
        else
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static IFormFile CreateFormFile(byte[] bytes, string fileName, string contentType)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    // ==========================================
    // A. MAGIC BYTE VALIDATION (GENUINE UPLOADS)
    // ==========================================

    [Fact]
    public async Task Upload_GenuineJpeg_MagicBytes_FF_D8_FF_ShouldSucceedWith200AndPersistRecord()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        // Standard JPEG SOI marker (0xFF, 0xD8, 0xFF) + JFIF header
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x60, 0x60, 0x00, 0x00 };
        var file = CreateFormFile(jpegBytes, "chest_xray.jpg", "image/jpeg");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "أشعة عادية على الصدر",
            File = file
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.MimeType.Should().Be("image/jpeg");
        dto.SizeBytes.Should().Be(jpegBytes.Length);
        dto.PatientId.Should().Be(_patient.Id);

        // Verify SQLite DB record
        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb.Should().NotBeNull();
        inDb!.MimeType.Should().Be("image/jpeg");
        inDb.OriginalFileName.Should().Be("chest_xray.jpg");
        inDb.StorageFileName.Should().EndWith(".jpg");
        inDb.IsDeleted.Should().BeFalse();

        // Verify Physical File on disk
        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        (await File.ReadAllBytesAsync(physicalPath)).Should().Equal(jpegBytes);
    }

    [Fact]
    public async Task Upload_GenuinePng_MagicBytes_89_50_4E_47_ShouldSucceedWith200AndPersistRecord()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        // Standard 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52 };
        var file = CreateFormFile(pngBytes, "ultrasound.png", "image/png");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "سونار بطن وحوض",
            File = file
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.MimeType.Should().Be("image/png");
        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb!.StorageFileName.Should().EndWith(".png");

        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        (await File.ReadAllBytesAsync(physicalPath)).Should().Equal(pngBytes);
    }

    [Fact]
    public async Task Upload_GenuineWebp_MagicBytes_RIFF_WEBP_ShouldSucceedWith200AndPersistRecord()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        // WebP signature: "RIFF" (52 49 46 46) + 4-byte size + "WEBP" (57 45 42 50)
        var webpBytes = new byte[]
        {
            0x52, 0x49, 0x46, 0x46,
            0x14, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50,
            0x56, 0x50, 0x38, 0x20
        };
        var file = CreateFormFile(webpBytes, "skin_lesion.webp", "image/webp");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Photo",
            Title = "صورة سريرية",
            File = file
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.MimeType.Should().Be("image/webp");
        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb!.StorageFileName.Should().EndWith(".webp");

        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        (await File.ReadAllBytesAsync(physicalPath)).Should().Equal(webpBytes);
    }

    [Fact]
    public async Task Upload_GenuinePdf_MagicBytes_25_50_44_46_ShouldSucceedWith200AndPersistRecord()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _nurse);

        // PDF signature: "%PDF-1.4"
        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF");
        var file = CreateFormFile(pdfBytes, "lab_report.pdf", "application/pdf");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Lab",
            Title = "تقرير معمل البرج",
            File = file
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.MimeType.Should().Be("application/pdf");
        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb!.StorageFileName.Should().EndWith(".pdf");

        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        (await File.ReadAllBytesAsync(physicalPath)).Should().Equal(pdfBytes);
    }

    [Fact]
    public async Task Upload_LinkedToMedicalVisit_ShouldPersistMedicalVisitId()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4\nVisit related report");
        var file = CreateFormFile(pdfBytes, "visit_report.pdf", "application/pdf");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            MedicalVisitId = _visit.Id,
            FileType = "Document",
            Title = "مستند الزيارة",
            File = file
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.MedicalVisitId.Should().Be(_visit.Id);

        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb!.MedicalVisitId.Should().Be(_visit.Id);
    }

    [Fact]
    public async Task Upload_LinkedToNonExistentVisit_ShouldReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4\nSample");
        var file = CreateFormFile(pdfBytes, "report.pdf", "application/pdf");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            MedicalVisitId = 99999,
            FileType = "Document",
            File = file
        };

        var response = await controller.Upload(request);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Upload_LinkedToVisitOfDifferentPatient_ShouldReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        // Seed a second patient and visit
        var patient2 = new Patient { FileNumber = "P-ATT-002", FullName = "سعيد كامل", Phone = "01099887766", Gender = PatientGender.Male };
        context.Patients.Add(patient2);
        await context.SaveChangesAsync();

        var service = await context.ServiceCatalogs.FirstAsync();

        var appointment2 = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = patient2.Id,
            ServiceId = service.Id,
            BusinessDate = new DateOnly(2026, 11, 17),
            QueueNumber = 2,
            Status = AppointmentStatus.WithDoctor,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Appointments.Add(appointment2);
        await context.SaveChangesAsync();

        var visit2 = new MedicalVisit
        {
            AppointmentId = appointment2.Id,
            PatientId = patient2.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.MedicalVisits.Add(visit2);
        await context.SaveChangesAsync();

        var pdfBytes = Encoding.ASCII.GetBytes("%PDF-1.4\nSample");
        var file = CreateFormFile(pdfBytes, "report.pdf", "application/pdf");

        // Attempt to link patient 1 upload to patient 2's visit
        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            MedicalVisitId = visit2.Id,
            FileType = "Document",
            File = file
        };

        var response = await controller.Upload(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_VISIT_LINK");
    }

    // ==========================================
    // B. MALICIOUS / SPOOFED FILE REJECTION
    // ==========================================

    [Fact]
    public async Task Upload_SpoofedWindowsExecutable_MZHeader_DisguisedAsJpg_MustBeRejectedWith400InvalidFileType()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        // PE / DOS Header: "MZ" (4D 5A)
        var exeBytes = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00 };
        var file = CreateFormFile(exeBytes, "trojan.jpg", "image/jpeg");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "صورة مزيفة",
            File = file
        };

        var response = await controller.Upload(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE_TYPE");

        // Verify zero attachments saved in DB
        (await context.PatientAttachments.CountAsync()).Should().Be(0);

        // Verify zero files created in attachments directory
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_SpoofedPhpScript_DisguisedAsPng_MustBeRejectedWith400InvalidFileType()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var phpBytes = Encoding.UTF8.GetBytes("<?php system($_GET['cmd']); ?>");
        var file = CreateFormFile(phpBytes, "shell.png", "image/png");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Report",
            Title = "ملف خبيث",
            File = file
        };

        var response = await controller.Upload(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE_TYPE");

        (await context.PatientAttachments.CountAsync()).Should().Be(0);
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_SpoofedHtmlScript_DisguisedAsPdf_MustBeRejectedWith400InvalidFileType()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var htmlBytes = Encoding.UTF8.GetBytes("<html><head><script>alert('xss');</script></head><body>Fake PDF</body></html>");
        var file = CreateFormFile(htmlBytes, "fake_invoice.pdf", "application/pdf");

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Document",
            Title = "مستند مشبوه",
            File = file
        };

        var response = await controller.Upload(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE_TYPE");

        (await context.PatientAttachments.CountAsync()).Should().Be(0);
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_PlainTextDisguisedAsImage_MustBeRejectedWith400InvalidFileType()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var txtBytes = Encoding.UTF8.GetBytes("This is plain ascii text pretending to be a JPG file.");
        var file = CreateFormFile(txtBytes, "notes.jpg", "image/jpeg");

        var response = await controller.Upload(new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Report",
            File = file
        });

        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE_TYPE");

        (await context.PatientAttachments.CountAsync()).Should().Be(0);
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_TruncatedHeaderLessThanMagicLength_MustBeRejectedWith400InvalidFileType()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var tinyBytes = new byte[] { 0xFF, 0xD8 }; // Only 2 bytes, incomplete JPEG header
        var file = CreateFormFile(tinyBytes, "broken.jpg", "image/jpeg");

        var response = await controller.Upload(new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            File = file
        });

        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE_TYPE");

        (await context.PatientAttachments.CountAsync()).Should().Be(0);
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    [Fact]
    public async Task Upload_EmptyFile_MustBeRejectedWith400InvalidFile()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var emptyBytes = Array.Empty<byte>();
        var file = CreateFormFile(emptyBytes, "empty.pdf", "application/pdf");

        var response = await controller.Upload(new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Document",
            File = file
        });

        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_FILE");

        (await context.PatientAttachments.CountAsync()).Should().Be(0);
    }

    // ==========================================
    // C. STRICT FILE SIZE LIMITS (10MB BOUNDARY)
    // ==========================================

    [Fact]
    public async Task Upload_Exact10MegaBytes_10485760Bytes_MustBeAccepted()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        const int exact10Mb = 10 * 1024 * 1024; // 10,485,760 bytes
        var stream = new MemoryStream(exact10Mb);
        var pdfHeader = Encoding.ASCII.GetBytes("%PDF-1.4\n");
        stream.Write(pdfHeader, 0, pdfHeader.Length);
        stream.SetLength(exact10Mb);

        var formFile = new FormFile(stream, 0, exact10Mb, "file", "large_ct_scan.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "أشعة مقطعية كاملة 10 ميجا",
            File = formFile
        };

        var response = await controller.Upload(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.SizeBytes.Should().Be(exact10Mb);

        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb.Should().NotBeNull();
        inDb!.SizeBytes.Should().Be(exact10Mb);

        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        new FileInfo(physicalPath).Length.Should().Be(exact10Mb);
    }

    [Fact]
    public async Task Upload_Exceeds10MegaBytesByOneByte_10485761Bytes_MustBeRejectedWith400FileTooLarge()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        const int oversized = (10 * 1024 * 1024) + 1; // 10,485,761 bytes
        var stream = new MemoryStream(oversized);
        var pdfHeader = Encoding.ASCII.GetBytes("%PDF-1.4\n");
        stream.Write(pdfHeader, 0, pdfHeader.Length);
        stream.SetLength(oversized);

        var formFile = new FormFile(stream, 0, oversized, "file", "too_large.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        var request = new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "ملف يتجاوز الحد المسموح",
            File = formFile
        };

        var response = await controller.Upload(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("FILE_TOO_LARGE");

        // Verify zero attachments saved in DB
        (await context.PatientAttachments.CountAsync()).Should().Be(0);

        // Verify zero files created in attachments directory
        Directory.GetFiles(Path.Combine(_tempDataRoot, "attachments")).Should().BeEmpty();
    }

    // ==========================================
    // D. STORAGE ISOLATION & DIRECTORY TRAVERSAL
    // ==========================================

    [Fact]
    public async Task StorageIsolation_SavedFileMustResideInsideConfiguredDataRootAndNeverInsideWwwrootOrBaseDirectory()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00 };
        // Malicious directory traversal filename in request
        var file = CreateFormFile(jpegBytes, "../../wwwroot/malicious_payload.jpg", "image/jpeg");

        var response = await controller.Upload(new UploadAttachmentRequest
        {
            PatientId = _patient.Id,
            FileType = "Ray",
            Title = "اختبار مسار الحفظ",
            File = file
        });

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        var inDb = await context.PatientAttachments.FindAsync(dto.Id);
        inDb.Should().NotBeNull();

        // 1. StorageFileName must be a fresh GUID, completely stripping "../../wwwroot/"
        inDb!.StorageFileName.Should().NotContain("..");
        inDb.StorageFileName.Should().NotContain("/");
        inDb.StorageFileName.Should().NotContain("\\");
        Guid.TryParse(Path.GetFileNameWithoutExtension(inDb.StorageFileName), out _).Should().BeTrue("Filename must be a GUID");

        // 2. Physical path must be inside DataRoot/attachments
        var physicalPath = Path.Combine(_tempDataRoot, "attachments", inDb.StorageFileName);
        File.Exists(physicalPath).Should().BeTrue();
        physicalPath.StartsWith(Path.Combine(_tempDataRoot, "attachments")).Should().BeTrue();

        // 3. Physical path must NOT be inside wwwroot or BaseDirectory
        var wwwrootCheck = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
        physicalPath.StartsWith(wwwrootCheck).Should().BeFalse();
        physicalPath.StartsWith(AppDomain.CurrentDomain.BaseDirectory).Should().BeFalse();
    }

    [Fact]
    public void StorageService_SanitizesFileName_AndRetainsInsideAttachmentsDirectory()
    {
        var storageService = new AttachmentStorageService(_tempDataRoot);

        // Path traversal attempts in filename are sanitized by Path.GetFileName to prevent path escaping
        var path1 = storageService.GetPhysicalFilePath("../../../etc/passwd");
        path1.Should().StartWith(storageService.GetAttachmentsDirectory());
        Path.GetFileName(path1).Should().Be("passwd");

        var path2 = storageService.GetPhysicalFilePath("..\\..\\windows\\system32\\cmd.exe");
        path2.Should().StartWith(storageService.GetAttachmentsDirectory());
        Path.GetFileName(path2).Should().Be("cmd.exe");
    }

    // ==========================================
    // E. AUTHENTICATION & STREAMING FORENSICS
    // ==========================================

    [Fact]
    public void Controller_MustEnforceAuthorizeAttribute()
    {
        // 1. Verify class-level [Authorize]
        var classAuthorize = typeof(AttachmentsController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        classAuthorize.Should().NotBeEmpty("AttachmentsController must be decorated with [Authorize]");

        // 2. Verify GetFile action has no [AllowAnonymous]
        var allowAnonymous = typeof(AttachmentsController)
            .GetMethod(nameof(AttachmentsController.GetFile))!
            .GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true);
        allowAnonymous.Should().BeEmpty("GetFile must not allow anonymous access");

        // 3. Verify Upload action has no [AllowAnonymous]
        var uploadAllowAnonymous = typeof(AttachmentsController)
            .GetMethod(nameof(AttachmentsController.Upload))!
            .GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true);
        uploadAllowAnonymous.Should().BeEmpty("Upload must not allow anonymous access");
    }

    [Fact]
    public async Task GetFile_WithAuthenticatedDoctor_StreamsPhysicalFileWithCorrectMimeType()
    {
        await using var context = CreateDbContext();

        var originalBytes = Encoding.ASCII.GetBytes("%PDF-1.4\nPatient Medical Report Data Here\n%%EOF");
        var fileName = $"{Guid.NewGuid():N}.pdf";
        var filePath = Path.Combine(_tempDataRoot, "attachments", fileName);
        await File.WriteAllBytesAsync(filePath, originalBytes);

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            FileType = AttachmentFileType.Report,
            Title = "تقرير طبي",
            StorageFileName = fileName,
            OriginalFileName = "report.pdf",
            MimeType = "application/pdf",
            SizeBytes = originalBytes.Length,
            UploadedByUserId = _doctor.Id
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);

        var response = await controller.GetFile(attachment.Id);
        var physResult = response.Should().BeOfType<PhysicalFileResult>().Subject;

        physResult.ContentType.Should().Be("application/pdf");
        physResult.FileName.Should().Be(filePath);
        physResult.EnableRangeProcessing.Should().BeTrue();

        // Verify Content-Disposition inline header
        controller.Response.Headers.ContainsKey("Content-Disposition").Should().BeTrue();
        controller.Response.Headers["Content-Disposition"].ToString().Should().Contain("inline; filename=\"report.pdf\"");

        // Assert file stream contents byte-for-byte
        var readBytes = await File.ReadAllBytesAsync(physResult.FileName);
        readBytes.Should().Equal(originalBytes);
    }

    [Fact]
    public async Task GetFile_NonExistentAttachmentId_MustReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var response = await controller.GetFile(99999);
        response.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetFile_SoftDeletedAttachment_MustReturn404NotFound()
    {
        await using var context = CreateDbContext();

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            FileType = AttachmentFileType.Ray,
            Title = "أشعة محذوفة",
            StorageFileName = "deleted.jpg",
            OriginalFileName = "xray.jpg",
            MimeType = "image/jpeg",
            SizeBytes = 100,
            UploadedByUserId = _doctor.Id,
            IsDeleted = true
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);
        var response = await controller.GetFile(attachment.Id);
        response.Should().BeOfType<NotFoundObjectResult>();
    }

    // ==========================================
    // F. LISTING & SOFT DELETION
    // ==========================================

    [Fact]
    public async Task GetPatientAttachments_ShouldReturnOnlyNonDeletedAttachmentsForPatient()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        context.PatientAttachments.AddRange(
            new PatientAttachment
            {
                PatientId = _patient.Id,
                Title = "تقرير نشط 1",
                FileType = AttachmentFileType.Report,
                StorageFileName = "1.pdf",
                OriginalFileName = "1.pdf",
                MimeType = "application/pdf",
                UploadedByUserId = _doctor.Id,
                IsDeleted = false
            },
            new PatientAttachment
            {
                PatientId = _patient.Id,
                Title = "أشعة محذوفة",
                FileType = AttachmentFileType.Ray,
                StorageFileName = "2.jpg",
                OriginalFileName = "2.jpg",
                MimeType = "image/jpeg",
                UploadedByUserId = _doctor.Id,
                IsDeleted = true
            }
        );
        await context.SaveChangesAsync();

        var response = await controller.GetPatientAttachments(_patient.Id);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = okResult.Value.Should().BeOfType<List<AttachmentDto>>().Subject;

        items.Should().HaveCount(1);
        items[0].Title.Should().Be("تقرير نشط 1");
    }

    [Fact]
    public async Task GetPatientAttachments_NonExistentPatient_Returns404NotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var response = await controller.GetPatientAttachments(99999);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetVisitAttachments_ShouldReturnOnlyNonDeletedAttachmentsForVisit()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        context.PatientAttachments.AddRange(
            new PatientAttachment
            {
                PatientId = _patient.Id,
                MedicalVisitId = _visit.Id,
                Title = "تقرير زيارة نشط",
                FileType = AttachmentFileType.Document,
                StorageFileName = "v1.pdf",
                OriginalFileName = "v1.pdf",
                MimeType = "application/pdf",
                UploadedByUserId = _doctor.Id,
                IsDeleted = false
            },
            new PatientAttachment
            {
                PatientId = _patient.Id,
                MedicalVisitId = _visit.Id,
                Title = "تقرير زيارة محذوف",
                FileType = AttachmentFileType.Document,
                StorageFileName = "v2.pdf",
                OriginalFileName = "v2.pdf",
                MimeType = "application/pdf",
                UploadedByUserId = _doctor.Id,
                IsDeleted = true
            }
        );
        await context.SaveChangesAsync();

        var response = await controller.GetVisitAttachments(_visit.Id);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = okResult.Value.Should().BeOfType<List<AttachmentDto>>().Subject;

        items.Should().HaveCount(1);
        items[0].Title.Should().Be("تقرير زيارة نشط");
    }

    [Fact]
    public async Task GetById_ExistingAttachment_ReturnsAttachmentMetadata()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            Title = "تقرير مخصص",
            FileType = AttachmentFileType.Report,
            StorageFileName = "custom.pdf",
            OriginalFileName = "custom.pdf",
            MimeType = "application/pdf",
            UploadedByUserId = _doctor.Id,
            IsDeleted = false
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var response = await controller.GetById(attachment.Id);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AttachmentDto>().Subject;

        dto.Id.Should().Be(attachment.Id);
        dto.Title.Should().Be("تقرير مخصص");
        dto.FileType.Should().Be("Report");
    }

    [Fact]
    public async Task GetById_SoftDeletedAttachment_Returns404NotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor);

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            Title = "تقرير محذوف",
            FileType = AttachmentFileType.Report,
            StorageFileName = "custom_del.pdf",
            OriginalFileName = "custom_del.pdf",
            MimeType = "application/pdf",
            UploadedByUserId = _doctor.Id,
            IsDeleted = true
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var response = await controller.GetById(attachment.Id);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task SoftDeleteAttachment_ShouldSetIsDeletedTrue_PreservePhysicalFile_AndCreateAuditLog()
    {
        await using var context = CreateDbContext();

        var fileName = $"{Guid.NewGuid():N}.pdf";
        var filePath = Path.Combine(_tempDataRoot, "attachments", fileName);
        await File.WriteAllBytesAsync(filePath, "%PDF-1.4\nPreserved For Legal Audit Trail"u8.ToArray());

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            Title = "تقرير للحذف",
            FileType = AttachmentFileType.Lab,
            StorageFileName = fileName,
            OriginalFileName = "lab_to_delete.pdf",
            MimeType = "application/pdf",
            SizeBytes = 40,
            UploadedByUserId = _doctor.Id,
            IsDeleted = false
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);

        var response = await controller.SoftDelete(attachment.Id);
        response.Should().BeOfType<NoContentResult>();

        // 1. Verify DB record soft-deleted
        var inDb = await context.PatientAttachments.FindAsync(attachment.Id);
        inDb!.IsDeleted.Should().BeTrue();

        // 2. Verify physical file is PRESERVED on disk for audit compliance
        File.Exists(filePath).Should().BeTrue("Physical file must be retained on disk for medical audit compliance");

        // 3. Verify AuditLog entry created
        var audit = await context.AuditLogs.FirstOrDefaultAsync(a => a.EntityName == "PatientAttachment" && a.EntityId == attachment.Id.ToString());
        audit.Should().NotBeNull();
        audit!.Action.Should().Be("SoftDeleteAttachment");
        audit.ActorUserId.Should().Be(_doctor.Id);
        audit.DiffJson.Should().Contain(attachment.StorageFileName);
    }

    [Fact]
    public async Task SoftDeleteAttachment_AlreadyDeleted_Returns404NotFound()
    {
        await using var context = CreateDbContext();

        var attachment = new PatientAttachment
        {
            PatientId = _patient.Id,
            Title = "محذوف مسبقاً",
            FileType = AttachmentFileType.Lab,
            StorageFileName = "del.pdf",
            OriginalFileName = "del.pdf",
            MimeType = "application/pdf",
            UploadedByUserId = _doctor.Id,
            IsDeleted = true
        };
        context.PatientAttachments.Add(attachment);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor);
        var response = await controller.SoftDelete(attachment.Id);
        response.Should().BeOfType<NotFoundObjectResult>();
    }

    public async Task DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            if (File.Exists(_dbFilePath + "-wal")) File.Delete(_dbFilePath + "-wal");
            if (File.Exists(_dbFilePath + "-shm")) File.Delete(_dbFilePath + "-shm");
            if (Directory.Exists(_tempDataRoot)) Directory.Delete(_tempDataRoot, recursive: true);
        }
        catch { }
    }
}
