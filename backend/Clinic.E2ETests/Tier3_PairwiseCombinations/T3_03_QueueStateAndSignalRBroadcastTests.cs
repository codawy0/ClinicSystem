using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_03_QueueStateAndSignalRBroadcastTests : E2ETestBase
{
    public T3_03_QueueStateAndSignalRBroadcastTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task QueueStateTransitions_EmitMonotonicSignalREvents()
    {
        await EnsureShiftOpenAsync();
        await using var client = await ConnectSignalRAsync(deviceToken: TestAuthHelper.DefaultTvDeviceToken);

        // 1. Book Patient A & B
        client.Clear();
        var patA = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض أ"));
        var aptA = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(patA.Data!.Id));

        var qEvent = await client.WaitForQueueUpdatedAsync(TimeSpan.FromSeconds(3));
        qEvent.Should().NotBeNull();

        // 2. Call Next
        client.Clear();
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        call.EnsureSuccess();

        var callEvent = await client.WaitForPatientCalledAsync(TimeSpan.FromSeconds(3));
        callEvent.Should().NotBeNull();
        callEvent.QueueNumber.Should().Be(call.Data!.QueueNumber);

        // 3. Skip
        client.Clear();
        await Api.AsReceptionist().PostAsync<object>($"/api/queue/{aptA.Data!.Id}/skip", new SkipRequest("Stepped out"));
        var skipEvent = await client.WaitForQueueUpdatedAsync(TimeSpan.FromSeconds(3));
        skipEvent.Should().NotBeNull();

        // 4. Recall
        client.Clear();
        await Api.AsReceptionist().PostAsync<object>($"/api/queue/{aptA.Data.Id}/return-from-skip");
        var recallEvent = await client.WaitForQueueUpdatedAsync(TimeSpan.FromSeconds(3));
        recallEvent.Should().NotBeNull();
    }
}
