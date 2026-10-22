#Requires -RunAsAdministrator
<#
    run-deploy.ps1 -- the WHOLE rebuild chain, run FROM THE USB STICK on the freshly
    wiped box. Sequences the existing deploy scripts; adds nothing new on top.

        E:\compgame-deploy\run-deploy.ps1                      (elevated PowerShell)
        E:\compgame-deploy\run-deploy.ps1 -SkipFirewall        (not recommended)

    Interactive exactly three times, on purpose:
      1. Tailscale auth key   (a secret; typed, never echoed, never stored)
      2. firewall.ps1 APPLY   (per-step GO after you read the -WhatIf preview)
      3. funnel hostname      (confirm the https://....ts.net students will use)

    It will NOT: wipe anything (that is C1, before this), mint a participant key,
    forward router ports, or install Parsec (optional; re-run firewall.ps1 after).
    ASCII + UTF-8 BOM, like every .ps1 here.
#>
[CmdletBinding()]
param(
    [string]$Target = 'C:\COMPGame',
    [string]$SecretFingerprint = '3e4d9879f95bab51',
    [string]$NodeName = 'compgame-study',
    [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'
$Stick   = $PSScriptRoot
$Config  = Join-Path $Stick 'stick-config.json'
$Bundle  = Join-Path $Stick 'repo.bundle'
$Secrets = Join-Path $Stick 'secrets'

function Head($m) { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [ok]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  [STOP] $m" -ForegroundColor Red; exit 1 }
function Have($x) { return [bool](Get-Command $x -ErrorAction SilentlyContinue) }
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

# ------------------------------------------------------------ 0. preflight
Head "0. Preflight"
foreach ($f in @($Config, $Bundle, (Join-Path $Secrets '.participant_secret'))) {
    if (-not (Test-Path $f)) { Die "stick is incomplete: $f missing. Rebuild it with deploy\usb\build-stick.ps1." }
}
$cfg = Get-Content $Config -Raw | ConvertFrom-Json
Ok "stick built from commit $($cfg.built_from) on $($cfg.built_at)"
try {
    Invoke-WebRequest 'https://ollama.com' -UseBasicParsing -TimeoutSec 8 | Out-Null
    Ok "network up"
} catch { Die "no network. The box needs it for winget, the 8 GB model pull and the funnel." }
if (Test-Path $Target) {
    if ((Get-ChildItem $Target -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
        Die "$Target exists and is not empty. This script installs onto a CLEAN box."
    }
}

# ------------------------------------------------------------ 1. runtimes
Head "1. Runtimes (winget)"
function Ensure($exe, $wingetId, $link) {
    Refresh-Path
    if (Have $exe) { Ok "$exe present"; return }
    Write-Host "  installing $exe via winget ($wingetId) ..."
    try { winget install -e --id $wingetId --silent --accept-package-agreements --accept-source-agreements | Out-Null } catch {}
    Refresh-Path
    if (-not (Have $exe)) { Die "$exe not on PATH after winget. Install from $link, open a NEW elevated shell, re-run." }
    Ok "$exe installed"
}
Ensure 'git'       'Git.Git'            'git-scm.com'
Ensure 'python'    'Python.Python.3.11' 'python.org (tick Add to PATH)'
Ensure 'node'      'OpenJS.NodeJS.LTS'  'nodejs.org (LTS)'
Ensure 'ollama'    'Ollama.Ollama'      'ollama.com'
Ensure 'tailscale' 'Tailscale.Tailscale' 'tailscale.com'

# ------------------------------------------------------------ 2. repo from the bundle
Head "2. Repo"
git clone $Bundle $Target
if ($LASTEXITCODE -ne 0) { Die "git clone from the stick bundle failed" }
if ($cfg.origin) {
    git -C $Target remote set-url origin $cfg.origin
    Ok "origin reset to $($cfg.origin) (update.ps1 will pull from there, given box git auth)"
}
$head = (git -C $Target rev-parse --short HEAD)
Ok "repo at $Target (HEAD $head)"

# ------------------------------------------------------------ 3. carry-across files
Head "3. Carry-across files (verify, never mint)"
$Backend = Join-Path $Target 'backend'
foreach ($name in @('.participant_secret', 'admin_sids.txt', 'researcher_sids.txt', 'enrolled_sids.txt')) {
    $src = Join-Path $Secrets $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $Backend $name) -Force
        Ok "$name placed"
    } elseif ($name -eq '.participant_secret') {
        Die "secrets\.participant_secret missing from the stick"
    } else {
        Warn "$name not on the stick -- skipped (see deploy\README.md for what that means)"
    }
}
$fp = ((Get-FileHash (Join-Path $Backend '.participant_secret') -Algorithm SHA256).Hash.ToLower()).Substring(0, 16)
if ($fp -ne $SecretFingerprint.ToLower()) {
    Die "participant key fingerprint is $fp, expected $($SecretFingerprint.ToLower()) -- WRONG KEY. Stop."
}
Ok "participant key verified ($fp)"

# ------------------------------------------------------------ 4. setup (deps, models, build, gates)
Head "4. setup.ps1 -- deps + ~8 GB models + build + go-live gates (the slow part)"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\setup.ps1')
if ($LASTEXITCODE -ne 0) { Die "setup.ps1 reported a red gate. Read what it printed, fix, re-run run-deploy." }
Ok "setup gates green"

# ------------------------------------------------------------ 5. production flags
Head "5. deploy\.env.local -- production flags"
$envFile = Join-Path $Target 'deploy\.env.local'
$lines = Get-Content $envFile
$refFile = Join-Path $Secrets 'deploy.env.local'
$mergeKeys = @('QUESTIONNAIRES_ENABLED', 'TELEMETRY_ENABLED', 'HEARTBEAT_URL', 'SESSION_IDLE_MINUTES')
$ref = @{}
if (Test-Path $refFile) {
    foreach ($l in (Get-Content $refFile)) {
        if ($l -match '^\s*#' -or $l -notmatch '=') { continue }
        $k, $v = $l -split '=', 2
        if ($mergeKeys -contains $k.Trim()) { $ref[$k.Trim()] = $v.Trim() }
    }
}
foreach ($k in $mergeKeys) {
    $want = $null
    if ($ref.ContainsKey($k)) { $want = $ref[$k] }
    elseif ($k -in @('QUESTIONNAIRES_ENABLED', 'TELEMETRY_ENABLED')) { $want = '1' }
    if ($null -eq $want) { continue }
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match ("^\s*" + [regex]::Escape($k) + "=")) { $lines[$i] = "$k=$want"; $found = $true }
    }
    if (-not $found) { $lines += "$k=$want" }
    Ok "$k=$want"
}
$lines | Set-Content -Path $envFile -Encoding utf8

# ------------------------------------------------------------ 6. Tailscale node
Head "6. Tailscale node (NEW key; the old JEFF3090 node must already be deleted in the console)"
$tsStatus = ''
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'   # 2>&1 on a native command wraps stderr as NativeCommandError under Stop
$tsStatus = (tailscale status 2>&1 | Out-String)
$ErrorActionPreference = $prevEAP
if ($tsStatus -match '100\.\d+\.\d+\.\d+') {
    Ok "tailscale already up"
} else {
    $key = Read-Host '  Tailscale auth key (tskey-auth-..., input hidden from logs but visible while typing)'
    if (-not $key) { Die "no auth key -- create a tagged, reusable key in the tailnet console and re-run" }
    tailscale up --authkey="$key" --hostname="$NodeName" --unattended
    if ($LASTEXITCODE -ne 0) { Die "tailscale up failed" }
    $key = $null
    Ok "tailscale up as $NodeName"
}

# ------------------------------------------------------------ 7. firewall
Head "7. Firewall baseline"
if ($SkipFirewall) {
    Warn "skipped (-SkipFirewall)"
} else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\firewall.ps1') -WhatIf
    Write-Host ""
    $go = Read-Host '  That was the -WhatIf preview. Type APPLY to enforce it'
    if ($go -ne 'APPLY') { Die "firewall not applied. Re-run run-deploy when ready." }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\firewall.ps1')
    if ($LASTEXITCODE -ne 0) { Die "firewall.ps1 failed" }
    Ok "firewall enforced (undo: deploy\firewall.ps1 -Revert)"
}

