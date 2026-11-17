using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F11")]
public class T2_11_VitalsExtremeAlertsTests : E2ETestBase
{
    public T2_11_VitalsExtremeAlertsTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F11_01_VitalsExtremeValues_Recorded()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var req = new VitalsRequest(
            BpSystolic: 220,
            BpDiastolic: 130,
            PulseBpm: 140,
            TempCelsius: 40.5,
            Version: 1
        );
        var res = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/vitals", req);
        res.EnsureSuccess();
        res.Data!.BpSystolic.Should().Be(220);
    }

    [Fact]
    public async Task T2_F11_02_VitalsNegativeOrImpossibleValues_Returns400()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var req = new VitalsRequest(
            BpSystolic: -10,
            BpDiastolic: 80,
            PulseBpm: 70,
            TempCelsius: 12.0,
            Version: 1
        );
        var res = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/vitals", req);
        res.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F11_03_VitalsConcurrencyConflict_Returns409()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var req = new VitalsRequest(120, 80, 72, 37.0, Version: 999);
        var res = await Api.AsNurse().PutAsync<MedicalVisitResponse>($"/api/visits/appointment/{apt.Data!.Id}/vitals", req);
        res.ShouldBeConflict();
    }

    [Fact]
    public async Task T2_F11_04_DraftAutosaveOnCompletedVisit_Returns400()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        // Complete visit
        await Api.AsDoctor().PostAsync<object>($"/api/visits/appointment/{apt.Data!.Id}/complete", new CompleteVisitRequest(new List<PrescriptionItemInput>()));

        // Attempt draft autosave on completed visit
        var draft = await Api.AsDoctor().PutAsync<object>($"/api/visits/appointment/{apt.Data.Id}/draft", new DraftVisitRequest("Complaint", "Exam", "Diag", 1));
        draft.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F11_05_AddendumOnDraftVisit_Returns400()
    {
        await EnsureShiftOpenAsync();
        var pat = await Api.AsReceptionist().PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt = await Api.AsReceptionist().PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat.Data!.Id));

        var hist = await Api.AsDoctor().GetAsync<PagedResult<MedicalVisitResponse>>($"/api/visits/patient/{pat.Data!.Id}");
        var mvId = hist.Data!.Items.First().Id;

        // Attempt addendum while still draft
        var addendum = await Api.AsDoctor().PostAsync<object>($"/api/visits/{mvId}/addendum", new AddendumRequest("Draft addendum"));
        addendum.ShouldBeBadRequest();
    }
}
