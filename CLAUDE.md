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
- **Fonts / design - TWO REGISTERS since 2026-08-21 (`docs/revamp.md` Part 14.1).** The shell
  (dashboard, topic unit, checks, probe, consent, login) runs the **CUBIK design system**, ported:
  **Inter** + **Roboto Mono** (data only), teal `#006666` on `#FFFFFF`/`#F9FAFB`/`#F2F4F5`, glass
  cards at `rounded-2xl`, black primary buttons that go teal on hover. Source of truth is
  `~/.antigravity/cubik-website` (`CLAUDE.md` Styling + `src/styles/globals.css`) - **if that
  changes, update `app/shell.css` and `app/fonts.ts`; never hand-drift the palette.** The **26 game CANVASES keep Press Start 2P + Pixelify Sans**, but since 2026-08-30 they take
  CUBIK's teal too: v0's inherited yellow (`#facc15`/`#fde047`/`#a16207`/cream `#f8f6ee`) is gone,
  and the one shared game CTA is **`.pixel-btn` / `.pixel-btn-sm` in `app/globals.css`** — 58 drifted
  call sites collapsed into two classes. Pixel GEOMETRY is untouched (square corners, hard offset
  shadow, Press Start 2P); only colour and the class name changed. Text on a teal fill must be white
  (black is ~3.2:1 and fails AA). Everything else around the canvases is untouched — but everything
  around them is CUBIK, including the AI tutor widget (renders on every page) and the
  end-of-game debrief (25 of 26 routes). All shell styling is scoped
  under `.shell` because `globals.css` redefines Tailwind's `.text-*` utilities globally and the
  games depend on it. **Do not move shell styles into `globals.css`.**

