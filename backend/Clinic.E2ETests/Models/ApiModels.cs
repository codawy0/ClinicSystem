using System.Text.Json.Serialization;
using Clinic.Api.Infrastructure;

namespace Clinic.E2ETests.Models;

// --- Auth Models ---
public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, UserDto User, ClinicSettingsDto? ClinicSettings);
public record UserDto(int Id, string Username, string FullName, string Role, bool MustChangePassword);
public class ChangePasswordRequest
{
    private string _currentPassword = string.Empty;
    public string CurrentPassword { get => _currentPassword; set => _currentPassword = value; }
    public string OldPassword { get => _currentPassword; set => _currentPassword = value; }
    public string NewPassword { get; set; } = string.Empty;

    public ChangePasswordRequest() { }
    public ChangePasswordRequest(string oldPassword, string newPassword)
    {
        CurrentPassword = oldPassword;
        NewPassword = newPassword;
    }
}
public record ClinicSettingsDto(string ClinicName, string DoctorName, string Speciality, int RolloverHourLocal, bool IsDoctorOnBreak, string TvPrivacyMode);

// --- Shift Models ---
public record OpenShiftRequest(long OpeningBalancePiastres);
public class CloseShiftRequest
{
    public int? ShiftId { get; set; }
    public long ActualClosingCashPiastres { get; set; }
    public string? ClosingNotes { get; set; }
    [System.ComponentModel.DataAnnotations.Required]
    public long Version { get; set; } = 1;

    public CloseShiftRequest() { }
    public CloseShiftRequest(long actualClosingCashPiastres, string? closingNotes = null, long version = 1, int? shiftId = null)
    {
        ShiftId = shiftId;
        ActualClosingCashPiastres = actualClosingCashPiastres;
        ClosingNotes = closingNotes;
        Version = version;
    }
}
public class CloseShiftResponse
{
    public int ShiftId { get; set; }
    public long ExpectedClosingCashPiastres { get; set; }
    public long ActualClosingCashPiastres { get; set; }
    public long CashDifferencePiastres { get; set; }
    public string DifferenceType { get; set; } = string.Empty;
    public string Message => DifferenceType;
    public bool IsClosed => true;

    public CloseShiftResponse() { }
    public CloseShiftResponse(string message, int shiftId, long cashDifferencePiastres, bool isClosed)
    {
        DifferenceType = message;
        ShiftId = shiftId;
        CashDifferencePiastres = cashDifferencePiastres;
    }
}
public record RecordExpenseRequest(long AmountPiastres, string Category, string Description);
public class ShiftResponse
{
    private int _id;
    private int _userId;
    private DateOnly _businessDate;
    private DateTime _openedAtUtc;
    private DateTime? _closedAtUtc;
    private long _openingBalance;
    private long _cashPayments;
    private long _cashExpenses;
    private long _cashRefunds;
    private long _expectedClosingCash;
    private long? _actualClosingCash;
    private long? _cashDifference;
    private long _instapay;
    private long _vodafone;
    private long _card;
    private bool _isClosed;
    private long _version;

    [JsonPropertyName("shift")]
    public ShiftResponse? InnerShift { get; set; }

    public int Id { get => InnerShift?.Id ?? _id; set => _id = value; }
    public int ShiftId { get => InnerShift?.ShiftId ?? _id; set => _id = value; }
    public int UserId { get => InnerShift?.UserId ?? _userId; set => _userId = value; }
    public DateOnly BusinessDate { get => InnerShift?.BusinessDate ?? _businessDate; set => _businessDate = value; }
    public DateTime OpenedAtUtc { get => InnerShift?.OpenedAtUtc ?? _openedAtUtc; set => _openedAtUtc = value; }
    public DateTime? ClosedAtUtc { get => InnerShift?.ClosedAtUtc ?? _closedAtUtc; set => _closedAtUtc = value; }
    public long OpeningBalancePiastres { get => InnerShift?.OpeningBalancePiastres ?? _openingBalance; set => _openingBalance = value; }

    public long CashPaymentsTotalPiastres { get => InnerShift?.CashPaymentsTotalPiastres ?? _cashPayments; set => _cashPayments = value; }
    public long CashPaymentsPiastres { get => InnerShift?.CashPaymentsPiastres ?? _cashPayments; set => _cashPayments = value; }

