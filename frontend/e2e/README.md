# Browser tests

`node e2e/run.mjs` — 104 assertions across 14 tests, in a real Chromium.

## Why these exist when 250 backend assertions already pass

On 2026-08-21 a brand-new student could not sign in. At all.

```
login writes {sid, username: null, avatarId: null} and NOT needsOnboarding
  → /onboarding/avatar reads !parsedUserData.needsOnboarding → !undefined → true
    → bounces to /dashboard
  → /dashboard sees no username → DELETES the cookie → bounces to /login
```

An unbreakable loop. Every backend test passed throughout, because the bug lived in
cookies and redirects — a layer Python tests cannot reach. On day one all 300 accounts
would have been in exactly that state.

This suite has since found two more of the same species:

- **`output: 'standalone'`** in `v0-user-next.config.mjs` meant `next start` — the
  command `docs/runbook.md` §2 tells you to deploy with — served HTML 200 while every
  `/_next/static/*` asset returned **400**. No CSS, no JS, no hydration: an unstyled
  page whose login form silently fell back to a native GET. A smoke test that checks
  for HTTP 200 would have passed it straight into launch day.
- **The dashboard trusted the cookie, never the server.** A student whose session was
  gone — expired, or **withdrawn**, which is supposed to end every session at once —
  still saw a full dashboard whose every data call quietly 401'd.

## Run it

Three things must be true: the app is built and served, the API is up, and **at least
one topic is open** (with real term dates, everything is `locked` and the happy path
has nowhere to go).

```bash
# 1. a schedule with today-relative dates: session 5 open, session 3 late, rest locked
python backend/make_e2e_schedule.py /tmp/sched.json

# 2. the API, pointed at throwaway state so the tests cannot touch real data
TOPIC_SCHEDULE_PATH=/tmp/sched.json \
ENROLMENT_PATH=/tmp/roster.txt \
RESEARCH_DB_PATH=/tmp/e2e_research.db \
AUTH_DB_PATH=/tmp/e2e_auth.db \
COOKIE_SECURE=0 \
python -m uvicorn rag_api:app --port 8080

# 3. the app — BUILD FIRST, THEN START. Never rebuild under a running server:
#    the build id changes and every asset 400s until you restart it.
cd frontend && npm run build && npm run start

# 4. the tests
node e2e/run.mjs              # everything
node e2e/run.mjs happy        # just the happy path
node e2e/run.mjs unhappy      # just the unhappy paths
E2E_VERBOSE=1 node e2e/run.mjs    # show passing assertions too
```

`/tmp/roster.txt` is one `SID,section` per line; the tests claim `24E00001A` upward.

Exit codes: **0** pass, **1** a real failure, **2** setup is wrong and nothing ran —
the third is deliberately distinct so a broken environment never reads as a red test.

### Running twice

State persists. A second run against the same databases hands out SIDs that have
already consented and already submitted, and the failures look like app bugs rather
than reused fixtures. Either point the two `*_DB_PATH`s at fresh files, or bump
`E2E_SID_OFFSET=100` between runs. The runner prints which SID block it is using.

## What is actually asserted

**Happy path** — the journey `docs/revamp.md` Part 2 describes, driven through a browser:
landing → sign in → consent → onboarding → dashboard → topic unit → brief → pre-check →
probe → game → post-check → probe → tutor → complete. It reads the **arm** the server
assigned and walks the unit in that order, then confirms the pre-check, the post-check
and completion all landed in the sink.

**Unhappy paths** — these matter more. The happy path proves the product works; these
prove the *measurement* is sound.

| Test | Protects |
|---|---|
| unenrolled SID | the allowlist is the only gate, and it holds |
| signed-out redirects | no gated page renders for a stranger |
| locked topic | release order **is** the independent variable — early entry breaks the design, not just the UX |
| **answer key never reaches the client** | the single rule `checks.py` exists to enforce, re-checked in the payload *and* the markup |
| pre reveals nothing / post reveals everything | the feedback asymmetry of Part 8.5 — a leaky pre-check contaminates the measurement |
| one submission | "MC limit 1", enforced against a second POST, not just a disabled button |
| nothing before consent | ethics: submitting via `fetch()` with consent unrecorded is refused |
| offline endpoints fail closed | `/api/grade` and the research export 503 without a token |
| sign-out ends the session | withdrawal has to actually eject you |

Every one has a server-side counterpart in `backend/tests`. They are re-asserted through
the browser because the client is where they would actually be bypassed, and because a
UI change can quietly stop honouring a rule the server still enforces.

## Audited 2026-08-21 - does it fail when it should?

A suite that has only ever been green is not known to work. Seven deliberate bugs were
introduced into a running system and the suite re-run against each.

