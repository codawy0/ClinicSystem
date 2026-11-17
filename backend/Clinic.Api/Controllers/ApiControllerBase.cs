using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Clinic.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(claim, out var id))
        {
            return id;
        }
        throw new UnauthorizedAccessException("Current user ID not found in token claims");
    }

    protected string GetCurrentUsername()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;
    }

    protected string GetCurrentUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    }
}
