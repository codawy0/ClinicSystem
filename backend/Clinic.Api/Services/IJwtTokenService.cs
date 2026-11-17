using Clinic.Api.Entities;

namespace Clinic.Api.Services;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}
