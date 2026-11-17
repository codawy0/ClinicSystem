using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F10")]
public class T1_10_SignalRQueueHubTests : E2ETestBase
{
    public T1_10_SignalRQueueHubTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F10_01_ConnectWithJwt_Success()
    {
        var token = TestAuthHelper.DoctorToken();
        await using var client = await ConnectSignalRAsync(accessToken: token);
        client.Should().NotBeNull();
    }

    [Fact]
    public async Task T1_F10_02_ConnectWithTvDeviceToken_Success()
    {
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.Should().NotBeNull();
    }

    [Fact]
    public async Task T1_F10_03_Broadcast_PatientCalledOnCallNext()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.Clear();

        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        call.EnsureSuccess();

        var ev = await client.WaitForPatientCalledAsync(TimeSpan.FromSeconds(3));
        ev.Should().NotBeNull();
        ev.QueueNumber.Should().Be(call.Data!.QueueNumber);
    }

    [Fact]
    public async Task T1_F10_04_Broadcast_QueueUpdatedOnNewBooking()
    {
        await EnsureShiftOpenAsync();
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.Clear();

        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var ev = await client.WaitForQueueUpdatedAsync(TimeSpan.FromSeconds(3));
        ev.Should().NotBeNull();
    }

    [Fact]
    public async Task T1_F10_05_Broadcast_DoctorBreakToggled()
    {
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.Clear();

        var toggle = await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        toggle.EnsureSuccess();

        var ev = await client.WaitForDoctorBreakToggledAsync(TimeSpan.FromSeconds(3));
        ev.Should().NotBeNull();

        // Restore break off
        if (toggle.Data!.IsDoctorOnBreak)
        {
            await Api.AsDoctor().PostAsync<DoctorBreakResponse>("/api/queue/doctor-break");
        }
    }
}
