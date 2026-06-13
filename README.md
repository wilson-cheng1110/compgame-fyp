# COMPGame — Flip-Learning Platform for HCI (COMP3423)

A fully serverless, browser-based educational platform that teaches Human-Computer Interaction through interactive games. Built for PolyU COMP3423, designed with a flip-learning model: **Understanding module (game) → Assessment (quiz) → Badge earning**.

**Stack:** Next.js 15 (App Router, TypeScript) + Python FastAPI (RAG tutor) + Ollama (local LLM) + Zustand + cookies (client-only state, no backend DB).

**Status:** Ready for EDC exhibition demo (June 24). All 13 HCI game pairs functional. Badge persistence verified. Auth flow fixed.

## Prerequisites
Before running, please ensure you have the following installed on your Windows machine:
1. **Node.js** (v18+) - Download from https://nodejs.org/
2. **Python** (v3.9+) - Download from https://www.python.org/ (Make sure to check "Add Python to PATH" during installation)
3. **Ollama** - Download from https://ollama.com/
   After installing Ollama, open PowerShell or Command Prompt and run these two commands to download the local AI models:
   `ollama pull gemma4`
   `ollama pull nomic-embed-text`

---

## Game Coverage

13 HCI game pairs covering all COMP3423 lecture topics:

| Topic | Understanding | Assessment | Status |
|-------|---|---|---|
| Fitts' Law | Target-clicking puzzle | RT comparison quiz | ✅ |
| Hick's Law | Menu decision demo | RT quiz | ✅ |
| Miller's Law | Chunking explorer | Memory quiz | ✅ |
| Gestalt Principles | Visual grouping demo | Principle ID quiz | ✅ |
| Problem Solving | Water-jug puzzle | Strategies quiz | ✅ |
| Visual Perception | Color/depth/saccade demos | Perception quiz | ✅ |
| Language & Ambiguity | Disambiguation game | Pragmatics quiz | ✅ |
| Ergonomics & I/O | Workstation hazard finder | Ergonomics quiz | ✅ |
| HCI Experiment Design | Experiment builder | Design validity quiz | ✅ |
| Norman's Action Cycle | 7-stage scenario walk-through | Gulf ID quiz | ✅ |
| Stroop & Consistency | RT conflict demo | Consistency quiz | ✅ |
| Weber's Law | JND threshold explorer | Perception quiz | ✅ |
| Mental Models | Affordance drag-sort | UI design quiz | ✅ |

**Flip-learning flow:** Each Understanding game teaches a concept interactively → Assessment game (6 MCQ) tests understanding → Badge (1-5 stars based on score) earned on success → Progress tracked in cookies → RAG tutor available throughout.

---

## Features

- **Auth:** SID + password login (cookie-based, client-only). Password reset via "Forgot password?" link.
- **Badges:** Awarded on assessment completion. Star rating (1-5) based on quiz score. Persists through page reload and logout/login.
- **AI Tutor:** Floating chat widget with RAG backend (Ollama + ChromaDB). Pre-filled exam-prep prompts per topic.
- **Dark mode:** Toggle at top-right of any page. Preference saved in cookies.
- **Progress tracking:** Dashboard shows completed topics, badge count, and next-game CTA.
- **Data export:** `/api/export-data` endpoint (GET) returns all user data as JSON.

---

## Step 1: Start the Python AI Backend (RAG)
The vector database is already pre-built with the course slides.

1. Open PowerShell or Command Prompt and navigate to the backend folder:
   `cd path\to\backend`
2. Create a virtual environment and activate it:
   `python -m venv venv`
   `venv\Scripts\activate`
3. Install the required Python packages:
   `pip install -r requirements.txt`
4. Start the API server:
   `python rag_api.py`

*(Leave this terminal window open. The server will start on port 8080)*

---

## Step 2: Start the Next.js Frontend Website

1. Open a **new, separate** PowerShell or Command Prompt window.
2. Navigate to the frontend folder:
   `cd path\to\frontend`
3. Install the Node modules:
   `npm install`
4. Start the development server:
   `npm run dev`

*(Leave this terminal window open as well)*

---

## Recent Fixes (June 13, 2026)

1. **Auth flow broken on signup → login redirect**
   - **Issue:** Users could sign up but couldn't log back in (infinite redirect to login).
   - **Root cause:** Signup never set `avatarId` field. Dashboard validation required it.
   - **Fix:** Default `avatarId: 1` on user creation (signup/page.tsx line 87).

2. **Password reset feature added**
   - "Forgot password?" link on login page clears credentials and redirects to signup.
   - Non-destructive: just clears cookies, user data persists on re-login.

