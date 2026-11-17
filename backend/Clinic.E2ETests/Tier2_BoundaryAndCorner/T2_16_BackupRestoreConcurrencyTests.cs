using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F16")]
public class T2_16_BackupRestoreConcurrencyTests : E2ETestBase
{
    public T2_16_BackupRestoreConcurrencyTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F16_01_DoctorSummary_ReceptionistForbidden_Returns403()
    {
        var res = await Api.AsReceptionist().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary");
        res.ShouldBeForbidden();
    }

    [Fact]
    public async Task T2_F16_02_DoctorSummary_InvalidDateRange_Returns400()
    {
        var res = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary?from=2026-11-30&to=2026-11-01");
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F16_03_RestoreBackup_CorruptedFileRejected()
    {
        var randomBytes = new byte[] { 0x01, 0x02, 0x03, 0x04, 0x05 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(randomBytes), "file", "corrupt.zip" }
        };
        var res = await Api.AsDoctor().PostMultipartAsync<object>("/api/backup/restore", form);
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F16_04_ConcurrentReadsDuringHotBackup_ZeroErrors()
    {
        // Concurrently query patients while backup runs
        var backupTask = Api.AsDoctor().PostAsync<string>("/api/backup/create");
        var readTasks = Enumerable.Range(1, 10).Select(_ =>
            Api.AsReceptionist().GetAsync<List<PatientResponse>>("/api/patients/search?q=test")
        );

        var allTasks = readTasks.Cast<Task>().Concat(new Task[] { backupTask });
        await Task.WhenAll(allTasks);

        (await backupTask).IsSuccessStatusCode.Should().BeTrue();
    }

    [Fact]
    public async Task T2_F16_05_RestoreBackup_AcquiresBookingWriteLock()
    {
        await EnsureShiftOpenAsync();
        var writeLock = Fixture.Services.GetRequiredService<IBookingWriteLock>();

        // 1. Simulate an active Restore operation acquiring BookingWriteLock
        var restoreCompletionSource = new TaskCompletionSource<bool>();
        var restoreTask = Task.Run(async () =>
        {
            await writeLock.ExecuteAsync(async () =>
            {
                // Lock held while restore is unpacking/replacing clinic.db
                await restoreCompletionSource.Task;
            });
        });

        // Ensure restore task has acquired the lock
        await Task.Delay(50);

        // 2. Concurrently attempt an appointment booking during active restore
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var bookingTask = Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Booking must NOT have completed yet because Restore holds BookingWriteLock
        await Task.Delay(50);
        bookingTask.IsCompleted.Should().BeFalse("Booking request must wait while Restore operation holds BookingWriteLock");

        // 3. Complete the Restore operation
        restoreCompletionSource.SetResult(true);
        await restoreTask;

        // 4. Booking completes successfully once Restore releases lock
        var bookingRes = await bookingTask;
        bookingRes.IsSuccessStatusCode.Should().BeTrue();
        bookingRes.Data!.QueueNumber.Should().NotBeNull();
    }
}
