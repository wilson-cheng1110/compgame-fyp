# Build the tutorial decks due before class. Registered as COMPGame-Decks by
# deploy\service.ps1 install. make_tutorial_decks.py builds only decks whose
# lecture is within ~30 h, skips a topic with no data, and always exits 0.
$root = Split-Path -Parent $PSScriptRoot
$be = Join-Path $root "backend"
$log = Join-Path $PSScriptRoot "logs\decks.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
"$(Get-Date -Format s)  building due tutorial decks" | Add-Content $log
Push-Location $be
& python make_tutorial_decks.py *>> $log
Pop-Location
