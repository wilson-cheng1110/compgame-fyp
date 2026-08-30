// Systematic HCI sweep across EVERY surface, measured rather than eyeballed.
//
//   node ux-audit.mjs            > ../docs/ux-audit-findings.md
//
// Why a script and not a walkthrough: a person clicking for five minutes finds the
// loudest six problems and stops. Consistency in particular is invisible to a human
// reviewer, because you cannot hold thirty pages' worth of button styling in your head
// -- you can only notice it when two of them are side by side. A script holds all of
// it and counts.
//
// What it can and cannot do, stated plainly:
//   CAN  -- count distinct styles, find missing labels/headings/alt text, find pages
//           with no way back, find raw jargon, measure text density. All objective.
//   CANNOT -- tell you whether a label is CLEAR, whether a flow makes sense, or whether
//           someone will know what to do. That is Cognitive Walkthrough and five real
//           users (docs/ux-walkthrough-plan.md Parts 1 and 3). This narrows where they
//           should look; it does not replace them.

import { chromium } from "playwright"

const APP = process.env.E2E_APP ?? "http://localhost:3000"
const SID = process.env.AUDIT_SID ?? "24E00399A"
const PW = process.env.AUDIT_PW ?? "prof-passw0rd"

const SHELL = ["/", "/login", "/signup", "/dashboard", "/badges", "/about", "/account", "/admin"]
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
].map((g) => `/games/${g}`)

// Words that are ours, not the student's. Nielsen 2: match between system and the real
// world. "Session 5" is a row in our config; "next Tuesday's lecture" is their week.
const JARGON = ["topic_id", "posttest", "pretest", "socratic", "arm ", "CONTROL", "FLIP",
                "corpus", "sink", "pseudonym", "telemetry", "unscheduled"]

const norm = (s) => (s || "").replace(/\s+/g, " ").trim()

async function fingerprint(page) {
  return page.evaluate((JARGON) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const named = (el) =>
      (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "").trim() ||
      (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText) ||
      el.closest("label")?.innerText || el.getAttribute("placeholder") || ""

    // The style fingerprint. A "primary action" is the biggest visible button; its
    // look is what a student learns to recognise as "the thing that moves me forward".
    // If that look changes from page to page, they have to re-learn it every time.
    const buttons = Array.from(document.querySelectorAll("button, a[role=button], input[type=submit]")).filter(vis)
    const biggest = buttons.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      return rb.width * rb.height - ra.width * ra.height
    })[0]
    const styleOf = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return [s.backgroundColor, s.color, s.borderRadius, s.fontFamily.split(",")[0].replace(/["']/g, ""),
              s.fontSize, s.borderWidth, s.boxShadow === "none" ? "no-shadow" : "shadow"].join(" | ")
    }

    const fonts = {}
    for (const el of Array.from(document.querySelectorAll("body *")).filter(vis)) {
      const f = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "")
      fonts[f] = (fonts[f] || 0) + 1
    }

    const body = (document.body.innerText || "")
    // THE GROUND THE STUDENT ACTUALLY SEES, not <body>. The first version of this
    // read body's background and reported "1 distinct value: white" across all 34
    // surfaces -- the one measure that looked unified. It was an artefact: 23 games
    // paint their cream ground on an inner `min-h-screen` div and never touch body,
    // so body stayed transparent-over-white everywhere. Take the biggest painted
    // element instead, which is what fills the viewport.
    // Ask what is literally behind the middle of the screen and walk UP to the first
    // thing that paints. Area-sorting does not work: <body> ties with a `min-h-screen`
    // child and wins, which is how the first version reported "white everywhere".
    let ground = null
    let el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2))
    while (el && !ground) {
      const c = getComputedStyle(el).backgroundColor
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") ground = c
      el = el.parentElement
    }

    return {
      bg: ground ?? getComputedStyle(document.body).backgroundColor,
      fonts: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
      primary: styleOf(biggest),
      primaryLabel: biggest ? (biggest.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30) : null,
      buttonStyles: [...new Set(buttons.map(styleOf))].length,
      buttons: buttons.length,
      h1: document.querySelectorAll("h1").length,
      headings: document.querySelectorAll("h1,h2,h3").length,
      // Nielsen 3: user control and freedom. Every page needs a visible exit.
      wayBack: !!document.querySelector('[data-testid="game-exit"], a[href="/dashboard"], a[href^="/topics/"], [aria-label*="ack"]'),
      // Nielsen 10: the tutor is meant to be everywhere.
      tutor: !!document.querySelector('[aria-label="Open AI tutor"]'),
      noAlt: Array.from(document.querySelectorAll("img")).filter((e) => vis(e) && e.getAttribute("alt") === null).length,
      noName: Array.from(document.querySelectorAll("button, a[href], input, select, textarea")).filter((e) => vis(e) && !named(e).trim()).length,
      chars: body.trim().length,
      jargon: JARGON.filter((j) => body.includes(j)),
    }
  }, JARGON)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message.slice(0, 80)))

