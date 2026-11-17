using Clinic.Api.Common.Enums;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F04")]
public class T1_04_SqlitePragmaTests : E2ETestBase
{
    public T1_04_SqlitePragmaTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T1_F04_01_Pragma_JournalModeIsWal()
    {
        // WAL mode is persistent in the database header
        using var conn = new SqliteConnection(Fixture.ConnectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode;";
        var mode = cmd.ExecuteScalar()?.ToString();
        mode.Should().BeEquivalentTo("wal");
    }

    [Fact]
    public async Task T1_F04_02_Pragma_BusyTimeoutIs5000()
    {
        // Authentically tests SqlitePragmaInterceptor by opening via ClinicDbContext
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout;";
        var timeout = Convert.ToInt32(cmd.ExecuteScalar());
        timeout.Should().Be(5000, "SqlitePragmaInterceptor must set busy_timeout = 5000 on connection open");
    }

    [Fact]
    public async Task T1_F04_03_Pragma_SynchronousIsFull()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA synchronous;";
        var synch = Convert.ToInt32(cmd.ExecuteScalar());
        synch.Should().Be(2, "SqlitePragmaInterceptor must set synchronous = FULL (2) on connection open");
    }

    [Fact]
    public async Task T1_F04_04_Pragma_ForeignKeysIsOn()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys;";
        var fk = Convert.ToInt32(cmd.ExecuteScalar());
        fk.Should().Be(1, "SqlitePragmaInterceptor must set foreign_keys = ON (1) on connection open");
    }

    [Fact]
    public async Task T1_F04_05_ForeignKeys_RestrictDeleteEnforced()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        // Seed patient and allergy via raw SQL on connection with PRAGMAs active from SqlitePragmaInterceptor
        using var seedCmd = conn.CreateCommand();
        seedCmd.CommandText = @"
            INSERT INTO Patients (FileNumber, FullName, SearchName, Phone, NormalizedPhone, Gender, IsPregnant, IsLactating, Version, CreatedAtUtc)
            VALUES ('FN-FK-TEST', 'مريض قيد التجربة', 'مريض قيد التجربة', '01099998888', '01099998888', 'Male', 0, 0, 1, CURRENT_TIMESTAMP);
            INSERT INTO PatientAllergies (PatientId, ActiveIngredient, AllergyName, Severity, CreatedAtUtc)
            VALUES (last_insert_rowid(), 'penicillin', 'حساسية بنسلين', 'Severe', CURRENT_TIMESTAMP);
        ";
        await seedCmd.ExecuteNonQueryAsync();

        // Attempting to delete patient with active dependent records fails under SQLite foreign key constraint
        Func<Task> act = async () =>
        {
            using var delCmd = conn.CreateCommand();
            delCmd.CommandText = "DELETE FROM Patients WHERE FileNumber = 'FN-FK-TEST';";
            await delCmd.ExecuteNonQueryAsync();
        };

        var ex = await act.Should().ThrowAsync<SqliteException>();
        ex.Which.SqliteErrorCode.Should().Be(19, "Foreign key constraint must prevent deletion of parent patient in SQLite");
    }
}
