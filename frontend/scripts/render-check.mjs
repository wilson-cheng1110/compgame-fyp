// Headless render verification for every game route.
//
// "build passes" only proves the code COMPILES. This actually RENDERS each route
// in a real browser, captures runtime console/page errors, screenshots it, and
// (for the gestalt iframe assessment) drives the recording path to prove the
// badge cookie is actually written at runtime — the thing static analysis can't
// confirm. Screenshots are later scanned by a local VLM (llava) for blank/broken
// renders. See vlm-scan.mjs.
//
// Run: node scripts/render-check.mjs   (dev server must be on :3000)

import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.BASE_URL || "http://localhost:3001"
const SHOTS = path.join(process.cwd(), "scripts", "shots")
fs.mkdirSync(SHOTS, { recursive: true })

// Test participant — written the same way js-cookie reads it (encodeURIComponent).
const SID = "TEST0001"
const userObj = { sid: SID, username: "Tester", avatarId: "knight" }
const usersObj = {
  [SID]: { password: "x", username: "Tester", avatarId: "knight", badges: [], topicProgress: {} },
}

const TOPICS = [
  "fitts-law", "gestalt", "hicks-law", "memory", "stroop", "webers-law",
  "norman", "mental-model", "problem-solving", "visual-perception",
  "language", "ergonomics", "experiment-design",
]

// Every game route + the gestalt iframe sub-routes (the special cases).
const ROUTES = []
for (const t of TOPICS) {
  ROUTES.push({ id: `${t}-understanding`, url: `/games/${t}-understanding` })
  ROUTES.push({ id: `${t}-assessment`, url: `/games/${t}-assessment` })
}
ROUTES.push({ id: "dashboard", url: "/dashboard" })
ROUTES.push({ id: "gestalt-iframe-app", url: "/games/gestalt-assessment/app" })
ROUTES.push({ id: "gestalt-iframe-quiz", url: "/games/gestalt-assessment/app/quiz" })
ROUTES.push({ id: "gestalt-iframe-results", url: "/games/gestalt-assessment/app/results?score=8" })

async function setAuth(context) {
  // Set cookies via the page so js-cookie's decode matches our encode.
  await context.addInitScript(
    ([u, us]) => {
      document.cookie = `user=${u}; path=/`
      document.cookie = `users=${us}; path=/`
    },
    [encodeURIComponent(JSON.stringify(userObj)), encodeURIComponent(JSON.stringify(usersObj))],
  )
}

const report = []

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
await setAuth(context)

for (const route of ROUTES) {
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message))
  let finalUrl = ""
  try {
    await page.goto(BASE + route.url, { waitUntil: "networkidle", timeout: 30000 })
    await page.waitForTimeout(1200) // let client effects/canvas paint
    finalUrl = page.url()
    await page.screenshot({ path: path.join(SHOTS, route.id + ".png") })
  } catch (e) {
    errors.push("NAV: " + e.message)
  }
  const redirectedToLogin = finalUrl.includes("/login")
  // crude blank check: tiny DOM text usually = broken render
  let textLen = 0
  try { textLen = (await page.locator("body").innerText()).trim().length } catch {}
  report.push({
    id: route.id,
    url: route.url,
    finalUrl,
    redirectedToLogin,
    textLen,
    errorCount: errors.length,
    errors: errors.slice(0, 6),
  })
  console.log(`${route.id.padEnd(34)} err=${errors.length} textLen=${textLen}${redirectedToLogin ? " LOGIN-REDIRECT" : ""}`)
  await page.close()
}

// ── Dynamic test: does the gestalt iframe results screen actually WRITE the
// badge cookie at runtime? (static analysis disputed this) ────────────────────
{
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(BASE + "/games/gestalt-assessment/app/results?score=10", { waitUntil: "networkidle", timeout: 30000 })
  await page.waitForTimeout(1500) // recording useEffect + setTimeout(refreshBadges,300)
  const usersCookie = await page.evaluate(() => {
    const m = document.cookie.split("; ").find((c) => c.startsWith("users="))
    return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : null
  })
  let badgeWritten = false
  let progressWritten = false
  try {
    const parsed = JSON.parse(usersCookie)
    const u = parsed[SID]
    badgeWritten = Array.isArray(u?.badges) && u.badges.some((b) => b.gameId === "gestalt-assessment")
    progressWritten = !!u?.topicProgress?.gestalt?.assessmentCompleted
  } catch {}
  report.push({
    id: "DYNAMIC:gestalt-results-recording",
    badgeWritten,
    progressWritten,
    assessmentScore: (() => { try { return JSON.parse(usersCookie)[SID].topicProgress.gestalt.assessmentScore } catch { return null } })(),
    errors,
  })
  console.log(`DYNAMIC gestalt recording: badge=${badgeWritten} progress=${progressWritten}`)
  await page.close()
}

await browser.close()
fs.writeFileSync(path.join(process.cwd(), "scripts", "render-report.json"), JSON.stringify(report, null, 2))

const broken = report.filter((r) => r.errorCount > 0 || r.redirectedToLogin || (r.textLen !== undefined && r.textLen < 30))
console.log("\n=== SUMMARY ===")
console.log(`routes checked: ${ROUTES.length}`)
console.log(`flagged (errors / login-redirect / near-blank): ${broken.length}`)
for (const b of broken) console.log("  FLAG", b.id, "err=" + b.errorCount, b.redirectedToLogin ? "LOGIN" : "", "textLen=" + b.textLen)
