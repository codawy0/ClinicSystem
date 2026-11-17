namespace Clinic.Api.Infrastructure;

public interface IBookingWriteLock
{
    Task<T> ExecuteAsync<T>(Func<Task<T>> action, int timeoutMs = 10000, CancellationToken cancellationToken = default);
    Task ExecuteAsync(Func<Task> action, int timeoutMs = 10000, CancellationToken cancellationToken = default);
}

public sealed class BookingWriteLock : IBookingWriteLock, IDisposable
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private bool _disposed;

    public async Task<T> ExecuteAsync<T>(
        Func<Task<T>> action, 
        int timeoutMs = 10000, 
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(action);

        bool entered = await _semaphore.WaitAsync(timeoutMs, cancellationToken);
        if (!entered)
        {
            throw new TimeoutException($"Timed out after {timeoutMs}ms waiting for BookingWriteLock.");
        }

        try
        {
            return await action();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task ExecuteAsync(
        Func<Task> action, 
        int timeoutMs = 10000, 
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(action);

        bool entered = await _semaphore.WaitAsync(timeoutMs, cancellationToken);
        if (!entered)
        {
            throw new TimeoutException($"Timed out after {timeoutMs}ms waiting for BookingWriteLock.");
        }

        try
        {
            await action();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
            _semaphore.Dispose();
        }
    }
}
