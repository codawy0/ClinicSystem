using Clinic.Api.Common.Enums;

namespace Clinic.Api.Models.Import;

public class PatientImportRowDto
{
    public int RowNumber { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? NormalizedPhone { get; set; }
    public string? NationalId { get; set; }
    public PatientGender Gender { get; set; } = PatientGender.Male;
    public DateOnly? BirthDate { get; set; }
    public int? Age { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsValid { get; set; } = true;
    public bool IsDuplicate { get; set; } = false;
    public string? ExistingFileNumber { get; set; }
    public string? AssignedFileNumber { get; set; }
    public string? ErrorMessage { get; set; }
}

public class PatientImportSummaryDto
{
    public int TotalRowsProcessed { get; set; }
    public int ValidCount { get; set; }
    public int DuplicateCount { get; set; }
    public int ErrorCount { get; set; }
    public int InsertedCount { get; set; }
    public bool IsDryRun { get; set; }
    public List<PatientImportRowDto> Rows { get; set; } = new();
}

public class DrugImportRowDto
{
    public int RowNumber { get; set; }
    public string TradeName { get; set; } = string.Empty;
    public string ActiveIngredient { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public DrugForm Form { get; set; } = DrugForm.Tablet;
    public string? Category { get; set; }
    public string? DefaultDosage { get; set; }
    public string? DefaultTiming { get; set; }
    public string? DefaultDuration { get; set; }
    public bool AvoidInPregnancy { get; set; }
    public bool AvoidInLactation { get; set; }
    public string? PregnancyCategory { get; set; }
    public string Action { get; set; } = "Insert"; // "Insert", "Update", "Skipped", "Error"
    public bool IsValid { get; set; } = true;
    public string? ErrorMessage { get; set; }
}

public class DrugImportSummaryDto
{
    public int TotalRowsProcessed { get; set; }
    public int InsertedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int ErrorCount { get; set; }
    public bool IsDryRun { get; set; }
    public List<DrugImportRowDto> Rows { get; set; } = new();
}
