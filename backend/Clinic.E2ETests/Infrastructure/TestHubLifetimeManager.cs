using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Clinic.Api.Hubs;

namespace Clinic.E2ETests.Infrastructure;

public class TestHubLifetimeManager : DefaultHubLifetimeManager<QueueHub>
{
    private static readonly ConcurrentDictionary<Guid, Action<string, object?[]>> _subscribers = new();

    public TestHubLifetimeManager(ILogger<DefaultHubLifetimeManager<QueueHub>> logger) : base(logger)
    {
    }

    public static IDisposable RegisterListener(Action<string, object?[]> callback)
    {
        var id = Guid.NewGuid();
        _subscribers[id] = callback;
        return new Unsubscriber(() => _subscribers.TryRemove(id, out _));
    }

    public override async Task SendGroupAsync(string groupName, string methodName, object?[] args, CancellationToken cancellationToken = default)
    {
        await base.SendGroupAsync(groupName, methodName, args, cancellationToken);
        Dispatch(methodName, args);
    }

    public override async Task SendAllAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
    {
        await base.SendAllAsync(methodName, args, cancellationToken);
        Dispatch(methodName, args);
    }

    private static void Dispatch(string methodName, object?[] args)
    {
        foreach (var listener in _subscribers.Values)
        {
            try
            {
                listener(methodName, args);
            }
            catch
            {
                // Ignore listener exceptions
            }
        }
    }

    private sealed class Unsubscriber : IDisposable
    {
        private readonly Action _unsubscribe;
        private bool _disposed;

        public Unsubscriber(Action unsubscribe) => _unsubscribe = unsubscribe;

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                _unsubscribe();
            }
        }
    }
}
