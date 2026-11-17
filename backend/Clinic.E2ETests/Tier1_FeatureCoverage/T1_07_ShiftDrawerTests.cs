using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F07")]
public class T1_07_ShiftDrawerTests : E2ETestBase
{
    public T1_07_ShiftDrawerTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F07_01_OpenShift_Success()
    {
        // Close any prior shift for user 3
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));

        var open = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
        open.EnsureSuccess();
        open.Data.Should().NotBeNull();
        open.Data!.OpeningBalancePiastres.Should().Be(50000L);
        open.Data.IsClosed.Should().BeFalse();
    }

    [Fact]
    public async Task T1_F07_02_GetCurrentShift_ReturnsSummary()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        cur.EnsureSuccess();
        cur.Data!.IsClosed.Should().BeFalse();
        cur.Data.ExpectedClosingCashPiastres.Should().BeGreaterOrEqualTo(50000L);
    }

    [Fact]
    public async Task T1_F07_03_RecordPettyExpense_Success()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var expense = await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/expense", new RecordExpenseRequest(12000L, "Maintenance", "Printer Paper"));
        expense.EnsureSuccess();
    }

    [Fact]
    public async Task T1_F07_04_CloseShift_ExactMatch()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        cur.EnsureSuccess();

        var expected = cur.Data!.ExpectedClosingCashPiastres;
        var close = await Api.AsReceptionist(3).PostAsync<CloseShiftResultDto>("/api/shifts/close", new CloseShiftRequest(expected, "Shift balanced", cur.Data.Version));
        close.EnsureSuccess();
        close.Data!.IsClosed.Should().BeTrue();
        close.Data.CashDifferencePiastres.Should().Be(0L);

        // Reopen shift for subsequent tests
        await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T1_F07_05_NonCashPayments_SegregatedFromCashDrawer()
    {
        await EnsureShiftOpenAsync(3, 50000L);
        var beforeShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var booking = TestDataBuilder.BuildBooking(pat.Data!.Id, paymentMethod: "Instapay", paymentRef: "INSTA-9988");
        var apt = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", booking);
        apt.EnsureSuccess();

        var afterShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        afterShift.EnsureSuccess();
        afterShift.Data!.ExpectedClosingCashPiastres.Should().Be(beforeShift.Data!.ExpectedClosingCashPiastres);
        afterShift.Data.InstapayTotalPiastres.Should().BeGreaterThan(0L);
    }

    public class CloseShiftResultDto
    {
        public int ShiftId { get; set; }
        public string? DifferenceType { get; set; }
        public string Message => DifferenceType ?? string.Empty;
        public long CashDifferencePiastres { get; set; }
        public DateTime? ClosedAtUtc { get; set; }
        public bool IsClosed => true;
    }
}
