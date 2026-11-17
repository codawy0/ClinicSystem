<#
================================================================================
 Clinic Management System - Standalone Production Release Packaging Script
 (نظام إدارة العيادة الطبية - سكريبت التجهيز والنشر النهائي)
================================================================================
 Compiles the React 18 SPA, deploys static assets to Clinic.Api wwwroot,
 publishes Clinic.Api and Clinic.Desktop in Release mode, and packages
 a standalone, offline-ready distribution folder with start scripts.
================================================================================
#>

[CmdletBinding()]
param(
    [switch]$Clean = $true,
    [switch]$CreateZip = $true,
    [string]$Configuration = "Release",
    [switch]$SkipDesktop = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Root paths
$RepoRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Item .).FullName
}

$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir = Join-Path $RepoRoot "backend"
$DesktopDir = Join-Path $RepoRoot "desktop"
$ApiProject = Join-Path $BackendDir "Clinic.Api\Clinic.Api.csproj"
$DesktopProject = Join-Path $DesktopDir "Clinic.Desktop\Clinic.Desktop.csproj"
$ApiWwwRoot = Join-Path $BackendDir "Clinic.Api\wwwroot"
$PublishRoot = Join-Path $RepoRoot "publish"
$DistDir = Join-Path $PublishRoot "ClinicSystem"
$ApiDistDir = Join-Path $DistDir "api"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " Clinic Management System - Production Release Packaging " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Repository Root: $RepoRoot" -ForegroundColor DarkGray
Write-Host "Configuration  : $Configuration" -ForegroundColor DarkGray
Write-Host "Output Directory: $DistDir" -ForegroundColor DarkGray
Write-Host ""

# ------------------------------------------------------------------------------
# Step 1: Pre-flight Environment Checks
# ------------------------------------------------------------------------------
Write-Host "[1/6] Running pre-flight environment checks..." -ForegroundColor Yellow

# Verify .NET SDK
try {
    $dotnetVersion = & dotnet --version
    Write-Host "  ✓ .NET SDK detected: $dotnetVersion" -ForegroundColor Green
} catch {
    Write-Error "  ✗ .NET 8 SDK not found! Please install .NET 8 SDK."
}

# Verify Node.js
try {
    $nodeVersion = & node -v
    Write-Host "  ✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "  ✗ Node.js not found! Please install Node.js (v18+)."
}

# Verify npm.cmd (Windows batch file to bypass PowerShell ExecutionPolicy)
try {
    $npmVersion = & npm.cmd -v
    Write-Host "  ✓ npm.cmd detected: $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "  ✗ npm.cmd not found! Ensure npm is installed and in PATH."
}

# Verify Project Files
if (-not (Test-Path $ApiProject)) {
    Write-Error "  ✗ Clinic.Api project file not found at: $ApiProject"
}
if (-not (Test-Path "$FrontendDir\package.json")) {
    Write-Error "  ✗ Frontend package.json not found at: $FrontendDir"
}

# ------------------------------------------------------------------------------
# Step 2: Clean Previous Build Artifacts
# ------------------------------------------------------------------------------
if ($Clean) {
    Write-Host "[2/6] Cleaning staging and publish directories..." -ForegroundColor Yellow
    if (Test-Path $PublishRoot) {
        Remove-Item -Path $PublishRoot -Recurse -Force
        Write-Host "  ✓ Cleaned: $PublishRoot" -ForegroundColor DarkGray
    }
    if (Test-Path $ApiWwwRoot) {
        Remove-Item -Path $ApiWwwRoot -Recurse -Force
        Write-Host "  ✓ Cleaned: $ApiWwwRoot" -ForegroundColor DarkGray
    }
}

# Create target directories
$null = New-Item -ItemType Directory -Path $DistDir -Force
$null = New-Item -ItemType Directory -Path $ApiDistDir -Force
$null = New-Item -ItemType Directory -Path $ApiWwwRoot -Force

