<#
    Make the study box keep itself alive WITHOUT admin rights.

        powershell -ExecutionPolicy Bypass -File deploy\install-user-autostart.ps1

    Use this when install-services.ps1 fails with "Register-ScheduledTask : Access is
    denied" (a normal user may not create Scheduled Tasks on this PC). It puts a
    launcher for deploy\keepalive.ps1 in THIS user's Startup folder -- which runs at
    every login, no admin needed -- and starts the keep-alive now. The keep-alive runs
    the watchdog every 5 minutes and the backup every hour.

    LIMIT: after a reboot nothing runs until this user logs in. Keep the box logged in,
    and set Windows Update "active hours" so it does not restart during the study.

    Undo:  deploy\install-user-autostart.ps1 -Remove
    ASCII only.
#>
[CmdletBinding()]
param([switch]$Remove)
$ErrorActionPreference = "Stop"
$Startup = [Environment]::GetFolderPath("Startup")
$Launcher = Join-Path $Startup "COMPGame-keepalive.cmd"
$Keepalive = Join-Path $PSScriptRoot "keepalive.ps1"

if ($Remove) {
    if (Test-Path $Launcher) { Remove-Item $Launcher; Write-Host "  [ok]   removed $Launcher" -ForegroundColor Green }
    Write-Host "  The running keep-alive stops at the next logout (or end it in Task Manager)."
    exit 0
}

foreach ($f in "watchdog.ps1", "backup.ps1") {
    if (-not (Test-Path (Join-Path $PSScriptRoot $f))) {
        Write-Host "  [FAIL] deploy\$f missing - run deploy\install-services.ps1 once first (it writes it even when task registration is denied)" -ForegroundColor Red
        exit 1
    }
}

$cmd = "@echo off`r`nstart `"`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Keepalive`"`r`n"
Set-Content -Path $Launcher -Value $cmd -Encoding ascii -NoNewline
Write-Host "  [ok]   wrote $Launcher (runs at every login)" -ForegroundColor Green

Start-Process -FilePath "powershell.exe" -WindowStyle Hidden `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$Keepalive`""
Write-Host "  [ok]   keep-alive started now (log: deploy\logs\keepalive.log)" -ForegroundColor Green
Write-Host "  The first backup runs within a minute; /researcher health should go green shortly after."
