using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Clinic.Desktop.Lifecycle;

public record StartupProgress(string Message, int Percentage);

/// <summary>
/// Supervises the lifecycle of the Clinic.Api backend child process:
/// - Resolves production vs development paths
/// - Launches process inside Windows Job Object
/// - Redirects and writes standard output & error to daily rolling log files
/// - Polls GET /api/health with backoff until healthy or 30-second timeout
/// </summary>
public sealed class BackendProcessSupervisor : IDisposable
{
    public const string DefaultBaseUrl = "http://127.0.0.1:5000";
    public const int StartupTimeoutSeconds = 30;

    private readonly JobObjectManager _jobObjectManager;
    private readonly string _baseUrl;
    private readonly string _dataRoot;
    private readonly HttpClient _httpClient;
    private readonly object _logLock = new();

    private Process? _backendProcess;
    private StreamWriter? _logWriter;
    private bool _disposed;

    public string LogDirectory { get; }
    public string HealthEndpoint => $"{_baseUrl.TrimEnd('/')}/api/health";

    public BackendProcessSupervisor(JobObjectManager jobObjectManager, string baseUrl = DefaultBaseUrl, string? dataRoot = null)
    {
        _jobObjectManager = jobObjectManager ?? throw new ArgumentNullException(nameof(jobObjectManager));
        _baseUrl = string.IsNullOrWhiteSpace(baseUrl) ? DefaultBaseUrl : baseUrl;
        
        // Resolve data and log directory (ProgramData for production, local directory for development)
        if (!string.IsNullOrWhiteSpace(dataRoot))
        {
            _dataRoot = Path.GetFullPath(dataRoot);
        }
        else
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(baseDir, "Clinic.Api.exe")) || File.Exists(Path.Combine(baseDir, "api", "Clinic.Api.exe")))
            {
                string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                _dataRoot = Path.Combine(programData, "ClinicSystem");
            }
            else
            {
                // Climb up to find solution root
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

        LogDirectory = Path.Combine(_dataRoot, "logs");
        Directory.CreateDirectory(LogDirectory);

        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(2)
        };
    }

    /// <summary>
    /// Starts the backend process and monitors health until ready.
    /// </summary>
    public async Task StartAsync(IProgress<StartupProgress>? progress = null, CancellationToken cancellationToken = default)
    {
        progress?.Report(new StartupProgress("جاري تهيئة مسار خادم العيادة...", 10));
        InitializeLogFile();

        // 1. Resolve executable or project
        var (fileName, arguments, workingDir) = ResolveBackendLaunchTarget();
        LogMessage($"[Supervisor] Launching backend: {fileName} {arguments} in '{workingDir}'");

        // 2. Prepare ProcessStartInfo
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        // Pass standard environment variables
        startInfo.EnvironmentVariables["ASPNETCORE_URLS"] = _baseUrl;
        startInfo.EnvironmentVariables["ClinicStorage__DataRoot"] = _dataRoot;

        // 3. Start Process
        _backendProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

        _backendProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) LogMessage($"[STDOUT] {e.Data}");
        };

        _backendProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data)) LogMessage($"[STDERR] {e.Data}");
        };

        if (!_backendProcess.Start())
        {
            throw new InvalidOperationException("Failed to start Clinic.Api backend process.");
        }

        _backendProcess.BeginOutputReadLine();
        _backendProcess.BeginErrorReadLine();

        // 4. Bind to Windows Job Object immediately
        _jobObjectManager.AssignProcess(_backendProcess);
        progress?.Report(new StartupProgress("جاري تشغيل خادم العيادة وقاعدة البيانات...", 30));

        // 5. Poll Health Endpoint
        await PollHealthCheckAsync(progress, cancellationToken);
    }

    /// <summary>
    /// Polls GET /api/health with exponential backoff until HTTP 200 OK or timeout.
    /// </summary>
    private async Task PollHealthCheckAsync(IProgress<StartupProgress>? progress, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var timeout = TimeSpan.FromSeconds(StartupTimeoutSeconds);
        int attempt = 0;
        int delayMs = 250;

        while (stopwatch.Elapsed < timeout)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (_backendProcess != null && _backendProcess.HasExited)
            {
                int exitCode = _backendProcess.ExitCode;
                throw new InvalidOperationException(
                    $"توقف خادم العيادة بشكل غير متوقع (رمز الخروج: {exitCode}). راجع ملف السجل: {Path.Combine(LogDirectory, $"backend-{DateTime.Today:yyyy-MM-dd}.log")}");
            }

            attempt++;
            int percentage = Math.Min(90, 30 + (int)((stopwatch.Elapsed.TotalSeconds / timeout.TotalSeconds) * 60));
            progress?.Report(new StartupProgress($"جاري انتظار استجابة الخادم (محاولة {attempt})...", percentage));

            try
            {
                using var response = await _httpClient.GetAsync(HealthEndpoint, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    LogMessage($"[Supervisor] Backend health verified after {stopwatch.ElapsedMilliseconds}ms (Attempt {attempt}).");
                    progress?.Report(new StartupProgress("تم الاتصال بالخادم بنجاح!", 100));
                    return;
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or SocketException)
            {
                // Expected during early boot
                LogMessage($"[Supervisor] Health check attempt {attempt} pending: {ex.Message}");
            }

            await Task.Delay(delayMs, cancellationToken);
            delayMs = Math.Min(1000, (int)(delayMs * 1.5));
        }

        throw new TimeoutException($"انتهت مهلة انتظار تشغيل خادم العيادة بعد {StartupTimeoutSeconds} ثانية. تحقق من السجلات في {LogDirectory}");
    }

    /// <summary>
    /// Resolves whether running in published production mode (.exe present) or development mode (source tree).
    /// </summary>
    private static (string FileName, string Arguments, string WorkingDirectory) ResolveBackendLaunchTarget()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;

        // 1. Direct executable in base directory (Single-folder or self-contained publish)
        string directExe = Path.Combine(baseDir, "Clinic.Api.exe");
        if (File.Exists(directExe))
        {
            return (directExe, "", baseDir);
        }

        // 2. Executable in "api" subfolder
        string subfolderExe = Path.Combine(baseDir, "api", "Clinic.Api.exe");
        if (File.Exists(subfolderExe))
        {
            return (subfolderExe, "", Path.Combine(baseDir, "api"));
        }

        // 3. Development Mode: Search upwards for solution root and backend/Clinic.Api
        var currentDir = new DirectoryInfo(baseDir);
        while (currentDir != null && currentDir.Exists)
        {
            string apiProjectDir = Path.Combine(currentDir.FullName, "backend", "Clinic.Api");
            string apiCsproj = Path.Combine(apiProjectDir, "Clinic.Api.csproj");

            if (File.Exists(apiCsproj))
            {
                // Check if pre-compiled debug binary exists
                string debugExe = Path.Combine(apiProjectDir, "bin", "Debug", "net8.0", "Clinic.Api.exe");
                if (File.Exists(debugExe))
                {
                    return (debugExe, "", apiProjectDir);
                }

                // Fall back to dotnet run
                return ("dotnet", $"run --project \"{apiCsproj}\" --no-launch-profile", apiProjectDir);
            }

            currentDir = currentDir.Parent;
        }

        throw new FileNotFoundException("تعذر العثور على ملف تشغيل الخادم Clinic.Api.exe أو مسار المشروع.");
    }

    private void InitializeLogFile()
    {
        string logPath = Path.Combine(LogDirectory, $"backend-{DateTime.Today:yyyy-MM-dd}.log");
        var fs = new FileStream(logPath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
        _logWriter = new StreamWriter(fs, Encoding.UTF8) { AutoFlush = true };
        LogMessage("==================== بدء تشغيل جلسة الخادم ====================");
    }

    private void LogMessage(string message)
    {
        lock (_logLock)
        {
            string formatted = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}";
            Trace.WriteLine(formatted);
            _logWriter?.WriteLine(formatted);
        }
    }

    public void Stop()
    {
        if (_backendProcess != null && !_backendProcess.HasExited)
        {
            try
            {
                LogMessage("[Supervisor] Requesting backend process termination...");
                _backendProcess.Kill(entireProcessTree: true);
                _backendProcess.WaitForExit(3000);
            }
            catch (Exception ex)
            {
                LogMessage($"[Supervisor] Exception terminating backend: {ex.Message}");
            }
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        Stop();
        _backendProcess?.Dispose();
        _httpClient.Dispose();

        lock (_logLock)
        {
            _logWriter?.Flush();
            _logWriter?.Dispose();
            _logWriter = null;
        }
    }
}
