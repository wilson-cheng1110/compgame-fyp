# COMPGame FYP — CLAUDE.md

## What this project is
**COMPGame** — a flipped-learning platform for COMP3423 (Human-Computer Interaction) at PolyU.
Pedagogical model: students go through an **Understanding** module (learn the concept via interactive game) → **Assessment** module (test themselves) → earn badges → AI tutor available throughout.
FYP deliverable + EDC exhibition + academic paper (measuring flip-learning effectiveness).

## Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Zustand + cookies (client-side state only — no server DB)
- **Backend**: Python FastAPI + LangChain + ChromaDB + Ollama (`gemma4` LLM + `nomic-embed-text` embeddings)
- **Storage**: All user data in browser cookies/localStorage via Zustand `persist`. No remote DB.
- **Fonts**: Press Start 2P (headings), Pixelify Sans (body) — pixel art aesthetic

## Project structure
```
FYP_Submission/
  backend/               # Python RAG API (FastAPI, port 8080)
    rag_api.py           # Main FastAPI server — /api/ask endpoint
    hci_chroma_db_local/ # Pre-built ChromaDB vector store (HCI lecture PDFs)
    *.pdf                # COMP3423 lecture slides (6 weeks)
    requirements.txt
  frontend/              # Next.js 15 app
    app/
      page.tsx           # Landing page
      layout.tsx         # Root layout — BadgeProvider + AiChatWidget global
      login/             # SID + password login (cookies-based)
      signup/            # SID + username + password signup
      onboarding/        # avatar/ + username/ — first-time setup
      dashboard/         # Game launcher (HCI + OS categories)
      games/
        [gameId]/        # Dynamic route — wrappers per game
        fitts-law-understanding/
        fitts-law-assessment/
        gestalt-understanding/
        gestalt-assessment/
        cpu-scheduling-understanding/
        cpu-scheduling-assessment/
        page-replacement-understanding/
        page-replacement-assessment/
      badges/            # Badge collection page
      about/
      api/
        save-lab/        # POST — persists lab result to cookie
        export-data/     # GET — exports user data as JSON
    components/
      ai-chat-widget.tsx # Floating RAG chatbot (calls localhost:8080)
      reflection-dialog.tsx # Post-game reflection prompt (open + Likert)
      game-card.tsx
      game-debrief.tsx   # End-of-game debrief + completion recording
      game-layout.tsx    # Shared wrapper for games (auth check, nav)
    lib/
      user-store.ts      # Zustand store (user, badges, login/signup/logout) — was store.ts
      badge-context.tsx  # React context for badge state
      progress-context.tsx # Per-topic progress + research-sink mirroring
      browser-utils.ts
      navigation.ts
```

## Three deadlines
1. **Internal revamp** — system needs "soul" (connective tissue between modules) — **ACTIVE**
2. **June 24** — EDC exhibition demo
3. **June 30** — Paper deadline (experiment design + results measuring flip learning effectiveness)

## What "soul" means (Wilson's diagnosis, 2026-06-13)
Current system: login is just login, RAG is just RAG, games are just games, avatar is just avatar. No connective tissue.
Target: a coherent **learning journey** — the avatar + identity persists across modules, progress feels cumulative, Understanding → Assessment flow is explicit and guided, AI tutor is woven in (not floating chatbot bolted on), badges tell a story.

## Flip learning model (core pedagogical concept)
- **Flip**: student learns concept FIRST in game-based Understanding module, THEN self-assesses
- Contrary to traditional: exam → lecture (passive) → exam
- The paper needs to MEASURE this effectiveness: pre-test → Understanding game → Assessment → post-test

## Games inventory
| Game | Mode | Status |
|------|------|--------|
| Fitts' Law | Understanding | Done |
| Fitts' Law | Assessment | Done |
| Gestalt Principles | Understanding | Done |
| Gestalt Principles | Assessment | Done |
| CPU Scheduling | Understanding | Done |
| CPU Scheduling | Assessment | Done |
| Page Replacement | Understanding | Done |
| Page Replacement | Assessment | Done |
| Legacy Labs (lab1–lab6) | HCI Research | Done (legacy) |

## Auth & data model
- Login: SID + password → cookie `user` = `{ sid, username, avatarId }`
- All users stored in cookie `users` = `{ [sid]: { password, username, avatarId, badges } }`
- Badges: array of `{ gameId, name, level (1-5), earnedAt }`
- No server — everything client-side. Data export via `/api/export-data`

