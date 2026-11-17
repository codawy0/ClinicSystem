using System;
using System.Linq;
using System.Windows;
using Application = System.Windows.Application;
using Clinic.Desktop.Views;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Screen = System.Windows.Forms.Screen;

namespace Clinic.Desktop.Services;

public class DualMonitorManager : IDisposable
{
    private readonly CoreWebView2Environment _env;
    private readonly string _baseUrl;
    private readonly string _tvToken;
    private TvWindow? _tvWindow;
    private bool _isDisposed;

    public DualMonitorManager(CoreWebView2Environment env, string baseUrl = "http://127.0.0.1:5000", string tvToken = "dev-tv-token")
    {
        _env = env ?? throw new ArgumentNullException(nameof(env));
        _baseUrl = string.IsNullOrWhiteSpace(baseUrl) ? "http://127.0.0.1:5000" : baseUrl;
        _tvToken = string.IsNullOrWhiteSpace(tvToken) ? "dev-tv-token" : tvToken;

        SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
    }

    public string BuildTvUrl()
    {
        return $"{_baseUrl.TrimEnd('/')}/tv-queue?tvToken={Uri.EscapeDataString(_tvToken)}";
    }

    public void LaunchTvScreen(bool forceWindowed = false)
    {
        string tvUrl = BuildTvUrl();
        var screens = Screen.AllScreens;
        var secondaryScreen = screens.FirstOrDefault(s => !s.Primary);

        if (_tvWindow != null && _tvWindow.IsLoaded)
        {
            _tvWindow.Activate();
            return;
        }

        if (secondaryScreen != null && !forceWindowed)
        {
            // Dual Monitor: Fullscreen on Secondary Screen
            _tvWindow = new TvWindow(_env, tvUrl, secondaryScreen);
            _tvWindow.Show();
        }
        else
        {
            // Single Monitor or manual test: Windowed Mode
            _tvWindow = new TvWindow(_env, tvUrl, null);
            _tvWindow.Show();
        }

        _tvWindow.Closed += (s, e) => _tvWindow = null;
    }

    public void CloseTvScreen()
    {
        if (_tvWindow != null)
        {
            _tvWindow.Close();
            _tvWindow = null;
        }
    }

    private void OnDisplaySettingsChanged(object? sender, EventArgs e)
    {
        Application.Current?.Dispatcher.Invoke(() =>
        {
            if (_tvWindow == null || !_tvWindow.IsLoaded)
                return;

            var screens = Screen.AllScreens;
            var secondaryScreen = screens.FirstOrDefault(s => !s.Primary);

            if (secondaryScreen != null)
            {
                // Reposition to newly detected secondary display
                _tvWindow.RepositionToScreen(secondaryScreen);
            }
            else
            {
                // Fallback to windowed mode if secondary display was unplugged
                _tvWindow.RevertToWindowed();
            }
        });
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged;
        CloseTvScreen();
        _isDisposed = true;
    }
}
