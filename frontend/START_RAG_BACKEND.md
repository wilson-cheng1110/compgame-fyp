# 🚀 Start RAG Backend — Live AI Responses

**Status:** Frontend is ready | Backend needs startup  
**Goal:** Get "What is Miller's Law?" responses from ChromaDB + Ollama

---

## Prerequisites

You need **Ollama** installed on your machine to run the LLM locally.

### Check if Ollama is Installed
```bash
ollama --version
```

**If NOT installed:**
- Download: https://ollama.ai/
- Install for Windows (choose RTX 5060 Ti support if available)
- Restart after install

---

## Step-by-Step Startup

### 1️⃣ Open Terminal 1 — Start Ollama (Background Service)
```bash
ollama serve
```
This starts the Ollama daemon on `http://localhost:11434`

**Expected output:**
```
time=2026-06-16T13:45:00.123Z level=INFO msg="Listening on 127.0.0.1:11434"
```

### 2️⃣ Open Terminal 2 — Pull Ollama Models (if not already pulled)
```bash
ollama pull gemma4
ollama pull nomic-embed-text
```

**Expected output:**
```
pulling manifest
pulling 980f1764f5f2
...
success
```

**Note:** This is only needed once. Skip if you've already pulled these models.

### 3️⃣ Open Terminal 3 — Start Python RAG Backend
```bash
cd C:\Users\User\Downloads\FYP_Final_Project\FYP_Submission\backend
pip install -r requirements.txt
python rag_api.py
```

**Expected output:**
```
🔌 Initializing database and Ollama 'gemma4' model...
INFO:     Uvicorn running on http://0.0.0.0:8080
✅ API Server is ready to receive questions!
```

### 4️⃣ Frontend Already Running
The Next.js dev server should still be running at `http://localhost:3000`

If not, open Terminal 4:
```bash
cd C:\Users\User\Downloads\FYP_Final_Project\FYP_Submission\frontend
npm run dev
```

---

## Verify Everything is Running

### Test 1: Check Ollama
```bash
curl http://localhost:11434/api/tags
```
Should return list of models including `gemma4` and `nomic-embed-text`

### Test 2: Check RAG Backend
```bash
curl -X POST http://localhost:8080/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Fitts Law?"}'
```

Should return:
```json
{
  "answer": "...",
  "sources": ["01 COMP3423 Introducing HCI 1.pdf (Page 5)", ...]
}
```

### Test 3: Check Frontend
1. Open `http://localhost:3000`
2. Log in with test account
3. Go to any game page
4. Click blue chat bubble (bottom-right)
5. Type: "What is Miller's Law?"
6. Hit Enter — **should now see AI response**

---

## 🎬 Demo Flow (When Everything is Running)

1. **Navigate to game** (e.g., Fitts' Law - Understanding)
2. **Click the blue RAG chat bubble** (bottom-right corner)
3. **Type a question:**
   - "What is Fitts' Law?"
   - "Explain Miller's Law"
   - "What does the 7±2 rule mean?"
   - "How does chunking help memory?"
4. **Wait 3-5 seconds** (gemma4 is 9B params, slower on RTX 5060 Ti)
5. **See the answer** with sources from COMP3423 PDFs

---

## ⏱️ Expected Response Times

| Scenario | Time |
|----------|------|
| Ollama first load of gemma4 | 10-30 seconds (one-time) |
| Question to answer | 3-5 seconds |
| Second question | 2-4 seconds (model warm) |

If it takes longer:
- RTX 5060 Ti is slower for inference (8GB VRAM)
- Watch Ollama terminal for `pull progress` messages
- Check Task Manager → GPU usage

---

## 🐛 Troubleshooting

### Problem: "Cannot reach the AI backend" (Port 8080)

**Solution 1:** Check if Python process is running
```bash
# Windows PowerShell:
Get-Process python | Where-Object { $_.CommandLine -like "*rag_api*" }
```

**Solution 2:** Port 8080 already in use?
```bash
# Find what's using port 8080:
netstat -ano | findstr :8080

# If something else is using it, either:
# A) Kill that process
# B) Change rag_api.py to use different port (e.g., 8081)
```

**Solution 3:** Reinstall Python dependencies
```bash
cd backend/
pip install --upgrade -r requirements.txt
python rag_api.py
```

---

### Problem: "Cannot reach Ollama" (Port 11434)

**Solution:** Make sure Terminal 1 is running `ollama serve`
```bash
ollama serve
```

Check for output like:
```
time=2026-06-16 level=INFO msg="Listening on 127.0.0.1:11434"
```

---

### Problem: "Models not found" (gemma4 or nomic-embed-text)

**Solution:** Pull them
```bash
ollama pull gemma4
ollama pull nomic-embed-text
```

Watch the download progress. Models are ~5-10 GB each.

---

### Problem: Response is slow (>10 seconds)

**Causes:**
- RTX 5060 Ti inference is inherently slow (8GB VRAM)
- First inference of a request type can be slower (model warmup)
- Computer is doing other work

**Temporary workaround:** Use a faster model (trade-off: quality)
```bash
# In rag_api.py, change:
OLLAMA_LLM = "mistral"  # Faster but less accurate
# Instead of:
OLLAMA_LLM = "gemma4"
```

---

### Problem: ChromaDB not loading ("Cannot open database")

**Solution:** Check if database folder exists
```bash
ls backend/hci_chroma_db_local/
```

If missing, create it:
```bash
cd backend/
python check_db.py
```

This will initialize the ChromaDB with COMP3423 PDFs.

---

## Summary

**3 Terminal Windows Needed:**
1. ✅ **Terminal 1:** `ollama serve`
2. ✅ **Terminal 2:** `python rag_api.py` (in backend folder)
3. ✅ **Terminal 3:** `npm run dev` (in frontend folder, if not already running)

**Then:**
- Open http://localhost:3000
- Click blue chat bubble on game page
- Ask questions about HCI concepts
- Get answers from COMP3423 lecture PDFs + gemma4 LLM

---

**Estimated Setup Time:** 2-5 minutes (after first model pull)  
**Model Pull Time:** 5-15 minutes (one-time, downloading 15 GB)

Ready to show the full "soul" of the system — game content + RAG tutor!
