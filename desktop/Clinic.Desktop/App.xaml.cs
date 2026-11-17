using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Application = System.Windows.Application;
using MessageBox = System.Windows.MessageBox;
using Clinic.Desktop.Lifecycle;
using Clinic.Desktop.Views;

namespace Clinic.Desktop;

public partial class App : Application
{
    private SingleInstanceManager? _singleInstanceManager;
    private JobObjectManager? _jobObjectManager;
    private BackendProcessSupervisor? _backendSupervisor;
    private SplashWindow? _splashWindow;
    private CancellationTokenSource? _startupCts;

    private string _baseUrl = "http://127.0.0.1:5000";
    private string? _dataRoot;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // 1. Single Instance Check via Named Mutex
        _singleInstanceManager = new SingleInstanceManager();
        if (!_singleInstanceManager.TryAcquire())
        {
            // Another instance is already running; it was brought to the foreground. Exit cleanly.
            Shutdown();
            return;
        }

        // 2. Global Exception Handling to ensure clean termination
        RegisterGlobalExceptionHandlers();

        // 3. Initialize Windows Job Object Child Process Manager
        try
        {
            _jobObjectManager = new JobObjectManager();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"فشل تهيئة نظام حماية العمليات في ويندوز (Windows Job Object):\n{ex.Message}",
                "خطأ في التهيئة",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Shutdown();
            return;
        }

        // 4. Load configuration parameters
        LoadConfiguration();

        // 5. Initialize and Show Splash Screen
        _splashWindow = new SplashWindow();
        MainWindow = _splashWindow;
        _splashWindow.Show();

        // 6. Initialize Backend Supervisor and Begin Boot Sequence
        _backendSupervisor = new BackendProcessSupervisor(_jobObjectManager, _baseUrl, _dataRoot);
        _splashWindow.SetLogDirectory(_backendSupervisor.LogDirectory);
        _splashWindow.RetryRequested += () => _ = LaunchBackendAsync();

        await LaunchBackendAsync();
    }

    private void LoadConfiguration()
    {
        try
        {
            string appSettingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
            if (File.Exists(appSettingsPath))
            {
                using var stream = File.OpenRead(appSettingsPath);
                using var doc = JsonDocument.Parse(stream);
                var root = doc.RootElement;
                if (root.TryGetProperty("Backend", out var backend))
                {
                    if (backend.TryGetProperty("BaseUrl", out var bu) && bu.GetString() is string b)
                        _baseUrl = b;
                }
                if (root.TryGetProperty("ClinicStorage", out var storage))
                {
                    if (storage.TryGetProperty("DataRoot", out var dr) && dr.GetString() is string d)
                        _dataRoot = d;
                }
            }
        }
        catch (Exception ex)
        {
            Trace.WriteLine($"[App] Error loading configuration: {ex.Message}");
        }
    }

    private async Task LaunchBackendAsync()
    {
        if (_backendSupervisor == null || _splashWindow == null) return;

        _startupCts?.Cancel();
        _startupCts = new CancellationTokenSource();

        try
        {
            var progress = new Progress<StartupProgress>(p =>
            {
                _splashWindow.UpdateStatus(p.Message, p.Percentage);
            });

            await _backendSupervisor.StartAsync(progress, _startupCts.Token);

            _splashWindow.UpdateStatus("تم التحقق من الخادم بنجاح! جاري تحميل واجهة النظام...", 95);
            await Task.Delay(400); // Brief visual confirmation for user

            // 7. Transition to MainWindow
            var mainWindow = new MainWindow(_baseUrl, _dataRoot);
            MainWindow = mainWindow;
            mainWindow.Show();

            _splashWindow.Close();
            _splashWindow = null;
        }
        catch (OperationCanceledException)
        {
            // User cancelled or retried
        }
        catch (Exception ex)
        {
            Trace.WriteLine($"[App] Backend startup error: {ex}");
            _splashWindow?.ShowError(ex.Message);
        }
    }

    private void RegisterGlobalExceptionHandlers()
    {
        DispatcherUnhandledException += (s, e) =>
        {
            Trace.WriteLine($"[App] DispatcherUnhandledException: {e.Exception}");
            MessageBox.Show(
                $"حدث خطأ غير متوقع في الواجهة:\n{e.Exception.Message}",
                "خطأ غير معالج",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            e.Handled = true;
        };

        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            Trace.WriteLine($"[App] AppDomain UnhandledException: {e.ExceptionObject}");
            // JobObject ensures child process dies even on hard crash
        };

        TaskScheduler.UnobservedTaskException += (s, e) =>
        {
            Trace.WriteLine($"[App] UnobservedTaskException: {e.Exception}");
            e.SetObserved();
        };
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _startupCts?.Cancel();
        _startupCts?.Dispose();

        _backendSupervisor?.Dispose();
        _jobObjectManager?.Dispose();
        _singleInstanceManager?.Dispose();

        base.OnExit(e);
    }
}
