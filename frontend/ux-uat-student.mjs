// UAT PERSONA 1: "a lost, exhausted student handed this right after summer, cortisol
// rising through November." Real end-user walkthrough, screenshots + on-screen text
// captured at every screen, for a human (Claude) to apply Wharton's Cognitive
// Walkthrough afterwards. This script does NOT judge — it records evidence.
//
//   node ux-uat-student.mjs
//
// Screenshots -> .shots-uat/. A JSON evidence log -> .shots-uat/log.json.
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "fs"
import { APP, go, ready, signIn, giveConsent, freshSid, apiFromPage } from "./e2e/lib.mjs"

const OUT = ".shots-uat"
mkdirSync(OUT, { recursive: true })

let step = 0
const log = []

const shot = async (page, name) => {
  step += 1
  const n = `${String(step).padStart(2, "0")}-${name}`
  await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }).catch(() => {})
  console.log(`  [${n}]  ${page.url()}`)
  return n
}

/** Grab everything a Cognitive Walkthrough needs: headings, body copy, every visible
 *  control's accessible name, and which one is styled as PRIMARY (biggest / most
 *  saturated). */
async function evidence(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"
    }
    const text = (el) => (el.innerText || "").replace(/\s+/g, " ").trim()
    const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
      .filter(vis)
      .map((h) => `${h.tagName}: ${text(h)}`)
    const paras = Array.from(document.querySelectorAll("p"))
      .filter(vis)
      .map(text)
      .filter((t) => t.length > 0)
    const controls = Array.from(
      document.querySelectorAll("button, a, input, textarea, select, [role=button]"),
    )
      .filter(vis)
      .map((el) => {
        const r = el.getBoundingClientRect()
        const name =
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          text(el) ||
          el.getAttribute("title") ||
          ""
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || "",
          name: name.slice(0, 80),
          area: Math.round(r.width * r.height),
          top: Math.round(r.top),
          testid: el.getAttribute("data-testid") || "",
          disabled: !!el.disabled,
        }
      })
    controls.sort((a, b) => b.area - a.area)
    return { title: document.title, headings, paras: paras.slice(0, 12), controls: controls.slice(0, 20) }
  })
}

