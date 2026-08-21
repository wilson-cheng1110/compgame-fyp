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
  process.exit(2)
}

console.log(`
  app=${APP}  api=${API}  SID block starts at 24E${String(sidBlockStart()).padStart(5, "0")}A
`)

const browser = await chromium.launch()
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
process.exit(failures ? 1 : 0)
