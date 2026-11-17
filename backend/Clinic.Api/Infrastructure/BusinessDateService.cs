using Microsoft.Extensions.Configuration;

namespace Clinic.Api.Infrastructure;

public interface IBusinessDateService
{
    DateOnly GetCurrentBusinessDate();
    DateOnly GetBusinessDate(DateTime utcDateTime, int? rolloverHourLocal = null);
    DateTime GetLocalNow();
    DateTime ToLocalTime(DateTime utcDateTime);
    int RolloverHourLocal { get; }
    TimeZoneInfo ClinicTimeZone { get; }
}

public sealed class BusinessDateService : IBusinessDateService
{
    private readonly TimeZoneInfo _timeZone;
    private readonly int _rolloverHourLocal;

    public int RolloverHourLocal => _rolloverHourLocal;
    public TimeZoneInfo ClinicTimeZone => _timeZone;

    public BusinessDateService(int rolloverHourLocal = 5)
    {
        _rolloverHourLocal = rolloverHourLocal;
        _timeZone = ResolveEgyptTimeZone();
    }

    public BusinessDateService(IConfiguration configuration)
    {
        _rolloverHourLocal = configuration.GetValue<int>("ClinicSettings:RolloverHourLocal", 5);
        _timeZone = ResolveEgyptTimeZone();
    }

    public static TimeZoneInfo ResolveEgyptTimeZone()
    {
        // 1. Try Windows standard ID
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
        }
        catch (TimeZoneNotFoundException) { }

        // 2. Try IANA standard ID (Linux/macOS)
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
        }
        catch (TimeZoneNotFoundException) { }

        // 3. Resilient fallback for minimal offline/Docker images
        return TimeZoneInfo.CreateCustomTimeZone(
            "Egypt Standard Time",
            TimeSpan.FromHours(2),
            "(UTC+02:00) Cairo",
            "Egypt Standard Time");
    }

    public DateTime ToLocalTime(DateTime utcDateTime)
    {
        var utc = utcDateTime.Kind == DateTimeKind.Utc
            ? utcDateTime
            : DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);

        return TimeZoneInfo.ConvertTimeFromUtc(utc, _timeZone);
    }

    public DateTime GetLocalNow()
    {
        return ToLocalTime(DateTime.UtcNow);
    }

    public DateOnly GetBusinessDate(DateTime utcDateTime, int? rolloverHourLocal = null)
    {
        int effectiveRolloverHour = rolloverHourLocal ?? _rolloverHourLocal;
        var localTime = ToLocalTime(utcDateTime);

        // If before rollover hour (e.g. 5:00 AM), business date belongs to previous calendar day
        if (localTime.Hour < effectiveRolloverHour)
        {
            return DateOnly.FromDateTime(localTime.Date.AddDays(-1));
        }

        return DateOnly.FromDateTime(localTime.Date);
    }

    public DateOnly GetCurrentBusinessDate()
    {
        return GetBusinessDate(DateTime.UtcNow);
    }
}
