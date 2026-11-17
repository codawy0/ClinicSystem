using Clinic.E2ETests.Infrastructure;
using Xunit;

namespace Clinic.E2ETests.Fixtures;

[Collection("ClinicE2E")]
[Trait("Category", "E2E")]
public abstract class E2ETestBase
{
    protected readonly ClinicTestFixture Fixture;
    protected readonly ApiClient Api;

    protected E2ETestBase(ClinicTestFixture fixture)
    {
        Fixture = fixture;
        Api = new ApiClient(fixture.HttpClient);
    }

    protected async Task<SignalRTestClient> ConnectSignalRAsync(string? accessToken = null, string? deviceToken = null)
    {
        var client = Fixture.CreateSignalRClient(accessToken, deviceToken);
        await client.StartAsync();
        return client;
    }

    protected async Task EnsureShiftOpenAsync(int userId = 4, long openingBalance = 50000)
    {
        var cur = await Api.AsReceptionist(userId).GetAsync<Models.CurrentShiftStatusDto>("/api/shifts/current");
        if (!cur.IsSuccessStatusCode || cur.Data?.HasActiveShift != true)
        {
            await Api.AsReceptionist(userId).PostAsync<object>("/api/shifts/open", new Models.OpenShiftRequest(openingBalance));
        }
    }

    protected HttpClient CreateClient() => Fixture.CreateClient();
}
