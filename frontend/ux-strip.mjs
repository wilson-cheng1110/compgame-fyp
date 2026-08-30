// Photograph the boundary that was the problem: does a game still tell you where you
// are in the unit? Run after a build+restart.  node ux-strip.mjs
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
mkdirSync(".shots-strip", { recursive: true })
const APP = process.env.E2E_APP ?? "http://localhost:3000"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
let n = 0
const shot = async (t) => {
  await p.screenshot({ path: `.shots-strip/${++n}-${t}.png` })
  console.log(`  shot ${n} ${t}`)
}

await p.goto(APP + "/login", { waitUntil: "domcontentloaded" })
await p.waitForTimeout(1500)
await p.locator('input[type="text"]').first().fill("24E00399A")
await p.locator('[data-testid="login-password"]').fill("prof-passw0rd")
await p.locator('button[type="submit"]').first().click()
await p.waitForTimeout(3500)

for (const [label, url] of [
  ["in-unit", "/games/hicks-law-understanding?unit=hicks-law&step=3&of=7"],
  ["free-play", "/games/hicks-law-understanding"],
  ["fitts-canvas", "/games/fitts-law-understanding/app/game/distance?unit=fitts-law&step=3&of=7"],
]) {
  await p.goto(APP + url, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(2200)
  const strip = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="game-exit"]')?.closest("div")
    return el ? (el.innerText || "").replace(/\s+/g, " ").trim() : "(no strip)"
  })
  const step = await p.locator('[data-testid="game-step"]').count()
  // The Fitts canvas is the fragile one: a 1920x1080 scene scaled to fit. If the strip
  // ever pushes layout instead of floating over it, this is where it shows up.
  const painted = await p.evaluate(() =>
    Array.from(document.querySelectorAll("*")).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width >= 8 && r.height >= 8 && getComputedStyle(el).backgroundImage !== "none"
    }).length)
  console.log(`  ${label.padEnd(13)} strip: "${strip}"  step=${step > 0}  painted=${painted}`)
  await shot(label)
}
await b.close()