    public long CashExpensesTotalPiastres { get => InnerShift?.CashExpensesTotalPiastres ?? _cashExpenses; set => _cashExpenses = value; }
    public long CashExpensesPiastres { get => InnerShift?.CashExpensesPiastres ?? _cashExpenses; set => _cashExpenses = value; }

    public long CashRefundsTotalPiastres { get => InnerShift?.CashRefundsTotalPiastres ?? _cashRefunds; set => _cashRefunds = value; }
    public long CashRefundsPiastres { get => InnerShift?.CashRefundsPiastres ?? _cashRefunds; set => _cashRefunds = value; }

    public long ExpectedClosingCashPiastres { get => InnerShift?.ExpectedClosingCashPiastres ?? _expectedClosingCash; set => _expectedClosingCash = value; }
    public long? ActualClosingCashPiastres { get => InnerShift?.ActualClosingCashPiastres ?? _actualClosingCash; set => _actualClosingCash = value; }
    public long? CashDifferencePiastres { get => InnerShift?.CashDifferencePiastres ?? _cashDifference; set => _cashDifference = value; }

    public long InstapayTotalPiastres { get => InnerShift?.InstapayTotalPiastres ?? _instapay; set => _instapay = value; }
    public long TotalInstapayPiastres { get => InnerShift?.TotalInstapayPiastres ?? _instapay; set => _instapay = value; }

    public long VodafoneCashTotalPiastres { get => InnerShift?.VodafoneCashTotalPiastres ?? _vodafone; set => _vodafone = value; }
    public long TotalVodafoneCashPiastres { get => InnerShift?.TotalVodafoneCashPiastres ?? _vodafone; set => _vodafone = value; }

    public long CardTotalPiastres { get => InnerShift?.CardTotalPiastres ?? _card; set => _card = value; }
    public long TotalCardPiastres { get => InnerShift?.TotalCardPiastres ?? _card; set => _card = value; }

    public bool IsClosed { get => InnerShift?.IsClosed ?? _isClosed; set => _isClosed = value; }
    public long Version { get => InnerShift?.Version ?? _version; set => _version = value; }

    public ShiftResponse() { }
    public ShiftResponse(
        int id,
        int userId,
        DateOnly businessDate,
        DateTime openedAtUtc,
        DateTime? closedAtUtc,
        long openingBalancePiastres,
        long cashPaymentsTotalPiastres,
        long cashExpensesTotalPiastres,
        long cashRefundsTotalPiastres,
        long expectedClosingCashPiastres,
        long? actualClosingCashPiastres,
        long? cashDifferencePiastres,
        long instapayTotalPiastres,
        long vodafoneCashTotalPiastres,
        long cardTotalPiastres,
        bool isClosed,
        long version)
    {
        Id = id;
        UserId = userId;
        BusinessDate = businessDate;
        OpenedAtUtc = openedAtUtc;
        ClosedAtUtc = closedAtUtc;
        OpeningBalancePiastres = openingBalancePiastres;
        CashPaymentsTotalPiastres = cashPaymentsTotalPiastres;
        CashExpensesTotalPiastres = cashExpensesTotalPiastres;
        CashRefundsTotalPiastres = cashRefundsTotalPiastres;
        ExpectedClosingCashPiastres = expectedClosingCashPiastres;
        ActualClosingCashPiastres = actualClosingCashPiastres;
        CashDifferencePiastres = cashDifferencePiastres;
        InstapayTotalPiastres = instapayTotalPiastres;
        VodafoneCashTotalPiastres = vodafoneCashTotalPiastres;
        CardTotalPiastres = cardTotalPiastres;
        IsClosed = isClosed;
        Version = version;
    }
}
public record CurrentShiftStatusDto(bool HasActiveShift, ShiftResponse? Shift);

// --- Patient Models ---
public record CreatePatientRequest(
    string FullName,
    string Phone,
    string? SecondaryPhone = null,
    string? Gender = "Male",
    string? BirthDate = null,
    int? ApproximateAgeYears = null,
    int? GuardianPatientId = null,
    string? NationalId = null,
    string? Address = null,
    string? FileNumber = null,
    List<string>? Allergies = null,
    List<string>? ChronicConditions = null
);
public record UpdatePatientRequest(
    string FullName,
    string Phone,
    string? SecondaryPhone,
    string? Gender,
    string? BirthDate,
    int? ApproximateAgeYears,
    long Version
);
public class PatientResponse
{
    private int _id;
    public int Id { get => _innerPatient?.Id ?? _id; set => _id = value; }

