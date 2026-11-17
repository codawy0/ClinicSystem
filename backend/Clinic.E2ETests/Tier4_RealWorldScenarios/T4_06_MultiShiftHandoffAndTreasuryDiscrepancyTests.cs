using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using Clinic.E2ETests.Tier1_FeatureCoverage;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_06_MultiShiftHandoffAndTreasuryDiscrepancyTests : E2ETestBase
{
    public T4_06_MultiShiftHandoffAndTreasuryDiscrepancyTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task MultiShiftHandoff_TracksCashShortage_AndMaintainsShiftSegregation()
    {
        // 1. Morning Shift Operations: Receptionist A (UserId 3)
        // Reset/Close any open shift
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));

        // Morning Receptionist opens Shift 1 with 30000 Piastres (300 EGP) opening cash
        var openShift1 = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(30000L));
        openShift1.EnsureSuccess();

        // Patient 1 pays 30000 Piastres Cash
        var p1 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض أول الصباح"));
        p1.EnsureSuccess();
        var apt1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p1.Data!.Id, paymentMethod: "Cash"));
        apt1.EnsureSuccess();

        // Patient 2 pays 30000 Piastres via Instapay (ref "IP-MORN-01")
        var p2 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض ثاني الصباح"));
        p2.EnsureSuccess();
        var apt2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p2.Data!.Id, paymentMethod: "Instapay", paymentRef: "IP-MORN-01"));
        apt2.EnsureSuccess();

        // Add 10000 Piastres procedure line to Patient 2 and pay via Instapay (total 40000 Piastres Instapay)
        var addLineRes = await Api.AsReceptionist(3).PostAsync<object>($"/api/invoices/{apt2.Data!.InvoiceId}/lines", new AddInvoiceLinesRequest(new List<InvoiceLineDto>
        {
            new("رسم قلب إضافي", 10000L, 1, 10000L)
        }));
        addLineRes.EnsureSuccess();
        var payLineRes = await Api.AsReceptionist(3).PostAsync<InvoiceResponse>($"/api/invoices/{apt2.Data.InvoiceId}/pay", new PayInvoiceRequest(
            ShiftId: openShift1.Data!.Id,
            AmountPiastres: 10000L,
            PaymentMethod: "Instapay",
            ReferenceNumber: "IP-MORN-01-B"
        ));
        payLineRes.EnsureSuccess();

        // Morning Receptionist records petty expense: 5000 Piastres Cash for clinic drinking water supplies
        var expRes = await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/expense", new RecordExpenseRequest(5000L, "Supplies", "شراء مياه ومستلزمات للعيادة"));
        expRes.EnsureSuccess();

        // 2. Morning Drawer Calculation & Shortage
        // Expected Cash in Drawer: 30000 (opening) + 30000 (P1) - 5000 (expense) = 55000 Piastres
        var morningShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        morningShift.EnsureSuccess();
        morningShift.Data!.ExpectedClosingCashPiastres.Should().Be(55000L);
        morningShift.Data.InstapayTotalPiastres.Should().Be(40000L);

        // Physical cash counting discovers 53000 Piastres (2000 Piastres shortage)
        var closeMorning = await Api.AsReceptionist(3).PostAsync<CloseShiftResponse>("/api/shifts/close", new CloseShiftRequest(53000L, "Shortage of 20 EGP unaccounted"));
        closeMorning.EnsureSuccess();
        closeMorning.Data!.CashDifferencePiastres.Should().Be(-2000L);
        closeMorning.Data.IsClosed.Should().BeTrue();

        // 3. Evening Shift Operations: Evening Receptionist B (UserId 4)
        // Reset any leftover shift for User 4 if needed
        await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset User 4"));
        var openShift2 = await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L)); // 500 EGP fresh cash
        openShift2.EnsureSuccess();

        // Patient 3 pays 30000 Piastres Cash
        var p3 = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض أول المساء"));
        p3.EnsureSuccess();
        var apt3 = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p3.Data!.Id, paymentMethod: "Cash"));
        apt3.EnsureSuccess();

        // Patient 4 pays 25000 Piastres via POS Card (ref "CARD-EV-99") with 5000 discount
        var p4 = await Api.AsReceptionist(4).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض ثاني المساء"));
        p4.EnsureSuccess();
        var apt4 = await Api.AsReceptionist(4).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p4.Data!.Id, discountPiastres: 5000L, discountReason: "DoctorCustom", paymentMethod: "Card", paymentRef: "CARD-EV-99"));
        apt4.EnsureSuccess();

        // 4. Shift Segregation Check
        // Shift 2 expected cash is strictly 50000 opening + 30000 Cash = 80000 Piastres
        var eveningShift = await Api.AsReceptionist(4).GetAsync<ShiftResponse>("/api/shifts/current");
        eveningShift.EnsureSuccess();
        eveningShift.Data!.ExpectedClosingCashPiastres.Should().Be(80000L);
        eveningShift.Data.OpeningBalancePiastres.Should().Be(50000L);
        eveningShift.Data.CashPaymentsTotalPiastres.Should().Be(30000L);
        eveningShift.Data.CardTotalPiastres.Should().Be(25000L);

        // 5. Evening Shift Close & Doctor Financial Audit
        var closeEvening = await Api.AsReceptionist(4).PostAsync<CloseShiftResponse>("/api/shifts/close", new CloseShiftRequest(80000L, "Evening shift balanced"));
        closeEvening.EnsureSuccess();
        closeEvening.Data!.CashDifferencePiastres.Should().Be(0L);

        // Doctor financial audit query
        var summary = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary");
        summary.EnsureSuccess();
        summary.Data!.ExpensesPiastres.Should().Be(5000L);

        // Re-open shift for User 3 for subsequent tests
        await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }
}
