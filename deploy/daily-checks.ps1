# Daily measurement/corpus/schedule checks. Registered as COMPGame-Checks by
# deploy\service.ps1 install. The RESULT lands in deploy\last-check.txt, which
# generate_tutorial_report.py already reads and warns on (FAIL or stale).
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
