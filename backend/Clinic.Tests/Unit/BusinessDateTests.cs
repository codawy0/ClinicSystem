using FluentAssertions;
using Xunit;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Unit;

[Trait("Category", "Unit")]
public class BusinessDateTests
{
    private readonly BusinessDateService _service = new(rolloverHourLocal: 5);

    [Fact]
    public void GetBusinessDate_At0130AmCairoTime_ShouldMapToPreviousCalendarDate()
    {
        // 01:30 AM Cairo time on 2026-11-15:
        // Cairo is UTC+2 (Standard Time), so 01:30 AM is 23:30 UTC on previous day (2026-11-14)
        var utcTime = new DateTime(2026, 11, 14, 23, 30, 0, DateTimeKind.Utc);
        
        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 5);

        // Since local hour is 1 (< 5), it rolls back to 2026-11-14
        businessDate.Should().Be(new DateOnly(2026, 11, 14));
    }

    [Fact]
    public void GetBusinessDate_At0459AmCairoTime_ShouldMapToPreviousCalendarDate()
    {
        // 04:59:59 AM Cairo local time on 2026-11-15 (02:59:59 UTC on 2026-11-15)
        var utcTime = new DateTime(2026, 11, 15, 2, 59, 59, DateTimeKind.Utc);

        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 5);

        businessDate.Should().Be(new DateOnly(2026, 11, 14));
    }

    [Fact]
    public void GetBusinessDate_At0500AmCairoTime_ShouldMapToCurrentCalendarDate()
    {
        // Exactly 05:00:00 AM Cairo local time on 2026-11-15 (03:00:00 UTC on 2026-11-15)
        var utcTime = new DateTime(2026, 11, 15, 3, 0, 0, DateTimeKind.Utc);

        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 5);

        businessDate.Should().Be(new DateOnly(2026, 11, 15));
    }

    [Fact]
    public void GetBusinessDate_At1130PmCairoTime_ShouldMapToCurrentCalendarDate()
    {
        // 11:30:00 PM Cairo local time on 2026-11-15 (21:30:00 UTC on 2026-11-15)
        var utcTime = new DateTime(2026, 11, 15, 21, 30, 0, DateTimeKind.Utc);

        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 5);

        businessDate.Should().Be(new DateOnly(2026, 11, 15));
    }

    [Fact]
    public void GetBusinessDate_OnYearBoundary_ShouldRollbackToPreviousYear()
    {
        // 02:00:00 AM Cairo local time on 2026-01-01 (00:00:00 UTC on 2026-01-01)
        var utcTime = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 5);

        businessDate.Should().Be(new DateOnly(2025, 12, 31));
    }

    [Fact]
    public void GetBusinessDate_CustomRolloverHour_ShouldRespectConfiguration()
    {
        // 05:30:00 AM Cairo local time (03:30:00 UTC on 2026-11-15) with RolloverHour = 6
        var utcTime = new DateTime(2026, 11, 15, 3, 30, 0, DateTimeKind.Utc);

        var businessDate = _service.GetBusinessDate(utcTime, rolloverHourLocal: 6);

        // Since local hour is 5 (< 6), it maps to previous day
        businessDate.Should().Be(new DateOnly(2026, 11, 14));
    }

    [Fact]
    public void ResolveEgyptTimeZone_ShouldNeverThrow()
    {
        var tz = BusinessDateService.ResolveEgyptTimeZone();
        tz.Should().NotBeNull();
    }
}