| Mutation | Suite verdict |
|---|---|
| `items_for_student` ships `correct` | **caught** - 4 assertions red |
| PRE branch returns the full graded payload | **caught** - 3 red |
| one-submission guard removed | **caught** - 2 red |
| consent gate removed from `submit_check` | **caught** - 2 red |
| locked-topic gate removed from `topic_detail` | **caught** - 1 red |
| `GRADE_TOKEN` defaulted non-empty | **caught** - 2 red |
| FLIP/CONTROL step order inverted | **caught** (the unit stopped rendering, so it went red before the arm assertion could) |

One mutation was **void**: flipping `reveal=(form == POST)` to `reveal=True` changes
nothing observable, because the PRE branch discards `graded` and hand-builds its own
`{ok, recorded, total}`. Two independent layers withhold the pre-check result. The
mutation that actually leaks - returning `{**graded}` - was caught.

Three real defects in the suite itself came out of the audit, all fixed:

1. **A vacuous assertion.** "an explanation is shown" tested `/not|isn't|cannot|class
   list/`, which matches the *clean* login page - it always says your SID needs to be
   on the class list. It passed whether or not an error appeared. Now matches the
   backend refusal string.
2. **A comment promising an invariant the code never checked.** The header claimed the
   test "checks the rendered steps match the arm it was given"; the only mention of
   `arm` was a `t.note()` - a log line. The arm order is now genuinely asserted, proven
   live on a FLIP student and against an inverted sequence.
3. **A check `docs/revamp.md` Part 17 asks for and the suite never did** - grep the
   built bundle for a known answer string. Added, with a positive control proving
   `grepBuild` can find a string that *is* in the bundle.

Also hardened: a spent SID block reports **SETUP** rather than a confusing red, and
`process.exitCode` replaced `process.exit()`, which aborted libuv on Windows with a
bogus "Assertion failed" banner and masked the exit code.

Flakiness: two consecutive full runs produced byte-identical results.

## The "Loading…" hang — CORRECTION, and still open

**An earlier version of this file, and commit c0d1043, said the cause was a corrupt
`.next` build. That conclusion does not survive the evidence and is withdrawn.**

The build WAS corrupt — `next start` logged `Cannot find module
'./vendor-chunks/lucide-react.js'` and served 500s, which is real and is worth the
tooling below. But after a clean rebuild that `verify-build.mjs` passes, the topic page
still reproduces:

```
url: http://localhost:3000/topics/webers-law
/api/topics requests: 0    hydrated: false
body: Loading…
```

A clean build, a fully signed-in student (login -> consent -> onboarding -> dashboard),
and the page renders its `Loading…` branch and **never hydrates**. No JS errors, no
failed assets, no chunk-load exception.

**What is established**

- It is *not* a missing chunk. `verify-build.mjs` passes on this build, and deliberately
  deleting a chunk produces a *different* symptom (a visible "Application error" plus a
  chunk-load exception).
- It is not the API: health ok, ~19 ms warm.
- `hydrated: false` is the key fact. Everything downstream — the effect, the fetch, and
  any client-side timeout — depends on hydration that never happens.

**What is NOT established**

Why. And why the same route on the same build passes 107/107 inside the suite while
failing in a standalone script that performs the same steps. That difference is the
thread to pull: it is either a genuine hydration fragility or an artifact of how the
standalone script drives the browser, and I could not separate the two.

**A client-side timeout cannot fix this, and it was a mistake to reach for one first.**
`useSlowLoad` (lib/use-slow-load.ts) is still worth having — it covers the case where
hydration succeeds and the *fetch* stalls, which a dropped tunnel will cause often
across 300 students — but it is powerless here, because a timer needs hydration too.
**The guard for a page that never hydrates has to live somewhere that does not depend on
hydration**: render something meaningful server-side, or put the fallback in the shell.
That is the architectural fix and it is not done.

**Reproducing it:** sign a student fully in, then hard-navigate to `/topics/<open-topic>`
in a standalone Playwright script and assert on `[data-testid="step-counter"]`. The
`journeyRequests` / `diag` capture in the happy path prints the two numbers that matter
— zero requests with `hydrated: false` means the client bundle, not the API.

## Conventions

**No test framework.** Same call as `backend/tests`: stdlib only, no pytest, no
`@playwright/test`. `playwright` is already a dependency; a runner would be a second
one and a second way to run tests on a box whose only job is serving 300 students. The
whole harness is `lib.mjs`, and it prints in the same `N passed, M failed` shape as the
Python suites so one CI line reads both.

**Selectors are `data-testid`, never styling classes.** This app had three visual passes
in a single day. A suite that selects on `.u-card` breaks on the fourth.

**One browser context per test.** Cookies and `localStorage` must not leak between
tests, or a test passes only because an earlier one signed in.

**Fixed sleeps are a bug.** Wait for a real signal — `waitFor` on a testid, or network
idle before touching a form. Next server-renders a real `<form>`, and until hydration
attaches the handler a click performs a native GET; two early versions of this suite
"failed to log in" for exactly that reason.
