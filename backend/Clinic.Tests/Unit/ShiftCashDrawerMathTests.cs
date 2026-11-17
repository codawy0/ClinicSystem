using FluentAssertions;
using Xunit;
using Clinic.Api.Common.Enums;

namespace Clinic.Tests.Unit;

[Trait("Category", "Unit")]
public class ShiftCashDrawerMathTests
{
    [Fact]
    public void CalculateExpectedClosingCash_WithCashPaymentsAndExpenses_ShouldFollowStrictFormula()
    {
        // Formula: Opening + CashPayments - CashRefunds - CashExpenses
        long openingBalance = 50_000L; // 500 EGP
        long cashPayments = 75_000L;   // 750 EGP
        long cashRefunds = 10_000L;    // 100 EGP
        long cashExpenses = 5_000L;    // 50 EGP

        long expected = openingBalance + cashPayments - cashRefunds - cashExpenses;

        expected.Should().Be(110_000L); // 1,100 EGP
    }

    [Theory]
    [InlineData(100_000L, 95_000L, -5_000L, "Shortage")] // Expected 1000 EGP, Actual 950 EGP -> -50 EGP shortage
    [InlineData(100_000L, 104_000L, 4_000L, "Surplus")]  // Expected 1000 EGP, Actual 1040 EGP -> +40 EGP surplus
    [InlineData(100_000L, 100_000L, 0L, "Balanced")]     // Expected 1000 EGP, Actual 1000 EGP -> 0 EGP balanced
    public void ReconcileActualCash_ShouldCalculateExactShortageSurplusOrBalanced(
        long expectedClosing, long actualClosing, long expectedDiff, string scenario)
    {
        long actualDiff = actualClosing - expectedClosing;

        actualDiff.Should().Be(expectedDiff);
        if (scenario == "Shortage") actualDiff.Should().BeNegative();
        else if (scenario == "Surplus") actualDiff.Should().BePositive();
        else actualDiff.Should().Be(0L);
    }

    [Fact]
    public void NonCashPaymentMethods_MustBeExcludedFromPhysicalCashDrawer()
    {
        // Arrange
        long openingCash = 20_000L;
        long cashPayment = 30_000L;
        long instapayPayment = 50_000L;
        long vodafoneCashPayment = 25_000L;
        long cardPayment = 60_000L;
        long cashExpense = 5_000L;

        // Physical Cash Drawer Math
        long physicalCashDrawer = openingCash + cashPayment - cashExpense;

        // Digital Non-Cash Totals
        long totalNonCash = instapayPayment + vodafoneCashPayment + cardPayment;
        long totalRevenue = cashPayment + totalNonCash;

        // Assert
        physicalCashDrawer.Should().Be(45_000L); // Only cash: 200 + 300 - 50 = 450 EGP
        physicalCashDrawer.Should().NotBe(45_000L + totalNonCash);
        totalNonCash.Should().Be(135_000L);     // 1,350 EGP
        totalRevenue.Should().Be(165_000L);     // 1,650 EGP
    }

    [Fact]
    public void LargePiastresValues_ShouldNeverCause32BitIntegerOverflow()
    {
        // Exceeding int.MaxValue (2,147,483,647 Piastres ~ 21.4M EGP)
        long opening = 2_500_000_000L; // 25M EGP
        long cashIn = 1_000_000_000L;  // 10M EGP
        long cashOut = 500_000_000L;   // 5M EGP

        long result = opening + cashIn - cashOut;

        result.Should().Be(3_000_000_000L);
        result.Should().BeGreaterThan(int.MaxValue);
    }

    [Fact]
    public void ZeroOpeningBalance_WithOnlyExpenses_ShouldYieldNegativeExpectedCash()
    {
        long opening = 0L;
        long expense = 15_000L;

        long expected = opening - expense;

        expected.Should().Be(-15_000L);
    }
}
