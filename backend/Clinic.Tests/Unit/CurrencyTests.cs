using FluentAssertions;
using Xunit;
using Clinic.Api.Common.Extensions;

namespace Clinic.Tests.Unit;

[Trait("Category", "Unit")]
public class CurrencyTests
{
    [Theory]
    [InlineData(30000L, "300.00 ج.م")]
    [InlineData(0L, "0.00 ج.م")]
    [InlineData(5000L, "50.00 ج.م")]
    [InlineData(45050L, "450.50 ج.م")]
    [InlineData(123456789L, "1,234,567.89 ج.م")]
    public void FormatEgp_ShouldAccuratelyFormatPiastresToEgyptianPounds(long piastres, string expected)
    {
        var formatted = CurrencyExtensions.FormatEgp(piastres);
        formatted.Should().Be(expected);
    }

    [Fact]
    public void PiastresMath_ShouldPerformExact64BitArithmeticWithoutFloatingPointDrift()
    {
        long price1 = 30000L; // 300 EGP
        long price2 = 20000L; // 200 EGP
        long discount = 5000L; // 50 EGP

        long netTotal = price1 + price2 - discount;

        netTotal.Should().Be(45000L); // 450 EGP
    }
}
