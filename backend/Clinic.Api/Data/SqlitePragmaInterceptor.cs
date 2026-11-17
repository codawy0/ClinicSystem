using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Clinic.Api.Data;

public sealed class SqlitePragmaInterceptor : DbConnectionInterceptor
{
    private const string PragmaCommands = 
        "PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand();
        command.CommandText = PragmaCommands;
        command.ExecuteNonQuery();
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, 
        ConnectionEndEventData eventData, 
        CancellationToken cancellationToken = default)
    {
        using var command = connection.CreateCommand();
        command.CommandText = PragmaCommands;
        await command.ExecuteNonQueryAsync(cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }
}
