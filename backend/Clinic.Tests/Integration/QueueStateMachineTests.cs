using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Clinic.Api.Data;
using Clinic.Api.Entities;
using Clinic.Api.Common.Enums;
using Clinic.Api.Infrastructure;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class QueueStateMachineTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _doctor = null!;
    private readonly DateOnly _businessDate = new(2026, 11, 15);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_queue_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "queue_doc", PasswordHash = "h", FullName = "د. أحمد", Role = UserRole.Doctor };
        context.Users.Add(_doctor);
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

    [Fact]
    public async Task CallNext_ShouldSelectUrgentPatientsFirst_ThenOrderByQueueNumberAscending()
    {
        await using var context = CreateDbContext();
        using var bookingWriteLock = new BookingWriteLock();

        // Create 4 patients and appointments:
        // Appt 1: Queue #1, Regular
        // Appt 2: Queue #2, Regular
        // Appt 3: Queue #3, Urgent
        // Appt 4: Queue #4, Urgent
        var p1 = new Patient { FileNumber = "F-Q1", FullName = "مريض 1", Phone = "01000000001", Gender = PatientGender.Male };
        var p2 = new Patient { FileNumber = "F-Q2", FullName = "مريض 2", Phone = "01000000002", Gender = PatientGender.Male };
        var p3 = new Patient { FileNumber = "F-Q3", FullName = "مريض 3 عاجل", Phone = "01000000003", Gender = PatientGender.Male };
        var p4 = new Patient { FileNumber = "F-Q4", FullName = "مريض 4 عاجل", Phone = "01000000004", Gender = PatientGender.Male };
        context.Patients.AddRange(p1, p2, p3, p4);

        var service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف", Category = ServiceCategory.Exam, DefaultPricePiastres = 30000L };
        context.ServiceCatalogs.Add(service);
        await context.SaveChangesAsync();

        var a1 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p1.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 1, IsUrgent = false, Status = AppointmentStatus.Waiting };
        var a2 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p2.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 2, IsUrgent = false, Status = AppointmentStatus.Waiting };
        var a3 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p3.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 3, IsUrgent = true, Status = AppointmentStatus.Waiting };
        var a4 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p4.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 4, IsUrgent = true, Status = AppointmentStatus.Waiting };
        context.Appointments.AddRange(a1, a2, a3, a4);
        await context.SaveChangesAsync();

        // Function that simulates call-next logic
        async Task<Appointment?> CallNextDoctorAsync(long sequence)
        {
            return await bookingWriteLock.ExecuteAsync(async () =>
            {
                var nextAppt = await context.Appointments
                    .Include(a => a.Patient)
                    .Where(a => a.DoctorUserId == _doctor.Id && a.BusinessDate == _businessDate && a.Status == AppointmentStatus.Waiting)
                    .OrderByDescending(a => a.IsUrgent)
                    .ThenBy(a => a.QueueNumber)
                    .FirstOrDefaultAsync();

                if (nextAppt != null)
                {
                    nextAppt.Status = AppointmentStatus.WithDoctor;
                    nextAppt.CalledAtUtc = DateTime.UtcNow;
                    nextAppt.CallSequence = sequence;
                    await context.SaveChangesAsync();
                }

                return nextAppt;
            });
        }

        // Call 1: Must pick Appt 3 (Urgent, Queue #3)
        var call1 = await CallNextDoctorAsync(1);
        call1.Should().NotBeNull();
        call1!.Id.Should().Be(a3.Id);
        call1.IsUrgent.Should().BeTrue();
        call1.QueueNumber.Should().Be(3);
        call1.CallSequence.Should().Be(1);

        // Call 2: Must pick Appt 4 (Urgent, Queue #4)
        var call2 = await CallNextDoctorAsync(2);
        call2.Should().NotBeNull();
        call2!.Id.Should().Be(a4.Id);
        call2.IsUrgent.Should().BeTrue();
        call2.QueueNumber.Should().Be(4);
        call2.CallSequence.Should().Be(2);

        // Call 3: No more urgent! Must pick Appt 1 (Regular, Queue #1)
        var call3 = await CallNextDoctorAsync(3);
        call3.Should().NotBeNull();
        call3!.Id.Should().Be(a1.Id);
        call3.IsUrgent.Should().BeFalse();
        call3.QueueNumber.Should().Be(1);
        call3.CallSequence.Should().Be(3);

        // Call 4: Must pick Appt 2 (Regular, Queue #2)
        var call4 = await CallNextDoctorAsync(4);
        call4.Should().NotBeNull();
        call4!.Id.Should().Be(a2.Id);
        call4.IsUrgent.Should().BeFalse();
        call4.QueueNumber.Should().Be(2);

        // Call 5: All called! Should return null (no waiting patients)
        var call5 = await CallNextDoctorAsync(5);
        call5.Should().BeNull();
    }

    [Fact]
    public async Task SkipPatient_AndReturnFromSkip_ShouldPreserveOriginalQueueNumber()
    {
        await using var context = CreateDbContext();

        var patient = new Patient { FileNumber = "F-SKIP", FullName = "مريض تجاوز", Phone = "01099998888", Gender = PatientGender.Male };
        var service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف", Category = ServiceCategory.Exam, DefaultPricePiastres = 30000L };
        context.Patients.Add(patient);
        context.ServiceCatalogs.Add(service);
        await context.SaveChangesAsync();

        var appt = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = patient.Id,
            ServiceId = service.Id,
            BusinessDate = _businessDate,
            QueueNumber = 7,
            Status = AppointmentStatus.Waiting
        };
        context.Appointments.Add(appt);
        await context.SaveChangesAsync();

        // 1. Skip patient
        appt.Status = AppointmentStatus.Skipped;
        context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = AppointmentStatus.Waiting.ToString(),
            ToStatus = AppointmentStatus.Skipped.ToString(),
            ChangedByUserId = _doctor.Id,
            Reason = "المريض غير موجود بالاستراحة"
        });
        await context.SaveChangesAsync();

        appt.Status.Should().Be(AppointmentStatus.Skipped);

        // 2. Return from skip
        appt.Status = AppointmentStatus.Waiting;
        context.AppointmentStatusHistories.Add(new AppointmentStatusHistory
        {
            AppointmentId = appt.Id,
            FromStatus = AppointmentStatus.Skipped.ToString(),
            ToStatus = AppointmentStatus.Waiting.ToString(),
            ChangedByUserId = _doctor.Id,
            Reason = "حضر المريض إلى العيادة"
        });
        await context.SaveChangesAsync();

        appt.Status.Should().Be(AppointmentStatus.Waiting);
        appt.QueueNumber.Should().Be(7); // Preserved!

        var histories = await context.AppointmentStatusHistories.Where(h => h.AppointmentId == appt.Id).ToListAsync();
        histories.Should().HaveCount(2);
    }

    [Fact]
    public async Task RecallPatient_ShouldIncrementCallSequenceMonotonically()
    {
        await using var context = CreateDbContext();

        var patient = new Patient { FileNumber = "F-REC", FullName = "مريض استدعاء", Phone = "01077776666", Gender = PatientGender.Female };
        var service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف", Category = ServiceCategory.Exam, DefaultPricePiastres = 30000L };
        context.Patients.Add(patient);
        context.ServiceCatalogs.Add(service);
        await context.SaveChangesAsync();

        var appt = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = patient.Id,
            ServiceId = service.Id,
            BusinessDate = _businessDate,
            QueueNumber = 5,
            CallSequence = 10,
            Status = AppointmentStatus.WithDoctor
        };
        context.Appointments.Add(appt);
        await context.SaveChangesAsync();

        // Simulate Recall
        long maxSeq = await context.Appointments.MaxAsync(a => (long?)a.CallSequence) ?? 0;
        long nextSeq = maxSeq + 1;
        appt.CallSequence = nextSeq;
        appt.CalledAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();

        appt.CallSequence.Should().Be(11);
        appt.CallSequence.Should().BeGreaterThan(10);
    }

    [Fact]
    public async Task DoctorBreakToggle_ShouldSwitchBreakState()
    {
        await using var context = CreateDbContext();

        var setting = new ClinicSetting
        {
            Id = 1,
            ClinicName = "عيادة د. حازم القاضي",
            DoctorName = "د. حازم القاضي",
            IsDoctorOnBreak = false
        };
        context.ClinicSettings.Add(setting);
        await context.SaveChangesAsync();

        // Toggle 1 -> On break
        setting.IsDoctorOnBreak = !setting.IsDoctorOnBreak;
        await context.SaveChangesAsync();
        setting.IsDoctorOnBreak.Should().BeTrue();

        // Toggle 2 -> Back from break
        setting.IsDoctorOnBreak = !setting.IsDoctorOnBreak;
        await context.SaveChangesAsync();
        setting.IsDoctorOnBreak.Should().BeFalse();
    }

    [Fact]
    public async Task CallNext_WithIdenticalIdempotencyKey_ShouldReturnSameAppointmentWithoutAdvancingQueue()
    {
        await using var context = CreateDbContext();
        using var bookingWriteLock = new BookingWriteLock();

        var p1 = new Patient { FileNumber = "F-IDEM1", FullName = "مريض 1", Phone = "01000000010", Gender = PatientGender.Male };
        var p2 = new Patient { FileNumber = "F-IDEM2", FullName = "مريض 2", Phone = "01000000020", Gender = PatientGender.Male };
        context.Patients.AddRange(p1, p2);

        var service = new ServiceCatalog { Code = "EXAM_IDEM", NameAr = "كشف", Category = ServiceCategory.Exam, DefaultPricePiastres = 30000L };
        context.ServiceCatalogs.Add(service);
        await context.SaveChangesAsync();

        var a1 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p1.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 1, Status = AppointmentStatus.Waiting };
        var a2 = new Appointment { DoctorUserId = _doctor.Id, PatientId = p2.Id, ServiceId = service.Id, BusinessDate = _businessDate, QueueNumber = 2, Status = AppointmentStatus.Waiting };
        context.Appointments.AddRange(a1, a2);
        await context.SaveChangesAsync();

        string idempotencyKey = "call-idem-uuid-999";

        // CallNext method implementing idempotency check
        async Task<(int AppointmentId, long CallSequence, AppointmentStatus Status)> CallNextWithIdempotencyAsync(string? idemKey)
        {
            return await bookingWriteLock.ExecuteAsync(async () =>
            {
                if (!string.IsNullOrEmpty(idemKey))
                {
                    var existing = await context.Appointments
                        .FirstOrDefaultAsync(a => a.BusinessDate == _businessDate &&
                            (a.CallIdempotencyKey == idemKey || a.IdempotencyKey == idemKey));

                    if (existing != null)
                    {
                        return (existing.Id, existing.CallSequence, existing.Status);
                    }
                }

                var currentActive = await context.Appointments
                    .Where(a => a.DoctorUserId == _doctor.Id && a.BusinessDate == _businessDate && a.Status == AppointmentStatus.WithDoctor)
                    .ToListAsync();
                foreach (var active in currentActive)
                {
                    active.Status = AppointmentStatus.Completed;
                    active.CompletedAtUtc = DateTime.UtcNow;
                }

                var nextAppt = await context.Appointments
                    .Where(a => a.DoctorUserId == _doctor.Id && a.BusinessDate == _businessDate && a.Status == AppointmentStatus.Waiting)
                    .OrderByDescending(a => a.IsUrgent)
                    .ThenBy(a => a.QueueNumber)
                    .FirstOrDefaultAsync();

                if (nextAppt == null) throw new InvalidOperationException("No waiting patients");

                long maxSeq = await context.Appointments.MaxAsync(a => (long?)a.CallSequence) ?? 0;
                long nextSeq = maxSeq + 1;

                nextAppt.Status = AppointmentStatus.WithDoctor;
                nextAppt.CalledAtUtc = DateTime.UtcNow;
                nextAppt.CallSequence = nextSeq;
                if (!string.IsNullOrEmpty(idemKey))
                {
                    nextAppt.CallIdempotencyKey = idemKey;
                }

                await context.SaveChangesAsync();
                return (nextAppt.Id, nextAppt.CallSequence, nextAppt.Status);
            });
        }

        // First call with IdempotencyKey
        var call1 = await CallNextWithIdempotencyAsync(idempotencyKey);
        call1.AppointmentId.Should().Be(a1.Id);
        call1.CallSequence.Should().Be(1);
        call1.Status.Should().Be(AppointmentStatus.WithDoctor);

        // Second call with SAME IdempotencyKey (replay)
        var call2 = await CallNextWithIdempotencyAsync(idempotencyKey);
        call2.AppointmentId.Should().Be(a1.Id);
        call2.CallSequence.Should().Be(1);
        call2.Status.Should().Be(AppointmentStatus.WithDoctor);

        // Verify database state: Patient 1 is still WithDoctor, Patient 2 is still Waiting!
        await using var verifyCtx = CreateDbContext();
        var p1Db = await verifyCtx.Appointments.FindAsync(a1.Id);
        var p2Db = await verifyCtx.Appointments.FindAsync(a2.Id);

        p1Db!.Status.Should().Be(AppointmentStatus.WithDoctor);
        p1Db.CallSequence.Should().Be(1);
        p1Db.CallIdempotencyKey.Should().Be(idempotencyKey);

        p2Db!.Status.Should().Be(AppointmentStatus.Waiting);
        p2Db.CallSequence.Should().Be(0);
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
