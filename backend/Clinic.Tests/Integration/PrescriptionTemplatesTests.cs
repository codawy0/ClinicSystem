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
using Clinic.Api.Models.PrescriptionTemplates;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class PrescriptionTemplatesTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;

    private User _doctor1 = null!;
    private User _doctor2 = null!;
    private Patient _patient = null!;
    private ServiceCatalog _service = null!;
    private Appointment _appointment = null!;
    private MedicalVisit _visit = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_pxtemplates_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _doctor1 = new User { Username = "doc_a", PasswordHash = "h", FullName = "د. حازم القاضي", Role = UserRole.Doctor };
        _doctor2 = new User { Username = "doc_b", PasswordHash = "h", FullName = "د. عادل إمام", Role = UserRole.Doctor };
        _patient = new Patient { FileNumber = "P-PX-1", FullName = "سامر محمود", Phone = "01011223344", Gender = PatientGender.Male };
        _service = new ServiceCatalog { Code = "EXAM", NameAr = "كشف باطنة", Category = ServiceCategory.Exam, DefaultPricePiastres = 30_000L };

        context.Users.AddRange(_doctor1, _doctor2);
        context.Patients.Add(_patient);
        context.ServiceCatalogs.Add(_service);
        await context.SaveChangesAsync();

        _appointment = new Appointment
        {
            DoctorUserId = _doctor1.Id,
            PatientId = _patient.Id,
            ServiceId = _service.Id,
            BusinessDate = new DateOnly(2026, 11, 16),
            QueueNumber = 1,
            Status = AppointmentStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Appointments.Add(_appointment);
        await context.SaveChangesAsync();

        _visit = new MedicalVisit
        {
            AppointmentId = _appointment.Id,
            PatientId = _patient.Id,
            DoctorUserId = _doctor1.Id,
            IsDraft = false,
            CompletedAtUtc = DateTime.UtcNow,
            Diagnosis = "Acute Gastroenteritis",
            ChiefComplaint = "Severe abdominal cramps",
            Version = 2
        };
        context.MedicalVisits.Add(_visit);
        await context.SaveChangesAsync();

        context.PrescriptionItems.AddRange(
            new PrescriptionItem
            {
                MedicalVisitId = _visit.Id,
                DrugNameSnapshot = "Nexium 40mg",
                ActiveIngredientSnapshot = "esomeprazole",
                StrengthSnapshot = "40mg",
                FormSnapshot = "Tablet",
                Dosage = "قرص يومياً",
                Timing = "قبل الإفطار",
                Duration = "14 يوماً"
            },
            new PrescriptionItem
            {
                MedicalVisitId = _visit.Id,
                DrugNameSnapshot = "Panadol Extra",
                ActiveIngredientSnapshot = "paracetamol",
                StrengthSnapshot = "500mg/65mg",
                FormSnapshot = "Tablet",
                Dosage = "قرصين عند اللزوم",
                Timing = "بعد الأكل",
                Duration = "3 أيام"
            }
        );

        context.ClinicalRequestItems.Add(new ClinicalRequestItem
        {
            MedicalVisitId = _visit.Id,
            RequestType = RequestType.Lab,
            CatalogCode = "STOOL",
            NameAr = "تحليل براز كامل",
            NameEn = "Stool Analysis"
        });

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

    private PrescriptionTemplatesController CreateController(ClinicDbContext context, User doctor)
    {
        return new PrescriptionTemplatesController(context, NullLogger<PrescriptionTemplatesController>.Instance)
        {
            ControllerContext = CreateControllerContext(doctor.Id, doctor.Username, "Doctor")
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
    public async Task GetTemplates_ShouldReturnOnlyTemplatesOwnedByAuthenticatedDoctor()
    {
        await using var context = CreateDbContext();

        context.PrescriptionTemplates.AddRange(
            new PrescriptionTemplate
            {
                DoctorUserId = _doctor1.Id,
                TemplateName = "قالب دكتور 1 - أ",
                ItemsJson = "[]"
            },
            new PrescriptionTemplate
            {
                DoctorUserId = _doctor1.Id,
                TemplateName = "قالب دكتور 1 - ب",
                ItemsJson = "[]"
            },
            new PrescriptionTemplate
            {
                DoctorUserId = _doctor2.Id,
                TemplateName = "قالب دكتور 2 - فقط",
                ItemsJson = "[]"
            }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor1);
        var response = await controller.GetAll();
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var items = okResult.Value.Should().BeOfType<List<PrescriptionTemplateSummaryDto>>().Subject;

        items.Should().HaveCount(2);
        items.Should().OnlyContain(t => t.TemplateName.StartsWith("قالب دكتور 1"));
    }

    [Fact]
    public async Task CreateTemplate_WithValidItemsAndOrders_ShouldPersistAndReturn201Created()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor1);

        var request = new CreatePrescriptionTemplateRequestDto
        {
            TemplateName = "بروتوكول السكري",
            DefaultDiagnosis = "T2DM",
            Items = new List<TemplateItemDto>
            {
                new() { DrugName = "Glucophage 1000mg", Dosage = "قرص مرتين", Timing = "مع الأكل", Duration = "30 يوماً" },
                new() { DrugName = "Januvia 100mg", Dosage = "قرص يومياً", Timing = "صباحاً", Duration = "30 يوماً" }
            },
            LabRadiologyOrders = new List<TemplateClinicalRequestDto>
            {
                new() { Type = RequestType.Lab, NameAr = "تحليل سكر تراكمي", NameEn = "HbA1c" }
            }
        };

        var response = await controller.Create(request);
        var createdResult = response.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = createdResult.Value.Should().BeOfType<PrescriptionTemplateDetailDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.TemplateName.Should().Be("بروتوكول السكري");
        dto.Items.Should().HaveCount(2);
        dto.LabRadiologyOrders.Should().HaveCount(1);

        var inDb = await context.PrescriptionTemplates.FindAsync(dto.Id);
        inDb.Should().NotBeNull();
        inDb!.DoctorUserId.Should().Be(_doctor1.Id);
        inDb.ItemsJson.Should().Contain("Glucophage 1000mg");
    }

    [Fact]
    public async Task CreateTemplate_WithWhitespaceName_ShouldReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor1);

        var request = new CreatePrescriptionTemplateRequestDto
        {
            TemplateName = "    ",
            Items = new List<TemplateItemDto>()
        };

        var response = await controller.Create(request);
        response.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetTemplateById_WhenOwnedByDoctor_ShouldReturn200WithFullDetail()
    {
        await using var context = CreateDbContext();
        var template = new PrescriptionTemplate
        {
            DoctorUserId = _doctor1.Id,
            TemplateName = "قالب الفحص السريري",
            DefaultDiagnosis = "Gastritis",
            ItemsJson = "[{\"DrugName\":\"Nexium 40mg\",\"Dosage\":\"قرص يومياً\",\"Timing\":\"قبل الأكل\",\"Duration\":\"14 يوماً\"}]",
            LabRadiologyOrdersJson = "[{\"Type\":0,\"NameAr\":\"تحليل صورة دم\",\"NameEn\":\"CBC\"}]"
        };
        context.PrescriptionTemplates.Add(template);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor1);
        var response = await controller.GetById(template.Id);
        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<PrescriptionTemplateDetailDto>().Subject;

        dto.Id.Should().Be(template.Id);
        dto.TemplateName.Should().Be("قالب الفحص السريري");
        dto.Items.Should().HaveCount(1);
        dto.Items[0].DrugName.Should().Be("Nexium 40mg");
        dto.LabRadiologyOrders.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetTemplateById_WhenOwnedByAnotherDoctor_ShouldReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var template = new PrescriptionTemplate
        {
            DoctorUserId = _doctor1.Id,
            TemplateName = "قالب خاص بطبيب 1",
            ItemsJson = "[]"
        };
        context.PrescriptionTemplates.Add(template);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor2);
        var response = await controller.GetById(template.Id);
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CreateTemplateFromVisit_ShouldCaptureFrozenSnapshotOfVisitPrescriptionsAndRequests()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor1);

        var request = new CreateTemplateFromVisitRequestDto
        {
            TemplateName = "قالب من كشف سابق"
        };

        var response = await controller.CreateFromVisit(_visit.Id, request);
        var createdResult = response.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = createdResult.Value.Should().BeOfType<PrescriptionTemplateDetailDto>().Subject;

        dto.Id.Should().BeGreaterThan(0);
        dto.TemplateName.Should().Be("قالب من كشف سابق");
        dto.DefaultDiagnosis.Should().Be("Acute Gastroenteritis");
        dto.Items.Should().HaveCount(2);
        dto.Items.Should().Contain(i => i.DrugName == "Nexium 40mg");
        dto.Items.Should().Contain(i => i.DrugName == "Panadol Extra");
        dto.LabRadiologyOrders.Should().HaveCount(1);
        dto.LabRadiologyOrders[0].NameAr.Should().Be("تحليل براز كامل");
        dto.DoctorUserId.Should().Be(_doctor1.Id);
    }

    [Fact]
    public async Task CreateTemplateFromVisit_SubsequentVisitChangesDoNotMutateTemplate()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor1);

        var response = await controller.CreateFromVisit(_visit.Id, new CreateTemplateFromVisitRequestDto
        {
            TemplateName = "قالب محمي من التعديل"
        });
        var createdResult = response.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = createdResult.Value.Should().BeOfType<PrescriptionTemplateDetailDto>().Subject;

        // Mutate the original visit notes in DB
        var visitInDb = await context.MedicalVisits.FindAsync(_visit.Id);
        visitInDb!.Diagnosis = "MUTATED DIAGNOSIS AFTER TEMPLATE CREATION";
        context.VisitAddenda.Add(new VisitAddendum
        {
            MedicalVisitId = _visit.Id,
            AuthorUserId = _doctor1.Id,
            NoteText = "Addendum added later"
        });
        await context.SaveChangesAsync();

        // Re-read template
        var templateInDb = await context.PrescriptionTemplates.FindAsync(dto.Id);
        templateInDb!.DefaultDiagnosis.Should().Be("Acute Gastroenteritis");
        templateInDb.ItemsJson.Should().Contain("Nexium 40mg");
    }

    [Fact]
    public async Task CreateTemplateFromVisit_NonExistentVisit_ShouldReturn404NotFound()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context, _doctor1);

        var response = await controller.CreateFromVisit(99999, new CreateTemplateFromVisitRequestDto
        {
            TemplateName = "قالب لزيارة غير موجودة"
        });
        response.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task DeleteTemplate_WhenOwnedByDoctor_ShouldDeleteSuccessfully()
    {
        await using var context = CreateDbContext();
        var template = new PrescriptionTemplate
        {
            DoctorUserId = _doctor1.Id,
            TemplateName = "قالب للحذف",
            ItemsJson = "[]"
        };
        context.PrescriptionTemplates.Add(template);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor1);
        var response = await controller.Delete(template.Id);
        response.Should().BeOfType<NoContentResult>();

        var inDb = await context.PrescriptionTemplates.FindAsync(template.Id);
        inDb.Should().BeNull();
    }

    [Fact]
    public async Task DeleteTemplate_WhenOwnedByAnotherDoctor_ShouldReturn404Or403AndNotDelete()
    {
        await using var context = CreateDbContext();
        var template = new PrescriptionTemplate
        {
            DoctorUserId = _doctor1.Id,
            TemplateName = "قالب محمي من الحذف بواسطة طبيب آخر",
            ItemsJson = "[]"
        };
        context.PrescriptionTemplates.Add(template);
        await context.SaveChangesAsync();

        var controller = CreateController(context, _doctor2);
        var response = await controller.Delete(template.Id);
        response.Should().BeOfType<NotFoundObjectResult>();

        var inDb = await context.PrescriptionTemplates.FindAsync(template.Id);
        inDb.Should().NotBeNull();
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