## Project structure
```
FYP_Submission/
  backend/               # Python RAG API (FastAPI, port 8080)
    rag_api.py           # Main FastAPI server — /api/ask, /api/socratic, /api/health.
                         #   Imports chromadb+langchain at module scope, so anything
                         #   that must work WITHOUT the RAG stack lives in a router:
    auth_api.py          #   → /api/auth/*      signup, session, consent, profile, withdraw
    admin_api.py         #   → /api/admin/*     teacher panel; own allowlist file, audited.
                         #     Includes GET/POST /api/admin/schedule — moves ONE lecture date
                         #     (sessions[n][section]); previews first because that date is the
                         #     timing of the IV, refuses a date that adds a validation problem
                         #     or lands on a declared no-class day, writes atomically, audited.
    topic_api.py         #   → /api/topics/*    journey, gate, pre/post checks
    research_api.py      #   → /api/research/*  event, summary, pseudonymised export
    auth_store.py        # Participant accounts (stdlib sqlite3) + HMAC pseudonyms
    schedule.py          # Release windows per section + FLIP/CONTROL assignment
    checks.py            # Item-bank parsing, server-side MC grading, key never ships
    grade.py             # Short-answer grading: rubric, null filter, BLINDING, kappa,
                         #   fail-closed /api/grade. temperature=0, offline by design
    grade_batch.py       # The offline blind pass + --sample-for-human / --kappa
    generate_tutorial_report.py # Teacher brief. Pass 1 counts in CODE, pass 2 is the
                         #   LLM on text only. Writes teacher + anonymised, always both
    ops.py               # Concurrency gate (off the event loop), rate limit, health
    backup_sink.py       # Hourly sqlite online-backup of the sink + accounts
    check_corpus_coverage.py # Is the vector store still current? exits 1 if not
    topic_schedule.json  # Release config. Dates VERIFIED 2026-08-27 vs the academic
                         #   calendar (teaching Mon 31 Aug - Sat 28 Nov 2026, 13 weeks).
                         #   --validate flags lecture dates on public holidays.
    enrolled_sids.txt    # Class list (SID,section). GITIGNORED — real personal data
    tests/               # 381 assertions: python backend/tests/run_all.py
    make_e2e_schedule.py # today-relative schedule so the browser tests have an open topic
    hci_chroma_db_local/ # Pre-built ChromaDB vector store (HCI lecture PDFs)
    *.pdf                # COMP3423 lecture slides (6 weeks)
    requirements.txt
  deploy/                # ONE COMMAND to a running study server. setup.ps1 -> start.ps1
                         #   -> publish.ps1, plus install-services.ps1 for the part
                         #   three commands do NOT give you: Scheduled Tasks for boot,
                         #   a watchdog, and a dead-man's-switch heartbeat (inbound
                         #   monitoring cannot tell you a box is OFF -- silence is the
                         #   signal). publish.ps1 REFUSES on a red gate. See deploy/README.md.
                         #   All .ps1 are ASCII + UTF-8 BOM: PowerShell 5.1 reads a
                         #   BOM-less .ps1 as ANSI and one em dash breaks the parse.
  frontend/              # Next.js 15 app
    e2e/                 # 352 browser assertions: node e2e/run.mjs (see e2e/README.md).
                         #   Catches what backend tests structurally cannot — the login
                         #   loop, the assets-400 deploy bug, the stale-session dashboard.
                         #   BUILD THEN START; never rebuild under a running server.
                         #   THREE suites: happy-path, unhappy-path, and
      resilience.mjs     #   → the surfaces the other two never touch. All 28 game
                         #   surfaces (26 routes + 2 Fitts sub-canvases) — only THREE
                         #   had ever been opened by a test. Plus refresh mid-check,
                         #   two tabs, backend down mid-submit, slow submit, cleared
                         #   storage, cross-device resume, a dead tutor, 390px phone,
                         #   keyboard-only, screen-reader semantics, and a 50-way
                         #   sign-in burst. Games are proven to MOUNT, not to be
                         #   finishable — that gap is P5 (docs/go-live-plan.md §4.1).
    app/
      page.tsx           # Landing page
      layout.tsx         # Root layout — BadgeProvider + AiChatWidget global
      login/             # SID + password login (cookies-based)
      signup/            # SID + username + password signup
      onboarding/        # avatar/ + username/ — first-time setup
      dashboard/         # Game launcher (HCI + OS categories)
      games/
        [gameId]/        # Dynamic route — wrappers per game
      topics/[topicId]/  # NO STEP IS SELF-DECLARED any more (2026-08-30): the activity,
                         #   assessment and tutor steps show Continue only once the thing has
                         #   RECORDED, and offer a LOGGED escape (activity_not_recorded etc.)
                         #   to someone who opened it and was let down. That escape is part of
                         #   the design, not a softness in it: in FLIP the activity sits
                         #   BETWEEN the two checks, so a hard gate would cost stuck FLIP
                         #   students their post-check and cost CONTROL nothing --
                         #   differential attrition by condition. The close screen now REPLAYS
                         #   both games (free play, no ?unit=), because "you have to do it" is
                         #   only fair beside "and you can do it again".
                         #   The old "I've finished it - continue" was masking a ten-week data
                         #   loss: docs/incident-2026-08-30-completion-events-lost.md.
                         #   The topic unit. page.tsx is a SERVER COMPONENT and must stay
                         #   one: it renders the unit's content (and the locked panel)
                         #   before any JS runs. When it was a client component, any
                         #   hydration failure showed "Loading…" forever, silently.
                         #   unit-client.tsx holds the interactive half.
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
      session-map.tsx    # "How this works" on the dashboard. Orientation, which is a
                         #   DIFFERENT job from the lecture grouping below it: grouping
                         #   answers "where is my stuff", this answers "what is this and
                         #   how do I use it". Open only while nothing is finished.
      game-debrief.tsx   # End-of-game debrief + completion recording
      game-layout.tsx    # Shared wrapper for games (auth check, nav)
    lib/
      user-store.ts      # Zustand store (user, badges, login/signup/logout) — was store.ts
      badge-context.tsx  # React context for badge state
      progress-context.tsx # Per-topic progress + research-sink mirroring
      game-phase.tsx     # Where you are INSIDE a game. Two contexts, not one: games
                         #   subscribe only to the stable setter, so a chrome update can
                         #   never re-render a game subtree — hicks-law-assessment MEASURES
                         #   REACTION TIME and must not be perturbed by the strip.
                         #   The 7 games that showed no progress on any screen now do.
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

Each maps to a COMP3423 lecture session — mapping table in `docs/revamp.md` Part 6.3. **All 13 now have
pre/post item banks** (`docs/quiz-item-banks.md`, 6 items per form, 156 in total) — topics 1-4 from
Stage 1, topics 5-13 authored 2026-08-30 from the games' own source. `checks.py` still returns `None`
for an unbanked topic and the unit renders with no MC step, so a 14th topic added without items is
silently unmeasured; `test_checks.py` asserts every scheduled topic has a bank to stop that.
**`norman` and `hicks-law` are extra topics, not H1 evidence** — zero lecture-corpus coverage, so
their gain is reported separately (Wilson's decision, 2026-08-30).

## Auth & data model
**Changed 2026-08-30 (Wilson) — this supersedes the 2026-08-16 SID-only model.** The credential is
**SID + password** (stdlib `hashlib.scrypt`, per-user salt; no bcrypt/passlib), and the enrolled-SID
allowlist became **OPTIONAL**. `backend/enrolled_sids.txt` is still gitignored — it holds real SIDs.

- **Sign up** at `/signup`: SID + password (+ section when no roster is configured). Roster present →
  it gates who may sign up AND dictates the section; roster absent → open signup and the student picks
  their section, which is then the ONLY source of their release window.
- **Sign in** at `/login`: SID + password. `/session` returns ONE 401 for unknown SID, wrong password,
  unclaimed account and withdrawn alike — it must never be usable to enumerate who is enrolled. `/signup`
  DOES name its refusals, because a signup form that will not say why is unusable. Do not "improve" the
  login error message.
- **Teacher panel** at `/admin` (`backend/admin_api.py`), gated on a session AND `backend/admin_sids.txt`
  (gitignored; `.example` is committed). Section correction, password reset, reversible disable/enable, and
  display-name edit (the last two added 2026-09-03), every mutation audited to `admin_audit`. It could not
  exist before the password did — both auth modules forbade it in their own docstrings. It cannot read answers
  or scores, return password material, or delete anything — **disable is a REVERSIBLE off switch** (blocks
  sign-in via all three gates: `resolve_session` / `start_session` / `create_account`, and keeps their data),
  distinct from withdrawal, which is the study-exit tombstone.
- Still NOT strong identity: a password can be shared, and with no roster an unenrolled person can create
  an account. Both belong in the paper.
- Cookie `user` = `{ sid, username, avatarId }` — **shape unchanged**, so all 15 `Cookies.get("user")`
  call sites keep working. UI decoration only.
- Badges: array of `{ gameId, name, level (1-5), earnedAt }`
- Research export pseudonymises via HMAC at the **export boundary**; real SIDs never leave the box.
- Withdrawal tombstones the account and kills every session.

## Critical rules

### ONE ORIGIN (2026-08-30) — the browser never names the API
The browser calls a **relative** `/api/...`; `next.config.mjs` rewrites it to FastAPI on
loopback. Only port 3000 is ever exposed. Three things depend on this and each was a real
hazard: the build carries **no hostname**, so it is portable (a bundle built with an
absolute origin deploys, serves 200s, and does nothing — no data, no error); there is **no
CORS** at all; and the session cookie stays **first-party `SameSite=Lax`** (a split origin
forces `SameSite=None`, which Safari ITP and Chrome's third-party-cookie deprecation block
— silent sign-in failure on iPhones. This is why a Vercel shell was declined).
**TWO constants, not one.** `lib/api.ts` `API_BASE` is empty (browser, relative).
Server-side callers — `app/topics/[topicId]/page.tsx` (server component) and
`app/api/export-data/route.ts` (route handler) — use an **absolute** `API_ORIGIN` loopback
URL, because server-side `fetch` has no document and so no origin to resolve against.
`e2e/happy-path.mjs` asserts the built bundle names no `localhost:8080`.

### Cookie-based auth
- Auth check in every page: `Cookies.get("user")` → redirect to /login if missing
- Onboarding gate: if `needsOnboarding` in cookie → redirect to /onboarding/avatar
- Never use server-side session — keep client-only
- **Idle timeout — added 2026-08-31 (Wilson).** `SESSION_IDLE_MINUTES` (default 30):
  `auth_store.resolve_session` stamps `last_seen_at` (throttled to ~1 write/min) and,
  past the window, refuses AND deletes the session row → the next request lands on
  /login. The absolute `SESSION_DAYS` expiry is unchanged; this is the inactivity cut.
  Legacy sessions with NULL `last_seen_at` are honoured then stamped (nobody logged out
  retroactively). `POST /api/auth/ping` + `components/session-keep-alive.tsx` refresh an
  ACTIVE session — the widget pings ONLY when there's been real interaction since the
  last 5-min tick, so typing a long probe answer keeps the session while a walked-away
  tab still times out.

### RAG backend
- Must be running locally on port 8080 before frontend can answer questions
- Ollama must have `gemma4:e4b` and `nomic-embed-text` pulled. **Tutor model floor:
  use `gemma4:e4b` (or larger), NOT `e2b`** — `e2b` cannot honor "give me an
  example"/analogy requests in the Socratic + JSON framing (it abstracts harder);
  e4b follows it reliably. Set via `OLLAMA_LLM` in `backend/rag_api.py` (shared by
  `/api/ask` + `/api/socratic`). Warm latency **~7s/call measured 2026-08-16** on the
  5060 Ti dev box (`/api/ask` end-to-end; socratic ~8s). The older ~12s figure is
  pessimistic; the 3090 deployment box is still unmeasured. (Wilson 2026-06-23,
  commit bb94012; a per-topic `_EXAMPLE_BANK` backs it up when a student is stuck.)
- **`num_predict` on `gemma4:e4b` has a cliff, measured 2026-08-21.** On the grader's
  prompt, `num_predict` of 320/512/640/768 returns an **empty string**; 1024+ returns
  correct JSON. An empty reply is indistinguishable from "not enough signal to grade",
  so too low a cap silently turns every answer into a missing datum while the batch
  looks like it ran fine. `grade.py` is pinned at 1536. **`/api/socratic` was tested
  end-to-end at its own `num_predict=512` and is NOT affected** (325 chars, correct
  flags) — its prompt shape differs. Do not "fix" socratic on the strength of the
  grader's number; re-measure if you change its prompt.
- **`/api/socratic` MUST keep `format="json"` + `num_predict` on its `ChatOllama`**
  (`get_socratic_chain`). The Socratic turn returns a `{response, understood, counts}`
  envelope; without JSON-mode the small model truncates long replies into BROKEN JSON
  and the raw `{"response": "...` leaked verbatim into the student's chat. `_parse_socratic`
  is the defense-in-depth backstop (regex-recovers truncated JSON, and `_clean_response`
  never lets raw JSON / a bare `true`/`0` / an empty string reach the UI). Note: the
  `understood`/`counts` flags come ONLY from the model's parsed output, never from student
  input — a student typing JSON can't self-award insight or advance the floor (no injection
  vector). (Wilson 2026-06-24.)
