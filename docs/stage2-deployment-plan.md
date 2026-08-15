# COMPGame — full roundtrip plan for a ~300-student deployment

## Context

COMPGame runs today as three dev processes on one machine (`START_ALL_SERVICES.ps1`: `ollama serve` +
`python rag_api.py` + `next dev`), and every layer assumes **one browser on the server machine**. That
breaks the instant a second person opens it.

But "make it deployable" is the smaller half. This is `CLAUDE.md`'s **Stage 2 wide rollout** — 300
students, staggered over days/weeks, on their own laptops, generating the dataset a paper depends on.
So the plan has to close five loops, not one:

| Loop | What it is | State today |
|---|---|---|
| **A — Request** | click → tunnel → Next → FastAPI → Ollama → back | breaks off-localhost; no timeouts anywhere |
| **B — Student journey** | link → consent → signup → 13 topics → post-test | no consent, no post-test, per-device accounts |
| **C — Operations** | a home PC running unattended for weeks | no health check, no supervisor, no monitoring |
| **D — Data** | event → sink → export → analysis | duplicates + test rows already in live data |
| **E — Change** | shipping a fix mid-study | no versioning; changing mid-study splits the sample |

Decisions taken (Wilson, this session): **server-side accounts** (explicitly overriding the
`Do NOT add: Remote database / Server-side auth` rule in `CLAUDE.md`, which was written for a
single-browser demo); **public HTTPS via tunnel**; **queue with honest wait UI**; **staggered load**.

Hardware note: this dev box is an **RTX 5060 Ti (16 GB)**, not a 3090. Every latency number in
`CLAUDE.md` was measured here and does not transfer to the 3090.

---

# Loop A — the request roundtrip

### Target: one origin

```
                Cloudflare Tunnel (free HTTPS, no port-forward, no public IP)
                                     │  ⚠ edge returns 524 on a slow origin
                            https://compgame.<domain>
                                     │
                    ┌────────────────▼───────────────┐
                    │ Next.js 127.0.0.1:3000         │  next build && next start
                    │ rewrites /api/rag/* ────────┐  │
                    └─────────────────────────────┼──┘
                    ┌─────────────────────────────▼──┐
                    │ FastAPI 127.0.0.1:8080         │  auth · queue · RAG · sink
                    └─────────────────┬──────────────┘
                    ┌─────────────────▼──────────────┐
                    │ Ollama 127.0.0.1:11434         │  gemma4:e4b + nomic-embed-text
                    │ RTX 3090 24 GB                 │
                    └────────────────────────────────┘
```

Exposing **only** port 3000 and proxying FastAPI behind a Next rewrite kills five problems at once:
the hardcoded-localhost failure, all CORS, the exposed `0.0.0.0:8080`, the 90 KB of
`Invalid HTTP request received` in `backend/_e4b_boot.err`, and the lack of HTTPS that the session
cookie's `Secure` flag needs.

### A1. Kill the hardcoded origins
`http://localhost:8080` is baked into **browser-side** code — on a student's laptop it points at *their*
machine and fails silently every time:
`components/ai-chat-widget.tsx:122`, `components/reflection-dialog.tsx:15`, `lib/research-log.ts:13`.

Add `rewrites()` in `next.config.mjs` mapping `/api/rag/:path*` → `${RAG_ORIGIN}/api/:path*`, switch
those three to relative paths, and read `RAG_ORIGIN` from env in the server-to-server caller
(`app/api/export-data/route.ts:13`). Drop the spec-invalid `allow_origins=["*"]` +
`allow_credentials=True` pair at `rag_api.py:51-57` — same-origin needs no CORS.

### A2. Stop blocking the event loop  ← biggest load bug
`rag_api.py:272,299,305` and `:472,487,518` call **synchronous** `retriever.invoke()` / `llm.invoke()`
inside `async def` handlers. That blocks the whole event loop, so FastAPI currently serves **one request
at a time** and every other student stalls behind it invisibly. Same defect at `:544` where
`research_event` calls blocking `sqlite3` + `threading.Lock` (`research_store.py:96-122`).

Fix: make the heavy handlers `def` (FastAPI then runs them in a threadpool) or `await ...ainvoke()`.
This alone is likely the main source of the "session errors" you're seeing — it is independent of the GPU.

### A3. Make the queue asynchronous, not a long-held request
A held request has to survive every timeout in the chain, and behind Cloudflare a slow origin returns
**524**. A student queued behind others would get a hard edge error, not a wait.

