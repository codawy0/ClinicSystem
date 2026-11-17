using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.Drugs;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class DrugSafetyTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    private User _doctor = null!;
    private Drug _augmentin = null!;
    private Drug _amoxil = null!;
    private Drug _voltaren = null!;
    private Drug _panadol = null!;
    private Drug _cetamol = null!;
    private Drug _concor = null!;
    private Drug _oldAspirin = null!;

    private Patient _patientAmr = null!;
    private Patient _patientMona = null!;
    private Patient _patientFatima = null!;
    private Patient _patientSara = null!;
    private Patient _patientKhaled = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_drugsafety_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc_safety", PasswordHash = "h", FullName = "د. كريم سامي", Role = UserRole.Doctor };
        context.Users.Add(_doctor);

        _augmentin = new Drug
        {
            TradeName = "Augmentin 1g",
            ActiveIngredient = "amoxicillin",
            Strength = "1g",
            Form = DrugForm.Tablet,
            Category = "Antibiotic",
            AvoidInPregnancy = false,
            AvoidInLactation = false,
            PregnancyCategory = "B"
        };
        _amoxil = new Drug
        {
            TradeName = "Amoxil 500mg",
            ActiveIngredient = "amoxicillin",
            Strength = "500mg",
            Form = DrugForm.Capsule,
            Category = "Antibiotic",
            AvoidInPregnancy = false,
            AvoidInLactation = false,
            PregnancyCategory = "B"
        };
        _voltaren = new Drug
        {
            TradeName = "Voltaren 75mg",
            ActiveIngredient = "diclofenac sodium",
            Strength = "75mg/3ml",
            Form = DrugForm.Injection,
            Category = "NSAID",
            AvoidInPregnancy = true,
            AvoidInLactation = true,
            PregnancyCategory = "D"
        };
        _panadol = new Drug
        {
            TradeName = "Panadol Extra",
            ActiveIngredient = "paracetamol",
            Strength = "500mg/65mg",
            Form = DrugForm.Tablet,
            Category = "Analgesic",
            AvoidInPregnancy = false,
            AvoidInLactation = false,
            PregnancyCategory = "B"
        };
        _cetamol = new Drug
        {
            TradeName = "Cetamol 500mg",
            ActiveIngredient = "paracetamol",
            Strength = "500mg",
            Form = DrugForm.Tablet,
            Category = "Analgesic",
            AvoidInPregnancy = false,
            AvoidInLactation = false,
            PregnancyCategory = "B"
        };
        _concor = new Drug
        {
            TradeName = "Concor 5mg",
            ActiveIngredient = "bisoprolol",
            Strength = "5mg",
            Form = DrugForm.Tablet,
            Category = "Antihypertensive",
            AvoidInPregnancy = true,
            AvoidInLactation = true,
            PregnancyCategory = "C"
        };
        _oldAspirin = new Drug
        {
            TradeName = "OldAspirin 300mg",
            ActiveIngredient = "acetylsalicylic acid",
            Strength = "300mg",
            Form = DrugForm.Tablet,
            Category = "Analgesic",
            IsDiscontinued = true
        };

        context.Drugs.AddRange(_augmentin, _amoxil, _voltaren, _panadol, _cetamol, _concor, _oldAspirin);

        _patientAmr = new Patient
        {
            FileNumber = "P-101",
            FullName = "عمرو كمال",
            Phone = "01000000001",
            Gender = PatientGender.Male,
            IsPregnant = false,
            IsLactating = false
        };
        _patientMona = new Patient
        {
            FileNumber = "P-102",
            FullName = "منى أحمد",
            Phone = "01000000002",
            Gender = PatientGender.Female,
            IsPregnant = true,
            IsLactating = false
        };
        _patientFatima = new Patient
        {
            FileNumber = "P-103",
            FullName = "فاطمة محمد",
            Phone = "01000000003",
            Gender = PatientGender.Female,
            IsPregnant = false,
            IsLactating = true
        };
        _patientSara = new Patient
        {
            FileNumber = "P-104",
            FullName = "سارة حسن",
            Phone = "01000000004",
            Gender = PatientGender.Female,
            IsPregnant = false,
            IsLactating = false
        };
        _patientKhaled = new Patient
        {
            FileNumber = "P-105",
            FullName = "خالد مصطفى",
            Phone = "01000000005",
            Gender = PatientGender.Male,
            IsPregnant = false,
            IsLactating = false
        };

        context.Patients.AddRange(_patientAmr, _patientMona, _patientFatima, _patientSara, _patientKhaled);
        await context.SaveChangesAsync();

        context.PatientAllergies.Add(new PatientAllergy
        {
            PatientId = _patientAmr.Id,
            ActiveIngredient = "amoxicillin",
            AllergyName = "حساسية بنسلين",
            Severity = AllergySeverity.Severe
        });

        context.PatientAllergies.Add(new PatientAllergy
        {
            PatientId = _patientSara.Id,
            ActiveIngredient = "diclofenac sodium",
            AllergyName = "حساسية ديكلوفيناك",
            Severity = AllergySeverity.Moderate
        });

        await context.SaveChangesAsync();
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private DrugsController CreateController(ClinicDbContext context)
    {
        return new DrugsController(context, NullLogger<DrugsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };
    }

    private static ControllerContext CreateControllerContext(int userId, string username, string role)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Fact]
    public async Task SafetyCheck_SevereAllergyConflict_ReturnsSevereWarningAndRequiresOverride()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientAmr.Id,
            DrugIds = new List<int> { _augmentin.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.HasWarnings.Should().BeTrue();
        result.HasSevereWarnings.Should().BeTrue();
        result.RequiresOverride.Should().BeTrue();
        result.Warnings.Should().HaveCount(1);

        var warning = result.Warnings[0];
        warning.Type.Should().Be("Allergy");
        warning.Severity.Should().Be("Severe");
        warning.RequiresOverride.Should().BeTrue();
        warning.MessageAr.Should().Contain("amoxicillin");
    }

    [Fact]
    public async Task SafetyCheck_AllergyMatching_CaseInsensitiveAndWhitespaceTrimmed()
    {
        await using var context = CreateDbContext();
        var newPatient = new Patient
        {
            FileNumber = "P-TRIM",
            FullName = "مريض فحص الحساسية",
            Phone = "01099999999",
            Gender = PatientGender.Male
        };
        context.Patients.Add(newPatient);
        await context.SaveChangesAsync();

        context.PatientAllergies.Add(new PatientAllergy
        {
            PatientId = newPatient.Id,
            ActiveIngredient = "  AmOxIcIlLiN  ",
            AllergyName = "حساسية فحص",
            Severity = AllergySeverity.Severe
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = newPatient.Id,
            DrugIds = new List<int> { _augmentin.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.HasWarnings.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Type == "Allergy" && w.Severity == "Severe");
    }

    [Fact]
    public async Task SafetyCheck_ModerateAllergyConflict_ReturnsModerateWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientSara.Id,
            DrugIds = new List<int> { _voltaren.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Should().Contain(w => w.Type == "Allergy" && w.Severity == "Moderate");
    }

    [Fact]
    public async Task SafetyCheck_NoMatchingAllergy_ReturnsZeroAllergyWarnings()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientAmr.Id,
            DrugIds = new List<int> { _panadol.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Where(w => w.Type == "Allergy").Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyCheck_PregnancyContraindication_PregnantPatient_AvoidInPregnancyTrue_ReturnsSevereWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientMona.Id,
            DrugIds = new List<int> { _voltaren.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Should().HaveCount(1);
        var warning = result.Warnings[0];
        warning.Type.Should().Be("Pregnancy");
        warning.Severity.Should().Be("Severe");
        warning.RequiresOverride.Should().BeTrue();
        warning.MessageAr.Should().Contain("الحمل");
    }

    [Fact]
    public async Task SafetyCheck_PregnancySafeDrug_PregnantPatient_ReturnsNoPregnancyWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientMona.Id,
            DrugIds = new List<int> { _panadol.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Where(w => w.Type == "Pregnancy").Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyCheck_AvoidInPregnancyTrue_NonPregnantPatient_ReturnsNoPregnancyWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientKhaled.Id,
            DrugIds = new List<int> { _voltaren.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Where(w => w.Type == "Pregnancy").Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyCheck_LactationContraindication_LactatingPatient_ReturnsLactationWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientFatima.Id,
            DrugIds = new List<int> { _concor.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Should().Contain(w => w.Type == "Lactation" && w.RequiresOverride);
    }

    [Fact]
    public async Task SafetyCheck_DuplicateIngredients_MultiDrugSelectionSameIngredient_ReturnsDuplicateWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientKhaled.Id,
            DrugIds = new List<int> { _augmentin.Id, _amoxil.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        var dupWarning = result.Warnings.FirstOrDefault(w => w.Type == "DuplicateIngredient");
        dupWarning.Should().NotBeNull();
        dupWarning!.Severity.Should().Be("Moderate");
        dupWarning.ActiveIngredient.Should().Be("amoxicillin");
        dupWarning.DrugName.Should().Contain("Augmentin 1g");
        dupWarning.DrugName.Should().Contain("Amoxil 500mg");
    }

    [Fact]
    public async Task SafetyCheck_DistinctIngredients_MultiDrugSelection_ReturnsNoDuplicateWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientKhaled.Id,
            DrugIds = new List<int> { _augmentin.Id, _panadol.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Where(w => w.Type == "DuplicateIngredient").Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyCheck_DiscontinuedDrug_ReturnsSevereDiscontinuedWarning()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientKhaled.Id,
            DrugIds = new List<int> { _oldAspirin.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.Warnings.Should().Contain(w => w.Type == "Discontinued" && w.Severity == "Severe" && w.RequiresOverride);
    }

    [Fact]
    public async Task SafetyCheck_MultiConflictMatrix_ReportsAllDistinctWarningsSimultaneously()
    {
        await using var context = CreateDbContext();
        context.PatientAllergies.Add(new PatientAllergy
        {
            PatientId = _patientMona.Id,
            ActiveIngredient = "paracetamol",
            AllergyName = "حساسية باراسيتامول",
            Severity = AllergySeverity.Severe
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientMona.Id,
            DrugIds = new List<int> { _panadol.Id, _cetamol.Id, _voltaren.Id }
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        // Exactly 4 warnings: 2 Allergy (Panadol & Cetamol), 1 DuplicateIngredient (paracetamol), 1 Pregnancy (Voltaren)
        result.Warnings.Should().HaveCount(4);
        result.Warnings.Count(w => w.Type == "Allergy").Should().Be(2);
        result.Warnings.Count(w => w.Type == "DuplicateIngredient").Should().Be(1);
        result.Warnings.Count(w => w.Type == "Pregnancy").Should().Be(1);
        result.HasWarnings.Should().BeTrue();
        result.RequiresOverride.Should().BeTrue();
    }

    [Fact]
    public async Task SafetyCheck_EmptyDrugList_ReturnsSuccessWithZeroWarnings()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = _patientKhaled.Id,
            DrugIds = new List<int>()
        };

        var response = await controller.CheckSafety(request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var result = okResult.Value.Should().BeOfType<DrugSafetyCheckResultDto>().Subject;

        result.HasWarnings.Should().BeFalse();
        result.Warnings.Should().BeEmpty();
    }

    [Fact]
    public async Task SafetyCheck_NonExistentPatientId_ReturnsNotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var request = new DrugSafetyCheckRequestDto
        {
            PatientId = 99999,
            DrugIds = new List<int> { _augmentin.Id }
        };

        var response = await controller.CheckSafety(request);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task SearchDrugs_ByTradeNamePrefix_ReturnsMatchingDrugs()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var response = await controller.Search("aug");
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = okResult.Value.Should().BeOfType<List<DrugSummaryDto>>().Subject;

        items.Should().Contain(d => d.TradeName == "Augmentin 1g");
    }

    [Fact]
    public async Task SearchDrugs_ByActiveIngredient_ReturnsMatchingDrugs()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var response = await controller.Search("amoxicillin");
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = okResult.Value.Should().BeOfType<List<DrugSummaryDto>>().Subject;

        items.Should().Contain(d => d.TradeName == "Augmentin 1g");
        items.Should().Contain(d => d.TradeName == "Amoxil 500mg");
    }

    public async Task DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            if (File.Exists(_dbFilePath + "-wal")) File.Delete(_dbFilePath + "-wal");
            if (File.Exists(_dbFilePath + "-shm")) File.Delete(_dbFilePath + "-shm");
        }
        catch { }
    }
}
