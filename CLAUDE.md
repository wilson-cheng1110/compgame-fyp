# COMPGame FYP — CLAUDE.md

## What this project is
**COMPGame** — a flipped-learning platform for COMP3423 (Human-Computer Interaction) at PolyU.
Pedagogical model: students go through an **Understanding** module (learn the concept via interactive game) → **Assessment** module (test themselves) → earn badges → AI tutor available throughout.
FYP deliverable + EDC exhibition + academic paper (measuring flip-learning effectiveness).

## Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Zustand + cookies
- **Backend**: Python FastAPI + LangChain + ChromaDB + Ollama (`gemma4` LLM + `nomic-embed-text` embeddings)
- **Storage**: **Changed 2026-08-16 for the 300-student rollout.** Accounts and progress move
  **server-side** (`backend/auth_store.py`, stdlib sqlite3 — same house pattern as `research_store.py`).
  The `user` cookie survives with its shape unchanged (`{ sid, username, avatarId }`) as **UI decoration
  only, never a security boundary**. See `docs/revamp.md` Part 0.
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
**13 topics × 2 modes = 26 game routes.** Source of truth is `lib/topic-definitions.ts` and
`app/games/` — not this file. (An earlier version of this table listed 4 topics / 8 games and was
wrong; corrected 2026-08-16.)

`fitts-law` · `gestalt` · `hicks-law` · `memory` (Miller's) · `stroop` (Consistency) · `webers-law` ·
`norman` (Action Cycle) · `mental-model` · `problem-solving` · `visual-perception` · `language` ·
`ergonomics` · `experiment-design`, plus Legacy Labs (lab1–lab6, HCI Research, legacy).

Each maps to a COMP3423 lecture session — mapping table in `docs/revamp.md` Part 6.3. Note only **4 of
13** have validated pre/post item banks (`docs/quiz-item-banks.md`); the other 9 are authored during the
run (Part 8.4).

## Auth & data model
**Changed 2026-08-16 — see `docs/revamp.md` Part 0.** Ratified: server accounts, credential is
**SID only, no secret**, gated on an enrolled-SID allowlist (`backend/enrolled_sids.txt`, gitignored —
it holds real student SIDs).

- Login: SID → allowlist check → server session. `start_session`, not `login`: with no secret this is
  **identity, not authentication**. An enrolled student can enter as another enrolled student; that is
  accepted and disclosed in the paper.
- Cookie `user` = `{ sid, username, avatarId }` — **shape unchanged**, so all 15 `Cookies.get("user")`
  call sites keep working. UI decoration only.
- Badges: array of `{ gameId, name, level (1-5), earnedAt }`
- Research export pseudonymises via HMAC at the **export boundary**; real SIDs never leave the box.
- Withdrawal tombstones the account and kills every session.

## Critical rules

### Cookie-based auth
- Auth check in every page: `Cookies.get("user")` → redirect to /login if missing
- Onboarding gate: if `needsOnboarding` in cookie → redirect to /onboarding/avatar
- Never use server-side session — keep client-only

### RAG backend
- Must be running locally on port 8080 before frontend can answer questions
- Ollama must have `gemma4:e4b` and `nomic-embed-text` pulled. **Tutor model floor:
  use `gemma4:e4b` (or larger), NOT `e2b`** — `e2b` cannot honor "give me an
  example"/analogy requests in the Socratic + JSON framing (it abstracts harder);
  e4b follows it reliably. Set via `OLLAMA_LLM` in `backend/rag_api.py` (shared by
  `/api/ask` + `/api/socratic`). Warm latency ~12s/call on e4b. (Wilson 2026-06-23,
  commit bb94012; a per-topic `_EXAMPLE_BANK` backs it up when a student is stuck.)
- **`/api/socratic` MUST keep `format="json"` + `num_predict` on its `ChatOllama`**
  (`get_socratic_chain`). The Socratic turn returns a `{response, understood, counts}`
  envelope; without JSON-mode the small model truncates long replies into BROKEN JSON
  and the raw `{"response": "...` leaked verbatim into the student's chat. `_parse_socratic`
  is the defense-in-depth backstop (regex-recovers truncated JSON, and `_clean_response`
  never lets raw JSON / a bare `true`/`0` / an empty string reach the UI). Note: the
  `understood`/`counts` flags come ONLY from the model's parsed output, never from student
  input — a student typing JSON can't self-award insight or advance the floor (no injection
  vector). (Wilson 2026-06-24.)
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
- ~~Remote database~~ / ~~Server-side auth~~ — **OVERRIDDEN 2026-08-16.** This rule was written for a
  single-browser demo. At 300 students on their own laptops, cookie-only state gives no cross-device
  resume, no deletion path on withdrawal, and silent total data loss on a cache clear. Server accounts
  are ratified: `backend/auth_store.py`, stdlib sqlite3 only. **Still do NOT add** Supabase / Firebase /
  any hosted DB, an ORM, or a second DB engine — the house pattern is stdlib sqlite3, one file, one lock.