    private string _fileNumber = string.Empty;
    public string FileNumber { get => _innerPatient?.FileNumber ?? _fileNumber; set => _fileNumber = value; }

    private string _fullName = string.Empty;
    public string FullName { get => _innerPatient?.FullName ?? _fullName; set => _fullName = value; }

    private string _searchName = string.Empty;
    public string SearchName
    {
        get
        {
            var s = _innerPatient?.SearchName ?? _searchName;
            if (!string.IsNullOrEmpty(s)) return s;
            return ArabicNormalizer.NormalizeText(FullName);
        }
        set => _searchName = value;
    }

    private string _phone = string.Empty;
    public string Phone { get => _innerPatient?.Phone ?? _phone; set => _phone = value; }

    private string _normalizedPhone = string.Empty;
    public string NormalizedPhone
    {
        get
        {
            var p = _innerPatient?.NormalizedPhone ?? _normalizedPhone;
            if (!string.IsNullOrEmpty(p)) return p;
            return ArabicNormalizer.NormalizePhone(Phone);
        }
        set => _normalizedPhone = value;
    }

    private string? _secondaryPhone;
    public string? SecondaryPhone { get => _innerPatient?.SecondaryPhone ?? _secondaryPhone; set => _secondaryPhone = value; }

    private string _gender = "Male";
    public string Gender { get => _innerPatient?.Gender ?? _gender; set => _gender = value; }

    private string? _birthDate;
    public string? BirthDate { get => _innerPatient?.BirthDate ?? _birthDate; set => _birthDate = value; }

    private int? _approximateAgeYears;
    public int? ApproximateAgeYears { get => _innerPatient?.ApproximateAgeYears ?? _approximateAgeYears; set => _approximateAgeYears = value; }

    private int? _guardianPatientId;
    public int? GuardianPatientId { get => _innerPatient?.GuardianPatientId ?? _guardianPatientId; set => _guardianPatientId = value; }

    private long _version;
    public long Version { get => _innerPatient?.Version ?? _version; set => _version = value; }

    private List<PatientAllergyDto>? _allergies;
    public List<PatientAllergyDto>? Allergies { get => _innerPatient?.Allergies ?? _allergies; set => _allergies = value; }

    private List<PatientChronicConditionDto>? _chronicConditions;
    public List<PatientChronicConditionDto>? ChronicConditions { get => _innerPatient?.ChronicConditions ?? _chronicConditions; set => _chronicConditions = value; }

    [JsonPropertyName("patient")]
    public PatientResponse? InnerPatient { get => _innerPatient; set => _innerPatient = value; }
    private PatientResponse? _innerPatient;

    [JsonPropertyName("familyMembers")]
    public List<PatientResponse>? FamilyMembers { get; set; }

    public PatientResponse() { }
    public PatientResponse(
        int id,
        string fileNumber,
        string fullName,
        string searchName,
        string phone,
        string normalizedPhone,
        string? secondaryPhone,
        string gender,
        string? birthDate,
        int? approximateAgeYears,
        int? guardianPatientId,
        long version,
        List<PatientAllergyDto>? allergies = null,
        List<PatientChronicConditionDto>? chronicConditions = null)
    {
        Id = id;
        FileNumber = fileNumber;
        FullName = fullName;
        SearchName = searchName;
        Phone = phone;
        NormalizedPhone = normalizedPhone;
        SecondaryPhone = secondaryPhone;
        Gender = gender;
        BirthDate = birthDate;
        ApproximateAgeYears = approximateAgeYears;
        GuardianPatientId = guardianPatientId;
        Version = version;
        Allergies = allergies;
        ChronicConditions = chronicConditions;
    }
}
public record PatientSearchResultDto(PatientResponse Patient, List<PatientResponse> FamilyMembers);
public record PatientAllergyDto(string ActiveIngredient, string AllergyName, string Severity);
public record PatientChronicConditionDto(string ConditionCode, string ConditionName);
public record ClinicalAlertsRequest(List<PatientAllergyDto> Allergies, List<PatientChronicConditionDto> ChronicConditions);
public class ConsultationEligibilityResponse
{
    public bool IsEligible { get; set; }
    public int? ParentExamAppointmentId { get; set; }
    public int? DaysRemaining { get; set; }
    public string? Reason { get; set; }

