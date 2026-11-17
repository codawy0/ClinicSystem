using Clinic.E2ETests.Fixtures;
using Clinic.E2ETests.Infrastructure;
using Clinic.E2ETests.Models;
using FluentAssertions;
using Xunit;

namespace Clinic.E2ETests.Tier2_BoundaryAndCorner;

[Trait("Category", "E2E")]
[Trait("Tier", "2")]
[Trait("Feature", "F07")]
public class T2_07_ShiftNegativeCashTests : E2ETestBase
{
    public T2_07_ShiftNegativeCashTests(ClinicTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task T2_F07_01_OpenShift_WhenAlreadyOpen_Returns400()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var secondOpen = await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
        secondOpen.ShouldBeBadRequest();
    }

    [Fact]
    public async Task T2_F07_02_OpenShift_NegativeBalance_Returns400()
    {
        // Close shift first
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        if (cur.IsSuccessStatusCode && cur.Data?.HasActiveShift == true && cur.Data.Shift != null)
        {
            await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", 
                new CloseShiftRequest(cur.Data.Shift.ExpectedClosingCashPiastres, "Reset", cur.Data.Shift.Version));
        }

        var open = await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(-100L));
        open.ShouldBeBadRequest();

        // Restore shift
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T2_F07_03_RecordExpense_NoActiveShift_Returns400()
    {
        // Close shift
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        if (cur.IsSuccessStatusCode && cur.Data?.HasActiveShift == true && cur.Data.Shift != null)
        {
            await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", 
                new CloseShiftRequest(cur.Data.Shift.ExpectedClosingCashPiastres, "Close for test", cur.Data.Shift.Version));
        }

        var expense = await Api.AsReceptionist(4).PostAsync<object>("/api/shifts/expense", new RecordExpenseRequest(5000L, "Cat", "Desc"));
        expense.ShouldBeBadRequest();

        // Restore shift
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T2_F07_04_CloseShift_ShortageAndSurplusCalculated()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        cur.EnsureSuccess();

        var expected = cur.Data!.Shift!.ExpectedClosingCashPiastres;
        var version = cur.Data.Shift.Version;

        // Submit 5000 less than expected -> shortage of -5000
        var closeRes = await Api.AsReceptionist(4).PostAsync<CloseShiftResponse>("/api/shifts/close", 
            new CloseShiftRequest(expected - 5000L, "Shortage", version));
        closeRes.EnsureSuccess();
        closeRes.Data!.CashDifferencePiastres.Should().Be(-5000L);

        // Reopen
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }

    [Fact]
    public async Task T2_F07_05_CloseShift_ConcurrencyConflict_Returns409()
    {
        await EnsureShiftOpenAsync(4, 50000L);
        var cur = await Api.AsReceptionist(4).GetAsync<CurrentShiftStatusDto>("/api/shifts/current");
        cur.EnsureSuccess();
        var shiftId = cur.Data!.Shift!.Id;
        var version = cur.Data.Shift.Version;
        var expected = cur.Data.Shift.ExpectedClosingCashPiastres;

        // Two simultaneous close requests on the same active shift
        var close1 = Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(expected, "First", version, shiftId));
        var close2 = Api.AsReceptionist(4).PostAsync<object>("/api/shifts/close", new CloseShiftRequest(expected, "Second", version, shiftId));

        await Task.WhenAll(close1, close2);

        var responses = new[] { close1.Result, close2.Result };
        var successCount = responses.Count(r => r.IsSuccessStatusCode);
        var conflictCount = responses.Count(r => r.StatusCode == System.Net.HttpStatusCode.Conflict);

        successCount.Should().Be(1, "exactly one concurrent shift close must succeed");
        conflictCount.Should().Be(1, "the duplicate concurrent shift close must be rejected with 409 Conflict");

        var conflictRes = responses.Single(r => r.StatusCode == System.Net.HttpStatusCode.Conflict);
        conflictRes.ShouldBeConflict();
        conflictRes.Error?.Title.Should().Be("CONCURRENCY_CONFLICT");

        // Reopen for subsequent tests
        await Api.AsReceptionist(4).PostAsync<ShiftResponse>("/api/shifts/open", new OpenShiftRequest(50000L));
    }
}
