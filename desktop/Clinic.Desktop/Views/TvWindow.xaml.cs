using System;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Screen = System.Windows.Forms.Screen;

namespace Clinic.Desktop.Views;

public partial class TvWindow : Window
{
    private readonly CoreWebView2Environment _env;
    private readonly string _tvUrl;

    public TvWindow(CoreWebView2Environment env, string tvUrl, Screen? targetScreen)
    {
        InitializeComponent();
        _env = env ?? throw new ArgumentNullException(nameof(env));
        _tvUrl = tvUrl ?? throw new ArgumentNullException(nameof(tvUrl));

        if (targetScreen != null)
        {
            RepositionToScreen(targetScreen);
        }
        else
        {
            RevertToWindowed();
        }

        Loaded += OnLoaded;
    }

    public void RepositionToScreen(Screen screen)
    {
        WindowStartupLocation = WindowStartupLocation.Manual;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        Left = screen.Bounds.Left;
        Top = screen.Bounds.Top;
        Width = screen.Bounds.Width;
        Height = screen.Bounds.Height;
    }

    public void RevertToWindowed()
    {
        WindowStyle = WindowStyle.SingleBorderWindow;
        ResizeMode = ResizeMode.CanResize;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Width = 1280;
        Height = 720;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await TvWebView.EnsureCoreWebView2Async(_env);
            
            TvWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            TvWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

            TvWebView.NavigationCompleted += (s, args) =>
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
            };

            TvWebView.CoreWebView2.Navigate(_tvUrl);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Trace.WriteLine($"[TvWindow] Error initializing TV WebView2: {ex.Message}");
        }
    }
}
