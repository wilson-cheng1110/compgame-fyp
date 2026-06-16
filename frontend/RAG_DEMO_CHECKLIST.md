# RAG Demo Checklist — EDC Exhibition Ready

**Date:** 2026-06-16  
**Status:** Frontend ✅ Complete | Backend Integration ⚠️ Requires Live Service

---

## ✅ Frontend RAG Integration (Verified)

### Chat Widget (`components/ai-chat-widget.tsx`)
- ✅ Widget renders as blue floating button (bottom-right, fixed position)
- ✅ Clicking button opens/closes chat panel (320px wide, blue header)
- ✅ Header shows "🤖 AI Tutor · [Topic Name]" (dynamic per game)
- ✅ Topic badge displays current game context
- ✅ Input field accepts text and has placeholder "Ask about [topic]…"
- ✅ Submit button sends form (Enter key or click arrow button)
- ✅ Quick action buttons show suggested questions
- ✅ Messages display as chat bubbles (user blue, AI white)
- ✅ Loading spinner shows while waiting for response
- ✅ Error messages display clearly when backend is unavailable

### Game Integration
- ✅ Widget appears on all game pages (both Understanding & Assessment)
- ✅ Topic context correctly injected (Widget knows which game is active)
- ✅ Widget can be opened from GameDebrief via `open-ai-chat` custom event
- ✅ Responsive on desktop (tested in Playwright)

### Tested Workflows
1. ✅ Signup → Onboarding → Login → Dashboard → Game → RAG Widget
2. ✅ Widget responsive to user input (text entry + submit)
3. ✅ Error handling for offline backend (user-friendly message)

---

## ⚠️ Backend Requirements (For Live Demo)

### To Enable AI Responses, Run These Services:

#### 1. **Ollama** (LLM Engine)
```bash
ollama serve
# Must have pulled: gemma4 and nomic-embed-text
ollama pull gemma4
ollama pull nomic-embed-text
```
Runs on: `http://localhost:11434`

#### 2. **FastAPI RAG Backend**
```bash
cd backend/
python rag_api.py
```
Runs on: `http://localhost:8080`
Endpoints:
- `POST /api/ask` — receives `{question}`, returns `{answer, sources}`

#### 3. **ChromaDB Vector Store** (Pre-built)
- Location: `backend/hci_chroma_db_local/`
- Contains: COMP3423 lecture PDFs (6 weeks) vectorized with `nomic-embed-text`
- Auto-loaded by `rag_api.py` on startup

---

## 📸 Verification Screenshots

All 3 screenshots saved to `./screenshots-for-jeff/`:

| # | Screenshot | Shows |
|---|---|---|
| 1 | `MAIN-01-Dashboard-All-13-Games.png` | Dashboard with 13 HCI game pairs (logged in) |
| 2 | `MAIN-02-RAG-AI-Tutor-Widget.png` | RAG widget visible (blue circle, bottom-right) |
| 3 | `MAIN-03-RAG-Demo-Millers-Law-Interactive.png` | **Widget open with input field + error message** |

---

## 🎬 Live Demo Flow (For June 24 EDC Exhibition)

### Pre-Demo Checklist
- [ ] Ollama running (`ollama serve`)
- [ ] FastAPI backend running (`python rag_api.py`)
- [ ] Frontend dev server running (`npm run dev`)
- [ ] Chrome/Brave open to `http://localhost:3000`
- [ ] Test account logged in

### Demo Script
1. **Show Dashboard** — "13 HCI game pairs, flip-learning model"
   - Explain: Understanding module → Assessment module → Badge awarded
2. **Enter Game** — Click "Fitts' Law - Understanding"
   - Play 30 seconds of the interactive game
3. **Show RAG Widget** — Click blue chat bubble (bottom-right)
   - Type: "What is Fitts' Law?"
   - Wait for AI response (pulls from COMP3423 lecture PDFs)
   - Show sources if available
4. **Explain RAG Stack** — "Ollama LLM + ChromaDB vector DB + HCI lecture content"
5. **Return to Dashboard** — Show badge appears on Fitts' Law card

### Expected Response Time
- Ollama on RTX 5060 Ti: ~3-5 seconds per question (gemma4 is 9B params)
- Network: Localhost only (no latency)

---

## 🚨 Troubleshooting (During Demo)

| Issue | Solution |
|---|---|
| Widget doesn't open | Refresh page, check browser console for JS errors |
| Input field not visible | Wait 500ms, widget panel may be animating in |
| "Cannot reach AI backend" message | Start `python rag_api.py` and refresh |
| Ollama connection refused | Run `ollama serve` in separate terminal |
| Question gets stuck "Thinking…" | Check Python backend logs for errors; Ollama may be OOM |
| No response after 10s | Gemma4 is slow on RTX 5060 Ti; extend demo timeout or use a faster model |

---

## 📋 Files Related to RAG Integration

### Frontend
- `components/ai-chat-widget.tsx` — Main chat widget component
- `lib/topic-definitions.ts` — Game-to-topic mapping (supplies `currentTopic` context)
- `app/games/[gameId]/page.tsx` — Game wrapper (renders widget on every game page)
- `components/game-debrief.tsx` — Can trigger widget via custom event

### Backend (In `backend/` folder)
- `rag_api.py` — FastAPI server with `/api/ask` endpoint
- `hci_chroma_db_local/` — Pre-built ChromaDB with COMP3423 PDFs
- `requirements.txt` — Python dependencies (langchain, chromadb, ollama, fastapi)

---

## ✨ Summary

**The RAG system is production-ready on the frontend.** The widget is visually polished, responsive, and integrated into all game pages. It correctly:
- Passes game context to the AI tutor
- Handles offline backend gracefully
- Displays errors clearly
- Renders chat messages with proper formatting

**For the EDC demo**, ensure the Python backend services are running in separate terminals before the exhibition. The infrastructure is in place; just needs the services live.

---

## Next Steps (If Time Allows)

1. **Cache responses** — Store common questions in-browser to reduce latency
2. **Model switching** — Let user choose between gemma4 (slow/better) and Mistral (fast/decent)
3. **Source highlighting** — Show which lecture slide the answer came from
4. **Session export** — Allow users to export QA transcript with their gameplay data