# ------------------------------------------------------------ 8. services
Head "8. Services"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\start.ps1')
if ($LASTEXITCODE -ne 0) { Die "start.ps1 did not come up -- see deploy\logs\" }
try {
    $h = Invoke-WebRequest 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 8
    Ok "API answers through port 3000"
} catch { Die "API not answering through 3000 -- see deploy\logs\" }

# ------------------------------------------------------------ 9. publish (funnel)
Head "9. Publish via the Tailscale funnel (the decided architecture: funnel + firewall)"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\publish.ps1') -Via tailscale
if ($LASTEXITCODE -ne 0) { Die "publish.ps1 refused or failed -- read the gates it printed" }
tailscale funnel status
$hostUrl = Read-Host '  Paste the https://....ts.net URL students will use'
if ($hostUrl -notmatch '^https://[a-z0-9.-]+\.ts\.net') { Die "that does not look like a https://....ts.net URL" }
$lines = Get-Content $envFile
$found = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*ALLOWED_ORIGINS=') { $lines[$i] = "ALLOWED_ORIGINS=$hostUrl"; $found = $true }
}
if (-not $found) { $lines += "ALLOWED_ORIGINS=$hostUrl" }
$lines | Set-Content -Path $envFile -Encoding utf8
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\start.ps1') -Stop
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\start.ps1')
if ($LASTEXITCODE -ne 0) { Die "restart after ALLOWED_ORIGINS failed" }
try {
    Invoke-WebRequest "$hostUrl/api/health" -UseBasicParsing -TimeoutSec 15 | Out-Null
    Ok "public path answers: $hostUrl/api/health"
} catch { Warn "public health check failed FROM THIS BOX -- check $hostUrl/api/health from another machine before declaring done" }

# ------------------------------------------------------------ 10. survive reboots
Head "10. Watchdog + hourly backup + heartbeat"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\install-services.ps1')
if ($LASTEXITCODE -ne 0) { Warn "install-services.ps1 could not register tasks (expected on this box) -- falling back to the Startup-folder keep-alive" }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Target 'deploy\install-user-autostart.ps1')
if ($LASTEXITCODE -ne 0) { Die "install-user-autostart.ps1 failed" }

# ------------------------------------------------------------ 11. final report
Head "Done -- verify these before students touch it"
Write-Host "  HEAD:            $head"
Write-Host "  participant key: $fp (verified)"
Write-Host "  public URL:      $hostUrl"
Write-Host "  funnel:          tailscale funnel status"
Write-Host "  keep-alive log:  $Target\deploy\logs\keepalive.log (first backup within a minute)"
Write-Host ""
Write-Host "  Operator TODO (none of these are automatable):"
Write-Host "   1. Tailnet console: confirm the OLD JEFF3090 node is deleted and its keys dead"
Write-Host "   2. Open $hostUrl from a phone on cellular (not this box, not this network)"
Write-Host "   3. Set Windows Update active hours; keep this user logged in (Startup-folder keep-alive)"
Write-Host "   4. WIPE THIS STICK -- it carries the participant key, the roster and .env.local"
exit 0
