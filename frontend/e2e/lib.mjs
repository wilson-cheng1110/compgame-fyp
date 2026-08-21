// Tiny browser-test harness. docs/revamp.md Part 17.
//
// NO TEST FRAMEWORK, ON PURPOSE — the same call as backend/tests (stdlib only, no
// pytest). `playwright` is already a dependency; `@playwright/test` is not, and
// adding a runner would mean a second dependency and a second way to run tests on a
// box whose only job is to serve 300 students. The whole harness is the forty lines
// below, and it prints in the same "N passed, M failed" shape as the Python suites
// so one CI line can read both.
//
// WHY BROWSER TESTS EXIST AT ALL, given 250 backend assertions already pass:
// on 2026-08-21 a brand-new student could not sign in. login wrote a cookie without
// `needsOnboarding`; /onboarding/avatar read `!undefined`, bounced to /dashboard;
// /dashboard saw no username, DELETED the cookie and bounced to /login. An
// unbreakable loop, and every backend test passed throughout, because the bug lived
// in cookies and redirects — a layer Python tests cannot reach. That is this file's
// reason to exist.

export const APP = process.env.E2E_APP ?? "http://localhost:3000"
// MUST match the origin the app itself calls (NEXT_PUBLIC_API_BASE, default
// http://localhost:8080). `127.0.0.1` and `localhost` are DIFFERENT SITES to a
// browser, so a fetch from the page to 127.0.0.1 does not carry the session cookie
// and every authenticated call comes back 401 — which reads exactly like a broken
// session and is really a broken test.
export const API = process.env.E2E_API ?? "http://localhost:8080"

const registry = []
export function test(name, fn) {
  registry.push({ name, fn })
}
export function getTests() {
  return registry
}

/** Per-test recorder. Collects every check so one failure does not hide the rest. */
export class T {
  constructor(name) {
    this.name = name
    this.passed = 0
    this.failed = 0
    this.lines = []
  }
  check(label, cond, extra) {
    if (cond) {
      this.passed++
      this.lines.push(`    PASS  ${label}`)
    } else {
      this.failed++
      const detail = extra === undefined ? "" : `  ${JSON.stringify(extra).slice(0, 220)}`
      this.lines.push(`    FAIL  ${label}${detail}`)
    }
    return !!cond
  }
  /** For things a later check depends on — stops the test rather than cascading. */
  require(label, cond, extra) {
    if (!this.check(label, cond, extra)) throw new Halt(label)
    return true
  }
  note(msg) {
    this.lines.push(`    ..    ${msg}`)
  }
}

export class Halt extends Error {}

// ── page helpers ──────────────────────────────────────────────────────────────

export const go = (page, path) =>
  page.goto(APP + path, { waitUntil: "domcontentloaded" })

/** Wait for React to claim the page.
 *
 *  This is not padding. Next.js server-renders a real <form>; until hydration
 *  attaches the onSubmit handler, clicking the button performs a NATIVE GET and the
 *  browser lands on `/login?` with the field discarded. Every early version of this
 *  suite "failed to log in" for exactly that reason, and so did the first hand-run
 *  screenshot pass. Waiting for network idle first, then a beat, is what makes it
 *  deterministic instead of a race against the machine's mood.
 */
export async function ready(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
}

export async function signIn(page, sid, attempt = 0) {
  await go(page, "/login")
  await ready(page)
  await page.locator('input[type="text"]').first().fill(sid)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(3000)

  // A trailing "?" is the signature of the native submit above. Retry once rather
  // than reporting a login failure that is really a timing artefact.
  if (page.url().includes("/login?") && attempt < 2) {
    return signIn(page, sid, attempt + 1)
  }
  return page.url()
}

export async function giveConsent(page) {
  if (!page.url().includes("/consent")) return false
  await page.locator('input[type="checkbox"]').first().check()
  await page.waitForTimeout(300)
  await page.getByRole("button", { name: /agree/i }).first().click()
  await page.waitForTimeout(2500)
  return true
}

