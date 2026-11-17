using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Clinic.Desktop.Native;

/// <summary>
/// SafeHandle wrapper for Windows Job Object kernel handle to prevent resource leaks.
/// </summary>
public sealed class SafeJobHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeJobHandle() : base(ownsHandle: true) { }

    public SafeJobHandle(IntPtr handle, bool ownsHandle) : base(ownsHandle)
    {
        SetHandle(handle);
    }

    protected override bool ReleaseHandle()
    {
        return NativeMethods.CloseHandle(handle);
    }
}
