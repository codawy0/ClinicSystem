using System.Security.Claims;
using System.Text;
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
using Clinic.Api.Models.Import;

namespace Clinic.Tests.Integration;

[Trait("Category", "Integration")]
public class CsvImportTests : IAsyncLifetime
{
    private string _dbFilePath = string.Empty;
    private string _connectionString = string.Empty;
    private User _admin = null!;

    public async Task InitializeAsync()
    {
        _dbFilePath = Path.Combine(Path.GetTempPath(), $"clinic_csv_test_{Guid.NewGuid():N}.db");
        _connectionString = $"Data Source={_dbFilePath};";

        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode = WAL;";
        await cmd.ExecuteNonQueryAsync();

        await using var context = CreateDbContext();
        await context.Database.EnsureCreatedAsync();

        _admin = new User
        {
            Username = "admin_csv",
            PasswordHash = "h",
            FullName = "مسؤول الاستيراد",
            Role = UserRole.Admin
        };
        context.Users.Add(_admin);
        await context.SaveChangesAsync();
    }

    public Task DisposeAsync()
    {
        try
        {
            if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath);
            var wal = $"{_dbFilePath}-wal";
            if (File.Exists(wal)) File.Delete(wal);
            var shm = $"{_dbFilePath}-shm";
            if (File.Exists(shm)) File.Delete(shm);
        }
        catch
        {
            // ignored
        }
        return Task.CompletedTask;
    }

    private ClinicDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseSqlite(_connectionString)
            .AddInterceptors(new SqlitePragmaInterceptor())
            .Options;
        return new ClinicDbContext(options);
    }

    private ImportController CreateController(ClinicDbContext context)
    {
        var controller = new ImportController(context, NullLogger<ImportController>.Instance);
        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, _admin.Id.ToString()),
            new Claim(ClaimTypes.Name, _admin.Username),
            new Claim(ClaimTypes.Role, _admin.Role.ToString())
        };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }

    private static IFormFile CreateCsvFile(string csvContent, string fileName = "test.csv")
    {
        var bytes = Encoding.UTF8.GetBytes(csvContent);
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv"
        };
    }

    [Fact]
    public async Task ImportPatients_ShouldNormalizeEgyptianPhonesAndArabicNames()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        string csv = @"الاسم بالكامل,رقم الهاتف,النوع,السن
