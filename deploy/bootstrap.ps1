<#
    bootstrap.ps1 -- one command from a bare Windows box to a running (loopback) study
    server. It does the mechanical part end to end, and STOPS on the two things that
    are yours and must not be automated:

      * the participant key (backend\.participant_secret) -- a fresh one silently breaks
        every export join, so this VERIFIES the one you dropped in, it never mints one.
      * the roster / admin list -- real personal data, carried across by hand.

    What it automates: install the prerequisites setup.ps1 only CHECKS for (via winget),
    then run setup.ps1 (deps, build, models, .env.local) and start.ps1.

        powershell -ExecutionPolicy Bypass -File deploy\bootstrap.ps1
        powershell -ExecutionPolicy Bypass -File deploy\bootstrap.ps1 -SecretFingerprint 3e4d98790a1b2c3d

    Still separate on purpose (they need your accounts / a public URL):
        deploy\publish.ps1            put it on the internet (refuses on a red gate)
        deploy\install-services.ps1   survive reboots (run elevated)

    ASCII + UTF-8 BOM, like every .ps1 here: PowerShell 5.1 reads a BOM-less file as
    ANSI and one stray byte breaks the parse.
#>
[CmdletBinding()]
param(
    [switch]$SkipModels,               # pass through to setup.ps1 (skip the ~8 GB pull)
    [string]$SecretFingerprint = ""    # first 16 hex of the KNOWN-good key; if set, VERIFIED
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"

function Head($m) { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [ok]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  [STOP] $m" -ForegroundColor Red; exit 1 }
function Have($x) { return [bool](Get-Command $x -ErrorAction SilentlyContinue) }

# 1. Prerequisites -- install what is missing. winget best-effort; Have() is the real
#    gate, so a wrong package id fails safe to the manual link rather than pretending.
Head "1. Prerequisites"
function Ensure($exe, $wingetId, $link) {
    if (Have $exe) { Ok "$exe present"; return }
    if (Have winget) {
        Write-Host "  installing $exe via winget ($wingetId) ..."
        try { winget install -e --id $wingetId --silent --accept-package-agreements --accept-source-agreements | Out-Null } catch {}
    } else {
        Warn "winget not found -- cannot auto-install"
    }
    if (-not (Have $exe)) {
        Die "$exe is not on PATH. Install from $link, open a NEW PowerShell (so PATH refreshes), and re-run bootstrap."
    }
    Ok "$exe installed"
}
Ensure "python" "Python.Python.3.11" "python.org (tick 'Add to PATH')"
Ensure "node"   "OpenJS.NodeJS.LTS"  "nodejs.org (LTS)"
Ensure "ollama" "Ollama.Ollama"      "ollama.com"

# 2. The files git does not carry -- VERIFY, never create.
Head "2. Carry-across files (yours to place)"
$secret = Join-Path $Backend ".participant_secret"
if (-not (Test-Path $secret)) {
    Die "backend\.participant_secret is missing. Copy it from your backup BEFORE bootstrapping. setup.ps1 will not mint one, and a fresh key breaks every pre/post export join -- silently, unfixably."
}
$fp = ((Get-FileHash $secret -Algorithm SHA256).Hash.ToLower()).Substring(0, 16)
if ($SecretFingerprint) {
    if ($fp -ne $SecretFingerprint.ToLower()) {
        Die "participant key fingerprint is $fp but you expected $($SecretFingerprint.ToLower()) -- this is the WRONG key. Stop and copy the right one."
    }
    Ok "participant key verified ($fp)"
} else {
    Warn "participant key present (fingerprint $fp). Re-run with -SecretFingerprint <16hex> to have it CHECKED against your backup."
}
$roster = Join-Path $Backend "enrolled_sids.txt"
if (Test-Path $roster) {
    $n = (Get-Content $roster | Where-Object { $_.Trim() -and $_ -notmatch '^\s*#' }).Count
    Ok "roster present ($n students)"
} else {
    Warn "no backend\enrolled_sids.txt -- sign-up will be OPEN and students self-report their section. Drop the real roster in to gate it."
}
if (-not (Test-Path (Join-Path $Backend "admin_sids.txt"))) {
    Warn "no backend\admin_sids.txt -- the /admin teacher panel admits nobody until you add it."
}

# 3. Setup (deps, build, models, .env.local) then start on loopback.
Head "3. Setup + start"
$setupArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "setup.ps1"))
if ($SkipModels) { $setupArgs += "-SkipModels" }
& powershell @setupArgs
if ($LASTEXITCODE -ne 0) { Die "setup.ps1 reported a problem (exit $LASTEXITCODE). Fix what it printed and re-run." }

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start.ps1")
if ($LASTEXITCODE -ne 0) { Die "start.ps1 did not come up -- see deploy\logs\." }

Head "Done"
Ok "Running on http://localhost:3000 (loopback)."
Write-Host "  When you are ready:"
Write-Host "    deploy\publish.ps1            put it on the internet (refuses on a red gate)"
Write-Host "    deploy\install-services.ps1  survive reboots (run from an elevated shell)"