async function record(page, name, extraNote) {
  const shotName = await shot(page, name)
  const ev = await evidence(page)
  log.push({ step: shotName, url: page.url(), note: extraNote || "", ...ev })
  console.log(`     H1: ${ev.headings[0] || "(none)"}`)
  if (ev.controls[0]) console.log(`     Biggest control: "${ev.controls[0].name}" (${ev.controls[0].tag})`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const sid = freshSid()
console.log(`=== Persona 1 walkthrough, SID ${sid} ===`)

// 1. Landing
await go(page, "/")
await ready(page)
await record(page, "landing")

// 2. Signup (fresh SID, per instructions block 7600+)
await go(page, "/signup")
await ready(page)
await record(page, "signup-blank")

await signIn(page, sid)
await ready(page)
await record(page, "post-signup")

// 3. Consent — capture BEFORE checking, so we can judge "do they understand WHY"
if (page.url().includes("/consent")) {
  await record(page, "consent-unread", "first view, before any interaction")
  // scroll to bottom to see if the agree control is reachable without scrolling
  const scrollInfo = await page.evaluate(() => ({
    scrollHeight: document.body.scrollHeight,
    innerHeight: window.innerHeight,
    needsScroll: document.body.scrollHeight > window.innerHeight,
  }))
  log.push({ note: "consent scroll info", ...scrollInfo })
  console.log(`     consent needs scroll to see everything: ${scrollInfo.needsScroll}`)
}
await giveConsent(page)
await ready(page)
await record(page, "post-consent")

// 4. Onboarding: avatar
if (page.url().includes("/onboarding/avatar")) {
  await record(page, "onboarding-avatar")
  const avatarOpts = await page.locator("button, [role=button]").count()
  log.push({ note: "avatar option count", count: avatarOpts })
}

// Drive onboarding manually (not via helper) so we can screenshot each sub-step
for (let i = 0; i < 6 && page.url().includes("/onboarding"); i++) {
  if (page.url().includes("/baseline")) {
    await record(page, "onboarding-baseline-blank", "before answering")
    await page.locator('[data-testid="baseline-item"]').first().waitFor({ timeout: 15000 }).catch(() => {})
    const items = await page.locator('[data-testid="baseline-item"]').count()
    for (let j = 0; j < items; j++) {
      const first = page
        .locator('[data-testid="baseline-item"]')
        .nth(j)
        .locator('[data-testid="baseline-option"]')
        .first()
      if (await first.count()) await first.click().catch(() => {})
    }
    await record(page, "onboarding-baseline-answered", "all items answered, before submit")
    await page.locator('[data-testid="baseline-submit"]').first().click()
    await page.waitForTimeout(2500)
    continue
  }
  const field = page.locator('input[type="text"]').first()
  if (await field.count()) {
    await record(page, `onboarding-step-${i}-blank`)
    await field.fill("Alex")
  }
  const next = page.getByRole("button", { name: "Continue", exact: true }).first()
  if (!(await next.count())) break
  await next.click()
  await page.waitForTimeout(2200)
}

// 5. Dashboard
await ready(page)
await record(page, "dashboard")

// Capture the "next up" card and lecture groups specifically
const nextUpText = await page
  .locator("text=Next up")
  .first()
  .locator("xpath=ancestor::div[contains(@class,'u-row')][1]")
  .innerText()
  .catch(() => "(not found)")
console.log(`     Next-up card text:\n${nextUpText}`)
log.push({ note: "next-up card raw text", text: nextUpText })

// 6. Enter the first open topic
const nextUpLink = page.locator('a[href^="/topics/"]').first()
const topicHref = await nextUpLink.getAttribute("href").catch(() => null)
console.log(`     Following: ${topicHref}`)
await nextUpLink.click()
await ready(page)
await record(page, "unit-brief")

// Capture the exact brief-step promise text
const briefText = await page.locator("body").innerText()
const timeMatch = briefText.match(/(about|approximately)\s+\d+\s+minutes?/i)
console.log(`     Brief-step time promise: "${timeMatch ? timeMatch[0] : "NOT FOUND"}"`)
log.push({ note: "brief-step time promise", text: timeMatch ? timeMatch[0] : null, fullBrief: briefText.slice(0, 800) })

// Cross-check against the API's questionnaires_enabled flag directly
const journeyRes = await apiFromPage(page, "/api/topics/journey", { method: "GET" })
log.push({ note: "journey API questionnaires_enabled", value: journeyRes?.body?.questionnaires_enabled })
console.log(`     API questionnaires_enabled = ${JSON.stringify(journeyRes?.body?.questionnaires_enabled)}`)

// Start
const startBtn = page.getByRole("button", { name: "Start", exact: true }).first()
await startBtn.click()
await ready(page)
await record(page, "unit-pre-check-blank", "before answering")

// 7. Pre-check: answer everything with the first option, submit
{
  const items = await page.locator('[data-testid="mc-option"]').count()
  console.log(`     mc-option count (pre): ${items}`)
  // Answer per-question: click first option in each question block
  const questionBlocks = page.locator("fieldset, [data-testid='mc-option']").first()
  // Simpler: click every visible mc-option that is first in its group. Try clicking
  // each option's nearest group's first radio by iterating unique 'name' attrs.
  const radios = page.locator('[data-testid="mc-option"]')
  const names = new Set()
  const count = await radios.count()
  for (let i = 0; i < count; i++) {
    const r = radios.nth(i)
    const name = await r.getAttribute("name").catch(() => null)
    const key = name || `idx${i}`
    if (names.has(key)) continue
    names.add(key)
    await r.click().catch(() => {})
  }
  await record(page, "unit-pre-check-answered", "one option per item selected")
  const submit = page.locator('[data-testid="mc-submit"]').first()
  await submit.click().catch(() => {})
  await page.waitForTimeout(1500)
  await record(page, "unit-pre-check-feedback", "post-submit — does it reveal answers?")
}

const preContinue = page.locator('[data-testid="pre-continue"]').first()
if (await preContinue.count()) {
  await preContinue.click()
  await page.waitForTimeout(1000)
}
await ready(page)
await record(page, "unit-after-pre")

// 8. preProbe, if this topic has one
if (page.url().includes("/topics/") && (await page.locator('[data-testid="probe-answer"]').count())) {
  await record(page, "unit-preprobe-blank")
  await page.locator('[data-testid="probe-answer"]').first().fill(
    "I think it's about how people notice and use the interface elements.",
  )
  await record(page, "unit-preprobe-filled")
  await page.locator('[data-testid="probe-submit"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await record(page, "unit-after-preprobe")
}

// 9. The activity (game)
const openActivity = page
  .getByRole("button", { name: /^(Open the activity|Continue|Play)/ })
  .first()
const openActivityLink = page.locator('a[href^="/games/"]').first()
let enteredGame = false
if (await openActivityLink.count()) {
  await record(page, "unit-before-game")
  await openActivityLink.click()
  await ready(page)
  enteredGame = true
} else if (await openActivity.count()) {
  await record(page, "unit-before-game")
  await openActivity.click()
  await ready(page)
  enteredGame = true
}

if (enteredGame) {
  await record(page, "game-entry")
  // Try to click through generically like ux-phases does, up to N steps, watching
  // for any in-game progress indicator text.
  for (let i = 0; i < 10; i++) {
    const progressText = await page.evaluate(() => {
      const m = document.body.innerText.match(/\b\d+\s*(of|\/)\s*\d+\b/i)
      return m ? m[0] : null
    })
    if (i === 0) log.push({ note: "in-game progress indicator on entry", value: progressText })
    const btns = page.locator("button:visible, a[role=button]:visible")
    const n = await btns.count()
    if (n === 0) break
    // Prefer a button whose text suggests "next/start/continue/submit"
    let clicked = false
    for (let b = 0; b < n; b++) {
      const t = (await btns.nth(b).innerText().catch(() => "")) || ""
      if (/start|continue|next|submit|begin|apply|go|finish|done/i.test(t)) {
        await btns.nth(b).click().catch(() => {})
        clicked = true
        break
      }
    }
    if (!clicked) await btns.first().click().catch(() => {})
    await page.waitForTimeout(900)
  }
  await record(page, "game-after-driving", "generic click-through, may not reach debrief")

  // If a debrief appeared, capture it
  if (await page.locator('[data-testid="debrief-cta"]').count()) {
    await record(page, "game-debrief")
  }

  // Take the recorded-completion escape back into the unit if available
  const backLink = page.getByRole("link", { name: /back|continue|topic/i }).first()
  if (await backLink.count()) {
    await backLink.click().catch(() => {})
    await ready(page);
  } else if (topicHref) {
    await go(page, topicHref)
    await ready(page)
  }
  await record(page, "unit-after-game")

  // The generic click-through cannot finish most of the 26 games (known, documented
  // limitation — docs/go-live-plan.md P5). So take the SAME escape a real stuck
  // student would: the low-emphasis "didn't record — continue without it" link, if
  // the game truly did not record; otherwise the real "Continue" once it did.
  const gameCarryOn = page.locator('[data-testid="unit-carry-on"]').first()
  const gameContinue = page.locator('[data-testid="unit-continue"]').first()
  if (await gameCarryOn.count()) {
    log.push({ note: "game step: activity did not record, used carry-on escape" })
    await gameCarryOn.click().catch(() => {})
    await page.waitForTimeout(1500)
  } else if (await gameContinue.count()) {
    log.push({ note: "game step: activity recorded for real" })
    await gameContinue.click().catch(() => {})
    await page.waitForTimeout(1500)
  }
  await ready(page)
  await record(page, "unit-past-game-step")
}

// 10. Post-check (form B)
if (await page.locator('[data-testid="mc-option"]').count()) {
  await record(page, "unit-post-check-blank")
  const radios = page.locator('[data-testid="mc-option"]')
  const names = new Set()
  const count = await radios.count()
  for (let i = 0; i < count; i++) {
    const r = radios.nth(i)
    const name = await r.getAttribute("name").catch(() => null)
    const key = name || `idx${i}`
    if (names.has(key)) continue
    names.add(key)
    await r.click().catch(() => {})
  }
  await record(page, "unit-post-check-answered")
  await page.locator('[data-testid="mc-submit"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await record(page, "unit-post-check-feedback", "does it now show score + per-item feedback?")
  let cont = page.locator('[data-testid="pre-continue"], [data-testid="unit-continue"]').first()
  if (!(await cont.count())) {
    // The post-check's own "Continue" (shown only after postDone) carries NO
    // data-testid in the source -- a real gap worth noting for CW/H4, and a script
    // must not skip it, or the walkthrough falsely reports the unit as stuck.
    cont = page.getByRole("button", { name: "Continue", exact: true }).first()
    log.push({ note: "post-check Continue button has no data-testid, fell back to role name" })
  }
  if (await cont.count()) {
    await cont.click().catch(() => {})
    await page.waitForTimeout(1000)
  }
}
await ready(page)
await record(page, "unit-after-post")

// 11. postProbe, if present
if (await page.locator('[data-testid="probe-answer"]').count()) {
  await page.locator('[data-testid="probe-answer"]').first().fill("Now I understand it involves feedback timing too.")
  await record(page, "unit-postprobe-filled")
  await page.locator('[data-testid="probe-submit"]').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await record(page, "unit-after-postprobe")
}

// 12. Whatever gated steps remain — game (CONTROL arm defers it to here), assess,
// tutor — in whatever order the unit presents them. Loop rather than assume a fixed
// order, since FLIP/CONTROL puts the activity in a different slot per student.
{
  const { passGatedStep } = await import("./e2e/lib.mjs")
  let tutorHandled = false
  for (let i = 0; i < 5; i++) {
    if (!tutorHandled && (await page.locator('[data-testid="open-reflection"]').count())) {
      tutorHandled = true
      await record(page, "unit-tutor-step")
      await page.locator('[data-testid="open-reflection"]').first().click()
      await page.waitForTimeout(1500)
      await record(page, "tutor-dialog-open")
      const textarea = page.locator("textarea").first()
      if (await textarea.count()) {
        await textarea.fill("I think it's about making the important thing easy to find.")
        const sendBtn = page.getByRole("button", { name: /send|submit|reply/i }).first()
        if (await sendBtn.count()) {
          await sendBtn.click().catch(() => {})
          await page.waitForTimeout(9000) // socratic call ~8s
          await record(page, "tutor-dialog-response")
        }
      }
      await page.keyboard.press("Escape").catch(() => {})
      await page.waitForTimeout(500)
    }
    const moved = await passGatedStep(page, topicHref)
    await ready(page)
    await record(page, `unit-loop-${i}`, `passGatedStep moved=${moved}`)
    if (!moved) break // reached close, or nothing left to escape
  }
}

// 14. Close step
await record(page, "unit-close", "delta, badge, replay, questionnaire presence?")
const closeText = await page.locator("body").innerText()
const hasQuestionnaire = /questionnaire/i.test(closeText) && (await page.locator('[data-testid="questionnaire"]').count()) > 0
log.push({ note: "questionnaire visible at close (should be OFF)", present: hasQuestionnaire })
console.log(`     Questionnaire visible at close: ${hasQuestionnaire}`)

// 15. Badges page
await go(page, "/badges")
await ready(page)
await record(page, "badges-page")

// 16. Back to dashboard — does it now reflect completion?
await go(page, "/dashboard")
await ready(page)
await record(page, "dashboard-after-completion")

writeFileSync(`${OUT}/log.json`, JSON.stringify({ sid, log }, null, 2))
console.log(`\nDone. ${step} screenshots in ${OUT}/, evidence in ${OUT}/log.json`)
await browser.close()