await page.goto(APP + "/login", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(1200)
await page.locator('input[type="text"]').first().fill(SID)
await page.locator('[data-testid="login-password"]').fill(PW)
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(3500)

const rows = []
for (const route of [...SHELL, ...GAMES]) {
  try {
    await page.goto(APP + route, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1300)
    rows.push({ route, ...(await fingerprint(page)) })
  } catch (e) {
    rows.push({ route, error: String(e.message).slice(0, 60) })
  }
}
await browser.close()

const ok = rows.filter((r) => !r.error)
const uniq = (f) => [...new Set(ok.map(f).filter(Boolean))]

console.log(`# Automated HCI sweep\n`)
console.log(`${ok.length} surfaces measured (${SHELL.length} shell, ${GAMES.length} games).`)
console.log(`Generated by \`frontend/ux-audit.mjs\`. Objective measures only --`)
console.log(`clarity and flow need the walkthrough in \`ux-walkthrough-plan.md\`.\n`)

console.log(`## H4 Consistency and standards\n`)
const prim = uniq((r) => r.primary)
const fonts = uniq((r) => r.fonts[0])
const bgs = uniq((r) => r.bg)
console.log(`| measure | distinct values across ${ok.length} surfaces |`)
console.log(`|---|---|`)
console.log(`| primary-action styling | **${prim.length}** |`)
console.log(`| dominant font | **${fonts.length}** -- ${fonts.join(", ")} |`)
console.log(`| page background | **${bgs.length}** -- ${bgs.join(" / ")} |`)
console.log(`\nA student learns "the thing that moves me forward" by its look. ${prim.length} distinct`)
console.log(`primary-action styles means learning it ${prim.length} times.\n`)
for (const p of prim) {
  const who = ok.filter((r) => r.primary === p).map((r) => r.route)
  console.log(`- \`${p}\`\n  - ${who.length} surface(s): ${who.slice(0, 6).join(", ")}${who.length > 6 ? " …" : ""}`)
}

const problems = [
  ["H1 Visibility of status", "no heading at all", ok.filter((r) => r.headings === 0)],
  ["H2 Match with the real world", "shows internal jargon", ok.filter((r) => r.jargon.length)],
  ["H3 User control and freedom", "no visible way back", ok.filter((r) => !r.wayBack)],
  ["H4 Consistency", "more than 3 button styles on ONE page", ok.filter((r) => r.buttonStyles > 3)],
  ["H10 Help", "tutor absent", ok.filter((r) => !r.tutor)],
  ["Accessibility", "image without alt", ok.filter((r) => r.noAlt > 0)],
  ["Accessibility", "control with no accessible name", ok.filter((r) => r.noName > 0)],
]
console.log(`\n## Per-heuristic findings\n`)
console.log(`| heuristic | finding | surfaces |`)
console.log(`|---|---|---|`)
for (const [h, what, hits] of problems) {
  console.log(`| ${h} | ${what} | **${hits.length}** ${hits.length ? "-- " + hits.slice(0, 5).map((r) => r.route).join(", ") + (hits.length > 5 ? " …" : "") : ""} |`)
}

console.log(`\n## Every surface\n`)
console.log(`| route | font | primary action | btn styles | headings | back | tutor | chars |`)
console.log(`|---|---|---|---|---|---|---|---|`)
for (const r of rows) {
  if (r.error) { console.log(`| \`${r.route}\` | ERROR | ${r.error} | | | | | |`); continue }
  console.log(`| \`${r.route}\` | ${r.fonts[0] ?? "-"} | ${r.primaryLabel ?? "(none)"} | ${r.buttonStyles} | ${r.headings} | ${r.wayBack ? "y" : "**n**"} | ${r.tutor ? "y" : "**n**"} | ${r.chars} |`)
}
if (errors.length) console.log(`\nPage errors: ${[...new Set(errors)].join(" | ")}`)
