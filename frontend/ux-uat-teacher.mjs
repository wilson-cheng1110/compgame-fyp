// UAT PERSONA 2: "a non-technical lecturer, 30 min before a tutorial, wants to know
// what to teach." Signs in as admin/admin-Passw0rd, tries to reach the tutorial brief
// and act on it. Records evidence only — no judgement here.
//
//   node ux-uat-teacher.mjs
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "fs"
import { APP, go, ready } from "./e2e/lib.mjs"

const OUT = ".shots-uat"
mkdirSync(OUT, { recursive: true })

let step = 0
const log = []

const shot = async (page, name) => {
  step += 1
  const n = `t${String(step).padStart(2, "0")}-${name}`
  await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }).catch(() => {})
  console.log(`  [${n}]  ${page.url()}`)
  return n
}

async function evidence(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const text = (el) => (el.innerText || "").replace(/\s+/g, " ").trim()
    const headings = Array.from(document.querySelectorAll("h1,h2,h3")).filter(vis).map((h) => text(h))
    const nav = Array.from(document.querySelectorAll("a,button")).filter(vis).map((el) => text(el)).filter(Boolean)
    return { title: document.title, headings, nav: nav.slice(0, 40), bodyText: document.body.innerText.slice(0, 3000) }
  })
}

async function record(page, name, note) {
  const n = await shot(page, name)
  const ev = await evidence(page)
  log.push({ step: n, url: page.url(), note: note || "", ...ev })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

console.log("=== Persona 2 walkthrough: non-technical lecturer, admin/admin-Passw0rd ===")

// 1. Landing -> sign in
await go(page, "/")
await ready(page)
await record(page, "landing")

await go(page, "/login")
await ready(page)
await page.locator('input[type="text"]').first().fill("admin")
await page.locator('[data-testid="login-password"]').fill("admin-Passw0rd")
await record(page, "login-filled")
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(3000)
await ready(page)
await record(page, "post-login", `landed on ${page.url()} -- is this consent/onboarding (participant flow) or straight to dashboard?`)

// If somehow routed through consent/onboarding despite being admin, note it and push
// through so we can still reach admin (evidence, not a fix).
for (let i = 0; i < 5 && (page.url().includes("/consent") || page.url().includes("/onboarding")); i++) {
  log.push({ note: "UNEXPECTED: admin routed through participant gate", url: page.url() })
  await record(page, `unexpected-gate-${i}`)
  if (page.url().includes("/consent")) {
    const cb = page.locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check()
    await page.getByRole("button", { name: /agree/i }).first().click().catch(() => {})
  } else {
    const field = page.locator('input[type="text"]').first()
    if (await field.count()) await field.fill("Course Team")
    const next = page.getByRole("button", { name: "Continue", exact: true }).first()
    if (await next.count()) await next.click().catch(() => {})
  }
  await page.waitForTimeout(2000)
}

await ready(page)
await record(page, "dashboard-as-admin", "does the dashboard show a way to the admin panel?")

// Look specifically for an admin link/button on the dashboard, the way a lecturer
// scanning the page would.
const adminLinkVisible = await page.locator('a[href="/admin"]').first().isVisible().catch(() => false)
log.push({ note: "admin link visible on dashboard", visible: adminLinkVisible })
console.log(`     Admin link visible on dashboard: ${adminLinkVisible}`)

if (adminLinkVisible) {
  await page.locator('a[href="/admin"]').first().click()
} else {
  await go(page, "/admin")
}
await ready(page)
await record(page, "admin-panel", "the panel itself")

// Sections present
const sectionsPresent = await page.evaluate(() => {
  const testids = ["admin-counts", "admin-list", "admin-reports", "admin-schedule", "admin-audit"]
  return Object.fromEntries(testids.map((t) => [t, !!document.querySelector(`[data-testid="${t}"]`)]))
})
log.push({ note: "admin sections present", sectionsPresent })
console.log("     sections present:", JSON.stringify(sectionsPresent))

// Scroll to Reports section specifically -- the persona's actual goal
const reportsHeading = page.locator('[data-testid="admin-reports"]').first()
if (await reportsHeading.count()) {
  await reportsHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await record(page, "admin-reports-section", "the lecturer's actual goal: what to teach today")

  const empty = await page.locator('[data-testid="reports-empty"]').count()
  const list = await page.locator('[data-testid="reports-list"] li').count()
  log.push({ note: "reports state", emptyStatePresent: !!empty, reportRows: list })
  console.log(`     reports-empty present: ${!!empty}, report rows: ${list}`)

  if (empty) {
    const emptyText = await page.locator('[data-testid="reports-empty"]').innerText()
    console.log(`     Empty-state text shown to the lecturer:\n${emptyText}`)
    log.push({ note: "empty state text (verbatim)", text: emptyText })
  }

  if (list > 0) {
    await page.locator('[data-testid="report-open"]').first().click()
    await page.waitForTimeout(1500)
    await record(page, "admin-report-opened", "did clicking Read actually show the brief?")
  }
}

// Schedule / lecture-dates section
const scheduleHeading = page.locator('[data-testid="admin-schedule"]').first()
if (await scheduleHeading.count()) {
  await scheduleHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await record(page, "admin-schedule-section")
}

// Accounts section: try Section-correction and Password reset controls, evidence only
const manageBtn = page.locator('[data-testid="admin-manage"]').first()
if (await manageBtn.count()) {
  await manageBtn.scrollIntoViewIfNeeded()
  await manageBtn.click().catch(() => {})
  await page.waitForTimeout(500)
  await record(page, "admin-manage-expanded", "section/password controls for one student")
}

// Audit trail readability
const auditHeading = page.locator('[data-testid="admin-audit"]').first()
if (await auditHeading.count()) {
  await auditHeading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await record(page, "admin-audit-section")
  const auditText = await page.locator('[data-testid="admin-audit"]').innerText().catch(() => "")
  log.push({ note: "audit trail sample text", text: auditText.slice(0, 800) })
}

writeFileSync(`${OUT}/log-teacher.json`, JSON.stringify({ log }, null, 2))
console.log(`\nDone. ${step} screenshots in ${OUT}/, evidence in ${OUT}/log-teacher.json`)
await browser.close()
