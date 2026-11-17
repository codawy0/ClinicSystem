using Clinic.Api.Common.Enums;

namespace Clinic.Api.Services;

public static class PrivacyFormatter
{
    public static string FormatPatientName(string fullName, int queueNumber, TvPrivacyMode mode)
    {
        return mode switch
        {
            TvPrivacyMode.QueueNumberOnly => $"كشف رقم {queueNumber}",
            TvPrivacyMode.FullName => fullName,
            TvPrivacyMode.FirstNameAndInitial => FormatFirstNameAndInitial(fullName),
            _ => FormatFirstNameAndInitial(fullName)
        };
    }

    private static string FormatFirstNameAndInitial(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return string.Empty;
        var tokens = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length <= 1) return tokens[0];
        return $"{tokens[0]} {tokens[1][0]}.";
    }
}
