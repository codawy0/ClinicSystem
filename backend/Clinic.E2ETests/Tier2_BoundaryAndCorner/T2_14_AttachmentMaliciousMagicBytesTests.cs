using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F14")]
public class T2_14_AttachmentMaliciousMagicBytesTests : E2ETestBase
{
    public T2_14_AttachmentMaliciousMagicBytesTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F14_01_SpoofedExtension_MaliciousFileRejected()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // File named script.jpg but containing ASCII shell script bytes (no JPEG magic header)
        var scriptBytes = "#!/bin/bash\nrm -rf /"u8.ToArray();
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(scriptBytes), "file", "malicious.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Photo"), "fileType" },
            { new StringContent("Spoofed"), "title" }
        };

        var res = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F14_02_UnauthenticatedFileAccess_Returns401()
    {
        using var client = CreateClient();
        var res = await client.GetAsync("/api/attachments/1/file");
        res.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task T2_F14_03_FileExceeds10MB_Returns400()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        // 11 MB JPEG file
        var largeBytes = new byte[11 * 1024 * 1024];
        largeBytes[0] = 0xFF; largeBytes[1] = 0xD8; largeBytes[2] = 0xFF; largeBytes[3] = 0xE0;
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(largeBytes), "file", "large.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Photo"), "fileType" },
            { new StringContent("Large"), "title" }
        };

        var res = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F14_04_PathTraversalFilename_Sanitized()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());

        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "../../../../windows/system32/cmd.exe.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Photo"), "fileType" },
            { new StringContent("Traversal"), "title" }
        };

        var res = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        res.EnsureSuccess();
        res.Data!.StorageFileName.Should().NotContain("..");
        res.Data.StorageFileName.Should().EndWith(".jpg");
    }

    [Fact]
    public async Task T2_F14_05_SoftDeletedFile_Returns404()
    {
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "test.jpg" },
            { new StringContent(pat.Data!.Id.ToString()), "patientId" },
            { new StringContent("Photo"), "fileType" },
            { new StringContent("Test"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        await Api.AsDoctor().DeleteAsync<object>($"/api/attachments/{upload.Data!.Id}");

        var getRes = await Api.AsDoctor().GetAsync<string>($"/api/attachments/{upload.Data.Id}/file");
        getRes.ShouldBeNotFound();
    }
}
