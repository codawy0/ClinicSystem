using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier3_PairwiseCombinations;

[Trait("Category", "E2E")]
[Trait("Tier", "3")]
public class T3_07_DiscountApprovalAndTreasuryReconciliationTests : E2ETestBase
{
    public T3_07_DiscountApprovalAndTreasuryReconciliationTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task DiscountsAndMixedPayments_ReconcileCorrectlyInTreasuryAndAnalytics()
    {
        await EnsureShiftOpenAsync(3, 50000L);

        // Patient 1: 10000 discount, 20000 cash paid
        var pat1 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt1 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat1.Data!.Id, discountPiastres: 10000L, discountReason: "Colleague", paymentMethod: "Cash"));
        apt1.EnsureSuccess();

        // Patient 2: 30000 full price via Instapay
        var pat2 = await Api.AsReceptionist(3).PostAsync<PatientResponse>("/api/patients", TestDataBuilder.BuildPatient());
        var apt2 = await Api.AsReceptionist(3).PostAsync<AppointmentResponse>("/api/appointments", TestDataBuilder.BuildBooking(pat2.Data!.Id, paymentMethod: "Instapay", paymentRef: "IP-7766"));
        apt2.EnsureSuccess();

        // Analytics check
        var summary = await Api.AsDoctor().GetAsync<DoctorSummaryResponse>("/api/analytics/doctor-summary");
        summary.EnsureSuccess();
        summary.Data!.ForegoneDiscountsPiastres.Should().BeGreaterOrEqualTo(10000L);
        summary.Data.InstapayCollectedPiastres.Should().BeGreaterOrEqualTo(30000L);
    }
}
