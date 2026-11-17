using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F09")]
public class T1_09_AppointmentQueueTests : E2ETestBase
{
    public T1_09_AppointmentQueueTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F09_01_BookWalkIn_AssignsQueueNumberImmediately()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var res = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, bookingType: "WalkIn"));
        res.EnsureSuccess();
        res.Data!.QueueNumber.Should().NotBeNull();
        res.Data.Status.Should().Be("Waiting");
    }

    [Fact]
    public async Task T1_F09_02_BookAdvance_QueueNumberNullUntilArrival()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var res = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, bookingType: "Advance"));
        res.EnsureSuccess();
        res.Data!.QueueNumber.Should().BeNull();
        res.Data.Status.Should().Be("Booked");
    }

    [Fact]
    public async Task T1_F09_03_CheckIn_AssignsNextQueueNumber()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var advanceApt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id, bookingType: "Advance"));

        var checkIn = await Api.AsReceptionist().PutAsync<object>($"/api/appointments/{advanceApt.Data!.Id}/check-in");
        checkIn.EnsureSuccess();

        var today = await Api.AsReceptionist().GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        var updated = today.Data!.First(a => a.Id == advanceApt.Data.Id);
        updated.QueueNumber.Should().NotBeNull();
        updated.Status.Should().Be("Waiting");
    }

    [Fact]
    public async Task T1_F09_04_CallNext_PreemptsWithUrgentPatient()
    {
        await EnsureShiftOpenAsync();
        // Regular patient
        var pat1 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض عادي"));
        await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id, isUrgent: false));

        // Urgent patient
        var pat2 = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient("مريض طارئ"));
        var apt2 = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat2.Data!.Id, isUrgent: true));

        // Call Next
        var call = await Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(2));
        call.EnsureSuccess();
        call.Data!.AppointmentId.Should().Be(apt2.Data!.Id); // Urgent called first!
    }

    [Fact]
    public async Task T1_F09_05_SkipAndRecall_Lifecycle()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var skip = await Api.AsReceptionist().PostAsync<object>($"/api/queue/{apt.Data!.Id}/skip", new SkipRequest("Stepped out"));
        skip.EnsureSuccess();

        var todayAfterSkip = await Api.AsReceptionist().GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayAfterSkip.Data!.First(a => a.Id == apt.Data.Id).Status.Should().Be("Skipped");

        var recall = await Api.AsReceptionist().PostAsync<object>($"/api/queue/{apt.Data.Id}/return-from-skip");
        recall.EnsureSuccess();

        var todayAfterRecall = await Api.AsReceptionist().GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        todayAfterRecall.Data!.First(a => a.Id == apt.Data.Id).Status.Should().Be("Waiting");
    }
}
