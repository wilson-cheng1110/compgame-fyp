<#
    Make it survive without you: start at boot, restart when it dies, and tell you
    when it cannot.

        powershell -ExecutionPolicy Bypass -File deploy\install-services.ps1

    Three commands get the software running. They do NOT keep it running, and that is
    the harder half. A study server that needs a human to restart it after Windows
    Update is a study server that is down every second Tuesday.

    This registers three Scheduled Tasks -- built in to Windows, nothing to download,
    unlike NSSM:

      COMPGame-Boot       at startup, runs deploy\start.ps1
      COMPGame-Watchdog   every 5 minutes, restarts anything that stopped answering
      COMPGame-Heartbeat  every 5 minutes, pings OUT to a dead-man's switch

    The heartbeat is the one people skip and it is the one that matters. Inbound
    monitoring cannot tell you a box is off, because nothing answers either way. A
    dead-man's switch inverts it: the box pings a URL every five minutes, and if the
    pings STOP, the service emails you. Set one up free at healthchecks.io, paste the
    ping URL into deploy\.env.local as HEARTBEAT_URL, and re-run this.

    WHAT THIS CANNOT FIX: power, and an ISP outage long enough to matter. The real
    mitigation for those is already in the design -- a release window is five days
    wide, not one morning, so students come back. Do not confuse "the box was down for
    an hour" with "a topic was lost"; they are very different events.

    Run this from an ELEVATED PowerShell if you want start-at-boot. Without elevation
    it falls back to start-at-logon, which only helps if someone logs in.

    Undo:  deploy\install-services.ps1 -Remove
#>
[CmdletBinding()]
param([switch]$Remove)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Start = Join-Path $Root "deploy\start.ps1"
$Names = @("COMPGame-Boot", "COMPGame-Watchdog", "COMPGame-Heartbeat")

function Ok($m)   { Write-Host "  [ok]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Info($m) { Write-Host "  $m" }

if ($Remove) {
    foreach ($n in $Names) {
        if (Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $n -Confirm:$false
            Ok "removed $n"
        }
    }
    exit 0
}

$elevated = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($elevated) { Ok "elevated - tasks will run at BOOT, without anyone logging in" }
else { Warn "not elevated - falling back to at-LOGON. Re-run as Administrator for a truly unattended box." }

# --------------------------------------------------------------- the watchdog
# Written to disk rather than inlined into the task, because a scheduled task
# argument string with quoting this deep is unreadable and unmaintainable.
$watchdog = Join-Path $Root "deploy\watchdog.ps1"
@'
# Restart the app if it stopped answering. Registered by install-services.ps1.
$Root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $Root "deploy\logs\watchdog.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Alive($url) {
    try { return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 }
    catch { return $false }
}

# Check the PROXY path, not the two services separately. /api/health through port
# 3000 is the only probe that proves the whole chain a student actually uses: the
# web server is up, the API is up, AND the rewrite between them is in effect. Either
# service alone can be healthy while the app is useless.
if (Alive "http://127.0.0.1:3000/api/health") { exit 0 }

"$(Get-Date -Format s)  down - restarting" | Add-Content $log
& (Join-Path $Root "deploy\start.ps1") *>> $log
if (Alive "http://127.0.0.1:3000/api/health") { "$(Get-Date -Format s)  recovered" | Add-Content $log }
else { "$(Get-Date -Format s)  STILL DOWN after restart - needs a human" | Add-Content $log }
'@ | Set-Content -Path $watchdog -Encoding utf8
Ok "wrote deploy\watchdog.ps1"

# -------------------------------------------------------------- the heartbeat
$heartbeat = Join-Path $Root "deploy\heartbeat.ps1"
@'
# Dead-man's switch. Pings OUT only when the app is genuinely serving, so a box that
# is off, wedged, or serving a broken proxy all look the same to the monitor: silence.
# Set HEARTBEAT_URL in deploy\.env.local (healthchecks.io gives you one free).
$Root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $Root "deploy\.env.local"
if (-not (Test-Path $envFile)) { exit 0 }
$url = (Get-Content $envFile | Where-Object { $_ -match '^\s*HEARTBEAT_URL\s*=\s*(.+)$' } |
        ForEach-Object { $Matches[1].Trim() } | Select-Object -First 1)
