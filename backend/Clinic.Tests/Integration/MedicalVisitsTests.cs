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
using Clinic.Api.Models.Appointments;
using Clinic.Api.Models.MedicalVisits;
using Clinic.Tests.Helpers;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class MedicalVisitsTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _doctor = null!;
    private User _nurse = null!;
    private Patient _patient = null!;
    private ServiceCatalog _service = null!;
    private Appointment _appointment = null!;
    private readonly DateOnly _businessDate = new(2026, 11, 16);

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_visits_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor = new User { Username = "doc_emr", PasswordHash = "h", FullName = "د. طبيب تجريبي", Role = UserRole.Doctor };
        _nurse = new User { Username = "nurse_emr", PasswordHash = "h", FullName = "ممرضة الاستقبال", Role = UserRole.Nurse };
        _patient = new Patient { FileNumber = "F-VISIT-1", FullName = "محمد نبيل عيادة", Phone = "01099887766", Gender = PatientGender.Male };
        _service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف باطنة", Category = ServiceCategory.Exam, DefaultPricePiastres = 30_000L };

        context.Users.AddRange(_doctor, _nurse);
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
            Status = AppointmentStatus.Waiting,
            BookingType = BookingType.WalkIn,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Appointments.Add(_appointment);
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

    private static ControllerContext CreateControllerContext(int userId, string username, string role)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Fact]
    public async Task InitOrGetVisit_WhenVisitDoesNotExist_ShouldCreateDraftAndTransitionAppointmentToInNursing()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), hubContext, NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };

        var result = await controller.InitOrGetVisit(new InitVisitRequestDto { AppointmentId = _appointment.Id });

        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var visitDto = okResult.Value.Should().BeOfType<MedicalVisitDetailDto>().Subject;
        visitDto.AppointmentId.Should().Be(_appointment.Id);
        visitDto.PatientId.Should().Be(_patient.Id);
        visitDto.IsDraft.Should().BeTrue();
        visitDto.Version.Should().Be(1);

        // Verify Appointment transitioned to InNursing
        var updatedAppt = await context.Appointments.FirstAsync(a => a.Id == _appointment.Id);
        updatedAppt.Status.Should().Be(AppointmentStatus.InNursing);
    }

    [Fact]
    public async Task SaveVitals_WithNormalReadings_ShouldCalculateBmiAndBroadcastSignalREventWithoutAlerts()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), hubContext, NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };

        var initRes = await controller.InitOrGetVisit(new InitVisitRequestDto { AppointmentId = _appointment.Id });
        var visitId = ((OkObjectResult)initRes.Result!).Value.As<MedicalVisitDetailDto>().Id;

        var request = new UpdateVitalsRequestDto
        {
            BpSystolic = 120,
            BpDiastolic = 80,
            PulseBpm = 72,
            TempCelsius = 37.0m,
            BloodSugarMgDl = 100,
            BloodSugarType = BloodSugarType.Random,
            Spo2Pct = 98,
            WeightKg = 70.0m,
            HeightCm = 175.0m,
            NurseNotes = "حالة عامة مستقرة",
            Version = 1
        };

        var updateRes = await controller.UpdateVitals(visitId, request);
        var okResult = updateRes.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<MedicalVisitDetailDto>().Subject;

        dto.BpSystolic.Should().Be(120);
        dto.BpDiastolic.Should().Be(80);
        dto.PulseBpm.Should().Be(72);
        dto.TempCelsius.Should().Be(37.0m);
        dto.BloodSugarMgDl.Should().Be(100);
        dto.Spo2Pct.Should().Be(98);
        dto.WeightKg.Should().Be(70.0m);
        dto.HeightCm.Should().Be(175.0m);
        dto.Bmi.Should().BeApproximately(22.86m, 0.05m);

        // Alerts should all be false
        dto.Alerts.IsBpHigh.Should().BeFalse();
        dto.Alerts.IsBpLow.Should().BeFalse();
        dto.Alerts.IsPulseHigh.Should().BeFalse();
        dto.Alerts.IsPulseLow.Should().BeFalse();
        dto.Alerts.IsTempHigh.Should().BeFalse();
        dto.Alerts.IsTempLow.Should().BeFalse();
        dto.Alerts.IsGlucoseHigh.Should().BeFalse();
        dto.Alerts.IsGlucoseLow.Should().BeFalse();
        dto.Alerts.IsSpo2Low.Should().BeFalse();

        // SignalR broadcast verification
        hubContext.TestClient.VitalsUpdatedEvents.Should().ContainSingle(e => e.AppointmentId == _appointment.Id && e.PatientId == _patient.Id);
    }

    [Theory]
    [InlineData(140, 85, 75, 37.0, 100, 98, true, false, false, false, false, false, false, false, false)] // BP High (Systolic >= 140)
    [InlineData(130, 90, 75, 37.0, 100, 98, true, false, false, false, false, false, false, false, false)] // BP High (Diastolic >= 90)
    [InlineData(89, 70, 75, 37.0, 100, 98, false, true, false, false, false, false, false, false, false)]  // BP Low (Systolic < 90)
    [InlineData(110, 59, 75, 37.0, 100, 98, false, true, false, false, false, false, false, false, false)] // BP Low (Diastolic < 60)
    [InlineData(120, 80, 101, 37.0, 100, 98, false, false, true, false, false, false, false, false, false)] // Pulse High (> 100)
    [InlineData(120, 80, 59, 37.0, 100, 98, false, false, false, true, false, false, false, false, false)]  // Pulse Low (< 60)
    [InlineData(120, 80, 75, 38.0, 100, 98, false, false, false, false, true, false, false, false, false)]  // Fever (Temp >= 38.0)
    [InlineData(120, 80, 75, 35.4, 100, 98, false, false, false, false, false, true, false, false, false)]  // Hypothermia (Temp < 35.5)
    [InlineData(120, 80, 75, 37.0, 200, 98, false, false, false, false, false, false, true, false, false)]  // Glucose High (>= 200)
    [InlineData(120, 80, 75, 37.0, 69, 98, false, false, false, false, false, false, false, true, false)]   // Glucose Low (< 70)
    [InlineData(120, 80, 75, 37.0, 100, 93, false, false, false, false, false, false, false, false, true)]  // SpO2 Low (< 94)
    public async Task SaveVitals_PhysiologicalAlertBoundaries_ShouldFlagAccurately(
        int sys, int dia, int pulse, double temp, int glucose, int spo2,
        bool expBpHigh, bool expBpLow, bool expPulseHigh, bool expPulseLow,
        bool expTempHigh, bool expTempLow, bool expGlucoseHigh, bool expGlucoseLow, bool expSpo2Low)
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), hubContext, NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };

        var initRes = await controller.InitOrGetVisit(new InitVisitRequestDto { AppointmentId = _appointment.Id });
        var visitId = ((OkObjectResult)initRes.Result!).Value.As<MedicalVisitDetailDto>().Id;

        var request = new UpdateVitalsRequestDto
        {
            BpSystolic = sys,
            BpDiastolic = dia,
            PulseBpm = pulse,
            TempCelsius = (decimal)temp,
            BloodSugarMgDl = glucose,
            Spo2Pct = spo2,
            Version = 1
        };

        var updateRes = await controller.UpdateVitals(visitId, request);
        var dto = ((OkObjectResult)updateRes.Result!).Value.As<MedicalVisitDetailDto>();

        dto.Alerts.IsBpHigh.Should().Be(expBpHigh);
        dto.Alerts.IsBpLow.Should().Be(expBpLow);
        dto.Alerts.IsPulseHigh.Should().Be(expPulseHigh);
        dto.Alerts.IsPulseLow.Should().Be(expPulseLow);
        dto.Alerts.IsTempHigh.Should().Be(expTempHigh);
        dto.Alerts.IsTempLow.Should().Be(expTempLow);
        dto.Alerts.IsGlucoseHigh.Should().Be(expGlucoseHigh);
        dto.Alerts.IsGlucoseLow.Should().Be(expGlucoseLow);
        dto.Alerts.IsSpo2Low.Should().Be(expSpo2Low);
    }

    [Fact]
    public async Task SaveVitals_WithZeroOrNullHeight_ShouldReturnNullBmiWithoutThrowingException()
    {
        await using var context = CreateDbContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };

        var initRes = await controller.InitOrGetVisit(new InitVisitRequestDto { AppointmentId = _appointment.Id });
        var visitId = ((OkObjectResult)initRes.Result!).Value.As<MedicalVisitDetailDto>().Id;

        var request = new UpdateVitalsRequestDto
        {
            WeightKg = 80m,
            HeightCm = 0m, // zero height
            Version = 1
        };

        var res = await controller.UpdateVitals(visitId, request);
        var dto = ((OkObjectResult)res.Result!).Value.As<MedicalVisitDetailDto>();
        dto.Bmi.Should().BeNull();
    }

    [Fact]
    public async Task OptimisticConcurrencyCollision_WhenTwoConcurrentUpdatesUseSameVersion_ShouldReturn409Conflict()
    {
        await using var context = CreateDbContext();
        var controller1 = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };
        var controller2 = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var initRes = await controller1.InitOrGetVisit(new InitVisitRequestDto { AppointmentId = _appointment.Id });
        var visitId = ((OkObjectResult)initRes.Result!).Value.As<MedicalVisitDetailDto>().Id;

        // Both clients read Version = 1
        var client1Request = new UpdateVitalsRequestDto { BpSystolic = 120, BpDiastolic = 80, Version = 1 };
        var client2Request = new UpdateVitalsRequestDto { BpSystolic = 135, BpDiastolic = 88, Version = 1 };

        // Client 1 updates -> Succeeds -> Version becomes 2
        var res1 = await controller1.UpdateVitals(visitId, client1Request);
        res1.Result.Should().BeOfType<OkObjectResult>();

        // Client 2 attempts update with stale Version 1 -> Must return 409 Conflict ProblemDetails
        var res2 = await controller2.UpdateVitals(visitId, client2Request);
        var problemResult = res2.Result.Should().BeOfType<ObjectResult>().Subject;
        problemResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);

        var problem = problemResult.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Be("CONCURRENCY_CONFLICT");

        // Verify DB preserved Client 1's values
        var visitInDb = await context.MedicalVisits.FirstAsync(v => v.Id == visitId);
        visitInDb.BpSystolic.Should().Be(120);
        visitInDb.Version.Should().Be(2);
    }

    [Fact]
    public async Task ImmutabilityEnforcement_WhenVisitIsCompleted_UpdatingVitalsOrDraftMustBeRejected()
    {
        await using var context = CreateDbContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        // Create completed visit
        var visit = new MedicalVisit
        {
            AppointmentId = _appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = false,
            CompletedAtUtc = DateTime.UtcNow,
            BpSystolic = 120,
            BpDiastolic = 80,
            Diagnosis = "التهاب حاد بالحلق",
            Version = 2
        };
        context.MedicalVisits.Add(visit);
        await context.SaveChangesAsync();

        // 1. Attempt updating vitals on completed visit
        var vitalsReq = new UpdateVitalsRequestDto { BpSystolic = 150, Version = 2 };
        var vitalsResult = await controller.UpdateVitals(visit.Id, vitalsReq);
        var vitalsProblem = vitalsResult.Result.Should().BeOfType<ObjectResult>().Subject;
        vitalsProblem.StatusCode.Should().Match(s => s == StatusCodes.Status400BadRequest || s == StatusCodes.Status409Conflict);

        // 2. Attempt autosaving draft notes on completed visit
        var draftReq = new AutosaveDraftNotesRequestDto { Diagnosis = "تعديل التشخيص غير مسموح", Version = 2 };
        var draftResult = await controller.AutosaveDraftNotes(visit.Id, draftReq);
        var draftProblem = draftResult.Result.Should().BeOfType<ObjectResult>().Subject;
        draftProblem.StatusCode.Should().Match(s => s == StatusCodes.Status400BadRequest || s == StatusCodes.Status409Conflict);

        // Verify DB record unchanged
        var refreshed = await context.MedicalVisits.FirstAsync(v => v.Id == visit.Id);
        refreshed.BpSystolic.Should().Be(120);
        refreshed.Diagnosis.Should().Be("التهاب حاد بالحلق");
    }

    [Fact]
    public async Task AddendumAddition_OnCompletedVisit_ShouldAppendImmutableRecordAndPreserveParentVisit()
    {
        await using var context = CreateDbContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var completedVisit = new MedicalVisit
        {
            AppointmentId = _appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = false,
            CompletedAtUtc = DateTime.UtcNow,
            BpSystolic = 125,
            Diagnosis = "نوبة ربو شعبي حادة",
            Version = 3
        };
        context.MedicalVisits.Add(completedVisit);
        await context.SaveChangesAsync();

        // Add Addendum 1
        var addendumReq1 = new CreateAddendumRequestDto
        {
            NoteText = "متابعة هاتفية: تحسن ملحوظ بعد استخدام البخاخ"
        };
        var addRes1 = await controller.AddAddendum(completedVisit.Id, addendumReq1);
        var createdResult1 = addRes1.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var addendumDto1 = createdResult1.Value.Should().BeOfType<VisitAddendumDto>().Subject;
        addendumDto1.NoteText.Should().Be(addendumReq1.NoteText);
        addendumDto1.AuthorUserId.Should().Be(_doctor.Id);

        // Add Addendum 2
        var addendumReq2 = new CreateAddendumRequestDto
        {
            NoteText = "ورود نتيجة صورة الدم الكاملة: كرات الدم البيضاء 7,500 (طبيعية)"
        };
        var addRes2 = await controller.AddAddendum(completedVisit.Id, addendumReq2);
        addRes2.Result.Should().BeOfType<CreatedAtActionResult>();

        // Verify parent visit preserved immutability
        var refreshedVisit = await context.MedicalVisits
            .Include(v => v.Addenda)
            .FirstAsync(v => v.Id == completedVisit.Id);

        refreshedVisit.Diagnosis.Should().Be("نوبة ربو شعبي حادة");
        refreshedVisit.BpSystolic.Should().Be(125);
        refreshedVisit.IsDraft.Should().BeFalse();
        refreshedVisit.Addenda.Should().HaveCount(2);
    }

    [Fact]
    public async Task AddendumAddition_WithEmptyNote_ShouldReturnBadRequest()
    {
        await using var context = CreateDbContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        var completedVisit = new MedicalVisit
        {
            AppointmentId = _appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor.Id,
            IsDraft = false,
            CompletedAtUtc = DateTime.UtcNow
        };
        context.MedicalVisits.Add(completedVisit);
        await context.SaveChangesAsync();

        var res = await controller.AddAddendum(completedVisit.Id, new CreateAddendumRequestDto { NoteText = "   " });
        res.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task PaginatedVisitHistory_ShouldReturnChronologicalVisitsWithVitalsAndAddendaCount()
    {
        await using var context = CreateDbContext();
        var controller = new MedicalVisitsController(context, new BusinessDateService(), new TestQueueHubContext(), NullLogger<MedicalVisitsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_doctor.Id, _doctor.Username, "Doctor")
        };

        // Create 3 historical visits for _patient
        for (int i = 1; i <= 3; i++)
        {
            var appt = new Appointment
            {
                DoctorUserId = _doctor.Id,
                PatientId = _patient.Id,
                ServiceId = _service.Id,
                BusinessDate = _businessDate.AddDays(-i),
                Status = AppointmentStatus.Completed,
                CreatedAtUtc = DateTime.UtcNow.AddDays(-i)
            };
            context.Appointments.Add(appt);
            await context.SaveChangesAsync();

            var visit = new MedicalVisit
            {
                AppointmentId = appt.Id,
                PatientId = _patient.Id,
                DoctorUserId = _doctor.Id,
                IsDraft = false,
                CompletedAtUtc = DateTime.UtcNow.AddDays(-i),
                BpSystolic = 120 + i,
                BpDiastolic = 80 + i,
                Diagnosis = $"تشخيص زيارة سابقة رقم {i}",
                CreatedAtUtc = DateTime.UtcNow.AddDays(-i)
            };
            context.MedicalVisits.Add(visit);
            await context.SaveChangesAsync();

            if (i == 1)
            {
                context.VisitAddenda.Add(new VisitAddendum
                {
                    MedicalVisitId = visit.Id,
                    AuthorUserId = _doctor.Id,
                    NoteText = "ملاحظة إلحاقية",
                    CreatedAtUtc = DateTime.UtcNow
                });
                await context.SaveChangesAsync();
            }
        }

        // Query page 1, pageSize 2
        var res = await controller.GetPatientVisits(_patient.Id, page: 1, pageSize: 2);
        var okResult = res.Result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = okResult.Value.Should().BeOfType<PagedResult<MedicalVisitSummaryDto>>().Subject;

        paged.TotalCount.Should().Be(3);
        paged.TotalPages.Should().Be(2);
        paged.Page.Should().Be(1);
        paged.Items.Should().HaveCount(2);

        // Chronological order descending: Visit 1 (yesterday) before Visit 2 (2 days ago)
        paged.Items[0].BpSystolic.Should().Be(121);
        paged.Items[0].AddendaCount.Should().Be(1);
        paged.Items[1].BpSystolic.Should().Be(122);
        paged.Items[1].AddendaCount.Should().Be(0);
    }

    [Fact]
    public async Task StartNursing_And_CompleteNursing_ShouldTransitionStatusAndBroadcastQueue()
    {
        await using var context = CreateDbContext();
        var hubContext = new TestQueueHubContext();
        var appointmentsController = new AppointmentsController(
            context,
            new BusinessDateService(),
            new BookingWriteLock(),
            hubContext,
            NullLogger<AppointmentsController>.Instance)
        {
            ControllerContext = CreateControllerContext(_nurse.Id, _nurse.Username, "Nurse")
        };

        // 1. Start nursing
        var startRes = await appointmentsController.StartNursing(_appointment.Id);
        var startOk = startRes.Result.Should().BeOfType<OkObjectResult>().Subject;
        var apptDto1 = startOk.Value.Should().BeOfType<AppointmentDto>().Subject;
        apptDto1.Status.Should().Be(AppointmentStatus.InNursing);

        hubContext.TestClient.QueueUpdatedEvents.Should().NotBeEmpty();

        // 2. Complete nursing
        var compRes = await appointmentsController.CompleteNursing(_appointment.Id);
        var compOk = compRes.Result.Should().BeOfType<OkObjectResult>().Subject;
        var apptDto2 = compOk.Value.Should().BeOfType<AppointmentDto>().Subject;
        apptDto2.Status.Should().Be(AppointmentStatus.Waiting);

        // Verify status histories
        var histories = await context.AppointmentStatusHistories
            .Where(h => h.AppointmentId == _appointment.Id)
            .OrderBy(h => h.Id)
            .ToListAsync();

        histories.Should().Contain(h => h.ToStatus == "InNursing");
        histories.Should().Contain(h => h.ToStatus == "Waiting");
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
