using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F02")]
public class T2_02_BusinessDateBoundaryTests : E2ETestBase
{
    private readonly BusinessDateService _service = new();

    public T2_02_BusinessDateBoundaryTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T2_F02_01_OneSecondBeforeRollover()
    {
        // 04:59:59 AM Cairo on Nov 16 is 02:59:59 UTC
        var utc = new DateTime(2026, 11, 16, 2, 59, 59, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 15));
    }

    [Fact]
    public void T2_F02_02_OneSecondAfterRollover()
    {
        // 05:00:01 AM Cairo on Nov 16 is 03:00:01 UTC
        var utc = new DateTime(2026, 11, 16, 3, 0, 1, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 16));
    }

    [Fact]
    public void T2_F02_03_NewYearEveBoundaryRollover()
    {
        // 02:00 AM Cairo on Jan 01, 2027 is 00:00 UTC Jan 01, 2027
        var utc = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 12, 31)); // Preserves previous day
    }

    [Fact]
    public void T2_F02_04_LeapYearFebruaryBoundary()
    {
        // 03:00 AM Cairo on March 01, 2028 (leap year) is 01:00 UTC March 01, 2028
        var utc = new DateTime(2028, 3, 1, 1, 0, 0, DateTimeKind.Utc);
        var bDate = _service.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2028, 2, 29)); // Correct leap day!
    }

    [Fact]
    public void T2_F02_05_CustomRolloverHourSetting()
    {
        var customService = new BusinessDateService(7);
        // 06:30 AM Cairo on Nov 16 is 04:30 UTC Nov 16
        var utc = new DateTime(2026, 11, 16, 4, 30, 0, DateTimeKind.Utc);
        var bDate = customService.GetBusinessDate(utc);
        bDate.Should().Be(new DateOnly(2026, 11, 15)); // Before 7 AM
    }
}
