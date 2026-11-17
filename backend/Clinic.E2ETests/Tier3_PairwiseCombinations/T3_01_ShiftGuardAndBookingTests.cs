using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_01_ShiftGuardAndBookingTests : E2ETestBase
{
    public T3_01_ShiftGuardAndBookingTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ShiftGuard_BlocksBookingWithoutActiveShift_ThenAllowsAfterShiftOpened()
    {
        // 1. Negative test: Close shift
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Close"));

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var failedBook = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        failedBook.StatusCode.Should().Be(System.Net.HttpStatusCode.BadRequest);

        // 2. Open shift
        var openShift = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(100000L));
        openShift.EnsureSuccess();

        // 3. Positive test: Book appointment
        var successfulBook = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data.Id, paymentMethod: "Cash"));
        successfulBook.EnsureSuccess();
        successfulBook.Data!.Status.Should().Be("Waiting");
        successfulBook.Data.QueueNumber.Should().NotBeNull();

        // 4. Drawer Math check: 100000 opening + 30000 payment = 130000
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        cur.EnsureSuccess();
        cur.Data!.ExpectedClosingCashPiastres.Should().Be(130000L);
    }
}
