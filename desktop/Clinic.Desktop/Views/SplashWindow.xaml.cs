using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Input;
using Application = System.Windows.Application;

namespace Clinic.Desktop.Views;

public partial class SplashWindow : Window
{
    public event Action? RetryRequested;
    private string? _logDirectory;

    public SplashWindow()
    {
        InitializeComponent();
    }

    public void SetLogDirectory(string logDirectory)
    {
        _logDirectory = logDirectory;
    }

    public void UpdateStatus(string message, int percentage)
    {
        Dispatcher.Invoke(() =>
        {
            TxtStatus.Text = message;
            MainProgressBar.Value = Math.Clamp(percentage, 0, 100);
            TxtPercentage.Text = $"{percentage}%";
        });
    }

    public void ShowError(string errorMessage)
    {
        Dispatcher.Invoke(() =>
        {
            ProgressPanel.Visibility = Visibility.Collapsed;
            ErrorPanel.Visibility = Visibility.Visible;
            TxtErrorMessage.Text = errorMessage;
        });
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void BtnRetry_Click(object sender, RoutedEventArgs e)
    {
        ErrorPanel.Visibility = Visibility.Collapsed;
        ProgressPanel.Visibility = Visibility.Visible;
        UpdateStatus("جاري إعادة المحاولة...", 10);
        RetryRequested?.Invoke();
    }

    private void BtnLogs_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (!string.IsNullOrEmpty(_logDirectory) && Directory.Exists(_logDirectory))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = _logDirectory,
                    UseShellExecute = true
                });
            }
        }
        catch (Exception ex)
        {
            Trace.WriteLine($"[SplashWindow] Error opening log directory: {ex.Message}");
        }
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e)
    {
        Application.Current.Shutdown();
    }
}
