using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F01")]
public class T1_01_NormalizerTests : E2ETestBase
{
    public T1_01_NormalizerTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T1_F01_01_HamzaUnification()
    {
        var input = "أحمد إبراهيم آية ٱستقبال";
        var normalized = ArabicNormalizer.NormalizeText(input);
        normalized.Should().Be("احمد ابراهيم ايه استقبال");
    }

    [Fact]
    public void T1_F01_02_TaaMarbutaAndAlefMaksura()
    {
        var input = "فاطمة مصطفى نادية";
        var normalized = ArabicNormalizer.NormalizeText(input);
        normalized.Should().Be("فاطمه مصطفي ناديه");
    }

    [Fact]
    public void T1_F01_03_TashkeelAndTatweelStripping()
    {
        var input = "مُـحَمَّـد عَبْدُ الرَّحْمَٰن";
        var normalized = ArabicNormalizer.NormalizeText(input);
        normalized.Should().Be("محمد عبد الرحمن");
    }

    [Fact]
    public void T1_F01_04_EgyptianPhonePrefixNormalization()
    {
        ArabicNormalizer.NormalizePhone("+201012345678").Should().Be("01012345678");
        ArabicNormalizer.NormalizePhone("00201112345678").Should().Be("01112345678");
        ArabicNormalizer.NormalizePhone("201212345678").Should().Be("01212345678");
        ArabicNormalizer.NormalizePhone("01512345678").Should().Be("01512345678");
    }

    [Fact]
    public async Task T1_F01_05_PatientSearch_TokenPrefixMatch()
    {
        var reg = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", new CreatePatientRequest(
            FullName: "أحمد محمد محمود",
            Phone: "01091234567"
        ));
        reg.EnsureSuccess();

        var search = await Api.AsReceptionist().GetAsync<List<PatientResponse>>("/api/patients/search?q=احمد");
        search.EnsureSuccess();
        search.Data.Should().Contain(p => p.FullName == "أحمد محمد محمود" && p.SearchName.Contains("احمد"));
    }
}
