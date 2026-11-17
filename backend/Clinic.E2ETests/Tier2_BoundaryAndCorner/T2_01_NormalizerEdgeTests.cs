using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F01")]
public class T2_01_NormalizerEdgeTests : E2ETestBase
{
    public T2_01_NormalizerEdgeTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T2_F01_01_NormalizeText_NullEmptyAndWhitespace()
    {
        ArabicNormalizer.NormalizeText(null).Should().BeEmpty();
        ArabicNormalizer.NormalizeText("").Should().BeEmpty();
        ArabicNormalizer.NormalizeText("   ").Should().BeEmpty();
        ArabicNormalizer.NormalizeText("\t\r\n").Should().BeEmpty();
    }

    [Fact]
    public void T2_F01_02_ArabicIndicDigitsConversion()
    {
        var input = "غرفة رقم ٠٤ الهاتف ٠١٠٩٨٧٦٥٤٣٢";
        var normalized = ArabicNormalizer.NormalizeText(input);
        normalized.Should().Be("غرفه رقم 04 الهاتف 01098765432");
    }

    [Fact]
    public void T2_F01_03_NormalizePhone_InvalidCharactersAndForeignNumbers()
    {
        ArabicNormalizer.NormalizePhone("123").Should().BeEmpty();
        ArabicNormalizer.NormalizePhone("0227654321").Should().BeEmpty(); // Cairo landline
        ArabicNormalizer.NormalizePhone("+14155552671").Should().BeEmpty(); // US number
        ArabicNormalizer.NormalizePhone("abcdef").Should().BeEmpty();
    }

    [Fact]
    public async Task T2_F01_04_PatientSearch_EmptyAndWhitespaceQuery()
    {
        var res = await Api.AsReceptionist().GetAsync<List<PatientResponse>>("/api/patients/search?q=%20%20");
        res.EnsureSuccess();
        res.Data.Should().BeEmpty();
    }

    [Fact]
    public async Task T2_F01_05_PatientSearch_SqlInjectionPunctuationSafety()
    {
        var res = await Api.AsReceptionist().GetAsync<List<PatientResponse>>("/api/patients/search?q=' OR '1'='1; --");
        res.EnsureSuccess();
        res.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);
    }
}
