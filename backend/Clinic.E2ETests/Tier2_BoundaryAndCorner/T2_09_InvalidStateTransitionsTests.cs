using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F09")]
public class T2_09_InvalidStateTransitionsTests : E2ETestBase
{
    public T2_09_InvalidStateTransitionsTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F09_01_BookAppointment_WithoutOpenShift_Returns400()
    {
        // Close shift for user 3
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Close"));

        var pat = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var book = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        book.ShouldBeBadRequest();

        // Restore shift
        await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T2_F09_02_CallNext_EmptyQueue_Returns404()
    {
        // Empty queue for doctor 9999
        var res = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(9999));
        res.ShouldBeNotFound();
    }

    [Fact]
    public async Task T2_F09_03_CallNext_IdempotencyReplay_DoesNotDoubleCall()
    {
        await EnsureShiftOpenAsync();
        var pat1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id));

        var key = Guid.NewGuid().ToString();
        var call1 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2), key);
        call1.EnsureSuccess();

        // Replay with same key
        var call2 = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2), key);
        call2.EnsureSuccess();
        call2.Data!.AppointmentId.Should().Be(call1.Data!.AppointmentId);
        call2.Data.CallSequence.Should().Be(call1.Data.CallSequence);
    }

    [Fact]
    public async Task T2_F09_04_DoctorBreak_BlocksCallNext()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var book = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        book.EnsureSuccess();

        // 1. Ensure break is toggled ON
        var toggleOn = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        if (!toggleOn.Data!.IsDoctorOnBreak)
        {
            toggleOn = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        }
        toggleOn.Data!.IsDoctorOnBreak.Should().BeTrue();

        // 2. Call-next while doctor is on break must be rejected with 400 Bad Request (DOCTOR_ON_BREAK)
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        call.ShouldBeBadRequest();
        call.Error?.Title.Should().Be("DOCTOR_ON_BREAK");

        // 3. Turn break OFF
        var toggleOff = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        if (toggleOff.Data!.IsDoctorOnBreak)
        {
            toggleOff = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        }
        toggleOff.Data!.IsDoctorOnBreak.Should().BeFalse();

        // 4. Verify CallNext succeeds once break is over and retrieves the queued patient
        var callResume = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        callResume.EnsureSuccess();
        callResume.Data!.AppointmentId.Should().Be(book.Data!.Id);
    }

    [Fact]
    public async Task T2_F09_05_SkipNonExistentAppointment_HandledSafely()
    {
        var skip = await Api.AsReceptionist().PostAsync<object>("/api/queue/99999/skip", new SkipRequest("Not there"));
        skip.ShouldBeNotFound();
    }
}