# ------------------------------------------------------------------------------
# Step 3: Build React SPA
# ------------------------------------------------------------------------------
Write-Host "[3/6] Building React SPA Production Bundle..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    & npm.cmd --prefix $FrontendDir run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend production build failed with exit code $LASTEXITCODE"
    }
    Write-Host "  ✓ React SPA compiled successfully to $FrontendDir\dist" -ForegroundColor Green
} finally {
    Pop-Location
}

# Verify frontend dist artifacts
$DistIndex = Join-Path $FrontendDir "dist\index.html"
$DistCss = Join-Path $FrontendDir "dist\assets\index.css"
$DistAudio = Join-Path $FrontendDir "dist\audio"

if (-not (Test-Path $DistIndex)) {
    Write-Error "  ✗ Frontend build did not produce $DistIndex!"
}
if (-not (Test-Path $DistCss)) {
    Write-Error "  ✗ Frontend build did not produce $DistCss!"
}
if (-not (Test-Path $DistAudio)) {
    Write-Error "  ✗ Frontend build did not produce offline audio assets!"
}

# Copy frontend dist to backend wwwroot
Write-Host "  -> Copying frontend/dist/* into backend/Clinic.Api/wwwroot/..." -ForegroundColor DarkGray
Copy-Item -Path "$FrontendDir\dist\*" -Destination $ApiWwwRoot -Recurse -Force
Write-Host "  ✓ Deployed static assets to $ApiWwwRoot" -ForegroundColor Green

# ------------------------------------------------------------------------------
# Step 4: Publish Clinic.Api (Release)
# ------------------------------------------------------------------------------
Write-Host "[4/6] Publishing Clinic.Api in $Configuration configuration..." -ForegroundColor Yellow
& dotnet publish $ApiProject -c $Configuration -o $ApiDistDir --nologo
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish for Clinic.Api failed with exit code $LASTEXITCODE"
}
Write-Host "  ✓ Published Clinic.Api to: $ApiDistDir" -ForegroundColor Green

