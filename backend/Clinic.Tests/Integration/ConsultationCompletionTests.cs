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

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class ConsultationCompletionTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    private User _doctor = null!;
    private Patient _patient = null!;
    private ServiceCatalog _service = null!;
    private Appointment _appointment = null!;
    private MedicalVisit _visit = null!;
    private Drug _augmentin = null!;

    private readonly IBookingWriteLock _bookingWriteLock = new BookingWriteLock();
    private readonly DateOnly _businessDate = new(2026, 11, 16);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_consultcomplete_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc_cockpit", PasswordHash = "h", FullName = "د. حازم القاضي", Role = UserRole.Doctor };
        _patient = new Patient { FileNumber = "P-COMP-1", FullName = "ماجد عبد الله", Phone = "01055667788", Gender = PatientGender.Male };
        _service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف باطنة", Category = ServiceCategory.Exam, DefaultPricePiastres = 30_000L };

        context.Users.Add(_doctor);
        context.Patients.Add(_patient);
        context.ServiceCatalogs.Add(_service);
        await context.SaveChangesAsync();

        _appointment = new Appointment
        {
            DoctorUserId = _doctor.Id,
            PatientId = _patient.Id,
            ServiceId = _service.Id,
            BusinessDate = _businessDate,
            QueueNumber = 1,
            Status = AppointmentStatus.WithDoctor,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Appointments.Add(_appointment);
        await context.SaveChangesAsync();

        _visit = new MedicalVisit
        {
            AppointmentId = _appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = true,
            Version = 1,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.MedicalVisits.Add(_visit);

        _augmentin = new Drug
        {
            TradeName = "Augmentin 1g",
            ActiveIngredient = "amoxicillin",
            Strength = "1g",
            Form = DrugForm.Tablet,
            Category = "Antibiotic",
            AvoidInPregnancy = false,
            AvoidInLactation = false,
            PregnancyCategory = "B"
        };
        context.Drugs.Add(_augmentin);

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

    private MedicalVisitsController CreateController(ClinicDbContext context, TestQueueHubContext hubContext)
    {
        return new MedicalVisitsController(
            context,
            new BusinessDateService(),
            _bookingWriteLock,
            hubContext,
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
    public async Task CompleteConsultation_WithPrescriptionsAndRequests_ShouldTransitionStatusAndSaveSnapshots()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            ChiefComplaint = "احتقان شديد بالحلق مع حرارة",
            Examination = "التهاب اللوزتين مع وجود صديد",
            Diagnosis = "التهاب لوزتين حاد (Acute Tonsillitis)",
            Icd10Code = "J03.9",
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new()
                {
                    DrugId = _augmentin.Id,
                    DrugName = "Augmentin 1g",
                    ActiveIngredient = "amoxicillin",
                    Strength = "1g",
                    Form = "Tablet",
                    Dosage = "قرص كل 12 ساعة",
                    Timing = "بعد الأكل",
                    Duration = "7 أيام",
                    Notes = "إكمال الكورس العلاجي بالكامل"
                }
            },
            ClinicalRequests = new List<CompleteVisitClinicalRequestDto>
            {
                new()
                {
                    RequestType = RequestType.Lab,
                    CatalogCode = "CBC",
                    NameAr = "صورة دم كاملة",
                    NameEn = "Complete Blood Picture"
                }
            }
        };

        var response = await controller.CompleteConsultation(_visit.Id, request);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<MedicalVisitDetailDto>().Subject;

        dto.IsDraft.Should().BeFalse();
        dto.CompletedAtUtc.Should().NotBeNull();
        dto.Version.Should().Be(2);
        dto.PrescriptionItems.Should().HaveCount(1);
        dto.PrescriptionItems[0].DrugNameSnapshot.Should().Be("Augmentin 1g");
        dto.PrescriptionItems[0].ActiveIngredientSnapshot.Should().Be("amoxicillin");
        dto.ClinicalRequests.Should().HaveCount(1);
        dto.ClinicalRequests[0].NameAr.Should().Be("صورة دم كاملة");

        // Verify Database state
        var visitInDb = await context.MedicalVisits.FindAsync(_visit.Id);
        visitInDb!.IsDraft.Should().BeFalse();
        visitInDb.CompletedAtUtc.Should().NotBeNull();
        visitInDb.Version.Should().Be(2);

        var apptInDb = await context.Appointments.FindAsync(_appointment.Id);
        apptInDb!.Status.Should().Be(AppointmentStatus.Completed);
        apptInDb.CompletedAtUtc.Should().NotBeNull();

        var history = await context.AppointmentStatusHistories
            .FirstOrDefaultAsync(h => h.AppointmentId == _appointment.Id && h.ToStatus == AppointmentStatus.Completed.ToString());
        history.Should().NotBeNull();

        hubContext.TestClient.QueueUpdatedEvents.Should().NotBeEmpty();
    }

    [Fact]
    public async Task FrozenDrugSnapshotImmutability_WhenDrugEntityIsMutatedInDatabase_PrescriptionItemMustRemainUnaltered()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "Tonsillitis",
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new()
                {
                    DrugId = _augmentin.Id,
                    DrugName = "Augmentin 1g",
                    ActiveIngredient = "amoxicillin",
                    Strength = "1g",
                    Form = "Tablet",
                    Dosage = "قرص كل 12 ساعة",
                    Timing = "بعد الأكل",
                    Duration = "7 أيام"
                }
            }
        };

        var response = await controller.CompleteConsultation(_visit.Id, request);
        response.Result.Should().BeOfType<OkObjectResult>();

        // Now maliciously mutate or update the Drug catalog entity
        var drugInDb = await context.Drugs.FindAsync(_augmentin.Id);
        drugInDb!.TradeName = "Augmentin XR 1500mg";
        drugInDb.ActiveIngredient = "clavulanate modified";
        drugInDb.Strength = "1500mg";
        drugInDb.IsDiscontinued = true;
        await context.SaveChangesAsync();

        // Query the PrescriptionItem freshly with AsNoTracking
        var rxItem = await context.PrescriptionItems
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.MedicalVisitId == _visit.Id);

        rxItem.Should().NotBeNull();
        rxItem!.DrugNameSnapshot.Should().Be("Augmentin 1g", "Snapshot trade name must remain permanently immutable");
        rxItem.ActiveIngredientSnapshot.Should().Be("amoxicillin", "Snapshot active ingredient must remain permanently immutable");
        rxItem.StrengthSnapshot.Should().Be("1g", "Snapshot strength must remain permanently immutable");
    }

    [Fact]
    public async Task CompleteConsultation_IdempotentReplay_SubsequentCallsMustReturnSuccessWithoutDuplicatingItems()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "Bronchitis",
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new() { DrugId = _augmentin.Id, DrugName = "Augmentin 1g", Dosage = "1 tab", Timing = "Bid", Duration = "5d" }
            },
            ClinicalRequests = new List<CompleteVisitClinicalRequestDto>
            {
                new() { RequestType = RequestType.Lab, NameAr = "تحليل دم" }
            }
        };

        // First call
        var firstResponse = await controller.CompleteConsultation(_visit.Id, request);
        firstResponse.Result.Should().BeOfType<OkObjectResult>();

        // Replay call (e.g. network retry or double click)
        var replayResponse = await controller.CompleteConsultation(_visit.Id, request);
        var okReplay = replayResponse.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okReplay.Value.Should().BeOfType<MedicalVisitDetailDto>().Subject;

        dto.IsDraft.Should().BeFalse();

        var rxCount = await context.PrescriptionItems.CountAsync(p => p.MedicalVisitId == _visit.Id);
        rxCount.Should().Be(1, "Prescription items must not be duplicated on replay");

        var crCount = await context.ClinicalRequestItems.CountAsync(c => c.MedicalVisitId == _visit.Id);
        crCount.Should().Be(1, "Clinical request items must not be duplicated on replay");

        var completionHistoryCount = await context.AppointmentStatusHistories
            .CountAsync(h => h.AppointmentId == _appointment.Id && h.ToStatus == AppointmentStatus.Completed.ToString());
        completionHistoryCount.Should().Be(1);
    }

    [Fact]
    public async Task CompleteConsultation_StaleVersion_ShouldReturn409Conflict()
    {
        await using var context = CreateDbContext();

        // Advance version of visit to 2 to simulate concurrent modification
        var visitInDb = await context.MedicalVisits.FindAsync(_visit.Id);
        visitInDb!.Examination = "Updated concurrently";
        await context.SaveChangesAsync();

        visitInDb.Version.Should().Be(2);

        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        // Client attempts to complete with stale version = 1
        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "Stale attempt"
        };

        var response = await controller.CompleteConsultation(_visit.Id, request);
        var problem = response.Result.Should().BeOfType<ObjectResult>().Subject;
        problem.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var visitCheck = await context.MedicalVisits.FindAsync(_visit.Id);
        visitCheck!.IsDraft.Should().BeTrue();
    }

    [Fact]
    public async Task CompleteConsultation_WithWarningOverride_ShouldPersistOverrideReasonAndFlag()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var request = new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "Infection with known allergy override",
            PrescriptionItems = new List<CompleteVisitPrescriptionItemDto>
            {
                new()
                {
                    DrugId = _augmentin.Id,
                    DrugName = "Augmentin 1g",
                    Dosage = "قرص كل 12 ساعة",
                    Timing = "بعد الأكل",
                    Duration = "7 أيام",
                    WarningOverridden = true,
                    OverrideReason = "فحص الحساسية واختبار الجلد سلبي"
                }
            }
        };

        var response = await controller.CompleteConsultation(_visit.Id, request);
        response.Result.Should().BeOfType<OkObjectResult>();

        var rxItem = await context.PrescriptionItems.FirstOrDefaultAsync(p => p.MedicalVisitId == _visit.Id);
        rxItem.Should().NotBeNull();
        rxItem!.WarningOverridden.Should().BeTrue();
        rxItem.OverrideReason.Should().Be("فحص الحساسية واختبار الجلد سلبي");
    }

    [Fact]
    public async Task PostCompletion_ImmutabilityGuards_VitalsAndDraftUpdatesMustBeRejected()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        // 1. Complete consultation
        await controller.CompleteConsultation(_visit.Id, new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "Completed condition"
        });

        // 2. Attempt PUT /api/visits/{id}/vitals
        var vitalsResponse = await controller.UpdateVitals(_visit.Id, new UpdateVitalsRequestDto
        {
            Version = 2,
            BpSystolic = 120,
            BpDiastolic = 80
        });
        var vitalsProblem = vitalsResponse.Result.Should().BeOfType<ObjectResult>().Subject;
        vitalsProblem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        // 3. Attempt PUT /api/visits/{id}/draft
        var draftResponse = await controller.AutosaveDraftNotes(_visit.Id, new AutosaveDraftNotesRequestDto
        {
            Version = 2,
            Diagnosis = "Attempted edit"
        });
        var draftProblem = draftResponse.Result.Should().BeOfType<ObjectResult>().Subject;
        draftProblem.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        // 4. Attempt POST /api/visits/{id}/addenda -> SHOULD SUCCEED
        var addendumResponse = await controller.AddAddendum(_visit.Id, new CreateAddendumRequestDto
        {
            NoteText = "ملاحظة إلحاقية قانونية مسموحة بعد إغلاق الكشف"
        });
        addendumResponse.Result.Should().BeOfType<CreatedAtActionResult>();
    }

    [Fact]
    public async Task CompleteConsultation_WithNonExistentVisit_ShouldReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var response = await controller.CompleteConsultation(99999, new CompleteVisitRequestDto { Version = 1 });
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CompleteConsultation_WithoutPrescriptionsOrRequests_ShouldCompleteSuccessfully()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = CreateController(context, hubContext);

        var response = await controller.CompleteConsultation(_visit.Id, new CompleteVisitRequestDto
        {
            Version = 1,
            Diagnosis = "صداع توتري بدون أدوية موصوفة",
            Examination = "فحص عصبي سليم"
        });

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<MedicalVisitDetailDto>().Subject;

        dto.IsDraft.Should().BeFalse();
        dto.PrescriptionItems.Should().BeEmpty();
        dto.ClinicalRequests.Should().BeEmpty();

        var appt = await context.Appointments.FindAsync(_appointment.Id);
        appt!.Status.Should().Be(AppointmentStatus.Completed);
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
