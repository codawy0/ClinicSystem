using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_08_DoctorBreakAndTvQueueDisplayTests : E2ETestBase
{
    public T3_08_DoctorBreakAndTvQueueDisplayTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task DoctorBreak_BroadcastsToTvAndBlocksCallNext_ThenResumesSmoothly()
    {
        await EnsureShiftOpenAsync();
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);

        // Pre-condition: Book an active appointment so the queue is populated before break
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var book = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        book.EnsureSuccess();

        // 1. Toggle Break ON
        client.Clear();
        var toggleOn = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        toggleOn.EnsureSuccess();

        // TV client must receive DoctorBreakToggled event
        var evOn = await client.WaitForDoctorBreakToggledAsync(TimeSpan.FromSeconds(3));
        evOn.Should().NotBeNull();
        evOn.IsDoctorOnBreak.Should().BeTrue();

        // 2. Attempt call next during break against active queue -> Must be rejected with 400 Bad Request (DOCTOR_ON_BREAK), NOT 404
        var callBlocked = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        callBlocked.ShouldBeBadRequest();
        callBlocked.Error?.Title.Should().Be("DOCTOR_ON_BREAK");

        // 3. Toggle Break OFF
        client.Clear();
        var toggleOff = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        toggleOff.EnsureSuccess();

        var evOff = await client.WaitForDoctorBreakToggledAsync(TimeSpan.FromSeconds(3));
        evOff.Should().NotBeNull();
        evOff.IsDoctorOnBreak.Should().BeFalse();

        // 4. Call next now succeeds against the previously queued patient
        var callSuccess = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        callSuccess.EnsureSuccess();
        callSuccess.Data!.AppointmentId.Should().Be(book.Data!.Id);
    }
}
