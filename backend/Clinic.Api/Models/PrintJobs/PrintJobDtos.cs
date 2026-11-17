namespace Clinic.Api.Models.PrintJobs;

public class CreatePrintJobRequest
{
    public string? DocumentType { get; set; }
    public string? PrinterType { get; set; }
    public string? TargetRole { get; set; }
    public string? TargetPrinterName { get; set; }
    public string? HtmlContent { get; set; }
    public string? PayloadJson { get; set; }
}

public class CompletePrintJobRequest
{
    public string Status { get; set; } = "Printed";
    public string? ErrorMessage { get; set; }
}

public class PrintJobResponseDto
{
    public int Id { get; set; }
    public string TargetRole { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}
