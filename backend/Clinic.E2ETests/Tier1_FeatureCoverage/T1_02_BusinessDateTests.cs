using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F02")]
public class T1_02_BusinessDateTests : E2ETestBase
{
    private readonly BusinessDateService _service = new();

    public T1_02_BusinessDateTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T1_F02_01_StandardDaytime_MapsToCurrentDate()
    {
        // 14:00 Cairo time is 12:00 UTC (Cairo is UTC+2)
        var utc = new DateTime(2026, 11, 15, 12, 0, 0, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 15));
    }

    [Fact]
    public void T1_F02_02_LateNightSession_MapsToPreviousCalendarDate()
    {
        // 01:30 AM Cairo on Nov 16 is 23:30 UTC Nov 15
        var utc = new DateTime(2026, 11, 15, 23, 30, 0, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 15));
    }

    [Fact]
    public void T1_F02_03_ExactRolloverThreshold_MapsToNewDate()
    {
        // 05:00:00 AM Cairo on Nov 16 is 03:00 UTC Nov 16
        var utc = new DateTime(2026, 11, 16, 3, 0, 0, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 16));
    }

    [Fact]
    public async Task T1_F02_04_SystemHealth_ExposesCurrentBusinessDate()
    {
        var response = await Api.GetAsync<HealthResponse>("/api/system/health");
        response.EnsureSuccess();
        response.Data.Should().NotBeNull();
        response.Data!.BusinessDate.Should().NotBeNullOrEmpty();
        response.Data.WalMode.Should().BeTrue();
    }

    [Fact]
    public async Task T1_F02_05_AppointmentCreation_UsesBusinessDate()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        pat.EnsureSuccess();

        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        apt.EnsureSuccess();
        apt.Data!.BusinessDate.Should().Be(_service.GetBusinessDate(DateTime.UtcNow));
    }
}
