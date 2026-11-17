using System;
using System.Drawing.Printing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Clinic.Desktop.Services;

public class SilentPrintMessage
{
    public string? Action { get; set; }
    public string? PrinterType { get; set; } // "Prescription", "Receipt", "LabSlip", "SickLeave"
    public string? Html { get; set; }
    public SilentPrintOptions? Options { get; set; }
}

public class SilentPrintOptions
{
    public string? PageSize { get; set; } // "A4", "A5", "Thermal80mm"
    public string? Orientation { get; set; } // "portrait", "landscape"
}

public class SilentPrintResult
{
    public bool Success { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PrinterName { get; set; } = string.Empty;
    public string? Error { get; set; }
}

public class SilentPrintManager
{
    private readonly CoreWebView2Environment _env;
    private readonly WebView2 _printWebView;
    private readonly string? _prescriptionPrinter;
    private readonly string? _receiptPrinter;
    private readonly SemaphoreSlim _printLock = new(1, 1);

    public SilentPrintManager(
        CoreWebView2Environment env,
        WebView2 printWebView,
        string? prescriptionPrinter = null,
        string? receiptPrinter = null)
    {
        _env = env ?? throw new ArgumentNullException(nameof(env));
        _printWebView = printWebView ?? throw new ArgumentNullException(nameof(printWebView));
        _prescriptionPrinter = prescriptionPrinter;
        _receiptPrinter = receiptPrinter;
    }

    /// <summary>
    /// Resolves target physical printer name based on document type and system configuration
    /// </summary>
    public string ResolvePrinter(string? printerType)
    {
        try
        {
            var installedPrinters = PrinterSettings.InstalledPrinters.Cast<string>().ToHashSet(StringComparer.OrdinalIgnoreCase);
            string defaultPrinter = new PrinterSettings().PrinterName ?? string.Empty;

            string? configuredPrinter = null;
            if (string.Equals(printerType, "Receipt", StringComparison.OrdinalIgnoreCase))
            {
                configuredPrinter = _receiptPrinter;
            }
            else
            {
                // Prescription, LabSlip, SickLeave
                configuredPrinter = _prescriptionPrinter;
            }

            if (!string.IsNullOrWhiteSpace(configuredPrinter) && installedPrinters.Contains(configuredPrinter))
            {
                return configuredPrinter;
            }

            return defaultPrinter;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.WriteLine($"[SilentPrintManager] Error resolving printer: {ex.Message}");
            return string.Empty;
        }
    }

    /// <summary>
    /// Sequentially renders HTML into offscreen WebView2 and silently prints to the target printer
    /// </summary>
    public async Task<SilentPrintResult> ExecutePrintAsync(SilentPrintMessage message)
    {
        if (string.IsNullOrWhiteSpace(message.Html))
        {
            return new SilentPrintResult { Success = false, Error = "HTML content is empty" };
        }

        await _printLock.WaitAsync();
        try
        {
            string targetPrinter = ResolvePrinter(message.PrinterType);

            // 1. Load HTML into hidden offscreen WebView2
            var navTcs = new TaskCompletionSource<bool>();
            void NavHandler(object? sender, CoreWebView2NavigationCompletedEventArgs e) => navTcs.TrySetResult(e.IsSuccess);

            _printWebView.NavigationCompleted += NavHandler;
            try
            {
                _printWebView.NavigateToString(message.Html);
                bool loaded = await navTcs.Task;
                if (!loaded)
                {
                    return new SilentPrintResult { Success = false, Error = "Failed to load HTML in print WebView2" };
                }
            }
            finally
            {
                _printWebView.NavigationCompleted -= NavHandler;
            }

            // 2. Allow 120ms stabilization for typography / styles layout settling
            await Task.Delay(120);

            // 3. Configure CoreWebView2PrintSettings
            var printSettings = _env.CreatePrintSettings();
            if (!string.IsNullOrWhiteSpace(targetPrinter))
            {
                printSettings.PrinterName = targetPrinter;
            }
            printSettings.ShouldPrintBackgrounds = true;
            printSettings.ShouldPrintHeaderAndFooter = false;
            printSettings.HeaderTitle = string.Empty;
            printSettings.FooterUri = string.Empty;
            printSettings.Copies = 1;

            if (string.Equals(message.Options?.Orientation, "landscape", StringComparison.OrdinalIgnoreCase))
            {
                printSettings.Orientation = CoreWebView2PrintOrientation.Landscape;
            }
            else
            {
                printSettings.Orientation = CoreWebView2PrintOrientation.Portrait;
            }

            // 4. Perform non-interactive silent print
            var status = await _printWebView.CoreWebView2.PrintAsync(printSettings);

            return new SilentPrintResult
            {
                Success = status == CoreWebView2PrintStatus.Succeeded,
                Status = status.ToString(),
                PrinterName = targetPrinter
            };
        }
        catch (Exception ex)
        {
            return new SilentPrintResult
            {
                Success = false,
                Status = CoreWebView2PrintStatus.OtherError.ToString(),
                Error = ex.Message
            };
        }
        finally
        {
            _printLock.Release();
        }
    }
}
