using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.PrintJobs;
using Clinic.Tests.Helpers;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class PrintJobTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    private User _doctor = null!;
    private User _receptionist = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_printjob_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc_print", PasswordHash = "h", FullName = "د. حازم الطباع", Role = UserRole.Doctor };
        _receptionist = new User { Username = "rec_print", PasswordHash = "h", FullName = "استقبال الطباعة", Role = UserRole.Receptionist };

        context.Users.AddRange(_doctor, _receptionist);
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

    private static PrintJobsController CreateController(ClinicDbContext context, TestQueueHubContext hubContext, User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");

        return new PrintJobsController(
            context,
            hubContext,
            NullLogger<PrintJobsController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    // ==========================================
    // 1. ENQUEUE PRINT JOB & SIGNALR BROADCAST
    // ==========================================

    [Fact]
    public async Task EnqueuePrintJob_ValidPrescription_ShouldPersistPendingRecordAndBroadcastSignalR()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var request = new CreatePrintJobRequest
        {
            TargetRole = "DoctorPrinter",
            DocumentType = "Prescription",
            PayloadJson = "{\"patientName\":\"عمرو دياب\",\"diagnosis\":\"نزلة معوية\",\"medicines\":[{\"name\":\"Flagyl 500\"}]}"
        };

        var response = await controller.Enqueue(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.TargetRole.Should().Be("DoctorPrinter");
        dto.DocumentType.Should().Be("Prescription");
        dto.Status.Should().Be("Pending");

        // Verify SQLite DB state
        var inDb = await context.PrintJobs.FindAsync(dto.Id);
        inDb.Should().NotBeNull();
        inDb!.Status.Should().Be(PrintJobStatus.Pending);
        inDb.TargetRole.Should().Be(PrintJobTargetRole.DoctorPrinter);
        inDb.DocumentType.Should().Be(PrintDocumentType.Prescription);
        inDb.PayloadJson.Should().Contain("Flagyl 500");

        // Verify SignalR event broadcast via QueueHub
        hubContext.TestClient.PrintJobEvents.Should().ContainSingle(e =>
            e.PrintJobId == dto.Id &&
            e.TargetRole == "DoctorPrinter" &&
            e.DocumentType == "Prescription");
    }

    [Fact]
    public async Task EnqueuePrintJob_ReceiptDocumentType_ShouldPersistWithReceptionRole()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _receptionist);

        var request = new CreatePrintJobRequest
        {
            TargetRole = "ReceptionReceiptPrinter",
            DocumentType = "Receipt",
            PayloadJson = "{\"invoiceId\":\"INV-101\",\"amountEgp\":300.0,\"patientName\":\"سعيد صالح\"}"
        };

        var response = await controller.Enqueue(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.TargetRole.Should().Be("ReceptionReceiptPrinter");
        dto.DocumentType.Should().Be("Receipt");
        dto.Status.Should().Be("Pending");

        hubContext.TestClient.PrintJobEvents.Should().ContainSingle(e =>
            e.TargetRole == "ReceptionReceiptPrinter" &&
            e.DocumentType == "Receipt");
    }

    [Fact]
    public async Task EnqueuePrintJob_DefaultTargetRoleForReceipt_DefaultsToReceptionReceiptPrinter()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _receptionist);

        var request = new CreatePrintJobRequest
        {
            DocumentType = "Receipt",
            PayloadJson = "{\"invoiceId\":\"INV-102\"}"
        };

        var response = await controller.Enqueue(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.TargetRole.Should().Be("ReceptionReceiptPrinter");
        dto.DocumentType.Should().Be("Receipt");

        var inDb = await context.PrintJobs.FindAsync(dto.Id);
        inDb!.TargetRole.Should().Be(PrintJobTargetRole.ReceptionReceiptPrinter);
    }

    [Fact]
    public async Task EnqueuePrintJob_WithHtmlContentAndTargetPrinter_BuildsPayloadJson()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var request = new CreatePrintJobRequest
        {
            DocumentType = "LabSlip",
            HtmlContent = "<div>نتائج التحاليل للمريض</div>",
            TargetPrinterName = "ClinicThermalPrinter"
        };

        var response = await controller.Enqueue(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        var inDb = await context.PrintJobs.FindAsync(dto.Id);
        inDb.Should().NotBeNull();

        using var jsonDoc = System.Text.Json.JsonDocument.Parse(inDb!.PayloadJson);
        jsonDoc.RootElement.GetProperty("htmlContent").GetString().Should().Be("<div>نتائج التحاليل للمريض</div>");
        jsonDoc.RootElement.GetProperty("targetPrinterName").GetString().Should().Be("ClinicThermalPrinter");
    }

    [Fact]
    public async Task EnqueuePrintJob_MissingDocumentType_ShouldReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var request = new CreatePrintJobRequest
        {
            DocumentType = null,
            PrinterType = null,
            PayloadJson = "{}"
        };

        var response = await controller.Enqueue(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("DOCUMENT_TYPE_REQUIRED");

        // Verify no print job created in DB
        (await context.PrintJobs.CountAsync()).Should().Be(0);
        hubContext.TestClient.PrintJobEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task EnqueuePrintJob_InvalidDocumentType_ShouldReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var request = new CreatePrintJobRequest
        {
            DocumentType = "SuperDocumentUnknown",
            PayloadJson = "{}"
        };

        var response = await controller.Enqueue(request);
        var badRequest = response.Result.Should().BeOfType<ObjectResult>().Subject;
        badRequest.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var problem = badRequest.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("INVALID_DOCUMENT_TYPE");

        (await context.PrintJobs.CountAsync()).Should().Be(0);
    }

    // ==========================================
    // 2. GET PENDING PRINT JOBS
    // ==========================================

    [Fact]
    public async Task GetPendingPrintJobs_ShouldReturnOnlyPendingJobs_InAscendingOrder()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        // Seed 2 Pending jobs and 1 Printed job
        var now = DateTime.UtcNow;
        var jobOld = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.Prescription,
            PayloadJson = "{}",
            Status = PrintJobStatus.Pending,
            CreatedAtUtc = now.AddMinutes(-10)
        };
        var jobNew = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.LabSlip,
            PayloadJson = "{}",
            Status = PrintJobStatus.Pending,
            CreatedAtUtc = now.AddMinutes(-5)
        };
        var jobDone = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.Prescription,
            PayloadJson = "{}",
            Status = PrintJobStatus.Printed,
            CreatedAtUtc = now.AddMinutes(-2)
        };

        context.PrintJobs.AddRange(jobOld, jobNew, jobDone);
        await context.SaveChangesAsync();

        var response = await controller.GetPending();
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var pendingJobs = okResult.Value.Should().BeOfType<List<PrintJobResponseDto>>().Subject;

        pendingJobs.Should().HaveCount(2);
        pendingJobs.Select(j => j.Id).Should().Equal(jobOld.Id, jobNew.Id);
    }

    [Fact]
    public async Task GetPendingPrintJobs_WithTargetRoleFilter_ShouldFilterCorrectly()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _receptionist);

        context.PrintJobs.AddRange(
            new PrintJob
            {
                TargetRole = PrintJobTargetRole.DoctorPrinter,
                DocumentType = PrintDocumentType.Prescription,
                PayloadJson = "{}",
                Status = PrintJobStatus.Pending
            },
            new PrintJob
            {
                TargetRole = PrintJobTargetRole.ReceptionReceiptPrinter,
                DocumentType = PrintDocumentType.Receipt,
                PayloadJson = "{}",
                Status = PrintJobStatus.Pending
            }
        );
        await context.SaveChangesAsync();

        var response = await controller.GetPending(targetRole: "ReceptionReceiptPrinter");
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var pendingJobs = okResult.Value.Should().BeOfType<List<PrintJobResponseDto>>().Subject;

        pendingJobs.Should().HaveCount(1);
        pendingJobs[0].TargetRole.Should().Be("ReceptionReceiptPrinter");
        pendingJobs[0].DocumentType.Should().Be("Receipt");
    }

    [Fact]
    public async Task GetPendingPrintJobs_WhenNoPendingJobs_ReturnsEmptyList()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var response = await controller.GetPending();
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var list = okResult.Value.Should().BeOfType<List<PrintJobResponseDto>>().Subject;

        list.Should().BeEmpty();
    }

    // ==========================================
    // 3. GET PRINT JOB BY ID
    // ==========================================

    [Fact]
    public async Task GetById_ExistingJob_ReturnsJobDetails()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var job = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.SickLeave,
            PayloadJson = "{\"days\":5}",
            Status = PrintJobStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.PrintJobs.Add(job);
        await context.SaveChangesAsync();

        var response = await controller.GetById(job.Id);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.Id.Should().Be(job.Id);
        dto.DocumentType.Should().Be("SickLeave");
        dto.Status.Should().Be("Pending");
        dto.PayloadJson.Should().Contain("5");
    }

    [Fact]
    public async Task GetById_NonExistentJob_Returns404NotFound()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var response = await controller.GetById(99999);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    // ==========================================
    // 4. COMPLETE PRINT JOB
    // ==========================================

    [Fact]
    public async Task CompletePrintJob_ValidPendingJob_DefaultStatus_UpdatesStatusToPrinted()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var job = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.SickLeave,
            PayloadJson = "{\"days\":3}",
            Status = PrintJobStatus.Pending
        };
        context.PrintJobs.Add(job);
        await context.SaveChangesAsync();

        var response = await controller.Complete(job.Id, null);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.Status.Should().Be("Printed");

        // Verify DB update
        var inDb = await context.PrintJobs.FindAsync(job.Id);
        inDb!.Status.Should().Be(PrintJobStatus.Printed);

        // Verify excluded from subsequent pending query
        var pendingResponse = await controller.GetPending();
        var pendingList = ((OkObjectResult)pendingResponse.Result!).Value.As<List<PrintJobResponseDto>>();
        pendingList.Should().NotContain(j => j.Id == job.Id);
    }

    [Fact]
    public async Task CompletePrintJob_ValidPendingJob_WithStatusCompleted_UpdatesStatusToCompleted()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var job = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.Prescription,
            PayloadJson = "{}",
            Status = PrintJobStatus.Pending
        };
        context.PrintJobs.Add(job);
        await context.SaveChangesAsync();

        var request = new CompletePrintJobRequest { Status = "Completed" };
        var response = await controller.Complete(job.Id, request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.Status.Should().Be("Completed");

        var inDb = await context.PrintJobs.FindAsync(job.Id);
        inDb!.Status.Should().Be(PrintJobStatus.Completed);
    }

    [Fact]
    public async Task CompletePrintJob_ValidPendingJob_WithStatusFailed_UpdatesStatusToFailed()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var job = new PrintJob
        {
            TargetRole = PrintJobTargetRole.ReceptionReceiptPrinter,
            DocumentType = PrintDocumentType.Receipt,
            PayloadJson = "{}",
            Status = PrintJobStatus.Pending
        };
        context.PrintJobs.Add(job);
        await context.SaveChangesAsync();

        var request = new CompletePrintJobRequest { Status = "Failed", ErrorMessage = "Paper jam error" };
        var response = await controller.Complete(job.Id, request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrintJobResponseDto>().Subject;

        dto.Status.Should().Be("Failed");

        var inDb = await context.PrintJobs.FindAsync(job.Id);
        inDb!.Status.Should().Be(PrintJobStatus.Failed);
    }

    [Fact]
    public async Task CompletePrintJob_NonExistentId_ShouldReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var response = await controller.Complete(99999, new CompletePrintJobRequest());
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CompletePrintJob_AlreadyPrintedJob_ShouldBeIdempotent()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext, _doctor);

        var job = new PrintJob
        {
            TargetRole = PrintJobTargetRole.DoctorPrinter,
            DocumentType = PrintDocumentType.Prescription,
            PayloadJson = "{}",
            Status = PrintJobStatus.Printed
        };
        context.PrintJobs.Add(job);
        await context.SaveChangesAsync();

        var response = await controller.Complete(job.Id, new CompletePrintJobRequest { Status = "Printed" });
        response.Result.Should().BeOfType<OkObjectResult>();

        var inDb = await context.PrintJobs.FindAsync(job.Id);
        inDb!.Status.Should().Be(PrintJobStatus.Printed);
    }

    // ==========================================
    // 5. SECURITY & CONTROLLER ATTRIBUTES
    // ==========================================

    [Fact]
    public void PrintJobsController_MustBeGuardedWithAuthorizeAttribute()
    {
        var classAuthorize = typeof(PrintJobsController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        classAuthorize.Should().NotBeEmpty("PrintJobsController must be decorated with [Authorize]");
    }

    public async Task DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            if (File.Exists(_dbFilePath + "-wal")) File.Delete(_dbFilePath + "-wal");
            if (File.Exists(_dbFilePath + "-shm")) File.Delete(_dbFilePath + "-shm");
        }
        catch { }
    }
}
