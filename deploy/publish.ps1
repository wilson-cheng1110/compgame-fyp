<#
    Put the running server on the public internet, and refuse to if it is not ready.

        powershell -ExecutionPolicy Bypass -File deploy\publish.ps1

    ONE PORT IS EXPOSED: 8081 -- nginx, the front door. It fans out to uvicorn
    (8080, /api/*), next (3000, everything else), and serves /_next/static/* off
    disk; all three stay loopback-only behind it. The browser reaches the API
    through the same origin, which is what keeps the session cookie first-party
    (SameSite=Lax) -- a split origin would force SameSite=None, which Safari's ITP
    and Chrome's third-party-cookie deprecation block by default, and sign-in would
    fail silently for everyone on an iPhone.

    Port forwarding is deliberately not offered. It puts a home router on the public
    internet in front of 300 students' credentials and buys nothing a tunnel does not
    already give you.
#>
[CmdletBinding()]
param(
    [ValidateSet("auto", "cloudflare", "tailscale", "quick")]
    [string]$Via = "auto",
    [string]$Hostname,      # cloudflare named tunnel: the DNS name to route
    [switch]$Force          # publish even if a gate is red. You will be asked why.
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$red = 0
function Bad($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:red++ }
function Ok($m)  { Write-Host "  [ok]   $m" -ForegroundColor Green }

Write-Host "== Pre-publish gates" -ForegroundColor Cyan

try {
    if ((Invoke-WebRequest "http://127.0.0.1:8081/login" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { Ok "web is serving through nginx (8081)" }
} catch { Bad "web is not serving on 8081 -- run deploy\start.ps1" }

try {
    $h = (Invoke-WebRequest "http://127.0.0.1:8081/api/health" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
    if ($h.status -eq "ok") { Ok "API answers through nginx (status ok)" }
    else { Bad "API health is '$($h.status)'" }
    # 8000 is the e2e fixture size. Publishing with it means the roster is the test
    # fixture, not the class, and any student ID would be accepted.
    if ($h.components.enrolment.enrolled -eq 8000) {
        Bad "enrolment is 8000 -- that is the e2e fixture, not your cohort"
    } else { Ok "enrolment: $($h.components.enrolment.enrolled)" }
} catch { Bad "/api/health did not answer through port 8081 -- the nginx -> uvicorn leg is down" }

if ($env:COOKIE_SECURE -eq "0") { Bad "COOKIE_SECURE=0 -- session cookies would travel unencrypted" }
else { Ok "COOKIE_SECURE is not 0" }

$secret = Join-Path $Root "backend\.participant_secret"
if (Test-Path $secret) {
    Ok "participant key present ($(((Get-FileHash $secret -Algorithm SHA256).Hash.ToLower()).Substring(0,16))...)"
} else { Bad "participant key missing -- exports could never be joined" }

# A bundle built with an absolute origin loads perfectly and does nothing. Cheap to
# check here, and this is the last moment anyone would notice.
$hits = Select-String -Path (Join-Path $Root "frontend\.next\static\**\*.js") -Pattern "localhost:8080" -SimpleMatch -List -ErrorAction SilentlyContinue
if ($hits) { Bad "the built bundle hardcodes localhost:8080 -- rebuild without NEXT_PUBLIC_API_BASE" }
else { Ok "the bundle names no API origin (relative /api, as intended)" }

# The zombie gate: the served webpack hash must match the on-disk build. A port
# probe cannot tell our server from a stale one; this can. Publish refuses a box
# that is serving yesterday's build.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "service.ps1") verify
if ($LASTEXITCODE -ne 0) { Bad "service.ps1 verify failed -- served build does not match disk, or a chain leg is down (deploy\logs\verify.log)" }
else { Ok "verify: served build == on-disk build" }

if ($red -and -not $Force) {
    Write-Host ""
    Write-Host "$red gate(s) red. Not publishing." -ForegroundColor Red
    Write-Host "Each student sits each topic once; there is no second run to fix this in." -ForegroundColor Red
    exit 1
}
if ($red) { Write-Host "  -Force: publishing with $red red gate(s). On your head." -ForegroundColor Yellow }

# ----------------------------------------------------------- choose a tunnel
if ($Via -eq "auto") {
    if (Get-Command cloudflared -ErrorAction SilentlyContinue) { $Via = if ($Hostname) { "cloudflare" } else { "quick" } }
    elseif (Get-Command tailscale -ErrorAction SilentlyContinue) { $Via = "tailscale" }
    else {
        Write-Host ""
        Write-Host "No tunnel client found. Install ONE of:" -ForegroundColor Yellow
        Write-Host "  cloudflared   winget install --id Cloudflare.cloudflared"
        Write-Host "                stable hostname; needs a domain on Cloudflare"
        Write-Host "  tailscale     winget install --id tailscale.tailscale"
        Write-Host "                stable hostname on *.ts.net; no domain needed"
        exit 1
    }
}

Write-Host ""
Write-Host "== Publishing via $Via" -ForegroundColor Cyan

switch ($Via) {
    "quick" {
        Write-Host "  A quick tunnel needs no account and no domain, and its URL CHANGES" -ForegroundColor Yellow
        Write-Host "  every restart. Fine for a demo. Not for a 13-week study: students" -ForegroundColor Yellow
        Write-Host "  would need a new link after every reboot." -ForegroundColor Yellow
        cloudflared tunnel --url http://127.0.0.1:8081
    }
    "cloudflare" {
        if (-not $Hostname) { Write-Host "  -Hostname is required for a named tunnel" -ForegroundColor Red; exit 1 }
        # Idempotent: create/route only if they are not already there.
        if (-not (cloudflared tunnel list 2>$null | Select-String -SimpleMatch "compgame")) {
            cloudflared tunnel login
            cloudflared tunnel create compgame
        }
        cloudflared tunnel route dns compgame $Hostname
        Write-Host "  https://$Hostname" -ForegroundColor Green
        Write-Host "  set ALLOWED_ORIGINS=https://$Hostname and restart the API" -ForegroundColor Yellow
        cloudflared tunnel run --url http://127.0.0.1:8081 compgame
    }
    "tailscale" {
        tailscale funnel --bg 8081
        tailscale funnel status
        Write-Host "  set ALLOWED_ORIGINS to the https://... shown above, then restart the API" -ForegroundColor Yellow
    }
}
