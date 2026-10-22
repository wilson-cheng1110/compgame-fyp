<#
    build-stick.ps1 -- assemble the USB deploy stick from THIS dev machine.

        powershell -File deploy\usb\build-stick.ps1 -DriveLetter E
        powershell -File deploy\usb\build-stick.ps1 -DriveLetter E -WhatIf   (writes nothing)

    Produces  E:\compgame-deploy\ :
        run-deploy.ps1        the on-box master (copy of deploy\usb\run-deploy.ps1)
        repo.bundle           git bundle of local master (committed state only)
        stick-config.json     origin URL, source commit, expected key fingerprint
        secrets\              the carry-across files git never carries:
            .participant_secret   (fingerprint-checked, contents never printed)
            admin_sids.txt  researcher_sids.txt  enrolled_sids.txt   (if present)
            deploy.env.local      (flag source for run-deploy phase 5)

    The stick holds the participant key, the roster and .env.local after this.
    Treat it like a key: known drawer, and wipe it after the rebuild.
    ASCII + UTF-8 BOM, like every .ps1 here.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)][string]$DriveLetter,
    [string]$SecretFingerprint = '3e4d9879f95bab51'
)

$ErrorActionPreference = 'Stop'
$Repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Dest = ($DriveLetter.TrimEnd(':') + ':\compgame-deploy')

function Ok($m)   { Write-Host "  [ok]   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  [STOP] $m" -ForegroundColor Red; exit 1 }

Write-Host "== Preflight"
if (-not (Test-Path ($DriveLetter.TrimEnd(':') + ':\'))) { Die "drive $DriveLetter not found" }
$dirty = (git -C $Repo status --porcelain | Measure-Object).Count
if ($dirty -gt 0) { Warn "working tree has $dirty uncommitted paths -- the bundle carries COMMITTED master only" }
$commit = (git -C $Repo rev-parse HEAD)
$short  = $commit.Substring(0, 7)
Ok "repo $Repo, master $short"

Write-Host "== Chain completeness (the bundle carries committed master ONLY)"
$needed = @('deploy/setup.ps1', 'deploy/start.ps1', 'deploy/publish.ps1',
            'deploy/install-services.ps1', 'deploy/install-user-autostart.ps1',
            'deploy/firewall.ps1')
$bad = @()
foreach ($n in $needed) {
    $tracked = git -C $Repo ls-files -- $n
    if (-not $tracked) { $bad += "$n (untracked)"; continue }
    if (git -C $Repo status --porcelain -- $n) { $bad += "$n (uncommitted changes)" }
}
if ($bad.Count -gt 0) {
    foreach ($b in $bad) { Write-Host "  [STOP] $b" -ForegroundColor Red }
    Die "run-deploy would call scripts that are not in the bundle. Commit the chain scripts, then rebuild the stick."
}
Ok "every script run-deploy calls is committed and clean"

if (-not $PSCmdlet.ShouldProcess($Dest, 'assemble deploy stick')) { exit 0 }

Write-Host "== Layout"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Dest 'secrets') | Out-Null

Write-Host "== Repo bundle"
$bundle = Join-Path $Dest 'repo.bundle'
git -C $Repo bundle create $bundle master
if ($LASTEXITCODE -ne 0) { Die "git bundle create failed" }
git -C $Repo bundle verify $bundle | Out-Null
if ($LASTEXITCODE -ne 0) { Die "git bundle verify failed -- do not ship this stick" }
Ok ("repo.bundle  {0:N1} MB  (master $short, verified)" -f ((Get-Item $bundle).Length / 1MB))

Write-Host "== Carry-across files (hashes only; contents never printed)"
$Backend = Join-Path $Repo 'backend'
$key = Join-Path $Backend '.participant_secret'
if (-not (Test-Path $key)) { Die "backend\.participant_secret missing -- the rebuild NEEDS it (fresh key silently breaks every export join)" }
$fp = ((Get-FileHash $key -Algorithm SHA256).Hash.ToLower()).Substring(0, 16)
if ($fp -ne $SecretFingerprint.ToLower()) { Die "participant key fingerprint is $fp, expected $($SecretFingerprint.ToLower()) -- do NOT ship" }
Copy-Item $key (Join-Path $Dest 'secrets\.participant_secret') -Force
Ok ".participant_secret  (fingerprint $fp)"

foreach ($name in @('admin_sids.txt', 'researcher_sids.txt', 'enrolled_sids.txt')) {
    $src = Join-Path $Backend $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $Dest "secrets\$name") -Force
        Ok "$name  ($((Get-Content $src | Measure-Object -Line).Lines) lines)"
    } else {
        Warn "$name not present -- skipped (box will warn; see deploy\README.md)"
    }
}
$envSrc = Join-Path $Repo 'deploy\.env.local'
if (Test-Path $envSrc) {
    Copy-Item $envSrc (Join-Path $Dest 'secrets\deploy.env.local') -Force
    Ok "deploy.env.local  (flag source only; run-deploy merges whitelisted keys)"
} else {
    Warn "deploy\.env.local not present -- run-deploy will write flag defaults"
}

Write-Host "== Master script + config"
Copy-Item (Join-Path $PSScriptRoot 'run-deploy.ps1') (Join-Path $Dest 'run-deploy.ps1') -Force
$origin = ''
try { $origin = (git -C $Repo remote get-url origin 2>$null) } catch {}
[pscustomobject]@{
    built_from = $commit
    built_at   = (Get-Date).ToString('s')
    origin     = $origin
    key_fingerprint = $SecretFingerprint.ToLower()
} | ConvertTo-Json | Set-Content -Path (Join-Path $Dest 'stick-config.json') -Encoding ascii
Ok "run-deploy.ps1 + stick-config.json"

Write-Host ""
Write-Host "== Stick ready at $Dest"
Get-ChildItem -Recurse $Dest | ForEach-Object { Write-Host ("   {0,10:N0}  {1}" -f $_.Length, $_.FullName.Substring($Dest.Length + 1)) }
Write-Host ""
Write-Host "  NEXT: carry the stick to the wiped box, open an ELEVATED PowerShell, run:"
Write-Host "    $Dest\run-deploy.ps1"
Write-Host "  The stick holds secrets. Wipe it after the rebuild."
exit 0
