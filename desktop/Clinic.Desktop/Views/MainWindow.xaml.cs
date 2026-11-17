using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Clinic.Desktop.Services;
using Microsoft.Web.WebView2.Core;
using Screen = System.Windows.Forms.Screen;

namespace Clinic.Desktop.Views;

public partial class MainWindow : Window
{
    private string _baseUrl = "http://127.0.0.1:5000";
    private string _dataRoot = string.Empty;
    private string _prescriptionPrinter = string.Empty;
    private string _receiptPrinter = string.Empty;
    private bool _autoLaunchTv = true;
    private string _tvToken = "dev-tv-token";

    private CoreWebView2Environment? _env;
    private SilentPrintManager? _silentPrintManager;
    private DualMonitorManager? _dualMonitorManager;

    public MainWindow(string? baseUrl = null, string? dataRoot = null)
    {
        InitializeComponent();

        LoadConfiguration();

        if (!string.IsNullOrWhiteSpace(baseUrl))
            _baseUrl = baseUrl;
        if (!string.IsNullOrWhiteSpace(dataRoot))
            _dataRoot = dataRoot;

        Loaded += OnMainWindowLoaded;
        Closing += OnMainWindowClosing;
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
                if (root.TryGetProperty("Printers", out var printers))
                {
                    if (printers.TryGetProperty("Prescription", out var rx) && rx.GetString() is string r)
                        _prescriptionPrinter = r;
                    if (printers.TryGetProperty("Receipt", out var rc) && rc.GetString() is string c)
                        _receiptPrinter = c;
                }
                if (root.TryGetProperty("Tv", out var tv))
                {
                    if (tv.TryGetProperty("AutoLaunch", out var al))
                        _autoLaunchTv = al.GetBoolean();
                    if (tv.TryGetProperty("TvToken", out var tt) && tt.GetString() is string t)
                        _tvToken = t;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.WriteLine($"[MainWindow] Config load error: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(_dataRoot))
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(baseDir, "Clinic.Api.exe")) || File.Exists(Path.Combine(baseDir, "api", "Clinic.Api.exe")))
            {
                string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                _dataRoot = Path.Combine(programData, "ClinicSystem");
            }
            else
            {
                var current = new DirectoryInfo(baseDir);
                string? solDir = null;
                while (current != null && current.Exists)
                {
                    if (File.Exists(Path.Combine(current.FullName, "ClinicSystem.sln")))
                    {
                        solDir = current.FullName;
                        break;
                    }
                    current = current.Parent;
                }
                _dataRoot = solDir != null ? Path.Combine(solDir, ".clinic-data") : Path.Combine(baseDir, ".clinic-data");
            }
        }

        _dataRoot = Path.GetFullPath(_dataRoot);
    }

    private async void OnMainWindowLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            TxtLoadingMessage.Text = "جاري تهيئة محرك العرض والطباعة...";

            // 1. Initialize Shared CoreWebView2Environment with isolated UserDataFolder
            string userDataFolder = Path.Combine(_dataRoot, "webview2_data");
            Directory.CreateDirectory(userDataFolder);

            _env = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userDataFolder,
                options: new CoreWebView2EnvironmentOptions()
            );

            // 2. Initialize Offscreen Silent Print WebView2
            await PrintWebView.EnsureCoreWebView2Async(_env);
            _silentPrintManager = new SilentPrintManager(_env, PrintWebView, _prescriptionPrinter, _receiptPrinter);

            // Update printer status in top strip
            string rxPrinter = _silentPrintManager.ResolvePrinter("Prescription");
            TxtPrinterInfo.Text = string.IsNullOrEmpty(rxPrinter) ? "الطابعة: جاهزة (افتراضية)" : $"الطابعة: {rxPrinter}";

            // 3. Initialize Main WebView2
            await MainWebView.EnsureCoreWebView2Async(_env);
            MainWebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            MainWebView.NavigationCompleted += (s, args) =>
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
            };

            // 4. Navigate to local SPA URL
            MainWebView.CoreWebView2.Navigate(_baseUrl);

            // 5. Initialize Dual-Monitor TV Screen
            _dualMonitorManager = new DualMonitorManager(_env, _baseUrl, _tvToken);
            if (_autoLaunchTv && Screen.AllScreens.Length > 1)
            {
                _dualMonitorManager.LaunchTvScreen(forceWindowed: false);
            }
        }
        catch (Exception ex)
        {
            TxtLoadingMessage.Text = $"حدث خطأ أثناء تشغيل النظام: {ex.Message}";
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            string rawJson = string.Empty;
            try
            {
                rawJson = e.TryGetWebMessageAsString();
            }
            catch
            {
                // Ignored: thrown if message is an object instead of raw string
            }

            if (string.IsNullOrWhiteSpace(rawJson))
            {
                rawJson = e.WebMessageAsJson;
            }

            using var doc = JsonDocument.Parse(rawJson);
            if (!doc.RootElement.TryGetProperty("action", out var actionProp))
                return;

            string action = actionProp.GetString() ?? string.Empty;
            if (string.Equals(action, "silentPrint", StringComparison.OrdinalIgnoreCase))
            {
                var printMsg = JsonSerializer.Deserialize<SilentPrintMessage>(rawJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (printMsg != null && _silentPrintManager != null)
                {
                    var result = await _silentPrintManager.ExecutePrintAsync(printMsg);

                    // Post response back to frontend React SPA
                    MainWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
                    {
                        action = "silentPrintResult",
                        success = result.Success,
                        status = result.Status,
                        printer = result.PrinterName,
                        error = result.Error
                    }));
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[IPC Error] {ex}");
        }
    }

    private void BtnTvToggle_Click(object sender, RoutedEventArgs e)
    {
        _dualMonitorManager?.LaunchTvScreen(forceWindowed: Screen.AllScreens.Length <= 1);
    }

    private void BtnReload_Click(object sender, RoutedEventArgs e)
    {
        MainWebView.CoreWebView2?.Reload();
    }

    private void OnMainWindowClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _dualMonitorManager?.Dispose();
    }
}