- Price prediction or unrelated features

## Paper experiment design — full plan in `FYP_Submission/docs/`
See `docs/experiment-design.md` + `docs/quiz-item-banks.md` (validated instruments, meta-analytic evidence dossier, APA refs, pre/post item banks). **Ready-to-administer Stage-1 pack: `docs/study-pack/`** (info sheet/consent, demographics, H1 concept inventory 6-item Form A/B, H2 IMI + H3 CoI + H4 ARCS battery, reflection + Paas, scoring keys/codebook/analysis, facilitator protocol).

Goal: measure whether the Understanding-then-Assessment (flip) sequence improves learning vs assessment-only.
- **Design — Stage 2 is CURRENT as of 2026-08-16. Full plan: `docs/revamp.md`.** Within-subjects,
  **13 topics × 300 students** (3 sections of ~100, Tue/Wed/Thu), released in **lecture-notes order**.
  FLIP/CONTROL is **randomised per topic per participant** (~half each), counterbalanced across the
  cohort, **assigned and recorded server-side at release time** — not inferred from completion order.
  A Latin square does not extend to 13 topics.
- *Historical — Stage 1 (Wilson 2026-06-23), now complete:* one-group pretest–posttest, no control;
  a focus-group simplification at small N. Limitation (no counterfactual; Campbell & Stanley) disclosed
  in `docs/study-pack/00_README.md` addendum + `06_scoring-codebook-analysis.md` §A.
- *Superseded:* the "4 study topics split 2 FLIP / 2 CONTROL, Latin square" plan. Ledger of everything
  it overrides is `docs/revamp.md` Part 18.
- **IV**: `played_understanding_first` (recorded per topic, already in the research sink).
- **DV (primary)**: normalized gain ⟨g⟩ from a uniform conceptual pre/post (Form A/B). **Secondary**: in-game assessment score, duration, attempts. (Weber's in-game assessment is *perceptual*, not a knowledge quiz → a separate behavioral measure.)
- **Constructs + instruments (LOCKED 2026-06-22)**: four co-equal — performance (concept inventory Form A/B + Hake gain), motivation (IMI), interaction (CoI *reworded* "instructor"→"game + AI tutor"; non-validated adaptation, exploratory), satisfaction (ARCS-S, null-expected) + reflection (open + Likert) + Paas load bonus. Dropped on purpose: IMMS, standalone TAM, EGameFlow. H1–H4 framed exploratory, Holm–Bonferroni corrected. Full matrix in `docs/experiment-design.md` §3.

### Measurement staging — Stage 2 reached 2026-08-16
- *Stage 1 — focus group (done):* pre/post quizzes + questionnaire run externally (Google Form / paper).
  Small N; validated the instruments and the flow.
- **Stage 2 — wide rollout (CURRENT): wire the instruments into the app.** The earlier "do NOT wire yet"
  instruction is spent. `topic_pretest` / `topic_posttest` become the pre- and post-check steps of the
  topic unit; everything logs through the existing sink. `docs/revamp.md` Parts 2 and 8.

## Known issues / TODOs
- Avatar system: only 2 avatars, minimal personality — needs revamp
- Game isolation: no shared narrative thread, no "journey" feel
- RAG widget: floating chatbot feels bolted-on, not integrated into game flow
- No progress visualization (e.g., skill tree or journey map)
- Experiment instrumentation: pre-test-at-signup ✅, research sink ✅ (`backend/research_store.py`), per-topic `played_understanding_first` ✅.
  - **ACTIVE (Stage 2 — no longer deferred, 2026-08-16):** wire per-topic pre/post gates
    (`topic_pretest`/`topic_posttest`) + questionnaire/reflection logging into the topic unit. Payloads
    in `docs/experiment-design.md` §8. Build order, phase by phase, in `docs/revamp.md` Part 3.
  - Server accounts ✅ (`backend/auth_store.py`, 26 tests). Corpus staleness check ✅
    (`backend/check_corpus_coverage.py` — currently **exits 1**: zero coverage on `norman` and
    `hicks-law`, because the vector store is built from 2023 decks. Fix is `docs/revamp.md` Part 9.3).
  - **Blocked on Wilson** (`docs/revamp.md` Part 4): `backend/enrolled_sids.txt` class list · HSESC
    ethics amendment · 2026/27 lecture decks · the 13 session dates × 3 sections · a backup of
    `backend/.participant_secret` taken off this machine.
