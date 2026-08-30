// Re-capture the admin panel as VIEWPORT shots (fullPage:false). The panel's audit
// table makes a full-page capture ~118000px tall and useless; a 1280x1000 viewport
// scrolled to each section is what a manual needs.
import { chromium } from "playwright"
import { mkdirSync } from "fs"
import { go, ready } from "./e2e/lib.mjs"

const OUT = ".shots-uat"; mkdirSync(OUT, { recursive: true })
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {})  // viewport only
const toTop = async (page, testid) => {
  const el = page.locator(`[data-testid="${testid}"]`).first()
  if (!(await el.count())) return false
  await el.evaluate((e) => e.scrollIntoView({ block: "start" }))
  await page.waitForTimeout(500)
  return true
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()

await go(page, "/login"); await ready(page)
await page.locator('input[type="text"]').first().fill("admin")
await page.locator('[data-testid="login-password"]').fill("admin-Passw0rd")
await shot(page, "tv01-login-filled")
await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(3000); await ready(page)

// Dashboard: scroll to the admin banner
const banner = page.locator('[data-testid="admin-banner"]').first()
if (await banner.count()) { await banner.evaluate((e)=>e.scrollIntoView({block:"center"})); await page.waitForTimeout(400); await shot(page, "tv02-dashboard-admin-banner") }

await go(page, "/admin"); await ready(page)
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300)
await shot(page, "tv03-admin-top")

await toTop(page, "admin-reports"); await shot(page, "tv04-admin-reports")
// open first report if present
const openBtn = page.locator('[data-testid="report-open"]').first()
if (await openBtn.count()) {
  await openBtn.click(); await page.waitForTimeout(1500)
  const opened = page.locator('[data-testid="report-body"], [data-testid="report-open"]').first()
  await opened.evaluate((e)=>e.scrollIntoView({block:"start"})).catch(()=>{})
  await page.waitForTimeout(400); await shot(page, "tv05-admin-report-open")
}
await toTop(page, "admin-schedule"); await shot(page, "tv06-admin-schedule")
const manage = page.locator('[data-testid="admin-manage"]').first()
if (await manage.count()) { await manage.evaluate((e)=>e.scrollIntoView({block:"start"})); await page.waitForTimeout(300); await manage.click().catch(()=>{}); await page.waitForTimeout(500); await shot(page, "tv07-admin-manage") }
await toTop(page, "admin-audit"); await shot(page, "tv08-admin-audit")

console.log("teacher viewport shots done")
await browser.close()