Design it out instead of tuning around it: `POST /api/rag/socratic` enqueues and returns a job id
immediately; the client polls `GET /api/rag/job/{id}`, which returns `queued (position N)` →
`running` → `done`. No request is ever long-lived, no edge timeout can kill it, and the honest
"you're #N in line" UI falls out for free because there is a real position to report.

Guard the workers with `asyncio.Semaphore(OLLAMA_NUM_PARALLEL)`; over `MAX_QUEUE`, refuse with a
friendly message rather than growing unboundedly. Verify Cloudflare's current origin-timeout behaviour
against their docs at build time — but the polling design is correct regardless of the number.

### A4. Timeouts and Ollama tuning
There is currently no timeout on any hop — not on `fetch`, not on `invoke()`. Set an explicit budget at
each. Also share **one** retriever between the RAG and Socratic paths (`rag_api.py:184,249` build it
twice, duplicating the BM25 index and the whole Chroma document set in RAM).

On the 3090: `OLLAMA_NUM_PARALLEL=4` to start, `OLLAMA_MAX_LOADED_MODELS=2` (`gemma4:e4b` **and**
`nomic-embed-text` — the vector leg embeds on every query), `OLLAMA_KEEP_ALIVE=-1` so the model never
unloads between staggered students.

**Capacity, honestly.** The only measured figure is ~12 s/call warm on e4b, on the 5060 Ti. Use the
formula, not a guess:

```
sustainable throughput (req/min) = 60 × OLLAMA_NUM_PARALLEL ÷ p50_seconds
```

Worked example under *my* assumptions (300 students × 13 topics × ~6 tutor turns ≈ 23k calls over 14
days ≈ 5 calls/min average; 4 slots at 12 s ≈ 20 req/min) leaves ~4× headroom. Average is not the
problem — **the night before a deadline is**. A 10× evening spike lands at ~46 req/min against 20,
which is why A3's queue is required rather than optional. The load test in Verification replaces this
arithmetic with a real number.

---

# Loop B — the student journey

### B1. Consent — blocking, and currently absent
`grep` for `consent|withdraw|ethics|HSESC` across the entire frontend returns **zero matches**. You
have consent material in `docs/study-pack/` (info sheet/consent), but nothing in the app. Running 300
participants without in-app informed consent is an ethics failure, not a polish item.

Add a consent gate before signup: info sheet → explicit opt-in → timestamped `consent_recorded` event
with the document version. Include a withdrawal path, since consent you cannot withdraw is not consent.
A participant who withdraws must have their data deletable — which needs B2.

