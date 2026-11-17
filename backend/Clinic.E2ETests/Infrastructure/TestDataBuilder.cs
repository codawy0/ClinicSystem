using Clinic.E2ETests.Models;

namespace Clinic.E2ETests.Infrastructure;

public static class TestDataBuilder
{
    private static int _counter = 100;

    public static CreatePatientRequest BuildPatient(
        string? fullName = null,
        string? phone = null,
        string gender = "Male",
        int age = 35,
        int? guardianId = null)
    {
        var id = Interlocked.Increment(ref _counter);
        return new CreatePatientRequest(
            FullName: fullName ?? $"مريض تجريبي {id}",
            Phone: phone ?? $"010{id:D8}",
            Gender: gender,
            ApproximateAgeYears: age,
            GuardianPatientId: guardianId
        );
    }

    public static BookAppointmentRequest BuildBooking(
        int patientId,
        int doctorUserId = 2,
        int serviceCatalogId = 1,
        string bookingType = "WalkIn",
        string paymentMethod = "Cash",
        long discountPiastres = 0,
        string? discountReason = null,
        bool isUrgent = false,
        string? paymentRef = null,
        int? parentExamId = null)
    {
        return new BookAppointmentRequest
        {
            PatientId = patientId,
            DoctorUserId = doctorUserId,
            ServiceId = serviceCatalogId,
            BookingType = bookingType,
            PaymentMethod = paymentMethod,
            DiscountAmountPiastres = discountPiastres,
            DiscountReason = discountReason,
            IsUrgent = isUrgent,
            PaymentReference = paymentRef,
            ParentExamAppointmentId = parentExamId
        };
    }

    public static CreateDrugRequest BuildDrug(
        string? tradeName = null,
        string? activeIngredient = null,
        string strength = "500mg",
        string form = "Tablet",
        bool avoidInPregnancy = false,
        bool avoidInLactation = false)
    {
        var id = Interlocked.Increment(ref _counter);
        return new CreateDrugRequest(
            TradeName: tradeName ?? $"Drug_{id}",
            ActiveIngredient: activeIngredient ?? $"ingredient_{id}",
            Strength: strength,
            Form: form,
            AvoidInPregnancy: avoidInPregnancy,
            AvoidInLactation: avoidInLactation
        );
    }
}
