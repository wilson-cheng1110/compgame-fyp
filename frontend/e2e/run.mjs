// Browser test runner.  node e2e/run.mjs [happy|unhappy]
//
// Prints in the same shape as backend/tests/run_all.py so one CI line reads both.
// Exit 1 on any failure; exit 2 on a SETUP problem, which is a different thing and
// must not be mistaken for a red test.

import { chromium } from "playwright"
import { getTests, APP, API, T, Halt, sidBlockStart, E2E_PASSWORD } from "./lib.mjs"

// Roughly how many SIDs one full run draws. Used only to check the block fits
// inside the roster before anything runs; generous on purpose.
const DRAWS_PER_RUN = 60

const only = process.argv[2]
const SUITES = [
  ["happy-path", "./happy-path.mjs"],
  ["unhappy-path", "./unhappy-path.mjs"],
  ["resilience", "./resilience.mjs"],
  ["teacher-path", "./teacher-path.mjs"],
  ["researcher-path", "./researcher-path.mjs"],
].filter(([n]) => !only || n === only || n === only + "-path")   // "happy" must not match "unhappy-path"

// ── preflight ─────────────────────────────────────────────────────────────────
// A test that fails because nothing is running teaches people to ignore red.

async function preflight() {
  const problems = []

  try {
    const r = await fetch(APP + "/login")
    if (!r.ok) problems.push(`frontend at ${APP} returned ${r.status}`)
  } catch {
    problems.push(`frontend is not running at ${APP}  →  npm run build && npm run start`)
  }

  let health
  try {
    const r = await fetch(API + "/api/health")
    health = await r.json()
  } catch {
    problems.push(`API is not running at ${API}  →  python -m uvicorn rag_api:app --port 8080`)
  }

  if (health) {
    if (!health.components?.enrolment?.enrolled) {
      problems.push("no SIDs are enrolled  →  set ENROLMENT_PATH to a roster file")
    }
    if (!health.components?.accounts?.ok || !health.components?.research_sink?.ok) {
      problems.push(`API health is "${health.status}" — accounts or the sink are down`)
    }

    // THIS SUITE IS A PARTICIPANT. It signs up students, sits checks, answers
    // probes and completes topics, and every one of those is a research event. Run
    // against a backend on the default paths it writes all of that into the sink
    // the PAPER is written from, and nothing anywhere says so -- the effort screen
    // on the dev box reads a median of 0.4 s per item and 75 straight-lined
    // submissions, which is this suite, not a cohort.
    //
    // Refusing is the only version that works. A warning in a log nobody reads is
    // how the data got mixed in the first place.
    if (health.components?.research_sink?.is_default_path
        && process.env.E2E_ALLOW_SHARED_SINK !== "1") {
      problems.push(
        "the API is writing to the DEFAULT research sink, and this suite would " +
        "pollute it with synthetic participants.\n" +
        "    Start the backend with its own files:\n" +
        "      RESEARCH_DB_PATH=/tmp/e2e-research.db AUTH_DB_PATH=/tmp/e2e-auth.db\n" +
        "      python -m uvicorn rag_api:app --port 8080\n" +
        "    Or set E2E_ALLOW_SHARED_SINK=1 if you genuinely mean to write there.")
    }
  }

  // Is this SID block already spent? A second run against the same databases hands
  // out students who have already consented and already submitted, and the resulting
  // failures read as app bugs. That is worse than a clean stop: a suite that goes red
  // for setup reasons teaches people to ignore red. Probe the first SID of the block
  // and refuse to run if it has been used.
  if (!problems.length) {
    // THIS PROBE USED TO ASK /api/auth/session FOR A BARE SID, AND THAT IS WHY IT
    // NOW ASKS TWO DIFFERENT QUESTIONS. Since accounts got passwords, /session
    // returns ONE identical 401 for unknown SID, wrong password, unclaimed account
    // and withdrawn alike -- deliberately, so it cannot be walked to discover who is
    // enrolled. That also silently killed this guard: it stopped telling "block
    // already spent" from "not on the roster" from "fine", and a run with an
    // out-of-range offset sailed straight past it into 28 tests all throwing
    // "roster exhausted", which reads as 28 app bugs.
    //
    // /signup cannot stand in for it either: weak_password is checked BEFORE the
    // roster and the existence check, so a deliberately-short password returns 400
    // for an unenrolled SID and a claimed one alike.
    const first = sidBlockStart()
    const sid = `24E${String(first).padStart(5, "0")}A`

    // 1. Does the roster reach far enough for the block this run will draw?
    const enrolled = health?.components?.enrolment?.enrolled ?? 0
    if (first + DRAWS_PER_RUN > enrolled) {
      problems.push(
        `E2E_SID_OFFSET=${first - 1} needs SIDs up to ~${first + DRAWS_PER_RUN}, but the ` +
          `roster has ${enrolled}. Extend ENROLMENT_PATH, or lower the offset.`,
      )
    }

    // 2. Is the first SID of the block already one of ours? Every account this suite
    //    creates uses E2E_PASSWORD, so a 200 here means the block is spent. (On a
    //    fixture DB a 401 means free; against a real DB it would only mean "not one
    //    of ours", which is the same answer for this purpose.)
    try {
      const r = await fetch(API + "/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, password: E2E_PASSWORD }),
      })
      if (r.ok) {
        problems.push(
          `SID block starting ${sid} has already been used (that account signs in ` +
            `with the e2e password). Bump E2E_SID_OFFSET, or point AUTH_DB_PATH/` +
            `RESEARCH_DB_PATH at fresh files.`,
        )
      }
    } catch {
      problems.push("could not probe the API for a fresh SID block")
    }
  }

  return problems
}

