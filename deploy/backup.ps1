# Hourly snapshot of the study databases. Registered as COMPGame-Backup by
# deploy\service.ps1 install. Stamps backend\.last-backup, which /researcher
# health reads -- a stopped task shows up there as "N hours since last backup".
# BACKUP_DIR in deploy\.env.local overrides the destination; prefer a DIFFERENT
# disk when the box has one.
$root = Split-Path -Parent $PSScriptRoot
$be = Join-Path $root "backend"
$log = Join-Path $PSScriptRoot "logs\backup.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$dest = "C:\compgame-backups"
$envFile = Join-Path $root "deploy\.env.local"
if (Test-Path $envFile) {
    $d = (Get-Content $envFile | Where-Object { $_ -match '^\s*BACKUP_DIR\s*=\s*(.+)$' } |
          ForEach-Object { $Matches[1].Trim() } | Select-Object -First 1)
    if ($d) { $dest = $d }
}
$py = Join-Path $be ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
"$(Get-Date -Format s)  backup -> $dest" | Add-Content $log
& $py (Join-Path $be "backup_sink.py") --dest $dest --verify *>> $log
exit $LASTEXITCODE
