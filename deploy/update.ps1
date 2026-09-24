<#
    One command to update the running study box and re-verify it. Replaces the
    manual dance (pause watchdog / discard store / pull / rebuild / restart /
    resume / smoke), each step of which was easy to forget or get wrong.

        powershell -ExecutionPolicy Bypass -File deploy\update.ps1

    Flags:
        -SkipBuild   backend-only change: don't rebuild the frontend
        -NoPull      already pulled by hand: just rebuild + restart + verify

    Safety:
      * Refuses anything but a clean fast-forward of origin/master (a half-pulled
        merge conflict mid-deploy is how a box ends up half-updated).
      * Stops the server BEFORE rebuilding. Rebuilding .next under a running
        'next start' makes every /_next/static/* asset 400 until a restart, so the
        site would LOOK alive and serve broken pages. Brief planned downtime instead.
      * If the build fails the server stays stopped and nothing new is served --
        fix and re-run; it never leaves a half-built .next live.
      * Pauses the COMPGame-Watchdog so it can't restart a mid-update server, and
        RESUMES it in a finally block even if the update throws.
      * End-to-end smoke goes through port 3000 (the real origin) and checks the
        /api proxy, not just that a page returns 200.

    ASCII only + run under -ExecutionPolicy Bypass. It calls npm via npm.cmd so the
    default policy's block on npm.ps1 never bites (no Set-ExecutionPolicy needed).
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$NoPull
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
$Store = "backend/hci_chroma_db_local"
$Watchdog = "COMPGame-Watchdog"
$Start = Join-Path $PSScriptRoot "start.ps1"

function Have-Task($n) { [bool](Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) }
function Run-Start($stop) {
    $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Start)
    if ($stop) { $a += "-Stop" }
    & powershell.exe @a
    return $LASTEXITCODE
}

Push-Location $Root
$paused = $false
$failed = $false
try {
    # 1. Pause the watchdog (best-effort: may need an elevated shell to touch a
    #    SYSTEM task; a 1-2 min build is under the 5 min watchdog interval anyway).
    if (Have-Task $Watchdog) {
        try { Disable-ScheduledTask -TaskName $Watchdog -ErrorAction Stop | Out-Null
              $paused = $true; Write-Host "watchdog paused" -ForegroundColor Cyan }
        catch { Write-Host "WARN: could not pause watchdog (run elevated to be safe): $($_.Exception.Message)" -ForegroundColor Yellow }
    }

    # 2. Pull (fast-forward only).
    if (-not $NoPull) {
        git checkout -- $Store 2>$null
        git fetch origin 2>&1 | Out-Null
        $local  = (git rev-parse HEAD).Trim()
        $remote = (git rev-parse origin/master).Trim()
        $base   = (git merge-base HEAD origin/master).Trim()
        if ($local -eq $remote) {
            Write-Host ("already up to date ({0})" -f $local.Substring(0, 7)) -ForegroundColor Green
        } elseif ($base -ne $local) {
            throw "local is NOT a fast-forward of origin/master -- resolve by hand (git status / git log)."
        } else {
            git merge --ff-only origin/master
            if ($LASTEXITCODE -ne 0) { throw "git merge --ff-only failed." }
            Write-Host ("pulled -> {0}" -f (git rev-parse --short HEAD).Trim()) -ForegroundColor Green
        }
    }

    # 3. Stop, then build (never rebuild under a running server), then start.
    Write-Host "stopping server for a clean rebuild" -ForegroundColor Cyan
    Run-Start $true | Out-Null

    if (-not $SkipBuild) {
        Write-Host "building frontend (npm.cmd -- no ExecutionPolicy dance)..." -ForegroundColor Cyan
        Push-Location $Frontend
        & cmd.exe /c "npm run build"
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { throw "frontend build FAILED (exit $code). Server is stopped; fix and re-run -- nothing broken was served." }
    }

    Write-Host "starting server" -ForegroundColor Cyan
    if ((Run-Start $false) -ne 0) { throw "start.ps1 FAILED -- see deploy\logs\ (api.err.log / web.err.log)." }

    # 4. End-to-end smoke through the real origin (port 3000). The /api proxy is the
    #    load-bearing bit: if it does not answer here, the browser's relative calls
    #    404 and the app looks alive while doing nothing.
    Write-Host "verifying end-to-end..." -ForegroundColor Cyan
    $ok = $true
    $checks = [ordered]@{
        "login" = "http://127.0.0.1:3000/login"
        "proxy" = "http://127.0.0.1:3000/api/health"
    }
    foreach ($name in $checks.Keys) {
        try {
            $r = Invoke-WebRequest $checks[$name] -UseBasicParsing -TimeoutSec 8
            Write-Host ("  {0,-6} {1}  {2}" -f $name, $r.StatusCode, $checks[$name]) -ForegroundColor Green
        } catch {
            Write-Host ("  {0,-6} FAIL   {1}  ({2})" -f $name, $checks[$name], $_.Exception.Message) -ForegroundColor Red
            $ok = $false
        }
    }
    if (-not (Test-Path (Join-Path $Frontend ".next\BUILD_ID"))) {
        Write-Host "  no .next\BUILD_ID -- the build did not land" -ForegroundColor Red; $ok = $false
    }
    if (-not $ok) { throw "post-deploy smoke FAILED -- do NOT treat this as deployed." }

    Write-Host ""
    Write-Host ("update complete + verified at {0}.  http://localhost:3000" -f (git rev-parse --short HEAD).Trim()) -ForegroundColor Green
}
catch {
    Write-Host ("UPDATE FAILED: {0}" -f $_.Exception.Message) -ForegroundColor Red
    $failed = $true
}
finally {
    if ($paused -and (Have-Task $Watchdog)) {
        try { Enable-ScheduledTask -TaskName $Watchdog -ErrorAction Stop | Out-Null
              Write-Host "watchdog resumed" -ForegroundColor Cyan }
        catch { Write-Host "WARN: could not resume watchdog -- re-enable it by hand: Enable-ScheduledTask -TaskName $Watchdog" -ForegroundColor Yellow }
    }
    Pop-Location
}
if ($failed) { exit 1 }
exit 0
