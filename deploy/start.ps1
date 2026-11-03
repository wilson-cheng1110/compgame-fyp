<#
    Start both services on loopback and wait until they actually answer.

        powershell -ExecutionPolicy Bypass -File deploy\start.ps1

    LOOPBACK ONLY, always. The API is never published directly; deploy\publish.ps1
    puts the Tailscale funnel in front of nginx on port 8081, nginx fronts this pair,
    and the browser reaches the API through the same origin. Binding 8080 to 0.0.0.0
    would expose an unauthenticated-by-default surface straight to the network.
#>
[CmdletBinding()]
param(
    [switch]$Stop,       # stop whatever is listening on 3000/8080/8081 and exit
    [switch]$Foreground  # keep this window attached to the logs
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "deploy\logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

# S4U task sessions get a thin environment: fold in the machine+user PATH stores so
# npx/nginx/python resolve no matter how we were launched. APPEND-only, and only entries
# not already present -- rebuilding PATH from scratch would reorder it (machine store
# first) and a stale nvm shim can silently swap the node version the web server runs on
# (bit us on dev 2026-11-04: nvm4w's Node 16 shadowed Node 24 and Next refused to start).
function Refresh-Path {
    $extra = ([Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')) -split ';'
    foreach ($p in $extra) {
        if ($p -and (($env:Path -split ';') -notcontains $p)) { $env:Path = $env:Path + ';' + $p }
    }
}
Refresh-Path

# Kill whatever listens on a port, then PROVE it died. The 2026-11-03 incident was
# days of dead login because a SYSTEM-owned zombie held 3000 and the old Kill-Port
# swallowed "Access is denied" via -ErrorAction SilentlyContinue. Never again:
# a port we cannot free is a LOUD, named, exit-1 failure.
function Kill-Port($p) {
    # Master/worker daemons RESPAWN a killed child: nginx's TCP listener belongs to the
    # worker, the master spawns a replacement in well under a second, and the port never
    # frees (reproduced 2026-11-04). So kill the listener's PARENT process as well --
    # the parent of a worker is the master, which is exactly what must die.
    for ($round = 0; $round -lt 3; $round++) {
        $listeners = @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
        if (-not $listeners.Count) { return }
        foreach ($c in $listeners) {
            $procId = $c.OwningProcess
            # Resolve the parent BEFORE killing the listener: once the worker is dead its
            # CIM record is gone, the parent lookup fails, and the master survives to
            # respawn a worker every round (reproduced 2026-11-04 -- three rounds, three
            # dead workers, master untouched). Kill the MASTER first so nothing respawns.
            $parent = 0
            try {
                $parent = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $procId) -ErrorAction Stop).ParentProcessId
            } catch {}
            if ($parent -gt 4 -and (Get-Process -Id $parent -ErrorAction SilentlyContinue)) {
                try { Stop-Process -Id $parent -Force -ErrorAction Stop }
                catch { Write-Host ("  kill failed on parent PID " + $parent + " (port " + $p + "): " + $_.Exception.Message) -ForegroundColor Red }
            }
            try { Stop-Process -Id $procId -Force -ErrorAction Stop }
            catch { Write-Host ("  kill failed on port " + $p + " PID " + $procId + ": " + $_.Exception.Message) -ForegroundColor Red }
        }
        Start-Sleep -Milliseconds 500
    }
    $still = @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
    if ($still.Count) {
        foreach ($c in $still) {
            $procId = $c.OwningProcess
            $name = "?"; $owner = "unknown (access denied -- likely another user or SYSTEM)"
            try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
            try { $o = Invoke-CimMethod -InputObject (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $procId) -ErrorAction Stop) -MethodName GetOwner -ErrorAction Stop; $owner = $o.Domain + "\" + $o.User } catch {}
            Write-Host ("  port " + $p + " still held by PID " + $procId + " (" + $name + ", owned by " + $owner + ")") -ForegroundColor Red
        }
        Write-Host "  A listener on $p could not be killed from this shell." -ForegroundColor Red
        Write-Host "  Open an ELEVATED PowerShell and run:" -ForegroundColor Yellow
        Write-Host "      Get-NetTCPConnection -LocalPort $p -State Listen | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force }" -ForegroundColor Yellow
        Write-Host "  then CLOSE that window (never start servers from it) and re-run start.ps1 from a normal shell." -ForegroundColor Yellow
        exit 1
    }
}
function Wait-Url($url, $seconds = 120) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try { if ((Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

if ($Stop) {
    Kill-Port 3000; Kill-Port 8080; Kill-Port 8081
    Write-Host "stopped" -ForegroundColor Yellow
    exit 0
}

# Load deploy\.env.local into this process. Anything already in the environment
# wins, so a one-off override on the command line is not silently overwritten.
$envFile = Join-Path $Root "deploy\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
            $k = $Matches[1]; $v = $Matches[2].Trim()
            if (-not [Environment]::GetEnvironmentVariable($k)) { Set-Item -Path "env:$k" -Value $v }
        }
    }
}

# Study data collection is ON for a real deployment: the HSESC amendment is cleared
# (Wilson, 2026-09-10), and hand-toggling this in .env.local on the box proved
# error-prone. Set AFTER the .env.local load and only when unset, so a box can still
# force either OFF with =0 in deploy\.env.local (loaded above; already-set wins). Tests
# and e2e do NOT go through this launcher, so their fail-closed module defaults stand --
# this is a deployment decision that lives in deployment code, exactly where it belongs.
foreach ($flag in 'QUESTIONNAIRES_ENABLED', 'TELEMETRY_ENABLED') {
    if (-not [Environment]::GetEnvironmentVariable($flag)) { Set-Item -Path "env:$flag" -Value '1' }
}

$Py = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Py)) { $Py = "python" }

