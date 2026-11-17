using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier4_RealWorldScenarios;

[Trait("Category", "E2E")]
[Trait("Tier", "4")]
public class T4_08_FullDayClinicLoadSimulationTests : E2ETestBase
{
    public T4_08_FullDayClinicLoadSimulationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task FullDayClinicLoadSimulation_30ConcurrentTasks_ZeroSqliteBusy_AndValidLedger()
    {
        // 1. Simulation Initialization
        await Api.AsReceptionist(3).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(50000L, "Reset"));
        var openShift = await Api.AsReceptionist(3).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(100000L)); // 1000 EGP opening
        openShift.EnsureSuccess();

        // Pre-seed 5 appointments for concurrent vitals recording
        var preAppointments = new List<AppointmentResponse>();
        for (int i = 1; i <= 5; i++)
        {
            var p = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient($"مريض تمهيدي {i}"));
            var a = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p.Data!.Id, paymentMethod: "Cash"));
            preAppointments.Add(a.Data!);
        }

        // Pre-create 20 patients for concurrent bookings
        var bookingPatients = new List<PatientResponse>();
        for (int i = 1; i <= 20; i++)
        {
            var p = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient($"مريض ضغط ذروة {i}"));
            bookingPatients.Add(p.Data!);
        }

        // 2. Spawn 30 Concurrent Asynchronous Tasks
        // Tasks 1-20: 20 simultaneous booking requests
        var bookingTasks = bookingPatients.Select(p =>
            Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(p.Id, paymentMethod: "Cash"))
        ).ToList();

        // Tasks 21-25: 5 simultaneous vitals updates
        var vitalsTasks = preAppointments.Select((apt, idx) =>
        {
            var req = new VitalsRequest(
                BpSystolic: 120 + idx,
                BpDiastolic: 80,
                PulseBpm: 72,
                TempCelsius: 36.8 + (idx * 0.1),
                WeightKg: 75.0,
                BloodSugarMgDl: 100 + idx,
                BloodSugarType: "Random",
                IsPregnant: false,
                IsLactating: false,
                Version: 1
            );
            return Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Id}/vitals", req);
        }).ToList();

        // Tasks 26-28: 3 simultaneous call-next requests
        var callTasks = Enumerable.Range(1, 3).Select(_ =>
            Api.AsDoctor().PostAsync<CallNextResponse>("/api/queue/call-next", new CallNextRequest(1))
        ).ToList();

        // Tasks 29-30: 2 simultaneous petty cash expenses (5000 Piastres each)
        var expenseTasks = Enumerable.Range(1, 2).Select(i =>
            Api.AsReceptionist(3).PostAsync<object>("/api/shifts/expense", new RecordExpenseRequest(5000L, "Supplies", $"مصروف متزامن {i}"))
        ).ToList();

        // Await all 30 tasks simultaneously
        var allTasks = new List<Task>();
        allTasks.AddRange(bookingTasks);
        allTasks.AddRange(vitalsTasks);
        allTasks.AddRange(callTasks);
        allTasks.AddRange(expenseTasks);

        await Task.WhenAll(allTasks);

        // 3. Concurrency Invariant Assertions
        // Assertion A: Zero SQLITE_BUSY or 500 Server Errors in booking tasks
        var bookingResponses = bookingTasks.Select(t => t.Result).ToList();
        bookingResponses.Should().AllSatisfy(r => r.IsSuccessStatusCode.Should().BeTrue());

        // Assertion B: Strict uniqueness of queue numbers among concurrent bookings
        var queueNumbers = bookingResponses.Select(r => r.Data!.QueueNumber!.Value).ToList();
        queueNumbers.Distinct().Count().Should().Be(20, "each concurrent booking must receive a unique queue number without race conditions");

        // Assertion C: Vitals tasks succeeded
        var vitalsResponses = vitalsTasks.Select(t => t.Result).ToList();
        vitalsResponses.Should().AllSatisfy(r => r.IsSuccessStatusCode.Should().BeTrue());

        // Assertion D: Call-next tasks returned valid responses (200 OK)
        var callResponses = callTasks.Select(t => t.Result).ToList();
        callResponses.Should().AllSatisfy(r => r.IsSuccessStatusCode.Should().BeTrue());

        // Assertion E: Expense tasks succeeded
        var expenseResponses = expenseTasks.Select(t => t.Result).ToList();
        expenseResponses.Should().AllSatisfy(r => r.IsSuccessStatusCode.Should().BeTrue());

        // Assertion F: Financial Drawer Math
        // Opening (100000) + 5 pre-appointments (5 * 30000) + 20 concurrent bookings (20 * 30000) - 2 expenses (2 * 5000)
        // = 100000 + 150000 + 600000 - 10000 = 840000 Piastres
        var currentShift = await Api.AsReceptionist(3).GetAsync<ShiftResponse>("/api/shifts/current");
        currentShift.EnsureSuccess();
        currentShift.Data!.ExpectedClosingCashPiastres.Should().Be(840000L);
    }
}
