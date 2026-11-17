using System;
using System.Diagnostics;
using System.Threading;
using Clinic.Desktop.Native;

namespace Clinic.Desktop.Lifecycle;

/// <summary>
/// Guarantees that only a single instance of Clinic.Desktop runs in the current user session.
/// Brings any existing instance window to the foreground if a second instance attempts to launch.
/// </summary>
public sealed class SingleInstanceManager : IDisposable
{
    public const string DefaultMutexName = @"Local\ClinicManagementSystem_SingleInstance_Mutex";
    public const string WindowTitle = "نظام إدارة العيادة الطبية";

    private readonly string _mutexName;
    private Mutex? _mutex;
    private bool _hasHandle;
    private bool _disposed;

    public SingleInstanceManager(string mutexName = DefaultMutexName)
    {
        _mutexName = mutexName;
    }

    /// <summary>
    /// Attempts to acquire the single-instance mutex.
    /// If another instance exists, activates the existing window and returns false.
    /// </summary>
    public bool TryAcquire()
    {
        try
        {
            _mutex = new Mutex(true, _mutexName, out bool createdNew);
            if (createdNew)
            {
                _hasHandle = true;
                return true;
            }

            // Another instance is running; activate it and exit
            ActivateExistingInstance();
            return false;
        }
        catch (AbandonedMutexException)
        {
            // Previous instance crashed or died without releasing mutex. Current process takes ownership.
            _hasHandle = true;
            return true;
        }
        catch (Exception ex)
        {
            Trace.WriteLine($"[SingleInstanceManager] Error checking mutex: {ex.Message}");
            // Fall back to allowing launch if mutex creation failed due to security restrictions
            return true;
        }
    }

    /// <summary>
    /// Finds the existing application instance window and restores/focuses it.
    /// </summary>
    public static void ActivateExistingInstance()
    {
        try
        {
            IntPtr hWnd = NativeMethods.FindWindow(null, WindowTitle);

            if (hWnd == IntPtr.Zero)
            {
                // Fall back: search top-level windows of processes matching current process name
                var currentProcess = Process.GetCurrentProcess();
                var processes = Process.GetProcessesByName(currentProcess.ProcessName);

                foreach (var p in processes)
                {
                    if (p.Id != currentProcess.Id && p.MainWindowHandle != IntPtr.Zero)
                    {
                        hWnd = p.MainWindowHandle;
                        break;
                    }
                }
            }

            if (hWnd != IntPtr.Zero)
            {
                if (NativeMethods.IsIconic(hWnd))
                {
                    NativeMethods.ShowWindow(hWnd, NativeMethods.SW_RESTORE);
                }
                else
                {
                    NativeMethods.ShowWindow(hWnd, NativeMethods.SW_SHOW);
                }

                NativeMethods.SetForegroundWindow(hWnd);
                NativeMethods.BringWindowToTop(hWnd);
            }
        }
        catch (Exception ex)
        {
            Trace.WriteLine($"[SingleInstanceManager] Failed to activate existing window: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        if (_hasHandle && _mutex != null)
        {
            try
            {
                _mutex.ReleaseMutex();
            }
            catch (Exception ex)
            {
                Trace.WriteLine($"[SingleInstanceManager] Exception releasing mutex: {ex.Message}");
            }
        }

        _mutex?.Dispose();
        _mutex = null;
        _hasHandle = false;
    }
}
