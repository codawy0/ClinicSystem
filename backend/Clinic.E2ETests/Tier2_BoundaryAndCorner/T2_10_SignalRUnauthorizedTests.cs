using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F10")]
public class T2_10_SignalRUnauthorizedTests : E2ETestBase
{
    public T2_10_SignalRUnauthorizedTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F10_01_ConnectWithoutCredentials_Rejected()
    {
        var act = async () => await ConnectSignalRAsync();
        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task T2_F10_02_InvalidTvDeviceToken_Rejected()
    {
        var act = async () => await ConnectSignalRAsync(deviceToken: "INVALID-TOKEN-999");
        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task T2_F10_03_ClientDirectBroadcast_Blocked()
    {
        // Hub is read-only for clients; client attempting direct broadcast invocation throws
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.IsConnected.Should().BeTrue();

        var act = async () => await client.InvokeHubMethodAsync("PatientCalled", new { QueueNumber = 99 });
        await act.Should().ThrowAsync<Exception>("QueueHub must not allow client-initiated broadcasts");
    }

    [Fact]
    public async Task T2_F10_04_TvPrivacyMode_FirstNameAndInitial()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest("محمد أحمد علي", "01055554444"));

        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client.Clear();

        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));

        call.Data!.DisplayName.Should().Be("محمد أ.");
    }

    [Fact]
    public async Task T2_F10_05_Reconnection_StateSync()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // 1. Initial TV client connects
        await using var client1 = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client1.IsConnected.Should().BeTrue();

        // 2. Disconnect client 1
        await client1.DisposeAsync();

        // 3. Queue state mutates while client is offline
        var callRes = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        callRes.EnsureSuccess();

        // 4. Reconnect client 2 and fetch current TV queue board
        await using var client2 = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);
        client2.IsConnected.Should().BeTrue();

        var boardRes = await Api.AsDoctor().GetAsync<QueueBoardResponse>("/api/queue/board");
        boardRes.EnsureSuccess();
        boardRes.Data!.WithDoctor.Should().Contain(a => a.AppointmentId == callRes.Data!.AppointmentId, 
            "reconnecting client must synchronize with active queue state");
    }
}
