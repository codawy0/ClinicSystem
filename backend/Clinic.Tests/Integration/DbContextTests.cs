using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Services;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class DbContextTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_test_db_{Guid.NewGuid():N}.db");
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
    public async Task PatientSave_ShouldAutoPopulateSearchNameAndNormalizedPhone()
    {
        await using var context = CreateDbContext();

        var patient = new Patient
        {
            FileNumber = "F-AUTO-1",
            FullName = "أحمد عبدُ الرَّحْمَٰن عـيـادة",
            Phone = "+20 101-234-5678",
            Gender = PatientGender.Male,
            CreatedAtUtc = DateTime.UtcNow
        };

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        patient.SearchName.Should().Be("احمد عبد الرحمن عياده");
        patient.NormalizedPhone.Should().Be("01012345678");
    }

    [Fact]
    public async Task VersionedEntity_ShouldIncrementVersionOnUpdate()
    {
        await using var context = CreateDbContext();

        var patient = new Patient
        {
            FileNumber = "F-VER-1",
            FullName = "محمد محمود",
            Phone = "01011112222",
            Gender = PatientGender.Male,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow
        };

        context.Patients.Add(patient);
        await context.SaveChangesAsync();
        patient.Version.Should().Be(1);

        patient.FullName = "محمد محمود السيد";
        await context.SaveChangesAsync();
        patient.Version.Should().Be(2);
    }

    [Fact]
    public async Task ConcurrencyCollision_OnStaleVersion_ShouldThrowDbUpdateConcurrencyException()
    {
        await using var context1 = CreateDbContext();
        await using var context2 = CreateDbContext();

        var patient = new Patient
        {
            FileNumber = "F-STALE-1",
            FullName = "علي حسن",
            Phone = "01033334444",
            Gender = PatientGender.Male,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow
        };

        context1.Patients.Add(patient);
        await context1.SaveChangesAsync();

        // Load same patient in context2
        var p2 = await context2.Patients.FirstAsync(p => p.Id == patient.Id);

        // context1 updates patient
        patient.FullName = "علي حسن إبراهيم";
        await context1.SaveChangesAsync(); // Version is now 2 in DB

        // context2 tries to update with stale Version 1
        p2.FullName = "علي حسن كمال";
        Func<Task> act = async () => await context2.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    [Fact]
    public async Task ShiftFilteredIndex_ShouldPreventTwoOpenShiftsForSameUser()
    {
        await using var context = CreateDbContext();

        var user = new User
        {
            Username = "shift_cashier",
            PasswordHash = "hash",
            FullName = "كاشير تجريبي",
            Role = UserRole.Receptionist,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var shift1 = new Shift
        {
            UserId = user.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            IsClosed = false,
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 50000L
        };
        context.Shifts.Add(shift1);
        await context.SaveChangesAsync();

        // Attempt second open shift for same user
        var shift2 = new Shift
        {
            UserId = user.Id,
            BusinessDate = new DateOnly(2026, 11, 15),
            IsClosed = false,
            OpenedAtUtc = DateTime.UtcNow,
            OpeningBalancePiastres = 20000L
        };
        context.Shifts.Add(shift2);

        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task DbSeeder_ShouldSeedStructuralDefaultsWithPiastresPrices()
    {
        await using var context = CreateDbContext();
        var hasher = new Pbkdf2PasswordHasher();

        await DbSeeder.SeedStructuralDefaultsAsync(context, hasher, NullLogger.Instance);

        var settings = await context.ClinicSettings.FirstOrDefaultAsync();
        settings.Should().NotBeNull();
        settings!.DefaultExamPricePiastres.Should().Be(30000L); // 300 EGP in Piastres

        var admin = await context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
        admin.Should().NotBeNull();
        admin!.Role.Should().Be(UserRole.Admin);
        hasher.VerifyPassword("Admin@123", admin.PasswordHash).Should().BeTrue();

        var services = await context.ServiceCatalogs.ToListAsync();
        services.Should().HaveCount(6);
        services.Should().Contain(s => s.Code == "EXAM" && s.DefaultPricePiastres == 30000L);
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
        await Task.CompletedTask;
    }
}