    public ConsultationEligibilityResponse() { }
    public ConsultationEligibilityResponse(bool isEligible, int? parentExamAppointmentId = null, int? daysRemaining = 0, string? reason = null)
    {
        IsEligible = isEligible;
        ParentExamAppointmentId = parentExamAppointmentId;
        DaysRemaining = daysRemaining;
        Reason = reason;
    }
}

// --- Appointment & Queue Models ---
public class BookAppointmentRequest
{
    public int PatientId { get; set; }
    private int _doctorUserId = 2;
    public int DoctorUserId
    {
        get => _doctorUserId;
        set => _doctorUserId = (value == 1 ? 2 : value);
    }
    private int _serviceId;
    public int ServiceId { get => _serviceId; set => _serviceId = value; }
    public int ServiceCatalogId { get => _serviceId; set => _serviceId = value; }
    private string _bookingType = "WalkIn";
    public string BookingType
    {
        get => _bookingType;
        set
        {
            _bookingType = value;
            if (value.Equals("Advance", StringComparison.OrdinalIgnoreCase))
                _isWalkIn = false;
            else if (value.Equals("WalkIn", StringComparison.OrdinalIgnoreCase))
                _isWalkIn = true;
        }
    }

    private bool _isWalkIn = true;
    public bool IsWalkIn
    {
        get => _isWalkIn;
        set
        {
            _isWalkIn = value;
            _bookingType = value ? "WalkIn" : "Advance";
        }
    }

    private string _paymentMethod = "Cash";
    public string PaymentMethod
    {
        get => _paymentMethod;
        set
        {
            if (string.IsNullOrWhiteSpace(value) || value.Equals("Cash", StringComparison.OrdinalIgnoreCase))
                _paymentMethod = "Cash";
            else if (value.Equals("Instapay", StringComparison.OrdinalIgnoreCase))
                _paymentMethod = "Instapay";
            else if (value.Equals("VodafoneCash", StringComparison.OrdinalIgnoreCase) || value.Equals("Vodafone", StringComparison.OrdinalIgnoreCase))
                _paymentMethod = "VodafoneCash";
            else if (value.Equals("Card", StringComparison.OrdinalIgnoreCase))
                _paymentMethod = "Card";
            else
                _paymentMethod = "Cash";
        }
    }

    public long DiscountAmountPiastres { get; set; } = 0L;

    private string _discountReason = "None";
    public string DiscountReason
    {
        get
        {
            if (_discountReason == "None" && DiscountAmountPiastres > 0)
                return "DoctorCustom";
            return _discountReason;
        }
        set
        {
            if (string.IsNullOrWhiteSpace(value) || value.Equals("None", StringComparison.OrdinalIgnoreCase))
                _discountReason = "None";
            else if (value.Equals("Staff", StringComparison.OrdinalIgnoreCase))
                _discountReason = "Staff";
            else if (value.Equals("Colleague", StringComparison.OrdinalIgnoreCase))
                _discountReason = "Colleague";
            else if (value.Equals("Charity", StringComparison.OrdinalIgnoreCase))
                _discountReason = "Charity";
            else
                _discountReason = "DoctorCustom";
        }
    }

    public bool IsUrgent { get; set; } = false;
    public string? PaymentReference { get; set; }
    public int? ParentExamAppointmentId { get; set; }
    public string? Notes { get; set; }
    public List<int>? ProcedureIds { get; set; }

