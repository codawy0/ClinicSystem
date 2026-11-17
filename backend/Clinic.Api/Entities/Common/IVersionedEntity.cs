namespace Clinic.Api.Entities.Common;

/// <summary>
/// Implemented by mutable clinical and financial entities requiring optimistic concurrency control.
/// The Version property is configured as an EF Core concurrency token and auto-incremented on update.
/// </summary>
public interface IVersionedEntity
{
    long Version { get; set; }
}
