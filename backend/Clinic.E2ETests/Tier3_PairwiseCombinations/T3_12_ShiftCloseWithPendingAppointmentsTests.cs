using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_12_ShiftCloseWithPendingAppointmentsTests : E2ETestBase
{
    public T3_12_ShiftCloseWithPendingAppointmentsTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ShiftClose_WithPendingAppointments_PreservesQueueStateForNextShift()
    {
        await EnsureShiftOpenAsync(3, 50000L);

        // Book 2 patients
        var pat1 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض 1"));
        var apt1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id));

        var pat2 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض 2"));
        var apt2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat2.Data!.Id));

        // Close morning shift
        var cur = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        var closeRes = await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(cur.Data!.ExpectedClosingCashPiastres, "Morning closed", cur.Data.Version));
        closeRes.EnsureSuccess();

        // Verify patient 2 is still waiting
        var today = await Api.AsReceptionist(3).GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        today.Data!.First(a => a.Id == apt2.Data!.Id).Status.Should().Be("Waiting");

        // Next shift opened and queue continues
        await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1));
        call.EnsureSuccess();
    }
}