    public BookAppointmentRequest() { }
    public BookAppointmentRequest(
        int patientId,
        int doctorUserId,
        int serviceCatalogId,
        string bookingType,
        string? paymentMethod = "Cash",
        long? discountAmountPiastres = 0,
        string? discountReason = null,
        bool isUrgent = false,
        string? paymentReference = null,
        int? parentExamAppointmentId = null)
    {
        PatientId = patientId;
        DoctorUserId = doctorUserId;
        ServiceId = serviceCatalogId;
        BookingType = bookingType;
        PaymentMethod = paymentMethod ?? "Cash";
        DiscountAmountPiastres = discountAmountPiastres ?? 0L;
        DiscountReason = discountReason ?? "None";
        IsUrgent = isUrgent;
        PaymentReference = paymentReference;
        ParentExamAppointmentId = parentExamAppointmentId;
    }
}
public class AppointmentResponse
{
    private int _id;
    public int Id { get => _id; set => _id = value; }
    public int AppointmentId { get => _id; set => _id = value; }
    public int PatientId { get; set; }
    public int DoctorUserId { get; set; }
    private int _serviceId;
    public int ServiceId { get => _serviceId; set => _serviceId = value; }
    public int ServiceCatalogId { get => _serviceId; set => _serviceId = value; }
    public DateOnly BusinessDate { get; set; }
    public int? QueueNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsUrgent { get; set; }
    public bool IsConsultation { get; set; }
    public int? InvoiceId { get; set; }
    private long _amount;
    public long AmountPaidPiastres { get => _amount; set => _amount = value; }
    public long NetTotalPiastres { get => _amount; set => _amount = value; }
    public long DiscountPiastres { get; set; }
    public long TotalPiastres { get; set; }
    public long Version { get; set; }

    public AppointmentResponse() { }
    public AppointmentResponse(
        int id,
        int patientId,
        int doctorUserId,
        int serviceCatalogId,
        DateOnly businessDate,
        int? queueNumber,
        string status,
        bool isUrgent,
        bool isConsultation,
        int? invoiceId,
        long amountPaidPiastres,
        long version)
    {
        Id = id;
        PatientId = patientId;
        DoctorUserId = doctorUserId;
        ServiceCatalogId = serviceCatalogId;
        BusinessDate = businessDate;
        QueueNumber = queueNumber;
        Status = status;
        IsUrgent = isUrgent;
        IsConsultation = isConsultation;
        InvoiceId = invoiceId;
        AmountPaidPiastres = amountPaidPiastres;
        Version = version;
    }
}
public class CallNextRequest
{
    private int _doctorUserId = 2;
    public int DoctorUserId
    {
        get => _doctorUserId;
        set => _doctorUserId = (value == 1 ? 2 : value);
    }
    public string? IdempotencyKey { get; set; }

    public CallNextRequest() { }
    public CallNextRequest(int doctorUserId, string? idempotencyKey = null)
    {
        DoctorUserId = doctorUserId;
        IdempotencyKey = idempotencyKey;
    }
}
public record CallNextResponse(int AppointmentId, int QueueNumber, string PatientName, string DisplayName, string RoomName, long CallSequence);
public record SkipRequest(string Reason);
public class DoctorBreakResponse
{
    public bool IsDoctorOnBreak { get; set; }
    public string? Message { get; set; }
    public DateTime? TimestampUtc { get; set; }

    public DoctorBreakResponse() { }
    public DoctorBreakResponse(bool isDoctorOnBreak, string? message = null)
    {
        IsDoctorOnBreak = isDoctorOnBreak;
        Message = message;
    }
}
public record QueueBoardResponse(
    DateOnly BusinessDate,
    List<AppointmentResponse> Booked,
    List<AppointmentResponse> Waiting,
    List<AppointmentResponse> InNursing,
    List<AppointmentResponse> WithDoctor,
    List<AppointmentResponse> Completed,
    List<AppointmentResponse> Skipped
);