- CORS is an explicit allowlist (`ALLOWED_ORIGINS`, default localhost:3000), NOT a wildcard —
  corrected once the session cookie became credentialed (rag_api.py). The old "allows all origins"
  note was stale; the sweep confirmed the live code is restrictive.
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
  *(A 4th **MSc** section — COMP5517, Mondays — was added to `topic_schedule.json` 2026-09-03 for a
  cross-population read; its inclusion in the study analysis is HSESC-gated, `docs/ethics-amendment-stage2.md`.)*
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
- **`markGameComplete` recorded NOTHING from 2026-06-23 to 2026-08-30** — `if (!users[sid])
  return` over a local record that nothing created once accounts moved server-side. So
  `game_done`, `assess_done` and `played_understanding_first` were never written from
  gameplay, and badges were dropped the same way. Fixed with `ensureUser()` in
  `lib/user-store.ts`. Evidence and the data consequences:
  `docs/incident-2026-08-30-completion-events-lost.md` — **two open questions for Wilson at
  its foot**, one an ethics wording issue on `TELEMETRY_ENABLED`.
- Experiment instrumentation: pre-test-at-signup ✅, research sink ✅ (`backend/research_store.py`), per-topic `played_understanding_first` ✅.
  - Per-topic pre/post gates ✅ · short-answer probe ✅ (`topic_probe`/`topic_probe_post`,
    fixed per topic — a per-student generated probe is a different instrument per student).
    Blind offline grading ✅ (Phase 04) · teacher tutorial report ✅ (Phase 06) ·
    `corpus_version`/`app_version` stamped on every event ✅ (Part 13.2).
    Questionnaire logging ✅ — IMI/CoI/ARCS/Paas wired as `backend/questionnaire_api.py`
    (`/api/questionnaire/*`), **OFF by default** (`QUESTIONNAIRES_ENABLED`, tied to the HSESC
    amendment), **consent-gated** (403 pre-consent, same as every recorded path), scoring key
    never served, one submission per instrument (partial unique index covers `questionnaire_%`).
    Derivation helpers in `backend/measures.py` (arm ASSIGNED, `played_first` OBSERVED from
    server_ts). **Still open:** Phase 07 visual pass (the 太game fix).
  - Server accounts ✅ (`backend/auth_store.py`, 26 tests). Corpus staleness check ✅
    (`backend/check_corpus_coverage.py` — currently **exits 1**: zero coverage on `norman` and
    `hicks-law`, because the vector store is built from 2023 decks. Fix is `docs/revamp.md` Part 9.3).
  - **Blocked on Wilson** (`docs/revamp.md` Part 4 · sequenced in `docs/go-live-plan.md`):
    `backend/enrolled_sids.txt` class list (OPTIONAL since 2026-08-30, but its absence means the
    student self-reports their section) · **HSESC ethics amendment — draft ready at
    `docs/ethics-amendment-stage2.md`, four open questions for the supervisor at its foot** ·
    2026/27 lecture decks (`norman`/`hicks-law` still zero corpus coverage, `webers-law` thin at
    3 hits).
    *(The National Day item that used to sit here is DONE: section C's session 5 on 2026-10-01 was
    acknowledged with a written decision on 2026-08-27, so `schedule.py --validate` exits 0. A
    teacher can now move any lecture date from `/admin` without touching the file.)*
  - **`backend/.participant_secret` — DONE 2026-08-30, and it was not what the list said.** The
    file had never existed: it is generated lazily on first use, so it would have been born
    unnoticed during the first export on the deployment box. Generated deliberately before any
    real data existed, and copied off-machine with a README and a fingerprint
    (`3e4d9879…9eabf3`) so a copy can be verified without exposing the key. **Copy it onto the
    deployment box BEFORE first run** — otherwise that box mints a different key and the backup
    is worthless.
