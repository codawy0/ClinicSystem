using Microsoft.Data.Sqlite;
using Xunit;

namespace Clinic.E2ETests.Infrastructure;

public class ClinicTestFixture : IAsyncLifetime
{
    public bool IsLiveServer { get; private set; }
    public Uri BaseAddress { get; private set; } = null!;
    public HttpClient HttpClient { get; private set; } = null!;
    public string ConnectionString => _factory?.ConnectionString ?? "";
    public IServiceProvider Services => _factory?.Services ?? throw new InvalidOperationException("Factory not initialized");
    public ClinicWebApplicationFactory Factory => _factory ?? throw new InvalidOperationException("Factory not initialized");

    private ClinicWebApplicationFactory? _factory;
    private string? _tempDataDir;

    public async Task InitializeAsync()
    {
        var liveUrl = Environment.GetEnvironmentVariable("TEST_API_URL");
        if (!string.IsNullOrWhiteSpace(liveUrl))
        {
            IsLiveServer = true;
            BaseAddress = new Uri(liveUrl.TrimEnd('/') + "/");
            HttpClient = new HttpClient { BaseAddress = BaseAddress };
        }
        else
        {
            IsLiveServer = false;
            _tempDataDir = Path.Combine(Path.GetTempPath(), "ClinicE2E_" + Guid.NewGuid().ToString("N"));
            _factory = new ClinicWebApplicationFactory(_tempDataDir);
            await _factory.StartAsync();

            BaseAddress = _factory.BaseAddress;
            HttpClient = _factory.CreateClient();
        }
    }

    public HttpClient CreateClient() => _factory != null ? _factory.CreateClient() : new HttpClient { BaseAddress = BaseAddress };

    public SignalRTestClient CreateSignalRClient(string? accessToken = null, string? deviceToken = null)
    {
        var hubUriBuilder = new UriBuilder(new Uri(BaseAddress, "hubs/queue"));
        var query = System.Web.HttpUtility.ParseQueryString(string.Empty);
        if (!string.IsNullOrEmpty(accessToken)) query["access_token"] = accessToken;
        if (!string.IsNullOrEmpty(deviceToken)) query["deviceToken"] = deviceToken;
        if (query.Count > 0) hubUriBuilder.Query = query.ToString();

        return new SignalRTestClient(hubUriBuilder.Uri);
    }

    public async Task DisposeAsync()
    {
        HttpClient.Dispose();

        if (_factory != null)
        {
            await _factory.DisposeAsync();
        }

        SqliteConnection.ClearAllPools();

        try
        {
            if (!string.IsNullOrEmpty(_tempDataDir) && Directory.Exists(_tempDataDir))
            {
                Directory.Delete(_tempDataDir, recursive: true);
            }
        }
        catch
        {
            // Best effort
        }
    }
}