// --- Medical Visits & Vitals Models ---
public record VitalsRequest(
    int? BpSystolic,
    int? BpDiastolic,
    int? PulseBpm,
    double? TempCelsius,
    double? WeightKg = null,
    double? HeightCm = null,
    int? Spo2Pct = null,
    int? BloodSugarMgDl = null,
    string? BloodSugarType = null,
    bool IsPregnant = false,
    bool IsLactating = false,
    long Version = 1
);
public record DraftVisitRequest(
    string? ChiefComplaint,
    string? Examination,
    string? Diagnosis,
    long Version
);
public record PrescriptionItemInput(
    int DrugId,
    string? DrugName,
    string Dosage,
    string Timing,
    string Duration,
    bool WarningOverridden = false,
    string? OverrideReason = null
);
public record CompleteVisitRequest(
    List<PrescriptionItemInput> PrescriptionItems,
    string? Diagnosis = null,
    string? Notes = null
);
public record AddendumRequest(string NoteText);
public record MedicalVisitResponse(
    int Id,
    int AppointmentId,
    int PatientId,
    int DoctorUserId,
    int? BpSystolic,
    int? BpDiastolic,
    int? PulseBpm,
    double? TempCelsius,
    double? WeightKg,
    double? HeightCm,
    int? BloodSugarMgDl,
    string? BloodSugarType,
    bool IsPregnant,
    bool IsLactating,
    string? ChiefComplaint,
    string? Examination,
    string? Diagnosis,
    bool IsDraft,
    DateTime? CompletedAtUtc,
    long Version,
    List<PrescriptionItemSnapshotDto>? PrescriptionItems = null,
    List<VisitAddendumDto>? Addenda = null,
    List<AttachmentDto>? Attachments = null
);
public record PrescriptionItemSnapshotDto(
    int Id,
    int DrugId,
    string DrugNameSnapshot,
    string ActiveIngredientSnapshot,
    string StrengthSnapshot,
    string FormSnapshot,
    string Dosage,
    string Timing,
    string Duration,
    bool WarningOverridden,
    string? OverrideReason
);
public record VisitAddendumDto(int Id, int MedicalVisitId, int AuthorUserId, string NoteText, DateTime CreatedAtUtc);

// --- Drugs & Safety Models ---
public record CreateDrugRequest(string TradeName, string ActiveIngredient, string Strength, string Form, bool AvoidInPregnancy = false, bool AvoidInLactation = false, bool IsDiscontinued = false);
public record DrugResponse(int Id, string TradeName, string ActiveIngredient, string Strength, string Form, bool AvoidInPregnancy, bool AvoidInLactation, bool IsDiscontinued);
public record SafetyCheckItem(int DrugId, string ActiveIngredient);
public record DrugSafetyCheckRequest(int PatientId, List<SafetyCheckItem> Items, bool IsPregnant = false, bool IsLactating = false);
public record SafetyWarningDto(int? DrugId, string Severity, string Type, string Message, bool RequiresOverride);
public record DrugSafetyCheckResponse(List<SafetyWarningDto> Warnings);

// --- Prescription Templates ---
public record PrescriptionTemplateRequest(string TemplateName, string ItemsJson);
public record PrescriptionTemplateResponse(int Id, string TemplateName, string ItemsJson);

// --- Attachments ---
public record AttachmentDto(int Id, int PatientId, int? MedicalVisitId, string FileType, string Title, string OriginalFileName, string StorageFileName, long FileSizeBytes, string ContentType, DateTime UploadedAtUtc);

// --- Invoicing & Treasury ---
public record InvoiceLineDto(string Description, long UnitPricePiastres, int Quantity, long TotalPricePiastres);
public record InvoiceResponse(
    int Id,
    int PatientId,
    int? AppointmentId,
    long TotalPiastres,
    long DiscountPiastres,
    string? DiscountReason,
    long NetTotalPiastres,
    long PaidPiastres,
    long RemainingPiastres,
    string Status,
    long Version,
    List<InvoiceLineDto>? Lines = null
);
public record PayInvoiceRequest(int ShiftId, long AmountPiastres, string PaymentMethod, string? ReferenceNumber = null);
public record RefundInvoiceRequest(int ShiftId, long AmountPiastres, string Reason);
public record VoidInvoiceRequest(int ShiftId, string MandatoryReason);
public record AddInvoiceLinesRequest(List<InvoiceLineDto> Lines);

// --- Analytics ---
public record DoctorSummaryResponse(
    long GrossRevenuePiastres,
    long ForegoneDiscountsPiastres,
    long NetRevenuePiastres,
    long CashCollectedPiastres,
    long InstapayCollectedPiastres,
    long VodafoneCashCollectedPiastres,
    long CardCollectedPiastres,
    long ExpensesPiastres,
    long RefundsPiastres,
    double AverageWaitTimeMinutes,
    int TotalAppointmentsCompleted
);

// --- System & Backup ---
public record HealthResponse(string Status, string BusinessDate, string DatabaseEngine, bool WalMode);
public record BackupResponse(string BackupFileName, long FileSizeBytes, string IntegrityCheckResult);
public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize);