3. **Badge persistence verified**
   - GameDebrief component centralizes badge recording (useEffect on mount).
   - Badges save to `users[sid].badges[]` in cookie, survive reload/logout/login.
   - Test suite confirms full journey: signup → assessment → badge → dashboard.

4. **All 13 game pairs wired**
   - 5 new games added: Problem Solving, Visual Perception, Language, Ergonomics, Experiment Design.
   - Each pair follows: Understanding (interactive learning) → Assessment (6 MCQ) → Badge.
   - All pairs render correctly in dev build (65 static pages).

---

## Step 3: Verify Installation (Optional)

Run the end-to-end test suite to verify the system works:

```powershell
cd path\to\frontend
npm install -g @playwright/test
node test-auth-flow.mjs          # Signup → onboarding → login → dashboard → game
node test-forgot-password.mjs     # Password reset flow
node test-badge-persistence.mjs   # Assessment → badge creation → persistence across reload/logout
```

All tests should output `✅` status lines. Expected runtime: ~15 seconds per test.

---

## Step 4: Use the System

1. Open your web browser (Chrome, Edge, etc.) and navigate to **http://localhost:3000**.
2. **Sign up** with a Student ID (e.g., `22000000D`) and password. You'll be guided through onboarding (avatar selection, username).
3. From the **Dashboard**, click any game to play. Each game has:
   - **Understanding phase** (interactive learning, explanations, exam tips)
   - **Assessment phase** (6-question quiz)
   - **Debrief** (score, principle summary, exam prep, AI tutor CTA, next-game button)
4. Earn **badges** on quiz completion (stars based on score ≥50%).
5. Ask the **AI Tutor** (blue chat bubble, bottom-right) questions about any topic. Example: *"What is Fitts' Law and how does it apply to button sizing?"*

**Note:** Both the Python backend (port 8080) and Next.js frontend (port 3000) must be running for full functionality.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" on `npm install` | Delete `node_modules/` and `package-lock.json`, run `npm install` again. |
| AI chat widget not responding | Check that Python backend is running: `python rag_api.py` in a separate terminal. |
| Badge not saving after quiz | Ensure you're logged in (check cookie `user` exists). Refresh the page if needed. |
| "Ollama pull gemma4" fails | Ensure Ollama is running. Run `ollama serve` in a PowerShell window first. |
| Login always redirects to login page | Clear browser cookies (Settings → Privacy → Clear Browsing Data) and try again. |

---

## Project Structure

```
FYP_Submission/
  backend/                  # Python FastAPI + ChromaDB RAG
    rag_api.py
    requirements.txt
    hci_chroma_db_local/    # Pre-built vector database
    *.pdf                   # COMP3423 lecture slides
  frontend/                 # Next.js 15 (App Router)
    app/
      games/
        [gameId]/           # Dynamic route, one per game pair
        [gameId]/game-client.tsx
      dashboard/            # Game launcher
      login/signup/         # Auth pages
      onboarding/           # Avatar + username setup
      api/save-lab/         # Optional: data export
    components/
      game-debrief.tsx      # Universal post-game wrapper
      ai-chat-widget.tsx    # RAG chat interface
    lib/
      badge-context.tsx     # Zustand + cookies for badges
      progress-context.tsx  # Topic progress tracking
      topic-definitions.ts  # Game metadata (13 pairs)
    test-*.mjs              # Playwright E2E tests
```

---

## For Developers

- **Add a new game:** Create `app/games/[new-game-id]/page.tsx` + `game-client.tsx`. Add entry to `TOPICS` array in `lib/topic-definitions.ts` and `DEBRIEF_CONTENT` in `components/game-debrief.tsx`.
- **Modify a game:** Edit the game-client file directly. No backend restart needed.
- **Test locally:** Run `npm run build` to verify all routes (should output ~65 static pages). Then `npm run dev` and test in browser.
- **Data model:** All user data stored in browser cookies (`user`, `users`, `darkMode`). No remote DB. Export via `/api/export-data`.

---

## EDC Exhibition Checklist

- [x] 13 HCI game pairs functional
- [x] Auth flow (signup, login, password reset) working
- [x] Badge persistence verified through E2E test
- [x] AI tutor responding with course-accurate answers
- [x] Dark mode toggle working
- [x] Build succeeds (65 static routes, zero errors)
- [ ] Manual browser testing (at least one full game cycle: Understanding → Assessment → Badge → Dashboard)
- [ ] Deployment to demo environment (if required)
