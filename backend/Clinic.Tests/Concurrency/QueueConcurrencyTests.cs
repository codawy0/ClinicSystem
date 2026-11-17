using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Concurrency;

[Trait("Category", "Concurrency")]
public class QueueConcurrencyTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private int _doctorUserId;
    private int _serviceId;
    private int[] _patientIds = Array.Empty<int>();
    private readonly DateOnly _businessDate = new(2026, 11, 15);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_test_queue_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        // 1. Enable WAL mode on startup and create database schema
        await using (var conn = new SqliteConnection(_connectionString))
        {
            await conn.OpenAsync();
            await using var walCmd = conn.CreateCommand();
            walCmd.CommandText = "PRAGMA journal_mode = WAL;";
            await walCmd.ExecuteNonQueryAsync();
        }

        // 2. Build DbContext with SqlitePragmaInterceptor
        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        // 3. Seed required doctor, service, and 30 patients
        var doctor = new User
        {
            Username = "test_doctor",
            PasswordHash = "hash",
            FullName = "د. اختبار التزامن",
            Role = UserRole.Doctor,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Users.Add(doctor);

        var service = new ServiceCatalog
        {
            Code = "TEST_EXAM",
            NameAr = "كشف تجريبي",
            Category = ServiceCategory.Exam,
            DefaultPricePiastres = 30000L,
            IsActive = true
        };
        context.ServiceCatalogs.Add(service);

        var patients = Enumerable.Range(1, 30).Select(i => new Patient
        {
            FileNumber = $"F-TEST-{i:D3}",
            FullName = $"مريض تجريبي {i}",
            SearchName = $"مريض تجريبي {i}",
            Phone = $"0109999{i:D4}",
            NormalizedPhone = $"0109999{i:D4}",
            Gender = PatientGender.Male,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        }).ToList();

        context.Patients.AddRange(patients);
        await context.SaveChangesAsync();

        _doctorUserId = doctor.Id;
        _serviceId = service.Id;
        _patientIds = patients.Select(p => p.Id).ToArray();
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
    public async Task AssignQueueNumbers_With30ParallelTasksAndBookingWriteLock_ShouldAssignExactGapless1To30WithoutSqliteBusy()
    {
        // Arrange
        const int concurrentTasksCount = 30;
        using var bookingWriteLock = new BookingWriteLock();

        // Act - Dispatch 30 parallel concurrent booking requests
        var tasks = Enumerable.Range(0, concurrentTasksCount).Select(async i =>
        {
            await Task.Yield(); // Force async threadpool dispatch

            await using var context = CreateDbContext();

            // Critical sequential lane protected by BookingWriteLock
            return await bookingWriteLock.ExecuteAsync(async () =>
            {
                // Calculate next queue number atomically inside lock
                var currentMax = await context.Appointments
                    .Where(a => a.DoctorUserId == _doctorUserId &&
                                a.BusinessDate == _businessDate &&
                                a.QueueNumber != null)
                    .Select(a => (int?)a.QueueNumber)
                    .MaxAsync() ?? 0;

                var nextQueueNumber = currentMax + 1;

                var appointment = new Appointment
                {
                    DoctorUserId = _doctorUserId,
                    PatientId = _patientIds[i],
                    ServiceId = _serviceId,
                    BusinessDate = _businessDate,
                    QueueNumber = nextQueueNumber,
                    BookingType = BookingType.WalkIn,
                    Status = AppointmentStatus.Waiting,
                    ArrivedAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    Version = 1
                };

                context.Appointments.Add(appointment);
                await context.SaveChangesAsync();

                return nextQueueNumber;
            });
        });

        var assignedQueueNumbers = await Task.WhenAll(tasks);

        // Assert 1: Exactly 30 results returned
        assignedQueueNumbers.Should().HaveCount(30);

        // Assert 2: All 30 numbers are distinct (no duplicates)
        assignedQueueNumbers.Distinct().Should().HaveCount(30);

        // Assert 3: Sequence is exactly 1..30 (gapless)
        assignedQueueNumbers.OrderBy(n => n).Should().Equal(Enumerable.Range(1, 30));

        // Assert 4: Verify directly from database with a fresh context
        await using var verifyContext = CreateDbContext();
        var committedAppointments = await verifyContext.Appointments
            .Where(a => a.DoctorUserId == _doctorUserId && a.BusinessDate == _businessDate)
            .OrderBy(a => a.QueueNumber)
            .ToListAsync();

        committedAppointments.Should().HaveCount(30);
        committedAppointments.Select(a => a.QueueNumber!.Value)
            .Should().Equal(Enumerable.Range(1, 30));
    }

    [Fact]
    public async Task BookAppointment_With30ParallelTasksUnderSameCashierShift_ShouldSucceedWithoutConcurrencyException()
    {
        const int concurrentTasksCount = 30;
        using var bookingWriteLock = new BookingWriteLock();

        // Create a receptionist and an open shift
        await using (var seedCtx = CreateDbContext())
        {
            var rec = new User
            {
                Username = "shared_receptionist",
                PasswordHash = "hash",
                FullName = "موظف الاستقبال المشترك",
                Role = UserRole.Receptionist,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            };
            seedCtx.Users.Add(rec);
            await seedCtx.SaveChangesAsync();

            var shift = new Shift
            {
                UserId = rec.Id,
                BusinessDate = _businessDate,
                OpeningBalancePiastres = 10_000L,
                ExpectedClosingCashPiastres = 10_000L,
                IsClosed = false,
                Version = 1,
                OpenedAtUtc = DateTime.UtcNow
            };
            seedCtx.Shifts.Add(shift);
            await seedCtx.SaveChangesAsync();
        }

        int shiftId;
        await using (var fetchCtx = CreateDbContext())
        {
            var shift = await fetchCtx.Shifts.FirstAsync(s => !s.IsClosed);
            shiftId = shift.Id;
        }

        var tasks = Enumerable.Range(0, concurrentTasksCount).Select(async i =>
        {
            await Task.Yield();
            await using var context = CreateDbContext();

            // 1. Shift guard pre-check (AsNoTracking outside lock, as done in AppointmentsController)
            var preCheckShift = await context.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId && !s.IsClosed);
            preCheckShift.Should().NotBeNull();

            // 2. Perform atomic booking under BookingWriteLock
            return await bookingWriteLock.ExecuteAsync(async () =>
            {
                // Re-query shift inside lock
                var activeShift = await context.Shifts.FirstAsync(s => s.Id == shiftId);
                activeShift.IsClosed.Should().BeFalse();

                var currentMax = await context.Appointments
                    .Where(a => a.DoctorUserId == _doctorUserId && a.BusinessDate == _businessDate && a.QueueNumber != null)
                    .Select(a => (int?)a.QueueNumber)
                    .MaxAsync() ?? 0;

                var nextQueue = currentMax + 1;

                var appointment = new Appointment
                {
                    DoctorUserId = _doctorUserId,
                    PatientId = _patientIds[i],
                    ServiceId = _serviceId,
                    BusinessDate = _businessDate,
                    QueueNumber = nextQueue,
                    BookingType = BookingType.WalkIn,
                    Status = AppointmentStatus.Waiting,
                    ArrivedAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    Version = 1
                };
                context.Appointments.Add(appointment);

                var invoice = new Invoice
                {
                    Appointment = appointment,
                    PatientId = _patientIds[i],
                    TotalPiastres = 30_000L,
                    NetTotalPiastres = 30_000L,
                    PaidPiastres = 30_000L,
                    Status = InvoiceStatus.Paid,
                    CreatedAtUtc = DateTime.UtcNow,
                    Version = 1
                };
                context.Invoices.Add(invoice);

                var transaction = new FinancialTransaction
                {
                    ShiftId = activeShift.Id,
                    Invoice = invoice,
                    Type = TransactionType.Payment,
                    PaymentMethod = PaymentMethod.Cash,
                    AmountPiastres = 30_000L,
                    Description = $"كشف نقدي {i}",
                    CreatedByUserId = activeShift.UserId,
                    CreatedAtUtc = DateTime.UtcNow
                };
                context.FinancialTransactions.Add(transaction);

                // Mutate shift cash balance inside lock
                activeShift.ExpectedClosingCashPiastres += 30_000L;

                await context.SaveChangesAsync();
                return nextQueue;
            });
        });

        var results = await Task.WhenAll(tasks);

        results.Should().HaveCount(30);
        results.Distinct().Should().HaveCount(30);
        results.OrderBy(n => n).Should().Equal(Enumerable.Range(1, 30));

        await using var verifyCtx = CreateDbContext();
        var finalShift = await verifyCtx.Shifts.FirstAsync(s => s.Id == shiftId);
        finalShift.ExpectedClosingCashPiastres.Should().Be(10_000L + (30 * 30_000L));
        finalShift.Version.Should().Be(31); // 1 initial + 30 updates
    }

    public async Task DisposeAsync()
    {
        // Cleanup SQLite connection pools and temporary test files
        SqliteConnection.ClearAllPools();

        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            var walPath = _dbFilePath + "-wal";
            var shmPath = _dbFilePath + "-shm";
            if (File.Exists(walPath)) File.Delete(walPath);
            if (File.Exists(shmPath)) File.Delete(shmPath);
        }
        catch
        {
            // Ignore cleanup lock issues on test completion
        }

        await Task.CompletedTask;
    }
}
