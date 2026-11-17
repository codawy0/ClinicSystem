using Xunit;

namespace Clinic.E2ETests.Fixtures;

[CollectionDefinition("ClinicE2E")]
public class E2ETestCollection : ICollectionFixture<Clinic.E2ETests.Infrastructure.ClinicTestFixture>
{
}
