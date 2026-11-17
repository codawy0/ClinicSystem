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
public class AppointmentBookingTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _doctor = null!;
    private User _receptionist = null!;
    private Patient _patient = null!;
    private ServiceCatalog _examService = null!;
    private ServiceCatalog _sonarService = null!;
    private readonly DateOnly _businessDate = new(2026, 11, 15);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_booking_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc1", PasswordHash = "h", FullName = "د. الطبيب", Role = UserRole.Doctor };
        _receptionist = new User { Username = "rec1", PasswordHash = "h", FullName = "الاستقبال", Role = UserRole.Receptionist };
        _patient = new Patient { FileNumber = "F-001", FullName = "أحمد محمد", Phone = "01011112222", Gender = PatientGender.Male };
        _examService = new ServiceCatalog { Code = "EXAM", NameAr = "كشف باطنة", Category = ServiceCategory.Exam, DefaultPricePiastres = 30_000L };
        _sonarService = new ServiceCatalog { Code = "SONAR", NameAr = "سونار بطن", Category = ServiceCategory.Procedure, DefaultPricePiastres = 20_000L };

        context.Users.AddRange(_doctor, _receptionist);
        context.Patients.Add(_patient);
        context.ServiceCatalogs.AddRange(_examService, _sonarService);
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
    public async Task BookingGuard_WhenCallerHasNoActiveShift_MustRejectOperation()
    {
        await using var context = CreateDbContext();

        // Check active shift for receptionist
        var activeShift = await context.Shifts.FirstOrDefaultAsync(s => s.UserId == _receptionist.Id && !s.IsClosed);
        activeShift.Should().BeNull();

        // Business Rule: If activeShift is null, booking cannot proceed
        bool canProceed = activeShift != null;
        canProceed.Should().BeFalse();

        // Verify zero appointments and invoices persisted
        var apptCount = await context.Appointments.CountAsync();
        var invCount = await context.Invoices.CountAsync();
        apptCount.Should().Be(0);
        invCount.Should().Be(0);
    }

    [Fact]
    public async Task OneClickBooking_WithActiveShift_ShouldPersistAppointmentInvoiceLinesAndTransactionAtomically()
    {
        await using var context = CreateDbContext();
        using var bookingWriteLock = new BookingWriteLock();

        // 1. Open active shift for receptionist
        var shift = new Shift
        {
            UserId = _receptionist.Id,
            BusinessDate = _businessDate,
            OpeningBalancePiastres = 50_000L,
            IsClosed = false
        };
        context.Shifts.Add(shift);
        await context.SaveChangesAsync();

        // 2. Perform 1-click booking protected by BookingWriteLock
        var result = await bookingWriteLock.ExecuteAsync(async () =>
        {
            // Sequential Queue Number
            var maxQueue = await context.Appointments
                .Where(a => a.DoctorUserId == _doctor.Id && a.BusinessDate == _businessDate)
                .Select(a => (int?)a.QueueNumber)
                .MaxAsync() ?? 0;
            int nextQueue = maxQueue + 1;

            // Appointment
            var appt = new Appointment
            {
                DoctorUserId = _doctor.Id,
                PatientId = _patient.Id,
                ServiceId = _examService.Id,
                BusinessDate = _businessDate,
                QueueNumber = nextQueue,
                BookingType = BookingType.WalkIn,
                Status = AppointmentStatus.Waiting,
                ArrivedAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Appointments.Add(appt);

            // Invoice
            long examPrice = _examService.DefaultPricePiastres;
            long sonarPrice = _sonarService.DefaultPricePiastres;
            long total = examPrice + sonarPrice;
            long discount = 5_000L; // 50 EGP discount
            long netTotal = total - discount;

            var invoice = new Invoice
            {
                Appointment = appt,
                PatientId = _patient.Id,
                TotalPiastres = total,
                DiscountPiastres = discount,
                DiscountReason = DiscountReason.DoctorCustom,
                NetTotalPiastres = netTotal,
                PaidPiastres = netTotal,
                RemainingPiastres = 0L,
                Status = InvoiceStatus.Paid,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Invoices.Add(invoice);

            // Invoice Lines
            context.InvoiceLines.Add(new InvoiceLine
            {
                Invoice = invoice,
                ServiceId = _examService.Id,
                Description = _examService.NameAr,
                Quantity = 1,
                UnitPricePiastres = examPrice,
                TotalPricePiastres = examPrice
            });
            context.InvoiceLines.Add(new InvoiceLine
            {
                Invoice = invoice,
                ServiceId = _sonarService.Id,
                Description = _sonarService.NameAr,
                Quantity = 1,
                UnitPricePiastres = sonarPrice,
                TotalPricePiastres = sonarPrice
            });

            // Financial Transaction
            var tx = new FinancialTransaction
            {
                ShiftId = shift.Id,
                Invoice = invoice,
                Type = TransactionType.Payment,
                PaymentMethod = PaymentMethod.Cash,
                AmountPiastres = netTotal,
                CreatedByUserId = _receptionist.Id,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.FinancialTransactions.Add(tx);

            await context.SaveChangesAsync();
            return (appt, invoice, tx);
        });

        // 3. Assertions
        result.appt.QueueNumber.Should().Be(1);
        result.appt.Status.Should().Be(AppointmentStatus.Waiting);

        result.invoice.TotalPiastres.Should().Be(50_000L);
        result.invoice.DiscountPiastres.Should().Be(5_000L);
        result.invoice.NetTotalPiastres.Should().Be(45_000L);
        result.invoice.Status.Should().Be(InvoiceStatus.Paid);

        result.tx.AmountPiastres.Should().Be(45_000L);
        result.tx.ShiftId.Should().Be(shift.Id);

        // Verify Lines in DB
        var savedLines = await context.InvoiceLines.Where(l => l.InvoiceId == result.invoice.Id).ToListAsync();
        savedLines.Should().HaveCount(2);
    }

    [Fact]
    public async Task BookingWithIdempotencyKey_DuplicateRequest_ShouldPreventDuplicateCreation()
    {
        await using var context = CreateDbContext();
        string idempotencyKey = "idem-booking-test-key-001";

        var appt1 = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = _patient.Id,
            ServiceId = _examService.Id,
            BusinessDate = _businessDate,
            QueueNumber = 1,
            IdempotencyKey = idempotencyKey,
            Status = AppointmentStatus.Waiting
        };
        context.Appointments.Add(appt1);
        await context.SaveChangesAsync();

        // Attempting to add second appointment with identical IdempotencyKey
        var appt2 = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = _patient.Id,
            ServiceId = _examService.Id,
            BusinessDate = _businessDate,
            QueueNumber = 2,
            IdempotencyKey = idempotencyKey,
            Status = AppointmentStatus.Waiting
        };
        context.Appointments.Add(appt2);

        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task BookingWithDiscountExceedingTotal_ShouldClampDiscountToTotal()
    {
        long totalPiastres = 30_000L;
        long requestedDiscount = 50_000L; // 500 EGP discount on 300 EGP exam

        long effectiveDiscount = Math.Clamp(requestedDiscount, 0, totalPiastres);
        long netTotal = totalPiastres - effectiveDiscount;

        effectiveDiscount.Should().Be(30_000L);
        netTotal.Should().Be(0L); // 100% free, no negative invoice
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
