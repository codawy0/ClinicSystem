using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F05")]
public class T1_05_QueueLockTests : E2ETestBase
{
    public T1_05_QueueLockTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F05_01_BookingWriteLock_SequentialExecution()
    {
        await EnsureShiftOpenAsync();

        // Pre-create 5 patients
        var patients = await Task.WhenAll(Enumerable.Range(1, 5).Select(i =>
            Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient($"مريض تسلسل {i}"))
        ));

        // Concurrently book all 5 walk-in appointments simultaneously
        var bookingTasks = patients.Select(p =>
            Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p.Data!.Id, bookingType: "WalkIn"))
        ).ToArray();

        var bookings = await Task.WhenAll(bookingTasks);

        // Assert all succeeded under BookingWriteLock
        bookings.Should().AllSatisfy(b => b.IsSuccessStatusCode.Should().BeTrue());

        // Extract assigned queue numbers
        var queueNumbers = bookings.Select(b => b.Data!.QueueNumber!.Value).OrderBy(q => q).ToList();

        // Verify strictly monotonic, gapless serialization
        queueNumbers.Should().OnlyHaveUniqueItems();
        for (int i = 1; i < queueNumbers.Count; i++)
        {
            (queueNumbers[i] - queueNumbers[i - 1]).Should().Be(1, "BookingWriteLock must serialize queue assignments gaplessly");
        }
    }

    [Fact]
    public async Task T1_F05_02_QueueNumber_GaplessWalkInAssignment()
    {
        await EnsureShiftOpenAsync();
        var queueNumbers = new List<int>();

        for (int i = 0; i < 3; i++)
        {
            var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
            var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, bookingType: "WalkIn"));
            apt.EnsureSuccess();
            queueNumbers.Add(apt.Data!.QueueNumber!.Value);
        }

        queueNumbers.Should().BeInAscendingOrder();
        for (int i = 1; i < queueNumbers.Count; i++)
        {
            (queueNumbers[i] - queueNumbers[i - 1]).Should().Be(1);
        }
    }

    [Fact]
    public async Task T1_F05_03_QueueNumber_CheckInSequenceContinuation()
    {
        await EnsureShiftOpenAsync();
        var pat1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var advanceApt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id, bookingType: "Advance"));
        advanceApt.EnsureSuccess();
        advanceApt.Data!.QueueNumber.Should().BeNull();

        // Check in
        var checkIn = await Api.AsReceptionist().PutAsync<object>($"/api/appointments/{advanceApt.Data.Id}/check-in");
        checkIn.EnsureSuccess();

        var today = await Api.AsReceptionist().GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        today.EnsureSuccess();
        var checkedApt = today.Data!.First(a => a.Id == advanceApt.Data.Id);
        checkedApt.QueueNumber.Should().NotBeNull();
        checkedApt.Status.Should().Be("Waiting");
    }

    [Fact]
    public async Task T1_F05_04_BookingWriteLock_ReturnsResult()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        apt.EnsureSuccess();
        apt.Data.Should().NotBeNull();
        apt.Data!.PatientId.Should().Be(pat.Data!.Id);
    }

    [Fact]
    public async Task T1_F05_05_BookingWriteLock_ReleasesOnSuccess()
    {
        await EnsureShiftOpenAsync();
        var pat1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var res1 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id));
        res1.EnsureSuccess();

        var pat2 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var res2 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat2.Data!.Id));
        res2.EnsureSuccess();
        res2.Data!.QueueNumber.Should().BeGreaterThan(res1.Data!.QueueNumber ?? 0);
    }
}
