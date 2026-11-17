using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Hubs;
using Clinic.Api.Models.PrintJobs;
using Clinic.Api.Models.SignalR;

namespace Clinic.Api.Controllers;

[Route("api/print-jobs")]
[Authorize]
public class PrintJobsController : ApiControllerBase
{
    private readonly ClinicDbContext _context;
    private readonly IHubContext<QueueHub, IQueueClient> _hubContext;
    private readonly ILogger<PrintJobsController> _logger;

    public PrintJobsController(
        ClinicDbContext context,
        IHubContext<QueueHub, IQueueClient> hubContext,
        ILogger<PrintJobsController> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<PrintJobResponseDto>> Enqueue([FromBody] CreatePrintJobRequest request)
    {
        var docTypeStr = request.DocumentType ?? request.PrinterType;
        if (string.IsNullOrWhiteSpace(docTypeStr))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "DOCUMENT_TYPE_REQUIRED", detail: "نوع المستند مطلوب.");
        }

        if (!Enum.TryParse<PrintDocumentType>(docTypeStr, true, out var documentType))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "INVALID_DOCUMENT_TYPE", detail: $"نوع المستند '{docTypeStr}' غير صالح.");
        }

        PrintJobTargetRole targetRole = PrintJobTargetRole.DoctorPrinter;
        if (!string.IsNullOrWhiteSpace(request.TargetRole))
        {
            if (Enum.TryParse<PrintJobTargetRole>(request.TargetRole, true, out var parsedRole))
            {
                targetRole = parsedRole;
            }
            else if (request.TargetRole.Contains("Receipt", StringComparison.OrdinalIgnoreCase) ||
                     request.TargetRole.Contains("Reception", StringComparison.OrdinalIgnoreCase))
            {
                targetRole = PrintJobTargetRole.ReceptionReceiptPrinter;
            }
        }
        else if (documentType == PrintDocumentType.Receipt)
        {
            targetRole = PrintJobTargetRole.ReceptionReceiptPrinter;
        }

        var payload = !string.IsNullOrWhiteSpace(request.PayloadJson)
            ? request.PayloadJson
            : JsonSerializer.Serialize(new
            {
                htmlContent = request.HtmlContent ?? string.Empty,
                targetPrinterName = request.TargetPrinterName
            });

        var printJob = new PrintJob
        {
            TargetRole = targetRole,
            DocumentType = documentType,
            PayloadJson = payload,
            Status = PrintJobStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.PrintJobs.Add(printJob);
        await _context.SaveChangesAsync();

        // Broadcast SignalR notification to ClinicGroup
        var notification = new PrintJobCreatedDto
        {
            PrintJobId = printJob.Id,
            TargetRole = printJob.TargetRole.ToString(),
            DocumentType = printJob.DocumentType.ToString(),
            CreatedAtUtc = printJob.CreatedAtUtc
        };

        await _hubContext.Clients.Group(QueueHub.ClinicGroup).PrintJobCreated(notification);

        return Ok(new PrintJobResponseDto
        {
            Id = printJob.Id,
            TargetRole = printJob.TargetRole.ToString(),
            DocumentType = printJob.DocumentType.ToString(),
            PayloadJson = printJob.PayloadJson,
            Status = printJob.Status.ToString(),
            CreatedAtUtc = printJob.CreatedAtUtc
        });
    }

    [HttpGet("pending")]
    public async Task<ActionResult<List<PrintJobResponseDto>>> GetPending([FromQuery] string? targetRole = null)
    {
        var query = _context.PrintJobs
            .AsNoTracking()
            .Where(j => j.Status == PrintJobStatus.Pending);

        if (!string.IsNullOrWhiteSpace(targetRole) && Enum.TryParse<PrintJobTargetRole>(targetRole, true, out var parsedRole))
        {
            query = query.Where(j => j.TargetRole == parsedRole);
        }

        var list = await query
            .OrderBy(j => j.CreatedAtUtc)
            .Select(j => new PrintJobResponseDto
            {
                Id = j.Id,
                TargetRole = j.TargetRole.ToString(),
                DocumentType = j.DocumentType.ToString(),
                PayloadJson = j.PayloadJson,
                Status = j.Status.ToString(),
                CreatedAtUtc = j.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrintJobResponseDto>> GetById(int id)
    {
        var job = await _context.PrintJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id);
        if (job == null)
        {
            return NotFound("أمر الطباعة غير موجود.");
        }

        return Ok(new PrintJobResponseDto
        {
            Id = job.Id,
            TargetRole = job.TargetRole.ToString(),
            DocumentType = job.DocumentType.ToString(),
            PayloadJson = job.PayloadJson,
            Status = job.Status.ToString(),
            CreatedAtUtc = job.CreatedAtUtc
        });
    }

    [HttpPost("{id:int}/complete")]
    public async Task<ActionResult<PrintJobResponseDto>> Complete(int id, [FromBody] CompletePrintJobRequest? request)
    {
        var job = await _context.PrintJobs.FindAsync(id);
        if (job == null)
        {
            return NotFound("أمر الطباعة غير موجود.");
        }

        var requestedStatus = request?.Status ?? "Printed";
        if (string.Equals(requestedStatus, "Failed", StringComparison.OrdinalIgnoreCase))
        {
            job.Status = PrintJobStatus.Failed;
        }
        else if (string.Equals(requestedStatus, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            job.Status = PrintJobStatus.Completed;
        }
        else
        {
            job.Status = PrintJobStatus.Printed;
        }

        await _context.SaveChangesAsync();

        return Ok(new PrintJobResponseDto
        {
            Id = job.Id,
            TargetRole = job.TargetRole.ToString(),
            DocumentType = job.DocumentType.ToString(),
            PayloadJson = job.PayloadJson,
            Status = job.Status.ToString(),
            CreatedAtUtc = job.CreatedAtUtc
        });
    }
}
