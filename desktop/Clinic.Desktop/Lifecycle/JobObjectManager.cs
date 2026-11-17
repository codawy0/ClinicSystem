using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Clinic.Desktop.Native;

namespace Clinic.Desktop.Lifecycle;

/// <summary>
/// Manages a Windows Job Object configured with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.
/// Any child process assigned to this job will be terminated unconditionally by the OS
/// kernel if Clinic.Desktop terminates, crashes, or is killed via Task Manager.
/// </summary>
public sealed class JobObjectManager : IDisposable
{
    private readonly SafeJobHandle _jobHandle;
    private bool _disposed;

    public JobObjectManager(string? jobName = null)
    {
        _jobHandle = NativeMethods.CreateJobObject(IntPtr.Zero, jobName);
        if (_jobHandle.IsInvalid)
        {
            int error = Marshal.GetLastWin32Error();
            throw new Win32Exception(error, $"Failed to create Job Object. Win32 error: {error}");
        }

        ConfigureKillOnClose();
    }

    private void ConfigureKillOnClose()
    {
        var info = new NativeMethods.JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = NativeMethods.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        int length = Marshal.SizeOf(typeof(NativeMethods.JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr infoPtr = Marshal.AllocHGlobal(length);

        try
        {
            Marshal.StructureToPtr(info, infoPtr, false);

            if (!NativeMethods.SetInformationJobObject(
                _jobHandle,
                NativeMethods.JobObjectExtendedLimitInformation,
                infoPtr,
                (uint)length))
            {
                int error = Marshal.GetLastWin32Error();
                throw new Win32Exception(error, $"Failed to configure JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. Win32 error: {error}");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(infoPtr);
        }
    }

    /// <summary>
    /// Assigns a running process to the Job Object.
    /// </summary>
    /// <param name="process">The child process to supervise.</param>
    /// <returns>True if assigned successfully.</returns>
    public bool AssignProcess(Process process)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(process);

        if (process.HasExited)
        {
            Trace.WriteLine($"[JobObjectManager] Process {process.Id} has already exited; skipping assignment.");
            return false;
        }

        if (!NativeMethods.AssignProcessToJobObject(_jobHandle, process.Handle))
        {
            int error = Marshal.GetLastWin32Error();
            // Error code 5 = ERROR_ACCESS_DENIED, 6 = ERROR_INVALID_HANDLE
            throw new Win32Exception(error, $"Failed to assign Process ID {process.Id} to Job Object. Win32 error: {error}");
        }

        Trace.WriteLine($"[JobObjectManager] Process {process.Id} ({process.ProcessName}) successfully bound to Job Object.");
        return true;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _jobHandle.Dispose();
    }
}
