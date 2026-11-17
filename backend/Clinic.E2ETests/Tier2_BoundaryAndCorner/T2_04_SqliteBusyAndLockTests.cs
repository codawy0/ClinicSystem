using Clinic.Api.Data;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F04")]
public class T2_04_SqliteBusyAndLockTests : E2ETestBase
{
    public T2_04_SqliteBusyAndLockTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public void T2_F04_01_ConcurrentReaderDuringActiveWriter()
    {
        using var writerConn = new SqliteConnection(Fixture.ConnectionString);
        using var readerConn = new SqliteConnection(Fixture.ConnectionString);

        writerConn.Open();
        readerConn.Open();

        using var tx = writerConn.BeginTransaction();
        using var writeCmd = writerConn.CreateCommand();
        writeCmd.Transaction = tx;
        writeCmd.CommandText = "UPDATE ClinicSettings SET ClinicName = 'Test Modified' WHERE Id = 1;";
        writeCmd.ExecuteNonQuery();

        // Concurrently read from reader connection in WAL mode - should succeed without blocking
        using var readCmd = readerConn.CreateCommand();
        readCmd.CommandText = "SELECT COUNT(*) FROM ClinicSettings;";
        var count = Convert.ToInt32(readCmd.ExecuteScalar());
        count.Should().BeGreaterOrEqualTo(1);

        tx.Rollback();
    }

    [Fact]
    public async Task T2_F04_02_BusyTimeoutWaitUnderLockContention()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout;";
        var timeout = Convert.ToInt32(cmd.ExecuteScalar());
        timeout.Should().Be(5000, "SqlitePragmaInterceptor must configure busy_timeout = 5000 on connection open");
    }

    [Fact]
    public async Task T2_F04_03_ForeignKeyViolationOnOrphanInsert()
    {
        using var scope = Fixture.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicDbContext>();
        var conn = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync();

        Func<Task> act = async () =>
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "INSERT INTO PatientAllergies (PatientId, ActiveIngredient, AllergyName, Severity, CreatedAtUtc) VALUES (999999, 'drug', 'Allergy', 'Severe', CURRENT_TIMESTAMP);";
            await cmd.ExecuteNonQueryAsync();
        };

        var ex = await act.Should().ThrowAsync<SqliteException>();
        ex.Which.SqliteErrorCode.Should().Be(19, "SqlitePragmaInterceptor must enforce foreign_keys = ON on connection open so orphan inserts fail");
    }

    [Fact]
    public async Task T2_F04_04_HighConnectionConcurrencyStress()
    {
        var tasks = Enumerable.Range(1, 20).Select(async _ =>
        {
            using var conn = new SqliteConnection(Fixture.ConnectionString);
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM ServiceCatalogs;";
            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        });

        var results = await Task.WhenAll(tasks);
        results.Should().AllSatisfy(c => c.Should().BeGreaterOrEqualTo(1));
    }

    [Fact]
    public void T2_F04_05_WalCheckpointExecution()
    {
        using var conn = new SqliteConnection(Fixture.ConnectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA wal_checkpoint(PASSIVE);";
        using var reader = cmd.ExecuteReader();
        reader.Read().Should().BeTrue();
    }
}