# The build has to exist BEFORE the server starts, and must not be rebuilt under a
# running one: the build id changes and every /_next/static/* asset 400s until a
# restart. The page still renders 200, so a smoke test passes while nothing hydrates.
if (-not (Test-Path (Join-Path $Frontend ".next\BUILD_ID"))) {
    Write-Host "No production build found. Run deploy\setup.ps1 first." -ForegroundColor Red
    exit 1
}

Kill-Port 8081  # nginx front door -- stale copies must die too
Kill-Port 8080
Write-Host "starting API on 127.0.0.1:8080 (loopback)" -ForegroundColor Cyan
# Force UTF-8 for Python I/O. rag_api.py prints emoji in its startup/log lines, and on
# a cp1252 Windows console that raises UnicodeEncodeError -- the fuzz sweep flagged one
# print of unvalidated student text as one codepage away from crashing that request
# path. PYTHONUTF8=1 makes stdout/stderr UTF-8 for the child process below. ASCII only,
# so a BOM-less-ANSI parse cannot break on it.
$env:PYTHONUTF8 = "1"
Start-Process -FilePath $Py `
    -ArgumentList "-m", "uvicorn", "rag_api:app", "--host", "127.0.0.1", "--port", "8080" `
    -WorkingDirectory $Backend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Logs "api.log") `
    -RedirectStandardError  (Join-Path $Logs "api.err.log")

Kill-Port 3000
Write-Host "starting web on 127.0.0.1:3000 (loopback)" -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx next start -H 127.0.0.1 -p 3000" `
    -WorkingDirectory $Frontend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Logs "web.log") `
    -RedirectStandardError  (Join-Path $Logs "web.err.log")

# nginx fronts the pair on 8081: /api/* -> uvicorn, /_next/static/* served off disk,
# everything else -> next. The funnel points at 8081, so without nginx the box serves
# nothing on the port the world probes.
$NginxExe = Join-Path $Root "deploy\tools\nginx\nginx.exe"
if (-not (Test-Path $NginxExe)) {
    Write-Host "nginx binary missing at deploy\tools\nginx\nginx.exe" -ForegroundColor Red
    Write-Host "  Run deploy\service.ps1 install first (downloads + hash-verifies the pinned build)." -ForegroundColor Yellow
    exit 1
}
Write-Host "starting nginx on 127.0.0.1:8081 (loopback front door)" -ForegroundColor Cyan
Start-Process -FilePath $NginxExe `
    -ArgumentList "-p", (($Root -replace '/','\') + "\"), "-c", "deploy\nginx.conf", "-e", "deploy\logs\nginx-boot.err.log" `
    -WorkingDirectory $Root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Logs "nginx.out.log") `
    -RedirectStandardError  (Join-Path $Logs "nginx.err.log")

# Wait for each to actually answer. "The process started" is not the same as "the
# service is up", and every version of this that assumed otherwise raced the tests.
if (Wait-Url "http://127.0.0.1:8080/api/health") { Write-Host "  API   ok" -ForegroundColor Green }
else { Write-Host "  API   did not answer -- see deploy\logs\api.err.log" -ForegroundColor Red; exit 1 }

if (Wait-Url "http://127.0.0.1:3000/login") { Write-Host "  Web   ok" -ForegroundColor Green }
else { Write-Host "  Web   did not answer -- see deploy\logs\web.err.log" -ForegroundColor Red; exit 1 }

# The rewrite is the whole architecture: if /api/health does NOT answer on port 3000,
# the browser's relative calls will 404 and the app will look alive and do nothing.
if (Wait-Url "http://127.0.0.1:3000/api/health" 15) {
    Write-Host "  Proxy ok  (/api reaches the backend through port 3000)" -ForegroundColor Green
} else {
    Write-Host "  Proxy FAILED -- next.config.mjs rewrites are not in effect." -ForegroundColor Red
    Write-Host "  The site will load and every data call will 404. Do not publish this." -ForegroundColor Red
    exit 1
}

# The authoritative chain probes: 8081 is the only port the funnel (and so the
# world) ever reaches. 3000-proxy green proves dev sanity; THESE prove deployment.
if (Wait-Url "http://127.0.0.1:8081/api/health" 15) { Write-Host "  nginx -> API   ok (8081)" -ForegroundColor Green }
else { Write-Host "  nginx -> API   FAILED on 8081 -- see deploy\logs\nginx.err.log + nginx-error.log" -ForegroundColor Red; exit 1 }

if (Wait-Url "http://127.0.0.1:8081/login" 15) { Write-Host "  nginx -> web   ok (8081)" -ForegroundColor Green }
else { Write-Host "  nginx -> web   FAILED on 8081 -- see deploy\logs\nginx.err.log + nginx-error.log" -ForegroundColor Red; exit 1 }

# The zombie detector: served webpack hash vs the on-disk build. A port probe cannot
# tell OUR server from a stale one; this can. Exit nonzero if the build being served
# is not the build on disk.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "deploy\service.ps1") verify
$verifyCode = $LASTEXITCODE
if ($verifyCode -ne 0) {
    Write-Host "  verify FAILED (exit $verifyCode) -- served build does not match disk, or a chain leg is down." -ForegroundColor Red
    Write-Host "  See deploy\logs\verify.log. Do not publish this." -ForegroundColor Red
    exit 1
}
Write-Host "  verify ok  (served build == on-disk build)" -ForegroundColor Green

Write-Host ""
Write-Host "front door: http://127.0.0.1:8081" -ForegroundColor Green
Write-Host "dev direct: http://localhost:3000" -ForegroundColor DarkGray
Write-Host "logs: deploy\logs\   stop: deploy\start.ps1 -Stop"

if ($Foreground) { Get-Content (Join-Path $Logs "api.log") -Wait -Tail 20 }
