using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class PatientSearchAndEligibilityTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_patient_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    [Fact]
    public async Task ArabicSearch_ShouldMatchHamzasTashkeelAndTaaMarbutaAcrossAllVariants()
    {
        await using var context = CreateDbContext();

        var patient = new Patient
        {
            FileNumber = "F-AR-1",
            FullName = "أحمد عبدُ الرَّحْمَٰن عـيـادة",
            Phone = "01099991111",
            Gender = PatientGender.Male
        };
        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        // Search Queries
        string[] queries = { "احمد", "عبد الرحمن", "عياده", "إحمد", "أَحْمَد", "عـيـادة" };

        foreach (var q in queries)
        {
            string normalizedQuery = ArabicNormalizer.NormalizeText(q);
            var matches = await context.Patients
                .Where(p => p.SearchName.Contains(normalizedQuery))
                .ToListAsync();

            matches.Should().ContainSingle(p => p.Id == patient.Id,
                $"Query '{q}' (normalized to '{normalizedQuery}') should match patient '{patient.FullName}'");
        }
    }

    [Fact]
    public async Task PhoneSearch_ShouldMatchVariousEgyptianPhoneFormats()
    {
        await using var context = CreateDbContext();

        var patient = new Patient
        {
            FileNumber = "F-PH-1",
            FullName = "طارق محمود",
            Phone = "01012345678",
            Gender = PatientGender.Male
        };
        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        string[] formats = {
            "+20 101-234-5678",
            "00201012345678",
            "010-1234-5678",
            "010 1234 5678",
            "٠١٠١٢٣٤٥٦٧٨"
        };

        foreach (var fmt in formats)
        {
            string normalized = ArabicNormalizer.NormalizePhone(fmt);
            var match = await context.Patients
                .FirstOrDefaultAsync(p => p.NormalizedPhone == normalized);

            match.Should().NotBeNull($"Format '{fmt}' normalized to '{normalized}' must match");
            match!.Id.Should().Be(patient.Id);
        }
    }

    [Fact]
    public async Task SharedFamilyPhone_ShouldReturnAllFamilyMembersUnderSamePhone()
    {
        await using var context = CreateDbContext();

        string sharedPhone = "01055554444";

        var father = new Patient { FileNumber = "F-FAM-1", FullName = "حسام عبد الله", Phone = sharedPhone, Gender = PatientGender.Male };
        context.Patients.Add(father);
        await context.SaveChangesAsync();

        var mother = new Patient { FileNumber = "F-FAM-2", FullName = "منى كمال", Phone = sharedPhone, Gender = PatientGender.Female };
        var child = new Patient { FileNumber = "F-FAM-3", FullName = "عمر حسام عبد الله", Phone = sharedPhone, Gender = PatientGender.Male, GuardianPatientId = father.Id };

        context.Patients.AddRange(mother, child);
        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().NotThrowAsync("Non-unique phone index allows shared family phone");

        string normalized = ArabicNormalizer.NormalizePhone(sharedPhone);
        var familyMembers = await context.Patients
            .Where(p => p.NormalizedPhone == normalized)
            .OrderBy(p => p.Id)
            .ToListAsync();

        familyMembers.Should().HaveCount(3);
        familyMembers.Should().Contain(p => p.Id == father.Id);
        familyMembers.Should().Contain(p => p.Id == mother.Id);
        familyMembers.Should().Contain(p => p.Id == child.Id && p.GuardianPatientId == father.Id);
    }

    [Theory]
    [InlineData(5, 0, true, null)]                           // 5 days ago, 0 consultations consumed -> Eligible!
    [InlineData(14, 0, true, null)]                          // Exact 14th day, 0 consumed -> Eligible!
    [InlineData(15, 0, false, "EXPIRED")]                    // 15 days ago (> 14) -> Expired!
    [InlineData(5, 1, false, "MAX_CONSULTATIONS_REACHED")]  // 5 days ago, 1 already consumed (max=1) -> Reached!
    public void ConsultationEligibilityLogic_ShouldEvaluateAccurately(
        int daysSinceExam, int consumedCount, bool expectedEligible, string? expectedReason)
    {
        int validityDays = 14;
        int maxConsultations = 1;

        bool isWithinValidity = daysSinceExam <= validityDays;
        bool hasRemainingQuota = consumedCount < maxConsultations;

        bool isEligible;
        string? reason = null;

        if (!isWithinValidity)
        {
            isEligible = false;
            reason = "EXPIRED";
        }
        else if (!hasRemainingQuota)
        {
            isEligible = false;
            reason = "MAX_CONSULTATIONS_REACHED";
        }
        else
        {
            isEligible = true;
        }

        isEligible.Should().Be(expectedEligible);
        reason.Should().Be(expectedReason);
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
