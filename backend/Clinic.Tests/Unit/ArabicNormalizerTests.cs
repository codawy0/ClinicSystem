using FluentAssertions;
using Xunit;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Unit;

[Trait("Category", "Unit")]
public class ArabicNormalizerTests
{
    [Theory]
    [InlineData("أحمد", "احمد")]
    [InlineData("إبراهيم", "ابراهيم")]
    [InlineData("آدم", "ادم")]
    [InlineData("آمال", "امال")]
    [InlineData("ٱلله", "الله")]
    [InlineData("ٱمرؤ", "امرو")]
    [InlineData("مأمون", "مامون")]
    [InlineData("إنشاء", "انشاء")]
    public void NormalizeText_ShouldUnifyHamzaVariantsToAlef(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("مصطفى", "مصطفي")]
    [InlineData("هدى", "هدي")]
    [InlineData("مستشفى", "مستشفي")]
    [InlineData("منى", "مني")]
    [InlineData("علي", "علي")]
    public void NormalizeText_ShouldUnifyAlefMaksuraToYaa(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("فاطمة", "فاطمه")]
    [InlineData("مروة", "مروه")]
    [InlineData("عيادة", "عياده")]
    [InlineData("استشارة", "استشاره")]
    [InlineData("خديجة", "خديجه")]
    public void NormalizeText_ShouldUnifyTaaMarbutaToHaa(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("مؤمن", "مومن")]
    [InlineData("سؤال", "سوال")]
    [InlineData("فؤاد", "فواد")]
    [InlineData("رئيس", "رييس")]
    [InlineData("قائم", "قايم")]
    [InlineData("شاطئ", "شاطي")]
    [InlineData("بئر", "بير")]
    public void NormalizeText_ShouldUnifyWawAndYaaWithHamza(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("مُحَمَّدٌ", "محمد")]
    [InlineData("عِـيَـادَةٌ", "عياده")]
    [InlineData("كِـتَـابٌ", "كتاب")]
    [InlineData("الـشِّـفَـاءُ", "الشفاء")]
    [InlineData("مُحَمَّد عبدُ الرَّحْمَٰن عـيـادة", "محمد عبد الرحمن عياده")]
    public void NormalizeText_ShouldStripTashkeelAndTatweel(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("٠١٢٣٤٥٦٧٨٩", "0123456789")]
    [InlineData("عيادة رقم ٤", "عياده رقم 4")]
    [InlineData("جرعة ٢ قرص", "جرعه 2 قرص")]
    [InlineData("عيادة رقم ٠١٢٣٤٥٦٧٨٩", "عياده رقم 0123456789")]
    public void NormalizeText_ShouldConvertArabicIndicDigitsToWestern(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("  د.   أحمد   إبراهيم  ", "د. احمد ابراهيم")]
    [InlineData("عيادة   الشفاء\tالتخصصية", "عياده الشفاء التخصصيه")]
    [InlineData("   أحمد    محمود   سعيد   ", "احمد محمود سعيد")]
    public void NormalizeText_ShouldTrimAndCollapseWhitespace(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void NormalizeText_NullOrWhitespace_ShouldReturnEmpty(string? input)
    {
        var result = ArabicNormalizer.NormalizeText(input);
        result.Should().BeEmpty();
    }

    [Theory]
    [InlineData("01012345678", "01012345678")]
    [InlineData("+201012345678", "01012345678")]
    [InlineData("00201123456789", "01123456789")]
    [InlineData("201234567890", "01234567890")]
    [InlineData("01512345678", "01512345678")]
    [InlineData("+20 101-234-5678", "01012345678")]
    [InlineData("+٢٠١٠١٢٣٤٥٦٧٨", "01012345678")]
    [InlineData("٠١٢٣٤٥٦٧٨٩٠", "01234567890")]
    [InlineData("1012345678", "01012345678")]
    public void NormalizePhone_ValidEgyptianFormats_ShouldNormalizeTo11Digits(string input, string expected)
    {
        var result = ArabicNormalizer.NormalizePhone(input);
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("abc")]
    [InlineData("123")] // too short
    [InlineData("---")]
    public void NormalizePhone_InvalidOrEmpty_ShouldReturnEmpty(string? input)
    {
        var result = ArabicNormalizer.NormalizePhone(input);
        result.Should().BeEmpty();
    }
}