أحمد عبدُ الرَّحْمَٰن,+20 101-234-5678,ذكر,35
مريم إسماعيل,00201112233445,أنثى,28
عمر إبراهيم,201555555555,ذكر,42";

        var file = CreateCsvFile(csv);
        var response = await controller.ImportPatients(dryRun: true, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<PatientImportSummaryDto>().Subject;

        summary.TotalRowsProcessed.Should().Be(3);
        summary.ValidCount.Should().Be(3);
        summary.ErrorCount.Should().Be(0);

        summary.Rows[0].NormalizedPhone.Should().Be("01012345678");
        summary.Rows[1].NormalizedPhone.Should().Be("01112233445");
        summary.Rows[2].NormalizedPhone.Should().Be("01555555555");
    }

    [Fact]
    public async Task ImportPatients_ShouldDetectDuplicatesInFileAndDatabase()
    {
        await using var context = CreateDbContext();
        // Seed existing patient in DB
        context.Patients.Add(new Patient
        {
            FileNumber = "F-9999",
            FullName = "مريض سابق",
            Phone = "01099998888",
            NormalizedPhone = "01099998888",
            Gender = PatientGender.Male
        });
        await context.SaveChangesAsync();

        var controller = CreateController(context);

        string csv = @"Name,Phone,Gender
علي حسن,01099998888,ذكر
محمود سمير,01012345678,ذكر
محمود سمير مكرر,01012345678,ذكر";

        var file = CreateCsvFile(csv);
        var response = await controller.ImportPatients(dryRun: true, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<PatientImportSummaryDto>().Subject;

        summary.TotalRowsProcessed.Should().Be(3);
        summary.ValidCount.Should().Be(1);
        summary.DuplicateCount.Should().Be(2);

        // Row 1 duplicates DB patient
        summary.Rows[0].IsDuplicate.Should().BeTrue();
        summary.Rows[0].ExistingFileNumber.Should().Be("F-9999");

        // Row 3 duplicates Row 2 within file
        summary.Rows[2].IsDuplicate.Should().BeTrue();
    }

    [Fact]
    public async Task ImportPatients_DryRun_ShouldNotPersistRecords()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        string csv = @"FullName,Phone
شريف فؤاد,01055554444";

        var file = CreateCsvFile(csv);
        var response = await controller.ImportPatients(dryRun: true, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<PatientImportSummaryDto>().Subject;

        summary.IsDryRun.Should().BeTrue();
        summary.InsertedCount.Should().Be(0);

        await using var verifyContext = CreateDbContext();
        var count = await verifyContext.Patients.CountAsync();
        count.Should().Be(0);
    }

    [Fact]
    public async Task ImportPatients_Execution_ShouldPersistValidRecordsAndAssignSequentialFileNumbers()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        string csv = @"FullName,Phone,Gender,Age
حسام البدري,01011110001,Male,50
إيمان يوسف,01011110002,Female,32";

        var file = CreateCsvFile(csv);
        var response = await controller.ImportPatients(dryRun: false, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<PatientImportSummaryDto>().Subject;

        summary.IsDryRun.Should().BeFalse();
        summary.InsertedCount.Should().Be(2);

        await using var verifyContext = CreateDbContext();
        var list = await verifyContext.Patients.OrderBy(p => p.Id).ToListAsync();
        list.Should().HaveCount(2);

        list[0].FullName.Should().Be("حسام البدري");
        list[0].SearchName.Should().Be("حسام البدري");
        list[0].NormalizedPhone.Should().Be("01011110001");
        list[0].FileNumber.Should().StartWith("F-");

        list[1].FullName.Should().Be("إيمان يوسف");
        list[1].NormalizedPhone.Should().Be("01011110002");
        list[1].FileNumber.Should().StartWith("F-");
    }

    [Fact]
    public async Task ImportPatients_MalformedCsv_ShouldReportRowErrorsGracefully()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        string csv = @"FullName,Phone
,01012345678
سعيد صالح,12345
كمال الشناوي,0233445566"; // 02 is landline, not 11-digit mobile

        var file = CreateCsvFile(csv);
        var response = await controller.ImportPatients(dryRun: true, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<PatientImportSummaryDto>().Subject;

        summary.TotalRowsProcessed.Should().Be(3);
        summary.ErrorCount.Should().Be(3);
        summary.ValidCount.Should().Be(0);

        summary.Rows[0].IsValid.Should().BeFalse();
        summary.Rows[1].IsValid.Should().BeFalse();
        summary.Rows[2].IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task ImportDrugs_ShouldInsertNewAndUpsertExistingFormulary()
    {
        await using var context = CreateDbContext();
        // Seed existing drug
        var panadol = new Drug
        {
            TradeName = "Panadol Extra",
            SearchTradeName = "panadol extra",
            ActiveIngredient = "paracetamol",
            Strength = "500mg",
            Form = DrugForm.Tablet
        };
        context.Drugs.Add(panadol);
        await context.SaveChangesAsync();

        var controller = CreateController(context);

        string csv = @"TradeName,ActiveIngredient,Strength,Form,Category,DefaultDosage
Panadol Extra,paracetamol,1000mg,Tablet,Analgesic,قرص مرتين يومياً
Augmentin,amoxicillin;clavulanate,1g,Tablet,Antibiotic,قرص كل 12 ساعة";

        var file = CreateCsvFile(csv);
        var response = await controller.ImportDrugs(dryRun: false, file);

        var okResult = response.Result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<DrugImportSummaryDto>().Subject;

        summary.TotalRowsProcessed.Should().Be(2);
        summary.UpdatedCount.Should().Be(1);
        summary.InsertedCount.Should().Be(1);

        await using var verifyContext = CreateDbContext();
        var updatedPanadol = await verifyContext.Drugs.FirstOrDefaultAsync(d => d.Id == panadol.Id);
        updatedPanadol!.Strength.Should().Be("1000mg");
        updatedPanadol.Category.Should().Be("Analgesic");

        var newAugmentin = await verifyContext.Drugs.FirstOrDefaultAsync(d => d.TradeName == "Augmentin");
        newAugmentin.Should().NotBeNull();
        newAugmentin!.ActiveIngredient.Should().Be("amoxicillin;clavulanate");
        newAugmentin.Strength.Should().Be("1g");
    }

    [Fact]
    public async Task ImportPatients_EmptyOrNonCsvFile_ShouldReturn400BadRequest()
    {
        await using var context = CreateDbContext();
        var controller = CreateController(context);

        var emptyFile = CreateCsvFile("", "empty.csv");
        var res1 = await controller.ImportPatients(true, emptyFile);
        res1.Result.Should().BeOfType<BadRequestObjectResult>();

        var nonCsv = CreateCsvFile("some,data", "data.txt");
        var res2 = await controller.ImportPatients(true, nonCsv);
        res2.Result.Should().BeOfType<BadRequestObjectResult>();
    }
}
