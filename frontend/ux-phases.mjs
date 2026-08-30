// Walk every game as deep as clicking can take it, and fingerprint EVERY screen.
//
//   node ux-phases.mjs > ../docs/ux-phase-findings.md
//
// ux-audit.mjs measures 34 surfaces -- one screen per route. But the games declare 85
// phases between them, so the audit sees the landing screen of each game and nothing
// behind it. Roughly 18% of what exists. This walks in.
//
// GENERIC, NOT 26 BESPOKE DRIVERS. Most games advance by clicking something: a Start,
// a Continue, an answer, a Next. So the driver is a loop -- fingerprint, find the most
// plausible advance control, click, repeat -- and it stops when the screen stops
// changing. That will NOT finish the reaction-time or pointing games, which need real
// timing and real coordinates, and that is fine: the games it cannot advance are
// themselves the finding, because they are exactly the ones needing a bespoke driver
// for P5. The report names them.
//
// A screen counts as new when its text+controls signature has not been seen in THIS
// game. That is the honest denominator: distinct screens actually reached, not clicks.

import { chromium } from "playwright"

const APP = process.env.E2E_APP ?? "http://localhost:3000"
const SID = process.env.AUDIT_SID ?? "24E00399A"
const PW = process.env.AUDIT_PW ?? "prof-passw0rd"
const MAX_STEPS = Number(process.env.MAX_STEPS ?? 14)

const GAMES = [
  "fitts-law-understanding", "fitts-law-assessment", "gestalt-understanding",
  "gestalt-assessment", "hicks-law-understanding", "hicks-law-assessment",
  "memory-understanding", "memory-assessment", "stroop-understanding", "stroop-assessment",
  "webers-law-understanding", "webers-law-assessment", "norman-understanding",
  "norman-assessment", "mental-model-understanding", "mental-model-assessment",
  "problem-solving-understanding", "problem-solving-assessment",
  "visual-perception-understanding", "visual-perception-assessment",
  "language-understanding", "language-assessment", "ergonomics-understanding",
  "ergonomics-assessment", "experiment-design-understanding", "experiment-design-assessment",
]

async function look(page) {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const named = (el) =>
      (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "").trim() ||
      el.closest("label")?.innerText || el.getAttribute("placeholder") || ""
    const btns = Array.from(document.querySelectorAll("button, a[role=button], input[type=submit]")).filter(vis)
    const styleOf = (el) => {
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.color, s.borderRadius,
              s.fontFamily.split(",")[0].replace(/["']/g, ""), s.fontSize,
              s.boxShadow === "none" ? "flat" : "shadow"].join(" | ")
    }
    const biggest = btns.slice().sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      return rb.width * rb.height - ra.width * ra.height
    })[0]
    let ground = null
    let el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2))
    while (el && !ground) {
      const c = getComputedStyle(el).backgroundColor
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") ground = c
      el = el.parentElement
    }
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim()
    return {
      sig: text.slice(0, 120) + "::" + btns.map((b) => (b.innerText || "").trim().slice(0, 12)).join("|"),
      head: text.slice(0, 70),
      primary: biggest ? styleOf(biggest) : null,
      ground,
      buttonStyles: [...new Set(btns.map(styleOf))].length,
      headings: document.querySelectorAll("h1,h2,h3").length,
      // Nielsen 1 inside a game: does this screen say where you are in the game?
      progress: /\b\d+\s*(\/|of)\s*\d+\b/i.test(text),
      noName: btns.filter((b) => !named(b).trim()).length,
      chars: text.length,
    }
  })
}

// Everything except the ways OUT. Clicking Exit ends the walk; clicking the tutor
// opens a widget that is not part of the game's own sequence.
const ADVANCE = /^(start|begin|play|next|continue|go|submit|answer|got it|ready|try|finish|see|show|apply|explore|check|reveal|→|↻)/i

