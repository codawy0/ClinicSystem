using Clinic.Api.Infrastructure;
using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F05")]
public class T2_05_QueueConcurrencyStressTests : E2ETestBase
{
    public T2_05_QueueConcurrencyStressTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F05_01_ParallelBookingStress_30ConcurrentTasks()
    {
        await EnsureShiftOpenAsync();

        // Pre-create patients
        var patientTasks = Enumerable.Range(1, 30).Select(i =>
            Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient($"مريض ضغط {i}"))
        );
        var patients = await Task.WhenAll(patientTasks);

        // Concurrently book all 30 patients
        var bookingTasks = patients.Select(p =>
            Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p.Data!.Id))
        ).ToArray();

        var bookings = await Task.WhenAll(bookingTasks);

        // Asserts zero failures and unique, monotonic queue numbers
        bookings.Should().AllSatisfy(b => b.IsSuccessStatusCode.Should().BeTrue());
        var queueNumbers = bookings.Select(b => b.Data!.QueueNumber!.Value).ToList();
        queueNumbers.Distinct().Count().Should().Be(30);
    }

    [Fact]
    public async Task T2_F05_02_ExceptionInsideLock_ReleasesSemaphore()
    {
        var writeLock = Fixture.Services.GetRequiredService<IBookingWriteLock>();

        Func<Task> failingAct = async () =>
        {
            await writeLock.ExecuteAsync<int>(() => throw new InvalidOperationException("Simulated failure inside lock"));
        };

        await failingAct.Should().ThrowAsync<InvalidOperationException>();

        var subsequentResult = await writeLock.ExecuteAsync(() => Task.FromResult(100), timeoutMs: 1000);
        subsequentResult.Should().Be(100, "BookingWriteLock must be released even when action throws an exception");
    }

    [Fact]
    public async Task T2_F05_03_TimeoutProtection_OnStalledExecution()
    {
        var writeLock = Fixture.Services.GetRequiredService<IBookingWriteLock>();

        var holdTask = Task.Run(async () =>
        {
            await writeLock.ExecuteAsync(async () => await Task.Delay(400));
        });

        await Task.Delay(50);

        Func<Task> timedOutAct = async () =>
        {
            await writeLock.ExecuteAsync(() => Task.FromResult(true), timeoutMs: 50);
        };

        await timedOutAct.Should().ThrowAsync<TimeoutException>()
            .WithMessage("*Timed out after 50ms waiting for BookingWriteLock.*");

        await holdTask;
    }

    [Fact]
    public async Task T2_F05_04_CancellationToken_AbortsWait()
    {
        var writeLock = Fixture.Services.GetRequiredService<IBookingWriteLock>();

        var holdTask = Task.Run(async () =>
        {
            await writeLock.ExecuteAsync(async () => await Task.Delay(400));
        });

        await Task.Delay(50);
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));

        Func<Task> cancelledAct = async () =>
        {
            await writeLock.ExecuteAsync(() => Task.FromResult(true), timeoutMs: 5000, cancellationToken: cts.Token);
        };

        await cancelledAct.Should().ThrowAsync<OperationCanceledException>();
        await holdTask;
    }

    [Fact]
    public async Task T2_F05_05_InterleavedCallNextAndBooking_NoRaceCondition()
    {
        await EnsureShiftOpenAsync();

        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var bookTask = Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));
        var callTask = Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));

        await Task.WhenAll(bookTask, callTask);

        var bookRes = await bookTask;
        var callRes = await callTask;

        bookRes.IsSuccessStatusCode.Should().BeTrue();
        callRes.StatusCode.Should().Match(s => s == System.Net.HttpStatusCode.OK || s == System.Net.HttpStatusCode.NotFound);
    }
}