### B2. Replace passwords with issued access codes
> **DECIDED 2026-08-16 — neither. `SID only, no secret`, gated on an enrolled-SID allowlist.**
> Three of the four benefits argued below are still delivered: enrolment control on a public URL (the
> allowlist), pseudonymised data (`revamp.md` Part 13's HMAC at the export boundary), and
> per-participant deletion for withdrawal. The fourth — unforgeable identity — is **given up
> deliberately**: an enrolled student can enter as another enrolled student. Accepted as a reasonable
> trade for a low-stakes formative tool, and disclosed in the paper's limitations.
> Distributing 300 codes was the cost that decided it. See `docs/revamp.md` Part 0.
Passwords are the wrong primitive for a 300-person class study, and they cause three separate problems:

- **Support load.** `login/page.tsx:61-65` "Forgot password" calls `removeUsers()` — it wipes *every*
  account on that machine. Even fixed, password resets across 300 students is real inbox volume for you.
- **Credential liability.** Students will reuse their PolyU password. You do not want that on a home PC.
- **Identifiability.** `research-log.ts:32` sets `participant_id` to the raw **SID**. Directly
  identifying personal data, on an internet-exposed box, under PDPO and PolyU policy.

Issue each enrolled student a random access code instead. The code *is* the `participant_id`; the
code→SID mapping lives in one offline file you control (or nowhere, if you distribute codes by hand).
This gives you enrolment control on a public URL, pseudonymised data, a trivial "lost my code" path,
and per-participant deletion for withdrawal — four problems, one primitive.

### B3. Accounts that follow the student
> **BUILT 2026-08-16 — `backend/auth_store.py`, 26 tests passing.** Everything below holds except the
> credential: there is no secret to hash, so `hashlib.scrypt` is unused. The rest is as specified —
> stdlib sqlite3, module lock, explicit `conn.close()`, `users` + `sessions`, and the `user` cookie
> keeping its exact shape so all 15 `Cookies.get("user")` call sites keep working untouched.
> Two additions: the enrolment file also carries each student's **section** (A/B/C), which drives the
> Tue/Wed/Thu release windows; and withdrawal **tombstones** rather than deletes, so a withdrawn SID
> cannot start a fresh session and reappear in the data.
New `backend/auth_store.py`, mirroring `research_store.py` exactly (stdlib `sqlite3`, module lock,
explicit `conn.close()` — that is the house pattern, reuse it). Tables `users` and `sessions`. Hash with
**stdlib `hashlib.scrypt`** — a proper KDF, no new dependency; do not add bcrypt/passlib.

**Two cookies, and this is what keeps the change small:**

| Cookie | Flags | Role |
|---|---|---|
| `session` | `HttpOnly; Secure; SameSite=Lax` | the real credential, validated server-side per request |
| `user` | JS-readable, **shape unchanged** `{sid, username, avatarId}` | UI decoration only, untrusted |

Keeping `user` identical means **all 15 `Cookies.get("user")` call sites across 12 files keep working
untouched** — `middleware.ts`, `game-layout.tsx`, `badge-context.tsx`, `progress-context.tsx`,
`dashboard`, `badges`, `onboarding/*`. Only `login/page.tsx`, `signup/page.tsx` and `lib/user-store.ts`
change. Comment explicitly that `middleware.ts` is a UX redirect, **not** a security boundary (it also
only matches `/games/:path*` at `:20-22`, leaving `/dashboard`, `/badges`, `/onboarding` open).

Migration: extend the existing cookie→localStorage path in `getUsers():35-41` to push a local profile to
the server once on first login, and **do not clear local data until the server confirms the write**.

### B4. The post-test does not exist
> **RESOLVED 2026-08-16.** The reconciliation this section demands: **per-topic Form A/B is the H1
> instrument**; the ad-hoc 5-item MCQ at `signup/page.tsx:29-80` is demoted to a one-off
> prior-knowledge baseline and never enters a gain score. Post-test is the post-check step of the
> topic unit. `docs/revamp.md` Parts 2 and 8.
No `post_test` event type appears anywhere in the code or in the 81 rows already in the sink. Without it
there is no pre→post gain, and **H1 — the primary hypothesis — is unmeasurable**. `docs/experiment-design.md`
§8 already specifies the payloads (`topic_pretest` / `topic_posttest`), and `docs/study-pack/` has the
validated 6-item Form A/B concept inventory. Note the signup pre-test at `signup/page.tsx:29-80` is a
different, ad-hoc 5-item MCQ — reconcile which instrument is authoritative before launch, not after.

### B5. The IV is not actually manipulated
> **RESOLVED 2026-08-16 — enforce, don't accept observational.** The topic unit sequences the student,
> and the arm (FLIP/CONTROL) is assigned **server-side per participant per topic** by the same endpoint
> that returns the release window, then recorded. Not the Latin square named below — that does not
> extend to 13 topics — but per-topic randomisation, ~half each, counterbalanced across the cohort.
> `progress-context.tsx:89` keeps recording the observed flag, and **observation must equal assignment
> or there is a bug**. `docs/revamp.md` Parts 2, 7.2, and Part 17's verification row.
`progress-context.tsx:89` records `playedUnderstandingFirst: current.understandingCompleted` — correct
as *observation*. But nothing sequences the student, and the live data shows the consequence:
**27 of 33 assessments have `played_understanding_first = 0`**. Only 2 of 22 participants ever completed
an Understanding module.

At 300 students that yields an uncontrolled observational variable, not a manipulated independent
variable — and the flip-learning claim rests on it. Either enforce the assignment per topic (the Stage-2
Latin square in `CLAUDE.md`) or accept and state plainly that Stage 2 is observational too.

### B6. Interruption, resume, and device
Students will close the laptop mid-topic and return the next day, and some will use phones. Two things
follow:

- Resume must be explicit — progress currently lives in `localStorage`, so a different browser shows a
  blank journey even after B3 fixes login.
- **Device is a research confound, not just a UI question.** Fitts' Law and Weber's Law assessments are
  *perceptual/motor* measures (`docs/experiment-design.md` says so explicitly). Touchscreen and mouse
  produce different numbers for the same student. Record input modality and viewport on every game
  event, and verify mobile rendering on a real phone — I have not verified it and am not assuming it.

---

# Loop C — operations on an unattended home PC

### C1. The home-PC failure modes that actually bite
For weeks of unattended running, these are more likely to take you down than any code path:

- **Sleep / hibernate.** A desktop that sleeps takes the whole class offline. Disable sleep and disk
  spin-down explicitly.
- **Windows Update auto-reboot.** Set active hours / defer restarts, and make every service restart on
  boot anyway.
- **Power cut, ISP blip.** The tunnel reconnects on its own; your services must too.

Run FastAPI, Next and `cloudflared` under a supervisor (NSSM on Windows, systemd on Linux) with
start-on-boot and restart-on-crash. `rag_api.py:588-594` must become `reload=False`,
`host="127.0.0.1"` — an auto-reloader is not a production server. The frontend runs
`next build && next start`, not `next dev` (`START_ALL_SERVICES.ps1:33`).

### C2. You cannot currently tell if it is alive
There is **no health endpoint** (`grep health` on `rag_api.py` returns nothing). Add
`GET /api/health` reporting Ollama reachability, model loaded, DB writable, and queue depth. Point an
external uptime check at it so you find out from a notification, not from a student email.

### C3. Support burden is a design input
300 students will generate messages. B2's access codes remove the biggest category. For the rest, a
short FAQ page and a documented "what to do if the site is down" line in the recruitment email will cost
you an hour and save many.

### C4. Housekeeping
`*.log`/`*.err` are gitignored but still grow on disk — `_e4b_boot.err` reached 90 KB of a single
repeated warning. Rotate them. Watch ChromaDB WAL growth and free space.

---

# Loop D — the data loop

**This loop has confirmed defects in data already collected** (81 events, 22 participants).

### D1. Duplicate events — confirmed live
Eight-plus cases of the same `participant_id + assessment_complete + topic_id` recorded twice
(`memory`, `problem-solving`, `language`, `ergonomics`). Cause: `progress-context.tsx:98` fires
`logResearchEvent` unconditionally on every `markGameComplete`, while the surrounding state write is
idempotent (`:80,87` use `?? now`). `record_event` has no idempotency key
(`research_store.py:99-120`). Replays, refreshes and React double-invokes all double-count.

Fix: a client-generated event key plus a `UNIQUE` constraint and upsert server-side. At 300 students,
duplicates silently inflate n and bias every mean you report.

### D2. Test rows share the table with real data
Participant IDs `DEMO…`, `REFL…`, `PROBE…` sit in the same `events` table with no `is_test` flag and no
environment separation. Add a cohort/environment column and filter at export — you do not want to be
sorting this out by prefix-matching during analysis.

### D3. Pseudonymise, and stamp provenance
`participant_id` becomes the access code from B2 rather than the SID. Add to every event: app version
(Loop E), instrument version, device/input modality (B6). Add `post_test` (B4).

### D4. The export is unauthenticated
`app/api/export-data/route.ts:13` → `rag_api.py:557-578` returns **every participant's ID and full
event history to anyone who asks**, on a public URL. Put both behind an admin token from env. This is
the consent obligation you signed up for, not hardening.

### D5. Back it up
`research_events.db` is a single SQLite file holding the entire study. Schedule a `VACUUM INTO`
snapshot off-box. Losing it at day 20 loses the paper.

---

# Loop E — the change loop

Changing the intervention mid-study splits your sample: students before and after a fix are not in the
same experiment, and pooling them is a validity error you cannot fix in analysis.

- **Stamp every event with an app version.** Then a mid-study change is partitionable rather than fatal.
- **Freeze the intervention once recruitment opens.** Distinguish up front which fixes are
  intervention-affecting (game content, scoring, sequencing, tutor prompts) and which are safe
  (crash fixes, capacity). Only ship the safe class during collection.
- `next.config.mjs:16-21` sets `ignoreBuildErrors` **and** `ignoreDuringBuilds` — the build passes over
  real type errors, so a deploy can look green and break a game for 300 people. Turn them off at least
  once to see what is hidden.
- Remove `frontend/let;chmod` — a UPX-packed Linux ELF binary still **tracked in git**. The identical-md5
  copy `frontend/let` was untracked and gitignored in `6987bcc`; the semicolon variant escaped that cleanup.

---

# Sequencing

Ordered so each stage is independently shippable, and so nothing irreversible happens before the
research-integrity items land.

| Stage | Contents | Why here |
|---|---|---|
| **0** | A1, A2, A4-share, C1-supervisor, C2-health | Makes it work for a second person and stay up. Smallest useful deployment. |
| **1** | B3 accounts, B2 access codes, D3 pseudonymisation, D4 export auth | Identity + privacy before any real participant touches it. |
| **2** | **B1 consent**, B4 post-test, B5 sequencing, D1 dedup, D2 cohort flag, E versioning | **Recruitment must not open before this stage lands** — these are the difference between 300 students producing a dataset and producing nothing usable. |
| **3** | A3 async queue, load test, C3, C4, D5 backups | Capacity and durability, verified under load. |
| **4** | Tunnel, unattended run, end-to-end rehearsal | Go-live. |

**If time forces a cut:** Stage 0+1 is a defensible deployment for a small pilot. Cutting **Stage 2** is
not a scope reduction — it is running 300 students and getting no paper.

---

# Verification

**Stage 0** — from a *second* machine (phone on mobile data, not your LAN): open the tunnel URL, ask
the tutor a question, get an answer with sources. This fails 100% of the time today; that contrast is
the test. Then `curl /api/health` and confirm it reports model-loaded and DB-writable.

**Stage 1** — register on machine A, log in on machine B, same profile and badges. DevTools shows
`user` but **not** `session` (proving `HttpOnly`). `curl` a protected endpoint with no session → 401.
`curl` the export with no admin token → 401. Re-run the existing `frontend/test-auth-flow.mjs` and
`test-login-debug.mjs` against the **built** app, not `next dev`.

**Stage 2 — the research-integrity gate.** Run one synthetic participant end to end, then assert
against the DB directly:
- exactly one row per `(participant, event_type, topic)` — replay the same game twice and confirm the
  count does **not** increase (this is D1's regression test, and today it would fail);
- a `consent_recorded` row exists before any other event for that participant;
- `pre_test` and `post_test` rows both exist and a gain is computable;
- `played_understanding_first` is `1` for topics assigned to the FLIP condition;
- no `DEMO/REFL/PROBE` rows appear in a production-cohort export.

**Stage 3 — the load gate.** Measure p50/p95 of a warm `/api/rag/socratic` call on the 3090 and record
it; that number replaces the 5060 Ti's 12 s everywhere. Then drive 40 concurrent synthetic students.
- **Pass:** zero 5xx, zero dropped connections, p95 under 60 s, and every request either answered or
  given an accurate queue position.
- **Pre-registered falsifier:** any 5xx, any silent timeout, any 524 from the edge, or a queue position
  shown to the user that does not match reality = failed. Do not narrow this bar afterwards to whatever
  the run happened to produce.
- Watch `nvidia-smi` throughout; if VRAM saturates, lower `NUM_PARALLEL` rather than hoping.

**Stage 4** — full journey from a phone on mobile data: consent → code entry → pre-test → onboarding →
Understanding → Assessment → reflection with tutor → post-test → badge. Then kill the FastAPI process
and confirm it returns by itself; reboot the box and confirm everything returns by itself. Finally
`GET /api/research/summary` with the admin token and confirm the events landed, deduplicated, correctly
attributed.

---

# Red hat — how this goes wrong

- **The tunnel URL is public.** Without B2's enrolment gate and rate limiting, anyone can create
  accounts and burn GPU time. Not optional.
- **Prompt injection is a live surface with 300 CS students.** The identity scrub at `rag_api.py:104-124`
  is a backstop on a small local model, not a guarantee. Expect it to be probed; log attempts.
- **`research_events.db` is one SQLite file holding the entire study.** Without D5 it is one bad
  shutdown from losing the paper.
- **The 3090's throughput is unknown.** Every capacity claim above is arithmetic on an unmeasured
  variable until Stage 3 runs. If the real number is much worse, the honest levers are a stricter
  per-student cap or a smaller model — and `CLAUDE.md` documents e4b as a hard quality floor for the
  Socratic prompt, so downgrading is a pedagogical regression, not a free win.
- **Server-side accounts contradict a documented project rule.** You overrode it deliberately;
  `CLAUDE.md` must be updated in the same change or the next session will read the old rule and revert this.
- **Migration is destructive-adjacent.** The localStorage → server migration must be idempotent and must
  not clear local data before the server confirms.
- **The deadlines in `CLAUDE.md` (June 24 EDC, June 30 paper) have passed.** Confirm what this 300-student
  rollout is actually for and what its real date is, because Stage 2's scope depends on it.
