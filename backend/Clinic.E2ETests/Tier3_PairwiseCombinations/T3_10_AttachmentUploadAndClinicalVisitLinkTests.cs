using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_10_AttachmentUploadAndClinicalVisitLinkTests : E2ETestBase
{
    public T3_10_AttachmentUploadAndClinicalVisitLinkTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task AttachmentUpload_LinksToClinicalVisit_AndStreamsAuthenticated()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data.Id}");
        var visitId = hist.Data!.Items.First().Id;

        // Multipart upload linked to visit
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46 };
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(jpegBytes), "file", "spine_xray.jpg" },
            { new StringContent(pat.Data.Id.ToString()), "patientId" },
            { new StringContent(visitId.ToString()), "medicalVisitId" },
            { new StringContent("Ray"), "fileType" },
            { new StringContent("Lumbosacral Spine X-Ray"), "title" }
        };

        var upload = await Api.AsDoctor().PostMultipartAsync<AttachmentDto>("/api/attachments/upload", form);
        upload.EnsureSuccess();

        // Stream authenticated
        var stream = await Api.AsDoctor().GetAsync<string>($"/api/attachments/{upload.Data!.Id}/file");
        stream.EnsureSuccess();

        // Unauthenticated access fails 401
        using var client = CreateClient();
        var unauth = await client.GetAsync($"/api/attachments/{upload.Data.Id}/file");
        unauth.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }
}
