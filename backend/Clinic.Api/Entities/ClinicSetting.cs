using System.ComponentModel.DataAnnotations;
using Clinic.Api.Common.Enums;
using Clinic.Api.Entities.Common;

namespace Clinic.Api.Entities;

public class ClinicSetting : IAuditableEntity
{
    public int Id { get; set; } = 1;

    [MaxLength(150)]
    public string ClinicName { get; set; } = "عيادة النور التخصصية";

    [MaxLength(150)]
    public string DoctorName { get; set; } = "د. أحمد عبد الرحمن";

    [MaxLength(150)]
    public string DoctorTitle { get; set; } = "استشاري الباطنة والقلب والسكر";

    [MaxLength(150)]
    public string Specialty { get; set; } = "أمراض الباطنة والقلب";

    public int ConsultationValidityDays { get; set; } = 14;

    public int MaxConsultationsPerExam { get; set; } = 1;

    public long DefaultExamPricePiastres { get; set; } = 30000L; // 300 EGP

    public long DefaultConsultPricePiastres { get; set; } = 0L; // Free follow-up

    public bool EnableNursingStage { get; set; } = true;

    public TvPrivacyMode TvPrivacyMode { get; set; } = TvPrivacyMode.FirstNameAndInitial;

    public int RolloverHourLocal { get; set; } = 5; // 5:00 AM

    public int RxTopMarginMm { get; set; } = 25;

    public int RxBottomMarginMm { get; set; } = 20;

    [MaxLength(100)]
    public string TvDeviceToken { get; set; } = Guid.NewGuid().ToString("N");

    public bool IsDoctorOnBreak { get; set; } = false;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
