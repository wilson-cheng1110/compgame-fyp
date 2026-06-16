# START_ALL_SERVICES.ps1
# Starts Ollama + RAG API + Frontend dev server in separate terminal windows

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🚀 COMPGame RAG System Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n📋 Starting 3 services in separate terminals:`n" -ForegroundColor Yellow

# Terminal 1: Ollama
Write-Host "1️⃣  Starting Ollama (LLM Engine)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"
Start-Sleep -Seconds 2

# Terminal 2: Python RAG Backend
Write-Host "2️⃣  Starting Python RAG API on port 8080..." -ForegroundColor Green
$backendPath = Join-Path $scriptDir "backend"
$pythonCmd = @"
cd "$backendPath"
python rag_api.py
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $pythonCmd
Start-Sleep -Seconds 3

# Terminal 3: Frontend Dev Server
Write-Host "3️⃣  Starting Next.js Frontend on port 3000..." -ForegroundColor Green
$frontendPath = Join-Path $scriptDir "frontend"
$npmCmd = @"
cd "$frontendPath"
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $npmCmd

Write-Host "`n✅ All services starting..." -ForegroundColor Cyan
Write-Host "`n⏳ Give each service 10-15 seconds to initialize..." -ForegroundColor Yellow

Start-Sleep -Seconds 5

Write-Host "`n📍 Access Points:" -ForegroundColor Cyan
Write-Host "   🌐 Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "   🤖 RAG API:   http://localhost:8080/api/ask" -ForegroundColor White
Write-Host "   🧠 Ollama:    http://localhost:11434" -ForegroundColor White

Write-Host "`n🎮 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "   2. Log in with test account" -ForegroundColor White
Write-Host "   3. Go to any game page" -ForegroundColor White
Write-Host "   4. Click blue chat bubble (bottom-right)" -ForegroundColor White
Write-Host "   5. Ask: 'What is Miller's Law?'" -ForegroundColor White
Write-Host "   6. See AI response from COMP3423 PDFs!" -ForegroundColor White

Write-Host "`n💡 Tip: Watch the terminals for startup messages" -ForegroundColor Yellow
Write-Host "   Ollama: 'Listening on 127.0.0.1:11434'" -ForegroundColor Gray
Write-Host "   RAG: '✅ API Server is ready to receive questions!'" -ForegroundColor Gray

Write-Host "`n" -ForegroundColor Cyan
