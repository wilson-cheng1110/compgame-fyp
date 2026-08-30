// Capture the first-run screens (consent, avatar, username, baseline pre-test) using a
// pre-created-but-unconsented account. 24E06000A was created via API (password below)
// and has needsConsent/needsOnboarding/needsBaseline all true, so logging in routes
// straight through the first-run flow.
import { chromium } from "playwright"
import { mkdirSync } from "fs"
import { go, ready } from "./e2e/lib.mjs"

const OUT = ".shots-uat"; mkdirSync(OUT, { recursive: true })
const SID = "24E06000A", PW = "probe-Passw0rd1"
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }).catch(() => {})

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

await go(page, "/login"); await ready(page)
await page.locator('input[type="text"]').first().fill(SID)
await page.locator('[data-testid="login-password"]').fill(PW)
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(3000); await ready(page)
console.log("after login ->", page.url())

if (page.url().includes("/consent")) {
  await shot(page, "f01-consent")
  await page.locator('input[type="checkbox"]').first().check().catch(() => {})
  await page.waitForTimeout(300)
  await page.getByRole("button", { name: /agree/i }).first().click().catch(() => {})
  await page.waitForTimeout(2500); await ready(page)
}
console.log("after consent ->", page.url())

for (let i = 0; i < 6 && page.url().includes("/onboarding"); i++) {
  if (page.url().includes("/baseline")) {
    await shot(page, "f04-baseline-blank")
    const items = await page.locator('[data-testid="baseline-item"]').count()
    for (let j = 0; j < items; j++) {
      const first = page.locator('[data-testid="baseline-item"]').nth(j).locator('[data-testid="baseline-option"]').first()
      if (await first.count()) await first.click().catch(() => {})
    }
    await shot(page, "f05-baseline-answered")
    await page.locator('[data-testid="baseline-submit"]').first().click().catch(() => {})
    await page.waitForTimeout(2500); await ready(page); continue
  }
  const field = page.locator('input[type="text"]').first()
  if (await field.count()) { await shot(page, "f03-onboarding-username"); await field.fill("Alex") }
  else { await shot(page, "f02-onboarding-avatar") }
  const next = page.getByRole("button", { name: "Continue", exact: true }).first()
  if (!(await next.count())) break
  await next.click(); await page.waitForTimeout(2200); await ready(page)
}
console.log("ended ->", page.url())
await browser.close()