## Critical rules

### Cookie-based auth
- Auth check in every page: `Cookies.get("user")` → redirect to /login if missing
- Onboarding gate: if `needsOnboarding` in cookie → redirect to /onboarding/avatar
- Never use server-side session — keep client-only

### RAG backend
- Must be running locally on port 8080 before frontend can answer questions
- Ollama must have `gemma4` and `nomic-embed-text` pulled
- CORS allows all origins (demo/dev setting — acceptable for FYP)
- The prebuilt vector DB (`hci_chroma_db_local/`) **and** the COMP3423 lecture PDFs are
  **committed to the repo** (intentional, Wilson 2026-06-18) so a fresh clone runs RAG with no
  out-of-band files. They are NOT gitignored. If the DB goes empty/missing, restore with
  `git checkout -- backend/` or rebuild from the committed PDFs via `python rebuild_db.py`.
- Retrieval is a BM25+vector ensemble at k=12 per leg. `/api/ask` retrieves on the **current
  question only** (prior turns stay as LLM context, never in the retrieval query — folding the
  previous answer in buries the right slide).

### Game structure pattern
Each game folder has: `layout.tsx` + `page.tsx` + `StartMenuClient.tsx` + `game/` subdir
Understanding games: concept intro → interactive exploration
Assessment games: scored quiz/challenge → badge awarded on completion

### Do NOT add
- Remote database (no Supabase, Firebase, etc.) — keep client-only for simplicity
- Server-side auth — cookie approach is intentional for the research context
- Price prediction or unrelated features

## Paper experiment design — full plan in `FYP_Submission/docs/`
See `docs/experiment-design.md` + `docs/quiz-item-banks.md` (validated instruments, meta-analytic evidence dossier, APA refs, pre/post item banks).

Goal: measure whether the Understanding-then-Assessment (flip) sequence improves learning vs assessment-only.
- **Design**: within-subjects, counterbalanced (Latin square). **4 study topics** — Weber's Law, Problem Solving, Gestalt, Miller's Law — split **2 FLIP / 2 CONTROL** per participant.
- **IV**: `played_understanding_first` (recorded per topic, already in the research sink).
- **DV (primary)**: normalized gain ⟨g⟩ from a uniform conceptual pre/post (Form A/B). **Secondary**: in-game assessment score, duration, attempts. (Weber's in-game assessment is *perceptual*, not a knowledge quiz → a separate behavioral measure.)
- **Constructs + instruments (LOCKED 2026-06-22)**: four co-equal — performance (concept inventory Form A/B + Hake gain), motivation (IMI), interaction (CoI *reworded* "instructor"→"game + AI tutor"; non-validated adaptation, exploratory), satisfaction (ARCS-S, null-expected) + reflection (open + Likert) + Paas load bonus. Dropped on purpose: IMMS, standalone TAM, EGameFlow. H1–H4 framed exploratory, Holm–Bonferroni corrected. Full matrix in `docs/experiment-design.md` §3.

### Measurement is STAGED (decision 2026-06-22)
- **Stage 1 — focus group (current):** pre/post quizzes + questionnaire run **externally (Google Form / paper-based)**, NOT wired into the app. Small N — validates the instruments and flow first.
- **Stage 2 — wide rollout (next batch of students):** wire the instruments into the app and collect at scale via the existing research sink (see TODO).

## Known issues / TODOs
- Avatar system: only 2 avatars, minimal personality — needs revamp
- Game isolation: no shared narrative thread, no "journey" feel
- RAG widget: floating chatbot feels bolted-on, not integrated into game flow
- No progress visualization (e.g., skill tree or journey map)
- Experiment instrumentation: pre-test-at-signup ✅, research sink ✅ (`backend/research_store.py`), per-topic `played_understanding_first` ✅.
  - **TODO (Stage 2 / wide rollout — defer):** wire per-topic pre/post gates (`topic_pretest`/`topic_posttest`) + questionnaire/reflection logging (`motivation_imi`, `interaction_survey`, `satisfaction_survey`, `reflection`) into the game flow. Payloads specified in `docs/experiment-design.md` §8. Focus-group (Stage 1) uses an external Google Form instead — do NOT wire yet.
