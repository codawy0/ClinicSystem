namespace Clinic.Api.Infrastructure.Storage;

public class ClinicStorageOptions
{
    public const string SectionName = "ClinicStorage";

    public string DataRoot { get; set; } = "./.clinic-data";

    public string AttachmentsSubfolder { get; set; } = "attachments";
}
