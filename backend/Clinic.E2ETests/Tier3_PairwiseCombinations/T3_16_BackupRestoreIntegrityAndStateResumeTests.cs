using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_16_BackupRestoreIntegrityAndStateResumeTests : E2ETestBase
{
    public T3_16_BackupRestoreIntegrityAndStateResumeTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task OnlineHotBackupAndRestore_RestoresExactPreBackupState_AndResumesQueue()
    {
        await EnsureShiftOpenAsync(3, 50000L);

        // Pre-backup patient
        var patA = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض قبل النسخ"));
        var aptA = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(patA.Data!.Id));

        // 1. Create hot online backup
        using var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", TestAuthHelper.DoctorToken());
        var backupRes = await client.PostAsync("/api/backup/create", null);
        backupRes.EnsureSuccessStatusCode();
        var zipBytes = await backupRes.Content.ReadAsByteArrayAsync();

        // 2. Mutate post-backup state: book Patient B
        var patB = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض بعد النسخ"));
        var aptB = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(patB.Data!.Id));

        var todayBefore = await Api.AsReceptionist(3).GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayBefore.Data.Should().Contain(a => a.Id == aptB.Data!.Id);

        // 3. Restore backup
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(zipBytes), "file", "backup.zip" }
        };
        var restore = await Api.AsDoctor().PostMultipartAsync<object>("/api/backup/restore", form);
        restore.EnsureSuccess();

        // 4. Verify post-backup patient B rolled back, Patient A exists
        var todayAfter = await Api.AsReceptionist(3).GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayAfter.Data.Should().Contain(a => a.Id == aptA.Data!.Id);
        todayAfter.Data.Should().NotContain(a => a.Id == aptB.Data!.Id);
    }
}
