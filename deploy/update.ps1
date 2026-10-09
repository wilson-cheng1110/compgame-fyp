<#
    One command to update + re-verify a running study box, in the familiar order,
    reusing the existing scripts:

        discard the dirty vector store  ->  git pull  ->  start.ps1 -Stop
        ->  setup.ps1 (rebuild + go-live gates)  ->  start.ps1

        powershell -ExecutionPolicy Bypass -File deploy\update.ps1

    -NoPull : skip the git pull (you already pulled by hand).
    -Reinstate <sid,...> : un-withdraw these accounts while the server is stopped
        (backend\reinstate_account.py --apply, audited). ONLY on the PI's explicit
        say-so -- withdrawal is a study exit. Idempotent; an unknown SID fails the
        update before anything is rebuilt. Reset their passwords from /admin after.
        -ReinstateNote sets the audit detail (default "PI-approved <today>").

    It pauses COMPGame-Watchdog around the whole thing and RESUMES it in a finally
    (so a mid-run failure still restores it). It stops the server BEFORE setup rebuilds
    the frontend, because rebuilding .next under a running 'next start' 400s every
    static asset until a restart. If a setup gate is red or the build fails, setup.ps1
    exits nonzero and this does NOT start -- the server is left stopped (a red gate
    should never serve students); fix it and re-run. setup.ps1 runs the full backend
    suite as a gate: if that shows the known date-relative test_schedule failures on
    this box, setup will refuse -- that is setup.ps1's existing behaviour, not new.

    Verification IS the flow: setup.ps1's gates + start.ps1's API/web/proxy health
    checks. ASCII only; run under -ExecutionPolicy Bypass (it passes the same to the
    child scripts, so no Set-ExecutionPolicy dance and npm.ps1 is never blocked).
#>
[CmdletBinding()]
param([switch]$NoPull, [string[]]$Reinstate = @(), [string]$ReinstateNote = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Store = "backend/hci_chroma_db_local"
$Watchdog = "COMPGame-Watchdog"
$Setup = Join-Path $PSScriptRoot "setup.ps1"
$Start = Join-Path $PSScriptRoot "start.ps1"

function Have-Task($n) { [bool](Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue) }
function PS-Run($file, [string[]]$extra) {
    # Runs a child script in THIS console and returns only its exit code.
    # Two earlier versions both broke the deploy:
    #  - `& powershell.exe ...` alone: the child's output became this function's return
    #    value, so `(PS-Run ...) -ne 0` compared an ARRAY to 0 -> "failed" on success.
    #  - `& powershell.exe ... | Out-Host`: start.ps1's background servers (uvicorn, next)
    #    inherit the pipe and hold it open for as long as they run, so this never returned
    #    (2026-10-08: the site was up, the update window hung forever).
    # Start-Process -NoNewWindow writes straight to the console (no pipe to inherit) and
    # WaitForExit() waits for the child alone, not for the servers it launched.
    $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$file`"") + $extra
    $p = Start-Process -FilePath "powershell.exe" -ArgumentList $a -NoNewWindow -PassThru
    $null = $p.Handle   # PS 5.1: without touching Handle first, ExitCode can read as $null
    $p.WaitForExit()
    return $p.ExitCode
}

Push-Location $Root
$paused = $false
$failed = $false
try {
    # Pause the watchdog so it cannot restart a mid-update server (best-effort: touching
    # a SYSTEM task may need an elevated shell; a rebuild is under the 5 min interval anyway).
    if (Have-Task $Watchdog) {
        try { Disable-ScheduledTask -TaskName $Watchdog -ErrorAction Stop | Out-Null
              $paused = $true; Write-Host "watchdog paused" -ForegroundColor Cyan }
        catch { Write-Host "WARN: could not pause watchdog (run elevated to be safe): $($_.Exception.Message)" -ForegroundColor Yellow }
    }

    if (-not $NoPull) {
        Write-Host "== git pull (discarding the dirty vector store first)" -ForegroundColor Cyan
        git checkout -- $Store 2>$null
        git pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw "git pull was not a clean fast-forward -- resolve by hand (git status), then re-run." }
    }

    Write-Host "== stop" -ForegroundColor Cyan
    PS-Run $Start @("-Stop") | Out-Null

    # -File hands "a,b" over as ONE string, so split commas ourselves.
    $Reinstate = @($Reinstate -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($Reinstate.Count) {
        Write-Host "== reinstate (PI-approved): $($Reinstate -join ', ')" -ForegroundColor Cyan
        $Py = Join-Path $Root "backend\.venv\Scripts\python.exe"
        if (-not (Test-Path $Py)) { $Py = "python" }
        if (-not $ReinstateNote) { $ReinstateNote = "PI-approved $(Get-Date -Format yyyy-MM-dd)" }
        Push-Location (Join-Path $Root "backend")
        try { & $Py reinstate_account.py @Reinstate --apply --note $ReinstateNote; $rc = $LASTEXITCODE }
        finally { Pop-Location }
        if ($rc -ne 0) { throw "reinstate_account.py failed (unknown SID?) -- server left stopped. Fix and re-run." }
    }

    Write-Host "== setup (rebuild + go-live gates)" -ForegroundColor Cyan
    if ((PS-Run $Setup @()) -ne 0) { throw "setup.ps1 failed (a gate is red or the build failed) -- server left stopped. Fix and re-run." }

    Write-Host "== start" -ForegroundColor Cyan
    if ((PS-Run $Start @()) -ne 0) { throw "start.ps1 failed -- see deploy\logs\ (api.err.log / web.err.log)." }

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
        catch { Write-Host "WARN: could not resume watchdog -- re-enable by hand: Enable-ScheduledTask -TaskName $Watchdog" -ForegroundColor Yellow }
    }
    Pop-Location
}
if ($failed) { exit 1 }
exit 0
