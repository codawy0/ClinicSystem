using Clinic.Api.Entities;
using Clinic.Api.Models.Shifts;

namespace Clinic.Api.Services;

public interface IShiftService
{
    Task<ShiftSummaryDto?> GetCurrentShiftAsync(int userId);
    Task<Shift> OpenShiftAsync(int userId, long openingBalancePiastres, string? notes);
    Task<FinancialTransaction> RecordExpenseAsync(int userId, long amountPiastres, string category, string description, string? idempotencyKey);
    Task<ShiftCloseResponseDto> CloseShiftAsync(int userId, int shiftId, long actualClosingCashPiastres, string? closingNotes, long version);
}