if (-not $url) { exit 0 }
try {
    if ((Invoke-WebRequest "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) {
        Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 | Out-Null
    }
} catch {}
'@ | Set-Content -Path $heartbeat -Encoding utf8
Ok "wrote deploy\heartbeat.ps1"


# --------------------------------------------------------------- daily checks
# The controls only work if something runs them. Every silent failure this project
# has had was invisible because nobody looked, not because nobody could -- so the
# looking is a scheduled task, and the RESULT is written where a human already
# reads: generate_tutorial_report.py prints a warning when this file says FAIL or
# has gone stale.
#
# Deliberately does NOT touch the heartbeat. The dead-man's switch means "the box
# is off"; a stale corpus is a different problem with a different fix, and folding
# them together trains people to ignore both.
$checks = Join-Path $Root "deploy\daily-checks.ps1"
@'
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$be = Join-Path $root "backend"
$out = Join-Path $PSScriptRoot "last-check.txt"
$fails = @()
foreach ($c in @(
    @{ n = "measurement"; a = @("check_measurement_coverage.py", "--quiet") },
    @{ n = "corpus";      a = @("check_corpus_coverage.py", "--quiet") },
    @{ n = "schedule";    a = @("schedule.py", "--validate") })) {
    Push-Location $be
    & python $c.a 2>&1 | Out-Null
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { $fails += $c.n }
}
$stamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
if ($fails.Count -eq 0) {
    "PASS $stamp" | Set-Content -Path $out -Encoding utf8
} else {
    "FAIL $stamp " + ($fails -join ",") | Set-Content -Path $out -Encoding utf8
}
'@ | Set-Content -Path $checks -Encoding utf8
Ok "wrote deploy\daily-checks.ps1"

# ------------------------------------------------------------------ register
function Register($name, $script, $trigger) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
    }
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    if ($elevated) {
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger `
            -Settings $settings -Principal $principal | Out-Null
    } else {
        Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger `
            -Settings $settings | Out-Null
    }
    Ok "registered $name"
}

$bootTrigger = if ($elevated) { New-ScheduledTaskTrigger -AtStartup } else { New-ScheduledTaskTrigger -AtLogOn }
$every5 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)

Register "COMPGame-Boot"      $Start     $bootTrigger
Register "COMPGame-Watchdog"  $watchdog  $every5
Register "COMPGame-Heartbeat" $heartbeat $every5

# Daily, early, so a failure is on the file before anyone opens a brief.
$daily = New-ScheduledTaskTrigger -Daily -At 6am
Register "COMPGame-Checks"    $checks    $daily

# ------------------------------------------------------------------- tunnel
Write-Host ""
Write-Host "== Tunnel" -ForegroundColor Cyan
if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    if ($elevated) {
        Info "install the tunnel as a service so it also survives a reboot:"
        Info "    cloudflared service install"
    } else { Warn "run elevated to install cloudflared as a service" }
} elseif (Get-Command tailscale -ErrorAction SilentlyContinue) {
    Info "Tailscale already runs as a service; 'tailscale funnel --bg 3000' persists."
} else {
    Warn "no tunnel client installed - the app will restart itself but stay private"
}

Write-Host ""
Write-Host "Unattended-ready. What is covered, and what is not:" -ForegroundColor Green
Info "  covered      reboot, crash, a service dying, an ISP blip (the tunnel reconnects)"
Info "  covered      you find out within ~10 min IF HEARTBEAT_URL is set"
Info "  NOT covered  power, and a long outage. Mitigated by design, not by software:"
Info "               a release window is five days wide, so students come back."
Write-Host ""
Info "Check it worked:  Get-ScheduledTask COMPGame-*"
Info "Watchdog log:     deploy\logs\watchdog.log"
Info "Undo:             deploy\install-services.ps1 -Remove"
