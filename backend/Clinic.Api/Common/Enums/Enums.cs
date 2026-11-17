namespace Clinic.Api.Common.Enums;

public enum UserRole
{
    Doctor,
    AssistantDoctor,
    Nurse,
    Receptionist,
    Admin
}

public enum ServiceCategory
{
    Exam,
    Consultation,
    Procedure,
    FileFee
}

public enum PatientGender
{
    Male,
    Female
}

public enum BloodType
{
    APositive,
    ANegative,
    BPositive,
    BNegative,
    OPositive,
    ONegative,
    ABPositive,
    ABNegative
}

public enum AllergySeverity
{
    Mild,
    Moderate,
    Severe
}

public enum BookingType
{
    WalkIn,
    Advance
}

public enum AppointmentStatus
{
    Booked,
    Waiting,
    InNursing,
    WithDoctor,
    Skipped,
    Completed,
    Cancelled
}

public enum BloodSugarType
{
    Fasting,
    Random,
    PostPrandial
}

public enum DrugForm
{
    Tablet,
    Syrup,
    Injection,
    Capsule,
    Ointment,
    Drops,
    Inhaler,
    Suppository
}

public enum RequestType
{
    Lab,
    Radiology
}

public enum AttachmentFileType
{
    Ray,
    Lab,
    Report,
    Document,
    Photo,
    Other
}

public enum TvPrivacyMode
{
    FirstNameAndInitial,
    QueueNumberOnly,
    FullName
}

public enum DiscountReason
{
    None,
    Colleague,
    Staff,
    Charity,
    DoctorCustom
}

public enum InvoiceStatus
{
    Unpaid,
    Partial,
    Paid,
    Voided
}

public enum TransactionType
{
    Payment,
    Refund,
    Expense,
    VoidReversal
}

public enum PaymentMethod
{
    Cash,
    Instapay,
    VodafoneCash,
    Card
}

public enum PrintJobTargetRole
{
    DoctorPrinter,
    ReceptionReceiptPrinter
}

public enum PrintDocumentType
{
    Prescription,
    Receipt,
    LabSlip,
    SickLeave
}

public enum PrintJobStatus
{
    Pending,
    Printed,
    Completed,
    Failed
}
