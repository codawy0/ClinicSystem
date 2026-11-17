using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Clinic.Api.Common.Enums;
using Clinic.Api.Controllers;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Infrastructure;
using Clinic.Api.Models.MedicalVisits;
using Clinic.Tests.Helpers;

namespace Clinic.Tests.Concurrency;

[Trait("Category", "Concurrency")]
public class VisitCompletionConcurrencyTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    private User _doctor = null!;
    private ServiceCatalog _service = null!;
    private Drug _drug1 = null!;
    private Drug _drug2 = null!;
    private readonly DateOnly _businessDate = new(2026, 11, 16);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_concurrency_visitcomp_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc_conc", PasswordHash = "h", FullName = "د. تامر شاكر", Role = UserRole.Doctor };
        _service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف باطنة", Category = ServiceCategory.Exam, DefaultPricePiastres = 30_000L };

        _drug1 = new Drug
        {
            TradeName = "Augmentin 1g",
            ActiveIngredient = "amoxicillin",
            Strength = "1g",
            Form = DrugForm.Tablet,
            Category = "Antibiotic"
        };
        _drug2 = new Drug
        {
            TradeName = "Nexium 40mg",
            ActiveIngredient = "esomeprazole",
            Strength = "40mg",
            Form = DrugForm.Tablet,
            Category = "PPI"
        };

        context.Users.Add(_doctor);
        context.ServiceCatalogs.Add(_service);
        context.Drugs.AddRange(_drug1, _drug2);
        await context.SaveChangesAsync();
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private MedicalVisitsController CreateController(ClinicDbContext context, IBookingWriteLock writeLock)
    {
        return new MedicalVisitsController(
            context,
            new BusinessDateService(),
            writeLock,
            new TestQueueHubContext(),
            NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };
    }

    private static ControllerContext CreateControllerContext(int userId, string username, string role)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Fact]
    public async Task VisitCompletion_ParallelSimultaneousCallsOnSameVisit_ShouldSerializeSafelyWithoutSqliteBusyOrDuplicateSnapshots()
    {
        // Arrange
        var bookingWriteLock = new BookingWriteLock();
        int visitId;
        int appointmentId;

        await using (var seedContext = CreateDbContext())
        {
            var patient = new Patient { FileNumber = "P-CONC-1", FullName = "مريض التزامن", Phone = "01088776655", Gender = PatientGender.Male };
            seedContext.Patients.Add(patient);
            await seedContext.SaveChangesAsync();

            var appointment = new Appointment
            {
                DoctorUserId = _doctor.Id,
                PatientId = patient.Id,
                ServiceId = _service.Id,
                BusinessDate = _businessDate,
                QueueNumber = 1,
                Status = AppointmentStatus.WithDoctor,
                CreatedAtUtc = DateTime.UtcNow
            };
            seedContext.Appointments.Add(appointment);
            await seedContext.SaveChangesAsync();

            var visit = new MedicalVisit
            {
                AppointmentId = appointment.Id,
                PatientId = patient.Id,
                DoctorUserId = _doctor.Id,
                IsDraft = true,
                Version = 1,
                CreatedAtUtc = DateTime.UtcNow
            };
            seedContext.MedicalVisits.Add(visit);
            await seedContext.SaveChangesAsync();

            visitId = visit.Id;
            appointmentId = appointment.Id;
        }

        const int parallelCount = 10;
        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "نزلة شعبية حادة",
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new() { DrugId = _drug1.Id, DrugName = "Augmentin 1g", Dosage = "قرص مرتين", Timing = "بعد الأكل", Duration = "7 أيام" },
                new() { DrugId = _drug2.Id, DrugName = "Nexium 40mg", Dosage = "قرص يومياً", Timing = "قبل الإفطار", Duration = "14 يوماً" }
            }
        };

        // Act - Launch 10 simultaneous tasks calling complete on the exact same visit
        var tasks = Enumerable.Range(0, parallelCount).Select(async _ =>
        {
            await Task.Yield();
            await using var context = CreateDbContext();
            var controller = CreateController(context, bookingWriteLock);
            return await controller.CompleteConsultation(visitId, request);
        });

        var results = await Task.WhenAll(tasks);

        // Assert - Zero exceptions, all responses return 200 OK (first completes, others return via idempotency)
        results.Should().AllSatisfy(res =>
        {
            res.Result.Should().BeOfType<OkObjectResult>();
        });

        // Verify Database state
        await using var verifyContext = CreateDbContext();
        var committedVisit = await verifyContext.MedicalVisits.FindAsync(visitId);
        committedVisit.Should().NotBeNull();
        committedVisit!.IsDraft.Should().BeFalse();
        committedVisit.CompletedAtUtc.Should().NotBeNull();

        var prescriptionItems = await verifyContext.PrescriptionItems
            .Where(p => p.MedicalVisitId == visitId)
            .ToListAsync();

        prescriptionItems.Should().HaveCount(2, "Concurrent completions must never duplicate prescription items!");

        var statusHistories = await verifyContext.AppointmentStatusHistories
            .Where(h => h.AppointmentId == appointmentId && h.ToStatus == AppointmentStatus.Completed.ToString())
            .ToListAsync();

        statusHistories.Should().HaveCount(1, "Status transition to Completed must occur exactly once!");
    }

    [Fact]
    public async Task ConcurrentBookingAndVisitCompletion_UnderSharedBookingWriteLock_ShouldNotDeadlock()
    {
        // Arrange
        var sharedWriteLock = new BookingWriteLock();
        const int count = 10;
        var bookingPatientIds = new List<int>();
        var completionVisitIds = new List<int>();

        await using (var seedContext = CreateDbContext())
        {
            // Seed 10 patients for booking
            for (int i = 1; i <= count; i++)
            {
                var patient = new Patient { FileNumber = $"P-BOOK-{i}", FullName = $"مريض حجز {i}", Phone = $"0101111{i:D4}", Gender = PatientGender.Male };
                seedContext.Patients.Add(patient);
            }

            // Seed 10 patients, appointments, and visits for completion
            for (int i = 1; i <= count; i++)
            {
                var patient = new Patient { FileNumber = $"P-COMPL-{i}", FullName = $"مريض إنهاء {i}", Phone = $"0102222{i:D4}", Gender = PatientGender.Female };
                seedContext.Patients.Add(patient);
                await seedContext.SaveChangesAsync();

                var appt = new Appointment
                {
                    DoctorUserId = _doctor.Id,
                    PatientId = patient.Id,
                    ServiceId = _service.Id,
                    BusinessDate = _businessDate,
                    QueueNumber = 100 + i,
                    Status = AppointmentStatus.WithDoctor,
                    CreatedAtUtc = DateTime.UtcNow
                };
                seedContext.Appointments.Add(appt);
                await seedContext.SaveChangesAsync();

                var visit = new MedicalVisit
                {
                    AppointmentId = appt.Id,
                    PatientId = patient.Id,
                    DoctorUserId = _doctor.Id,
                    IsDraft = true,
                    Version = 1,
                    CreatedAtUtc = DateTime.UtcNow
                };
                seedContext.MedicalVisits.Add(visit);
                await seedContext.SaveChangesAsync();

                completionVisitIds.Add(visit.Id);
            }

            await seedContext.SaveChangesAsync();
            var bookingPatients = await seedContext.Patients.Where(p => p.FileNumber.StartsWith("P-BOOK-")).ToListAsync();
            bookingPatientIds = bookingPatients.Select(p => p.Id).ToList();
        }

        // Act - Run 10 bookings and 10 completions concurrently
        var bookingTasks = bookingPatientIds.Select(async (patientId, index) =>
        {
            await Task.Yield();
            await using var context = CreateDbContext();

            return await sharedWriteLock.ExecuteAsync(async () =>
            {
                var currentMax = await context.Appointments
                    .Where(a => a.DoctorUserId == _doctor.Id &&
                                a.BusinessDate == _businessDate &&
                                a.QueueNumber != null &&
                                a.QueueNumber < 100)
                    .Select(a => (int?)a.QueueNumber)
                    .MaxAsync() ?? 0;

                var nextQueue = currentMax + 1;
                var appt = new Appointment
                {
                    DoctorUserId = _doctor.Id,
                    PatientId = patientId,
                    ServiceId = _service.Id,
                    BusinessDate = _businessDate,
                    QueueNumber = nextQueue,
                    Status = AppointmentStatus.Waiting,
                    CreatedAtUtc = DateTime.UtcNow
                };
                context.Appointments.Add(appt);
                await context.SaveChangesAsync();
                return nextQueue;
            });
        });

        var completionTasks = completionVisitIds.Select(async visitId =>
        {
            await Task.Yield();
            await using var context = CreateDbContext();
            var controller = CreateController(context, sharedWriteLock);

            return await controller.CompleteConsultation(visitId, new CompleteVisitRequestDto
            {
                Version = 1,
                Diagnosis = "كشف مكتمل بالتزامن"
            });
        });

        var allTasks = bookingTasks.Concat<Task>(completionTasks);
        var completedAll = Task.WhenAll(allTasks);

        // Assert - Finish within 10s without deadlocks
        var completedInTime = await Task.WhenAny(completedAll, Task.Delay(10000));
        completedInTime.Should().Be(completedAll, "Concurrent operations must complete within 10 seconds without deadlocking");

        // Verify Database
        await using var verifyContext = CreateDbContext();
        var bookedAppointments = await verifyContext.Appointments
            .Where(a => a.DoctorUserId == _doctor.Id && a.BusinessDate == _businessDate && a.QueueNumber < 100)
            .OrderBy(a => a.QueueNumber)
            .ToListAsync();

        bookedAppointments.Should().HaveCount(count);
        bookedAppointments.Select(a => a.QueueNumber!.Value).Should().Equal(Enumerable.Range(1, count));

        var completedVisits = await verifyContext.MedicalVisits
            .Where(v => completionVisitIds.Contains(v.Id))
            .ToListAsync();

        completedVisits.Should().HaveCount(count);
        completedVisits.Should().OnlyContain(v => !v.IsDraft && v.CompletedAtUtc != null);
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
