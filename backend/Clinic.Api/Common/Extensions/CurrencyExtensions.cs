using System.Globalization;

namespace Clinic.Api.Common.Extensions;

public static class CurrencyExtensions
{
    public static string FormatEgp(this long piastres)
    {
        decimal egp = piastres / 100.0m;
        return $"{egp.ToString("N2", CultureInfo.InvariantCulture)} ج.م";
    }
}