export async function onboard(page, name = "E2E Student") {
  // Three steps now: avatar, username, baseline. The baseline is a different shape —
  // multiple choice rather than a Continue button — so it gets its own branch.
  for (let i = 0; i < 6 && page.url().includes("/onboarding"); i++) {
    if (page.url().includes("/baseline")) {
      await answerBaseline(page)
      continue
    }
    const field = page.locator('input[type="text"]').first()
    if (await field.count()) await field.fill(name)
    const next = page.getByRole("button", { name: "Continue", exact: true }).first()
    if (!(await next.count())) break
    await next.click()
    await page.waitForTimeout(2200)
  }
  return page.url()
}

/** Answer every baseline item (first option) and submit. */
export async function answerBaseline(page) {
  await page.locator('[data-testid="baseline-item"]').first().waitFor({ timeout: 15000 }).catch(() => {})
  const opts = page.locator('[data-testid="baseline-option"]')
  const items = await page.locator('[data-testid="baseline-item"]').count()
  for (let i = 0; i < items; i++) {
    const first = page.locator('[data-testid="baseline-item"]').nth(i).locator('[data-testid="baseline-option"]').first()
    if (await first.count()) await first.click().catch(() => {})
  }
  await page.locator('[data-testid="baseline-submit"]').first().click()
  await page.waitForTimeout(2500)
  return page.url()
}

/** Sign in + consent + onboard. Returns the URL it ends on. */
export async function fullSignIn(page, sid, name) {
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page, name)
  return page.url()
}

/** Call the API through the PAGE, so the session cookie rides along.
 *
 *  Requires the page to be ON the app origin — fetch() from about:blank has no
 *  origin and is rejected before it reaches the server, which looks exactly like a
 *  backend failure and is not one.
 */
export async function apiFromPage(page, path, init) {
  if (!page.url().startsWith(APP)) {
    await go(page, "/login")
    await page.waitForTimeout(400)
  }
  return page.evaluate(
    async ([url, opts]) => {
      const res = await fetch(url, { ...opts, credentials: "include" })
      let body = null
      try {
        body = await res.json()
      } catch {}
      return { status: res.status, body }
    },
    [API + path, init ?? {}],
  )
}

/** Search the BUILT client bundle for a string.
 *
 *  docs/revamp.md Part 17 asks for this and the suite was not doing it: the answer
 *  key could leak through the API payload, through the server-rendered markup, or
 *  through the shipped JavaScript, and only the first two were being checked.
 *  Returns the files that contain `needle`; empty means clean.
 */
export async function grepBuild(needle) {
  const { readdir, readFile } = await import("node:fs/promises")
  const { join } = await import("node:path")
  const hits = []
  async function walk(dir) {
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (/\.(js|css|json)$/.test(e.name)) {
        const text = await readFile(p, "utf8").catch(() => "")
        if (text.includes(needle)) hits.push(p)
      }
    }
  }
  await walk(".next/static")
  return hits
}

// ── SID allocation ────────────────────────────────────────────────────────────
// Every test that submits anything needs a student nobody else has touched: the
// one-submission rule is enforced per (sid, topic, form), so a shared SID would make
// tests pass or fail depending on order.

// The offset exists because state PERSISTS between runs. A second run against the
// same auth/research DB would hand out SIDs that already consented and already
// submitted, and the failures look like app bugs rather than reused fixtures — which
// is exactly what happened the first time this suite was run twice.
// Either point AUTH_DB_PATH / RESEARCH_DB_PATH at throwaway files (preferred), or
// bump E2E_SID_OFFSET between runs.
const SID_OFFSET = Number(process.env.E2E_SID_OFFSET ?? 0)
let nextSid = SID_OFFSET
export function freshSid() {
  nextSid += 1
  if (nextSid > 400) throw new Error("e2e roster exhausted — raise E2E_SID_OFFSET or reset the DBs")
  return `24E${String(nextSid).padStart(5, "0")}A`
}
export const sidBlockStart = () => SID_OFFSET + 1
export const UNENROLLED_SID = "99Z99999Z"