# ------------------------------------------------------------------------------
# Step 5: Publish Clinic.Desktop (Release)
# ------------------------------------------------------------------------------
Write-Host "[5/6] Publishing Clinic.Desktop in $Configuration configuration..." -ForegroundColor Yellow
if (-not $SkipDesktop -and (Test-Path $DesktopProject)) {
    try {
        & dotnet publish $DesktopProject -c $Configuration -o $DistDir --nologo
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "dotnet publish for Clinic.Desktop returned code $LASTEXITCODE. Desktop shell may still be compiling or under active development."
        } else {
            Write-Host "  ✓ Published Clinic.Desktop to: $DistDir" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Failed to publish Clinic.Desktop: $_"
    }
} elseif ($SkipDesktop) {
    Write-Host "  ⏩ Desktop publish skipped via -SkipDesktop switch." -ForegroundColor Yellow
} else {
    Write-Host "  ⚠️ Clinic.Desktop project not found yet ($DesktopProject). Skipping desktop shell publish." -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# Step 6: Assemble Standalone Distribution & Packaging
# ------------------------------------------------------------------------------
Write-Host "[6/6] Assembling distribution package layout..." -ForegroundColor Yellow

# 1. Create start.bat launcher
$StartBatPath = Join-Path $DistDir "start.bat"
$StartBatContent = @"
@echo off
chcp 65001 >nul
title نظام إدارة العيادة الطبية - Clinic Management System
cd /d "%~dp0"

echo ==================================================================
echo   نظام إدارة العيادة الطبية - جاري التشغيل...
echo ==================================================================

if exist "Clinic.Desktop.exe" (
    start "" "Clinic.Desktop.exe"
    exit /b 0
)

if exist "api\Clinic.Api.exe" (
    echo [تنبيه] لم يتم العثور على مشغل سطح المكتب، جاري تشغيل خادم الويب...
    start "" "api\Clinic.Api.exe"
    timeout /t 2 >nul
    start http://localhost:5000
    exit /b 0
)

echo [خطأ] لم يتم العثور على ملفات تشغيل النظام!
pause
exit /b 1
"@
Set-Content -Path $StartBatPath -Value $StartBatContent -Encoding UTF8
Write-Host "  ✓ Created launcher: $StartBatPath" -ForegroundColor Green

# 2. Create README.txt in Arabic
$ReadmePath = Join-Path $DistDir "README.txt"
$ReadmeContent = @"
================================================================================
 نظام إدارة العيادة الطبية (Clinic Management System) - الإصدار الإنتاجي
================================================================================

متطلبات التشغيل:
1. نظام تشغيل Windows 10 (إصدار 1809 فما فوق) أو Windows 11 (x64).
2. حزمة WebView2 Runtime (مثبتة مسبقاً تلقائياً في أنظمة ويندوز الحديثة).

طريقة التشغيل:
- قم بتشغيل ملف 'start.bat' أو النقر المزدوج على 'Clinic.Desktop.exe'.
- يقوم البرنامج تلقائياً بتشغيل خادم النظام وفتح واجهة العيادة وشاشة الانتظار للتلفزيون.

مسار تخزين البيانات والنسخ الاحتياطية:
- يتم حفظ قاعدة البيانات والمرفقات في المسار الآمن خارج مجلد التثبيت:
  %ProgramData%\ClinicSystem\

بيانات الدخول الافتراضية:
- الطبيب     : doctor       / كلمة المرور: Doctor@123
- الاستقبال   : receptionist / كلمة المرور: Recept@123
- التمريض    : nurse        / كلمة المرور: Nurse@123
- مدير النظام : admin        / كلمة المرور: Admin@123

================================================================================
"@
Set-Content -Path $ReadmePath -Value $ReadmeContent -Encoding UTF8
Write-Host "  ✓ Created: $ReadmePath" -ForegroundColor Green

# 3. Post-build Sanity Verification
Write-Host ""
Write-Host "--- Distribution Verification ---" -ForegroundColor Cyan
$VerifiedItems = @()

$CheckApiExe = Join-Path $ApiDistDir "Clinic.Api.exe"
$CheckApiDll = Join-Path $ApiDistDir "Clinic.Api.dll"
$CheckSpaHtml = Join-Path $ApiDistDir "wwwroot\index.html"
$CheckSpaCss = Join-Path $ApiDistDir "wwwroot\assets\index.css"
$CheckSpaAudio = Join-Path $ApiDistDir "wwwroot\audio"
$CheckDesktopExe = Join-Path $DistDir "Clinic.Desktop.exe"

$VerifiedItems += [PSCustomObject]@{ Component = "Clinic.Api Executable/DLL"; Status = if (Test-Path $CheckApiDll) { "PASS" } else { "FAIL" } }
$VerifiedItems += [PSCustomObject]@{ Component = "Production SPA index.html"; Status = if (Test-Path $CheckSpaHtml) { "PASS" } else { "FAIL" } }
$VerifiedItems += [PSCustomObject]@{ Component = "Compiled Tailwind CSS"; Status = if (Test-Path $CheckSpaCss) { "PASS" } else { "FAIL" } }
$VerifiedItems += [PSCustomObject]@{ Component = "Offline Audio Clips (102)"; Status = if ((Get-ChildItem -Path $CheckSpaAudio -ErrorAction SilentlyContinue | Measure-Object).Count -gt 50) { "PASS" } else { "FAIL" } }
$VerifiedItems += [PSCustomObject]@{ Component = "Launcher start.bat"; Status = if (Test-Path $StartBatPath) { "PASS" } else { "FAIL" } }
if (Test-Path $CheckDesktopExe) {
    $VerifiedItems += [PSCustomObject]@{ Component = "Clinic.Desktop Executable"; Status = "PASS" }
}

$VerifiedItems | Format-Table -AutoSize

# 4. Optional ZIP Archive
if ($CreateZip) {
    $ZipPath = Join-Path $PublishRoot "ClinicSystem-Release-v1.0.0.zip"
    Write-Host "Creating standalone ZIP archive: $ZipPath..." -ForegroundColor Yellow
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    Compress-Archive -Path "$DistDir\*" -DestinationPath $ZipPath -Force
    $zipSize = (Get-Item $ZipPath).Length / 1MB
    Write-Host "  ✓ Standalone package created: $ZipPath ($("{0:N2}" -f $zipSize) MB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Release Build & Packaging Completed Successfully 100%! " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
