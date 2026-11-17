using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_02_FamilyMultiBookingAndShiftReconciliationTests : E2ETestBase
{
    public T4_02_FamilyMultiBookingAndShiftReconciliationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task FamilyMultiBooking_WithSharedPhoneAndDiscount_ReconcilesCashAndInstapay()
    {
        // 1. Shift setup
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));
        var open = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
        open.EnsureSuccess();

        // 2. Family registration with single shared phone
        var sharedPhone = "01098765432";
        var mother = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("مريم عبد الله", sharedPhone, Gender: "Female", BirthDate: "1990-01-01"));
        var son1 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("يوسف أحمد", sharedPhone, GuardianPatientId: mother.Data!.Id, ApproximateAgeYears: 8));
        var son2 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("عمر أحمد", sharedPhone, GuardianPatientId: mother.Data.Id, ApproximateAgeYears: 5));

        // 3. Search retrieves all 3 family members
        var familySearch = await Api.AsReceptionist(3).GetAsync<List<PatientResponse>>($"/api/patients/search?q={sharedPhone}");
        familySearch.EnsureSuccess();
        familySearch.Data!.Count.Should().BeGreaterOrEqualTo(3);

        // 4. Book Son 1: Standard Exam 30000 Piastres, Paid Cash
        var apt1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(son1.Data!.Id, paymentMethod: "Cash"));
        apt1.EnsureSuccess();

        // 5. Book Son 2: Standard Exam with 10000 Family Discount, Paid 20000 via Instapay
        var bookingSon2 = TestDataBuilder.BuildBooking(son2.Data!.Id, discountPiastres: 10000L, discountReason: "DoctorCustom", paymentMethod: "Instapay", paymentRef: "IP-FAM-992");
        var apt2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", bookingSon2);
        apt2.EnsureSuccess();

        // 6. Doctor examines and finalizes both
        await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt1.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt2.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        // 7. Close shift with physical cash: 50000 opening + 30000 Son 1 = 80000 Piastres
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var closeRes = await Api.AsReceptionist(3).PostAsync<CloseShiftResponse>("/api/shifts/close", new CloseShiftRequest(80000L, "Shift balanced", cur.Data!.Version));
        closeRes.EnsureSuccess();
        closeRes.Data!.CashDifferencePiastres.Should().Be(0L);

        // 8. Re-open shift for subsequent tests
        await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }
}
