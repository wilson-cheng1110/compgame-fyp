<#
    Non-admin keep-alive: what install-services.ps1's Scheduled Tasks do, for a box
    where a normal user may not register tasks ("Register-ScheduledTask : Access is
    denied", 2026-10-12). Started at login from the user's Startup folder by
    install-user-autostart.ps1; runs hidden.

      every 5 min   deploy\watchdog.ps1   restarts the app if /api/health stops answering
      every 5 min   public-path check     app fine locally but unreachable from the
                                          internet twice running -> resets the funnel
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

# The watchdog only sees 127.0.0.1:3000. On 2026-10-12 the app was healthy locally for
# ~4 h while the Tailscale funnel had silently stopped, so students got nothing. Check
# the PUBLIC path too. From this box its own name resolves inside the tailnet (bypassing
# the funnel relay that broke), so resolve it via public DNS and pin that address.
function Public-Status {
    try {
        $h = ((& tailscale status --json | ConvertFrom-Json).Self.DNSName).TrimEnd(".")
        $ips = @((Resolve-DnsName $h -Server 1.1.1.1 -Type A -ErrorAction Stop |
                  Where-Object { $_.IPAddress }).IPAddress)
        if (-not $h -or -not $ips.Count) { return "unknown" }
        # The name has several relay addresses and one can be down while another works
        # (seen 2026-10-12); a browser falls back, so the site is up if ANY answers.
        $last = "000"
        foreach ($ip in $ips) {
            $last = (& curl.exe -s -o NUL -w "%{http_code}" -m 20 --resolve "${h}:443:$ip" "https://$h/api/health")
            if ($last -eq "200") { return "200" }
        }
        return $last
    } catch { return "unknown" }
}
function Local-Ok {
    try { return (Invoke-WebRequest "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 }
    catch { return $false }
}
$publicFails = 0

$lastBackup = [datetime]::MinValue
while ($true) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Watchdog
    if (Local-Ok) {
        $code = Public-Status
        if ($code -eq "200" -or $code -eq "unknown") { $publicFails = 0 }
        else {
            $publicFails++
            "$(Get-Date -Format s)  app OK locally but public check returned '$code' ($publicFails in a row)" | Add-Content $Log
            if ($publicFails -ge 2) {
                "$(Get-Date -Format s)  resetting the Tailscale funnel" | Add-Content $Log
                & tailscale funnel reset *>> $Log
                & tailscale funnel --bg 3000 *>> $Log
                $publicFails = 0
            }
        }
    }
    if (((Get-Date) - $lastBackup).TotalMinutes -ge 60) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Backup
        $lastBackup = Get-Date
        "$(Get-Date -Format s)  backup run (exit $LASTEXITCODE)" | Add-Content $Log
    }
    Start-Sleep -Seconds 300
}
