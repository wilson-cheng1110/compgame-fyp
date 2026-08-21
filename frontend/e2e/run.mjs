// Browser test runner.  node e2e/run.mjs [happy|unhappy]
//
// Prints in the same shape as backend/tests/run_all.py so one CI line reads both.
// Exit 1 on any failure; exit 2 on a SETUP problem, which is a different thing and
// must not be mistaken for a red test.

import { chromium } from "playwright"
import { getTests, APP, API, T, Halt, sidBlockStart } from "./lib.mjs"

const only = process.argv[2]
const SUITES = [
  ["happy-path", "./happy-path.mjs"],
  ["unhappy-path", "./unhappy-path.mjs"],
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
  }

  // Is this SID block already spent? A second run against the same databases hands
  // out students who have already consented and already submitted, and the resulting
  // failures read as app bugs. That is worse than a clean stop: a suite that goes red
  // for setup reasons teaches people to ignore red. Probe the first SID of the block
  // and refuse to run if it has been used.
  if (!problems.length) {
    const sid = `24E${String(sidBlockStart()).padStart(5, "0")}A`
    try {
      const r = await fetch(API + "/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      })
      const body = await r.json()
      if (r.ok && body.needsConsent === false) {
        problems.push(
          `SID block starting ${sid} has already been used (that student has consented). ` +
            `Bump E2E_SID_OFFSET, or point AUTH_DB_PATH/RESEARCH_DB_PATH at fresh files.`,
        )
      } else if (r.status === 403) {
        problems.push(`${sid} is not on the enrolment list — check ENROLMENT_PATH`)
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