// ── run ───────────────────────────────────────────────────────────────────────

const problems = await preflight()
if (problems.length) {
  console.log("\n  SETUP — the tests did not run:\n")
  for (const p of problems) console.log(`    · ${p}`)
  console.log(
    "\n  For an open topic (the happy path needs one):\n" +
      "    python backend/make_e2e_schedule.py /tmp/sched.json\n" +
      "    TOPIC_SCHEDULE_PATH=/tmp/sched.json python -m uvicorn rag_api:app --port 8080\n",
  )
  process.exitCode = 2
  // exitCode, not exit(): process.exit() with an in-flight fetch handle aborts libuv
  // on Windows with a bogus "Assertion failed" banner that looks like a crash.
}

if (process.exitCode === 2) {
  // nothing further to do — the environment is not ready
} else {

console.log(`
  app=${APP}  api=${API}  SID block starts at 24E${String(sidBlockStart()).padStart(5, "0")}A
`)

const browser = await chromium.launch()
let envBroken = false
let total = 0
let failures = 0

for (const [suiteName, mod] of SUITES) {
  await import(mod)
}

for (const { name, fn } of getTests()) {
  // A fresh context per test: cookies and localStorage must not leak between them,
  // or a test passes only because an earlier one signed in.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(e.message))

  const t = new T(name)
  const started = Date.now()
  try {
    await fn(page, t)
  } catch (e) {
    if (e instanceof Halt) {
      t.note(`stopped: ${e.message}`)
    } else {
      t.check(`threw: ${e.message?.slice(0, 140)}`, false)
    }
  }
  t.check("no uncaught JS errors on the page", pageErrors.length === 0, pageErrors.slice(0, 3))

  // PREFLIGHT RUNS ONCE, AT THE START. If the API dies or stalls part-way through, every
  // test after it fails for a reason that has nothing to do with the code — and reads as
  // a red suite. Re-check health on any failure so a broken environment is named as one.
  // (A dead API was mistaken for an app bug during this suite's own development, twice.)
  if (t.failed) {
    const alive = await fetch(API + "/api/health").then((r) => r.json()).catch(() => null)
    if (!alive || alive.status === "down") {
      t.note("!! THE API IS NOT HEALTHY — treat this failure as SETUP, not as a defect")
      envBroken = true
    }
    // The FRONTEND too. The first version of this check only watched the API, and a
    // frontend that died mid-run duly reported eight red tests instead of one broken
    // environment — the exact mistake this check exists to prevent, made one layer up.
    const web = await fetch(APP + "/login").then((r) => r.ok).catch(() => false)
    if (!web) {
      t.note("!! THE FRONTEND IS NOT SERVING — treat this failure as SETUP, not a defect")
      envBroken = true
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const status = (t.failed ? "FAIL" : "ok").padStart(4)
  console.log(`  ${status}  ${name}  (${t.passed} passed, ${t.failed} failed, ${secs}s)`)
  for (const line of t.lines) if (t.failed || process.env.E2E_VERBOSE) console.log(line)

  total += t.passed + t.failed
  failures += t.failed
  await ctx.close()
}

await browser.close()
console.log(`\n${total} assertions, ${failures} failure(s)`)
if (envBroken) {
  console.log()
  console.log('  The API stopped being healthy DURING the run. Those failures are')
  console.log('  environment, not code - restart it and re-run before believing any.')
  process.exitCode = 2
} else {
  process.exitCode = failures ? 1 : 0
}
}
