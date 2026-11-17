using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinic.Api.Data;
using Clinic.Api.Models.Shifts;
using Clinic.Api.Services;

namespace Clinic.Api.Controllers;

[Route("api/[controller]")]
[Authorize]
public class ShiftsController : ApiControllerBase
{
    private readonly IShiftService _shiftService;
    private readonly ClinicDbContext _context;
    private readonly ILogger<ShiftsController> _logger;

    public ShiftsController(IShiftService shiftService, ClinicDbContext context, ILogger<ShiftsController> logger)
    {
        _shiftService = shiftService;
        _context = context;
        _logger = logger;
    }

    [HttpGet("current")]
    public async Task<ActionResult<CurrentShiftStatusDto>> GetCurrentShift()
    {
        int userId = GetCurrentUserId();
        var shiftSummary = await _shiftService.GetCurrentShiftAsync(userId);

        return Ok(new CurrentShiftStatusDto
        {
            HasActiveShift = shiftSummary != null,
            Shift = shiftSummary
        });
    }

    [HttpPost("open")]
    public async Task<ActionResult<ShiftSummaryDto>> OpenShift([FromBody] OpenShiftRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int userId = GetCurrentUserId();

        try
        {
            var shift = await _shiftService.OpenShiftAsync(userId, request.OpeningBalancePiastres, request.Notes);
            var summary = await _shiftService.GetCurrentShiftAsync(userId);
            return Ok(summary);
        }
        catch (InvalidOperationException ex) when (ex.Message == "ACTIVE_SHIFT_EXISTS")
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "ACTIVE_SHIFT_EXISTS",
                detail: "يوجد وردية نشطة مفتوحة بالفعل للمستخدم الحالي. يجب إغلاق الوردية الحالية أولاً.");
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "DbUpdateException on open shift");
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "ACTIVE_SHIFT_EXISTS",
                detail: "يوجد وردية نشطة مفتوحة بالفعل للمستخدم الحالي.");
        }
    }

    [HttpPost("expense")]
    public async Task<IActionResult> RecordExpense([FromBody] RecordExpenseRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int userId = GetCurrentUserId();

        try
        {
            var tx = await _shiftService.RecordExpenseAsync(
                userId, request.AmountPiastres, request.Category, request.Description, request.IdempotencyKey);

            return Ok(new
            {
                success = true,
                transactionId = tx.Id,
                amountPiastres = tx.AmountPiastres,
                category = tx.ExpenseCategory,
                description = tx.Description,
                createdAtUtc = tx.CreatedAtUtc
            });
        }
        catch (InvalidOperationException ex) when (ex.Message == "NO_ACTIVE_SHIFT")
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "NO_ACTIVE_SHIFT",
                detail: "لا توجد وردية نشطة مفتوحة حالياً لتسجيل المصروف.");
        }
    }

    [HttpPost("close")]
    public async Task<ActionResult<ShiftCloseResponseDto>> CloseShift([FromBody] CloseShiftRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        int userId = GetCurrentUserId();

        // Determine target shift ID: explicit ShiftId, active shift, or latest shift for concurrency verification
        int targetShiftId;
        if (request.ShiftId.HasValue && request.ShiftId.Value > 0)
        {
            targetShiftId = request.ShiftId.Value;
        }
        else
        {
            var activeSummary = await _shiftService.GetCurrentShiftAsync(userId);
            if (activeSummary != null)
            {
                targetShiftId = activeSummary.ShiftId;
            }
            else
            {
                // Check if user's latest shift was concurrently closed with a mismatched version
                var latestShift = await _context.Shifts
                    .Where(s => s.UserId == userId)
                    .OrderByDescending(s => s.Id)
                    .FirstOrDefaultAsync();

                if (latestShift != null && latestShift.Version != request.Version)
                {
                    targetShiftId = latestShift.Id;
                }
                else
                {
                    return Problem(
                        statusCode: StatusCodes.Status400BadRequest,
                        title: "NO_ACTIVE_SHIFT",
                        detail: "لا توجد وردية نشطة مفتوحة حالياً لإغلاقها.");
                }
            }
        }

        try
        {
            var response = await _shiftService.CloseShiftAsync(
                userId, targetShiftId, request.ActualClosingCashPiastres, request.ClosingNotes, request.Version);

            return Ok(response);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("الوردية غير موجودة");
        }
        catch (InvalidOperationException ex) when (ex.Message == "SHIFT_ALREADY_CLOSED")
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "SHIFT_ALREADY_CLOSED",
                detail: "الوردية مغلقة بالفعل.");
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "CONCURRENCY_CONFLICT",
                detail: "تم تعديل بيانات الوردية من قبل مستخدم أو عملية أخرى. يرجى تحديث الصفحة والمحاولة مجدداً.");
        }
    }
}