async function advance(page) {
  const btns = page.locator("button:visible, a[role=button]:visible")
  const n = Math.min(await btns.count(), 40)
  const cands = []
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i)
    const [label, aria, tid] = await Promise.all([
      b.innerText().catch(() => ""), b.getAttribute("aria-label").catch(() => null),
      b.getAttribute("data-testid").catch(() => null),
    ])
    const t = (label || aria || "").replace(/\s+/g, " ").trim()
    if (tid === "game-exit" || /tutor/i.test(aria || "") || /^(←|back|exit)/i.test(t)) continue
    if (!(await b.isEnabled().catch(() => false))) continue
    cands.push({ b, t, rank: ADVANCE.test(t) ? 0 : 1 })
  }
  if (!cands.length) return false
  cands.sort((a, b) => a.rank - b.rank)
  await cands[0].b.click({ timeout: 4000 }).catch(() => {})
  return true
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(APP + "/login", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(1200)
await page.locator('input[type="text"]').first().fill(SID)
await page.locator('[data-testid="login-password"]').fill(PW)
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(3500)

const per = []
const all = []
for (const g of GAMES) {
  const seen = new Set()
  const screens = []
  await page.goto(`${APP}/games/${g}`, { waitUntil: "domcontentloaded" }).catch(() => {})
  await page.waitForTimeout(1500)
  for (let i = 0; i < MAX_STEPS; i++) {
    let v
    try { v = await look(page) } catch { break }
    if (!seen.has(v.sig)) { seen.add(v.sig); screens.push(v); all.push({ game: g, ...v }) }
    if (!(await advance(page))) break
    await page.waitForTimeout(1100)
    if (!page.url().includes("/games/")) break   // walked out of the game
  }
  per.push({ game: g, reached: screens.length, withProgress: screens.filter((s) => s.progress).length })
  console.error(`  ${g.padEnd(34)} ${screens.length} screen(s)`)
}
await browser.close()

const uniq = (f) => [...new Set(all.map(f).filter(Boolean))]
console.log(`# Phase sweep -- every game, walked as deep as clicking goes\n`)
console.log(`\`node frontend/ux-phases.mjs\`. ux-audit.mjs measures one screen per route;`)
console.log(`this walks in and fingerprints each one it reaches.\n`)
console.log(`**${all.length} screens measured** across ${GAMES.length} games`)
console.log(`(the audit's whole-product number was 34, of which 26 were games).\n`)

console.log(`## Consistency, now measured across screens rather than landing pages\n`)
console.log(`| measure | distinct |`)
console.log(`|---|---|`)
console.log(`| primary-action styling | **${uniq((r) => r.primary).length}** |`)
console.log(`| ground | **${uniq((r) => r.ground).length}** |\n`)

const noProg = per.filter((p) => p.reached > 1 && p.withProgress === 0)
console.log(`## H1 Visibility of status, inside the games\n`)
console.log(`Screens showing any "N of M": **${all.filter((s) => s.progress).length} of ${all.length}**.\n`)
console.log(`Games with more than one screen and NO progress indicator on any of them:`)
console.log(`**${noProg.length}** -- ${noProg.map((p) => p.game).join(", ") || "none"}\n`)

const stuck = per.filter((p) => p.reached <= 1)
console.log(`## Games a generic driver cannot advance\n`)
console.log(`**${stuck.length}** -- these need a bespoke driver for P5, and that list is the finding:`)
console.log(`${stuck.map((p) => p.game).join(", ") || "none"}\n`)

console.log(`## Per game\n`)
console.log(`| game | screens reached | with progress |`)
console.log(`|---|---|---|`)
for (const p of per) console.log(`| \`${p.game}\` | ${p.reached} | ${p.withProgress} |`)

const bad = all.filter((s) => s.noName > 0)
console.log(`\n## Controls with no accessible name\n`)
console.log(`**${bad.length}** screen(s): ${[...new Set(bad.map((s) => s.game))].join(", ") || "none"}`)
