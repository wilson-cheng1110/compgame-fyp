<#
    Non-admin keep-alive: what install-services.ps1's Scheduled Tasks do, for a box
    where a normal user may not register tasks ("Register-ScheduledTask : Access is
    denied", 2026-10-12). Started at login from the user's Startup folder by
    install-user-autostart.ps1; runs hidden.

      every 5 min   deploy\watchdog.ps1   restarts the app if /api/health stops answering
      every 60 min  deploy\backup.ps1     snapshots the sink + accounts

    Both scripts are written by install-services.ps1 (they exist even when its task
    registration fails). One copy only: a named mutex makes a second start exit at once.
    Limit, by design of a non-admin box: nothing runs until the user logs in.
    ASCII only.
#>
$ErrorActionPreference = "Continue"
$Watchdog = Join-Path $PSScriptRoot "watchdog.ps1"
$Backup = Join-Path $PSScriptRoot "backup.ps1"
$Log = Join-Path $PSScriptRoot "logs\keepalive.log"
New-Item -ItemType Directory -Force -Path (Split-Path $Log) | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Local\COMPGame-Keepalive")
if (-not $mutex.WaitOne(0)) { exit 0 }   # another keep-alive is already running

foreach ($f in $Watchdog, $Backup) {
    if (-not (Test-Path $f)) {
        "$(Get-Date -Format s)  missing $f - run deploy\install-services.ps1 once to write it" | Add-Content $Log
        exit 1
    }
}
"$(Get-Date -Format s)  keep-alive started" | Add-Content $Log
$lastBackup = [datetime]::MinValue
while ($true) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Watchdog
    if (((Get-Date) - $lastBackup).TotalMinutes -ge 60) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Backup
        $lastBackup = Get-Date
        "$(Get-Date -Format s)  backup run (exit $LASTEXITCODE)" | Add-Content $Log
    }
    Start-Sleep -Seconds 300
}
