using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F14")]
public class T1_14_AttachmentSecurityTests : E2ETestBase
{
    public T1_14_AttachmentSecurityTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F14_01_UploadValidJpeg_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // JPEG Magic bytes: FF D8 FF E0
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "xray.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Ray"), "fileType" },
            { new StringContent("Chest X-Ray"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();
        upload.Data!.StorageFileName.Should().EndWith(".jpg");
    }

    [Fact]
    public async Task T1_F14_02_UploadValidPng_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // PNG Magic bytes: 89 50 4E 47 0D 0A 1A 0A
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(pngBytes), "file", "scan.png" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Lab"), "fileType" },
            { new StringContent("Blood Test Scan"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();
        upload.Data!.StorageFileName.Should().EndWith(".png");
    }

    [Fact]
    public async Task T1_F14_03_UploadValidPdf_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // PDF Magic bytes: %PDF- (25 50 44 46)
        var pdfBytes = "%PDF-1.4 sample pdf content"u8.ToArray();
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(pdfBytes), "file", "report.pdf" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Report"), "fileType" },
            { new StringContent("MRI Report"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();
        upload.Data!.StorageFileName.Should().EndWith(".pdf");
    }

    [Fact]
    public async Task T1_F14_04_StreamAttachment_WithAuthentication_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "photo.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Photo"), "fileType" },
            { new StringContent("Clinical Photo"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();

        var streamRes = await Api.AsDoctor().GetAsync<string>($"/api/attachments/{upload.Data!.Id}/file");
        streamRes.EnsureSuccess();
    }

    [Fact]
    public async Task T1_F14_05_SoftDeleteAttachment_Success()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "delete_me.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Other"), "fileType" },
            { new StringContent("To Delete"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();

        var del = await Api.AsDoctor().DeleteAsync<object>($"/api/attachments/{upload.Data!.Id}");
        del.StatusCode.Should().Be(System.Net.HttpStatusCode.NoContent);

        // Fetch after delete should 404
        var getAfter = await Api.AsDoctor().GetAsync<string>($"/api/attachments/{upload.Data.Id}/file");
        getAfter.StatusCode.Should().Be(System.Net.HttpStatusCode.NotFound);
    }
}
