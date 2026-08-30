<#
    Start both services on loopback and wait until they actually answer.

        powershell -ExecutionPolicy Bypass -File deploy\start.ps1

    LOOPBACK ONLY, always. The API is never published directly; deploy\publish.ps1
    puts a tunnel in front of port 3000, and the browser reaches the API through the
    same origin via next.config.mjs's rewrite. Binding 8080 to 0.0.0.0 would expose
    an unauthenticated-by-default surface straight to the network.
#>
[CmdletBinding()]
param(
    [switch]$Stop,       # stop whatever is listening on 3000/8080 and exit
    [switch]$Foreground  # keep this window attached to the logs
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "deploy\logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

function Kill-Port($p) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
function Wait-Url($url, $seconds = 120) {
    for ($i = 0; $i -lt $seconds; $i++) {
        try { if ((Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

if ($Stop) {
    Kill-Port 3000; Kill-Port 8080
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

$Py = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Py)) { $Py = "python" }

# The build has to exist BEFORE the server starts, and must not be rebuilt under a
# running one: the build id changes and every /_next/static/* asset 400s until a
# restart. The page still renders 200, so a smoke test passes while nothing hydrates.
if (-not (Test-Path (Join-Path $Frontend ".next\BUILD_ID"))) {
    Write-Host "No production build found. Run deploy\setup.ps1 first." -ForegroundColor Red
    exit 1
}

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

Write-Host ""
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "logs: deploy\logs\   stop: deploy\start.ps1 -Stop"

if ($Foreground) { Get-Content (Join-Path $Logs "api.log") -Wait -Tail 20 }
