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
using Clinic.Api.Models.ClinicalProfile;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class PatientClinicalProfileTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _doctor = null!;
    private Patient _patient = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_profile_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "profile_doc", PasswordHash = "h", FullName = "د. استشاري", Role = UserRole.Doctor };
        _patient = new Patient
        {
            FileNumber = "F-CLIN-1",
            FullName = "فاطمة أحمد حسن",
            Phone = "01122334455",
            Gender = PatientGender.Female,
            BloodType = BloodType.APositive,
            IsPregnant = true,
            IsLactating = false
        };

        context.Users.Add(_doctor);
        context.Patients.Add(_patient);
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

    private static ControllerContext CreateControllerContext(int userId, string username, string role)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Theory]
    [InlineData("  Amoxicillin  ", "amoxicillin")]
    [InlineData("CEFTRIAXONE SODIUM", "ceftriaxone sodium")]
    [InlineData("  Paracetamol  ", "paracetamol")]
    [InlineData("cIPrOflOxAcIn", "ciprofloxacin")]
    public async Task DrugAllergyNormalization_WhenSaved_ActiveIngredientMustBeTrimmedAndLowercased(
        string rawIngredient, string expectedNormalized)
    {
        await using var context = CreateDbContext();
        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var request = new AddPatientAllergyRequestDto
        {
            ActiveIngredient = rawIngredient,
            AllergyName = "حساسية بنسلين",
            Severity = AllergySeverity.Severe,
            Notes = "تسبب وذمة وعائية"
        };

        var res = await controller.AddAllergy(_patient.Id, request);
        var created = res.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = created.Value.Should().BeOfType<PatientAllergyDto>().Subject;

        dto.ActiveIngredient.Should().Be(expectedNormalized);

        // Verify directly in database storage
        var allergyInDb = await context.PatientAllergies.FirstAsync(a => a.Id == dto.Id);
        allergyInDb.ActiveIngredient.Should().Be(expectedNormalized);
    }

    [Fact]
    public async Task AddDrugAllergy_ShouldPersistAllergyWithSeverityAndNotes()
    {
        await using var context = CreateDbContext();
        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var request = new AddPatientAllergyRequestDto
        {
            ActiveIngredient = "sulfa",
            AllergyName = "سلفا ومشتقاتها",
            Severity = AllergySeverity.Moderate,
            Notes = "طفح جلدي وحكة"
        };

        var res = await controller.AddAllergy(_patient.Id, request);
        var created = res.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = created.Value.Should().BeOfType<PatientAllergyDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.PatientId.Should().Be(_patient.Id);
        dto.Severity.Should().Be(AllergySeverity.Moderate);

        var count = await context.PatientAllergies.CountAsync(a => a.PatientId == _patient.Id);
        count.Should().Be(1);
    }

    [Fact]
    public async Task DeleteDrugAllergy_ShouldRemoveRecordFromDatabase()
    {
        await using var context = CreateDbContext();
        var allergy = new PatientAllergy
        {
            PatientId = _patient.Id,
            ActiveIngredient = "aspirin",
            AllergyName = "أسبرين",
            Severity = AllergySeverity.Severe
        };
        context.PatientAllergies.Add(allergy);
        await context.SaveChangesAsync();

        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var deleteRes = await controller.DeleteAllergy(_patient.Id, allergy.Id);
        deleteRes.Should().BeOfType<NoContentResult>();

        var exists = await context.PatientAllergies.AnyAsync(a => a.Id == allergy.Id);
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteDrugAllergy_ForDifferentPatient_ShouldReturnNotFound()
    {
        await using var context = CreateDbContext();
        var otherPatient = new Patient
        {
            FileNumber = "F-OTHER",
            FullName = "مريض آخر",
            Phone = "01200000000",
            Gender = PatientGender.Male
        };
        context.Patients.Add(otherPatient);
        await context.SaveChangesAsync();

        var allergy = new PatientAllergy
        {
            PatientId = _patient.Id,
            ActiveIngredient = "aspirin",
            AllergyName = "أسبرين",
            Severity = AllergySeverity.Severe
        };
        context.PatientAllergies.Add(allergy);
        await context.SaveChangesAsync();

        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        // Try deleting patient 1's allergy using otherPatient's ID
        var deleteRes = await controller.DeleteAllergy(otherPatient.Id, allergy.Id);
        deleteRes.Should().BeOfType<NotFoundObjectResult>();

        // Ensure record still exists
        var stillExists = await context.PatientAllergies.AnyAsync(a => a.Id == allergy.Id);
        stillExists.Should().BeTrue();
    }

    [Fact]
    public async Task AddChronicCondition_ShouldPersistWithCodeAndArabicName()
    {
        await using var context = CreateDbContext();
        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var request = new AddPatientChronicConditionRequestDto
        {
            ConditionCode = "HTN",
            ConditionName = "ارتفاع ضغط الدم الأساسي",
            Notes = "منذ 4 سنوات ويتناول أدوية بانتظام"
        };

        var res = await controller.AddChronicCondition(_patient.Id, request);
        var created = res.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = created.Value.Should().BeOfType<PatientChronicConditionDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.ConditionCode.Should().Be("HTN");
        dto.ConditionName.Should().Be("ارتفاع ضغط الدم الأساسي");

        var condInDb = await context.PatientChronicConditions.FirstAsync(c => c.Id == dto.Id);
        condInDb.ConditionName.Should().Be("ارتفاع ضغط الدم الأساسي");
    }

    [Fact]
    public async Task DeleteChronicCondition_ShouldRemoveRecordFromDatabase()
    {
        await using var context = CreateDbContext();
        var condition = new PatientChronicCondition
        {
            PatientId = _patient.Id,
            ConditionCode = "DM2",
            ConditionName = "داء السكري من النوع الثاني"
        };
        context.PatientChronicConditions.Add(condition);
        await context.SaveChangesAsync();

        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var deleteRes = await controller.DeleteChronicCondition(_patient.Id, condition.Id);
        deleteRes.Should().BeOfType<NoContentResult>();

        var exists = await context.PatientChronicConditions.AnyAsync(c => c.Id == condition.Id);
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task GetClinicalProfile_ShouldReturnAllergiesAndConditionsWithPatientDemographics()
    {
        await using var context = CreateDbContext();

        // Seed 1 allergy and 1 chronic condition
        context.PatientAllergies.Add(new PatientAllergy
        {
            PatientId = _patient.Id,
            ActiveIngredient = "penicillin",
            AllergyName = "بنسلين",
            Severity = AllergySeverity.Severe
        });
        context.PatientChronicConditions.Add(new PatientChronicCondition
        {
            PatientId = _patient.Id,
            ConditionCode = "ASTHMA",
            ConditionName = "حساسية صدرية (ربو)"
        });
        await context.SaveChangesAsync();

        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var res = await controller.GetProfile(_patient.Id);
        var okResult = res.Result.Should().BeOfType<OkObjectResult>().Subject;
        var profile = okResult.Value.Should().BeOfType<PatientClinicalProfileDto>().Subject;

        profile.PatientId.Should().Be(_patient.Id);
        profile.FullName.Should().Be("فاطمة أحمد حسن");
        profile.FileNumber.Should().Be("F-CLIN-1");
        profile.IsPregnant.Should().BeTrue();
        profile.IsLactating.Should().BeFalse();
        profile.BloodType.Should().Be(BloodType.APositive);

        profile.Allergies.Should().ContainSingle(a => a.ActiveIngredient == "penicillin");
        profile.ChronicConditions.Should().ContainSingle(c => c.ConditionCode == "ASTHMA");
    }

    [Fact]
    public async Task GetClinicalProfile_WhenPatientDoesNotExist_ShouldReturn404()
    {
        await using var context = CreateDbContext();
        var controller = new PatientClinicalProfileController(context, NullLogger<PatientClinicalProfileController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var res = await controller.GetProfile(99999);
        res.Result.Should().BeOfType<NotFoundObjectResult>();
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
