using System.Text;
using System.Text.RegularExpressions;

namespace Clinic.Api.Infrastructure;

public static class ArabicNormalizer
{
    private static readonly Regex MultipleSpacesRegex = new(@"\s+", RegexOptions.Compiled);

    /// <summary>
    /// Normalizes Arabic text:
    /// - Unifies alef variants (أ, إ, آ, ٱ -> ا)
    /// - Unifies alef-maksura to yaa (ى -> ي)
    /// - Unifies taa-marbuta to haa (ة -> ه)
    /// - Unifies waw with hamza (ؤ -> و)
    /// - Unifies yaa with hamza (ئ -> ي)
    /// - Strips Arabic diacritics (tashkeel: fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, dagger alef)
    /// - Strips tatweel (ـ)
    /// - Converts Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to Western digits (0-9)
    /// - Collapses multiple spaces and trims
    /// - Lowercases ASCII characters
    /// </summary>
    public static string NormalizeText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var sb = new StringBuilder(input.Length);

        foreach (char c in input)
        {
            // 1. Strip Tashkeel, Tatweel, Dagger Alef
            if ((c >= '\u064B' && c <= '\u0652') || c == '\u0640' || c == '\u0670')
            {
                continue;
            }

            // 2. Arabic-Indic Digits (٠-٩) -> (0-9)
            if (c >= '\u0660' && c <= '\u0669')
            {
                sb.Append((char)('0' + (c - '\u0660')));
                continue;
            }

            // Persian/Eastern Arabic-Indic Digits (۰-۹) -> (0-9)
            if (c >= '\u06F0' && c <= '\u06F9')
            {
                sb.Append((char)('0' + (c - '\u06F0')));
                continue;
            }

            // 3. Hamzas, Alef variants, Yaa, Taa-marbuta, Waw-hamza
            switch (c)
            {
                case '\u0622': // آ
                case '\u0623': // أ
                case '\u0625': // إ
                case '\u0671': // ٱ
                    sb.Append('\u0627'); // ا
                    break;

                case '\u0649': // ى (Alef Maksura)
                    sb.Append('\u064A'); // ي
                    break;

                case '\u0629': // ة (Taa Marbuta)
                    sb.Append('\u0647'); // ه (Haa)
                    break;

                case '\u0624': // ؤ (Waw with Hamza)
                    sb.Append('\u0648'); // و (Waw)
                    break;

                case '\u0626': // ئ (Yaa with Hamza)
                    sb.Append('\u064A'); // ي (Yaa)
                    break;

                default:
                    sb.Append(char.ToLowerInvariant(c));
                    break;
            }
        }

        string normalized = sb.ToString();
        normalized = MultipleSpacesRegex.Replace(normalized, " ").Trim();
        return normalized;
    }

    /// <summary>
    /// Normalizes Egyptian mobile phone numbers:
    /// - Converts Arabic-Indic digits to Western digits
    /// - Strips all non-digit characters (spaces, hyphens, plus signs, parentheses)
    /// - Converts international prefixes +201..., 00201..., 201... to 01...
    /// - If 10 digits starting with 1, prepends 0 -> 01...
    /// - Validates and produces standard 11-digit format for Egyptian mobiles (starting with 01)
    /// </summary>
    public static string NormalizePhone(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var sb = new StringBuilder(input.Length);

        foreach (char c in input)
        {
            if (c >= '\u0660' && c <= '\u0669')
            {
                sb.Append((char)('0' + (c - '\u0660')));
            }
            else if (c >= '\u06F0' && c <= '\u06F9')
            {
                sb.Append((char)('0' + (c - '\u06F0')));
            }
            else if (char.IsDigit(c))
            {
                sb.Append(c);
            }
        }

        string digits = sb.ToString();

        if (digits.StartsWith("00201") && digits.Length >= 13)
        {
            digits = "01" + digits.Substring(5);
        }
        else if (digits.StartsWith("201") && digits.Length >= 12)
        {
            digits = "01" + digits.Substring(3);
        }
        else if (digits.StartsWith("1") && digits.Length == 10)
        {
            digits = "0" + digits;
        }

        // Egyptian mobile phones are 11 digits starting with 01 (010, 011, 012, 015)
        if (digits.Length == 11 && digits.StartsWith("01"))
        {
            return digits;
        }

        // If not matching valid Egyptian phone format (e.g. invalid, too short), return empty string
        return string.Empty;
    }
}
