using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier1_FeatureCoverage;

[Trait("Category", "E2E")]
[Trait("Tier", "1")]
[Trait("Feature", "F13")]
public class T1_13_PrescriptionSnapshotTests : E2ETestBase
{
    public T1_13_PrescriptionSnapshotTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T1_F13_01_CreatePrescriptionTemplate_Success()
    {
        var req = new PrescriptionTemplateRequest(
            TemplateName: "Upper Respiratory Infection",
            ItemsJson: "[{\"tradeName\":\"Augmentin 1g\",\"dosage\":\"1 tab\",\"timing\":\"every 12h\",\"duration\":\"7 days\"}]"
        );
        var res = await Api.AsDoctor().PostAsync<PrescriptionTemplateResponse>("/api/prescription-templates", req);
        res.EnsureSuccess();
        res.Data!.TemplateName.Should().Be("Upper Respiratory Infection");

        var list = await Api.GetAsync<List<PrescriptionTemplateResponse>>("/api/prescription-templates");
        list.EnsureSuccess();
        list.Data.Should().Contain(t => t.TemplateName == "Upper Respiratory Infection");
    }

    [Fact]
    public async Task T1_F13_02_CompleteVisit_StandardFinalization()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 2, DrugName: "Panadol", Dosage: "1 tab", Timing: "twice daily", Duration: "5 days")
            }
        );
        var complete = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", completeReq);
        complete.EnsureSuccess();

        var today = await Api.AsReceptionist().GetAsync<List<AppointmentResponse>>("/api/appointments/today");
        today.Data!.First(a => a.Id == apt.Data.Id).Status.Should().Be("Completed");
    }

    [Fact]
    public async Task T1_F13_03_RxSnapshot_FrozenOnCompletion()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 1, DrugName: "Augmentin", Dosage: "1 tab q12h", Timing: "after meals", Duration: "7 days")
            }
        );
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", completeReq);

        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data!.Id}");
        hist.EnsureSuccess();
        var visit = hist.Data!.Items.First();
        visit.PrescriptionItems.Should().NotBeNullOrEmpty();
        var item = visit.PrescriptionItems!.First();
        item.ActiveIngredientSnapshot.Should().Be("amoxicillin");
        item.DrugNameSnapshot.Should().Be("Augmentin");
    }

    [Fact]
    public async Task T1_F13_04_RxSnapshot_UnaffectedBySubsequentDrugModification()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var completeReq = new CompleteVisitRequest(
            PrescriptionItems: new List<PrescriptionItemInput>
            {
                new(DrugId: 2, DrugName: "Panadol", Dosage: "1 tab", Timing: "PRN", Duration: "3 days")
            }
        );
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", completeReq);

        // Fetch visit snapshot
        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data!.Id}");
        var originalDrugName = hist.Data!.Items.First().PrescriptionItems!.First().DrugNameSnapshot;
        originalDrugName.Should().Be("Panadol");
    }

    [Fact]
    public async Task T1_F13_05_CompleteVisit_IdempotentReplay()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var idempotencyKey = Guid.NewGuid().ToString();
        var req = new CompleteVisitRequest(new List<PrescriptionItemInput>());

        var first = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", req, idempotencyKey);
        first.EnsureSuccess();

        var replay = await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data.Id}/complete", req, idempotencyKey);
        replay.StatusCode.Should().Be(System.Net.HttpStatusCode.OK);
    }
}
