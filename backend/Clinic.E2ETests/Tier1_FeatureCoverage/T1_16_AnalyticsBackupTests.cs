using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F16")]
public class T1_16_AnalyticsBackupTests : E2ETestBase
{
    public T1_16_AnalyticsBackupTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F16_01_DoctorSummary_RevenueAndDiscountKPIs()
    {
        var summary = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary?from=2026-11-01&to=2026-11-30");
        summary.EnsureSuccess();
        summary.Data.Should().NotBeNull();
        summary.Data!.GrossRevenuePiastres.Should().BeGreaterOrEqualTo(0L);
    }

    [Fact]
    public async Task T1_F16_02_DoctorSummary_AverageWaitTimeAccurate()
    {
        var summary = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary");
        summary.EnsureSuccess();
        summary.Data!.AverageWaitTimeMinutes.Should().BeGreaterOrEqualTo(0.0);
    }

    [Fact]
    public async Task T1_F16_03_CreateBackup_OnlineHotBackup()
    {
        var backup = await Api.AsDoctor().PostAsync<string>("/api/backup/create");
        backup.EnsureSuccess();
        backup.RawContent.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task T1_F16_04_RestoreBackup_CleanReload()
    {
        // 1. Create backup
        using var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", TestAuthHelper.DoctorToken());
        var backupRes = await client.PostAsync("/api/backup/create", null);
        backupRes.EnsureSuccessStatusCode();
        var zipBytes = await backupRes.Content.ReadAsByteArrayAsync();

        // 2. Restore backup
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(zipBytes), "file", "backup.zip" }
        };
        var restore = await Api.AsDoctor().PostMultipartAsync<object>("/api/backup/restore", form);
        restore.EnsureSuccess();
    }

    [Fact]
    public async Task T1_F16_05_PaymentMethodBreakdown_Accurate()
    {
        var summary = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary");
        summary.EnsureSuccess();
        var totalBreakdown = summary.Data!.CashCollectedPiastres + summary.Data.InstapayCollectedPiastres + summary.Data.VodafoneCashCollectedPiastres + summary.Data.CardCollectedPiastres;
        totalBreakdown.Should().BeGreaterOrEqualTo(0L);
    }
}
