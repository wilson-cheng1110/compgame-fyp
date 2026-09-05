// THE RESEARCHER'S PATH — the PI's monitoring surface, kept BLIND from the teacher.
//
// The teacher panel is deliberately blind to arms / scores / export: a lecturer who
// learns the FLIP/CONTROL manipulation exists can teach to compensate, and differential
// instruction by condition is a confound on H1 that cannot be undone. So those things
// live on a SEPARATE surface behind a SEPARATE allowlist (researcher_sids.txt). This
// walks all three roles against it:
//
//   * a researcher (PI) reaches /researcher, is NOT a participant, and can export
//   * a TEACHER (admin only) is refused it AND never shown the link — the blinding
//   * a STUDENT is refused it too
//
// Needs a SID on backend/researcher_sids.txt (E2E_RESEARCHER_SID, default 24E00398A)
// that is NOT on admin_sids.txt, and the teacher SID on admin_sids.txt but NOT the
// researcher list — so the two gates are proven independent, not one a superset.

import { test, go, ready, signIn, logIn, giveConsent, onboard, apiFromPage, freshSid } from "./lib.mjs"

const RESEARCHER = process.env.E2E_RESEARCHER_SID ?? "24E00398A"
const TEACHER = process.env.E2E_TEACHER_SID ?? "24E00399A"
// A raw enrolled-SID shape (24E00001A / 24S…): if any of these appears in the export,
// pseudonymisation failed. The 16-hex pseudonym cannot match this.
const RAW_SID = /\b\d{2}[A-Z]\d{5}[A-Z]\b/

test("a researcher reaches the monitoring surface and it is not blank", async (page, t) => {
  const url = await signIn(page, RESEARCHER)
  t.require("the researcher can sign in", !url.includes("/login"),
    `${url} — is ${RESEARCHER} on researcher_sids.txt with the e2e password?`)

  // A researcher (PI) is staff, not a participant: no consent, no baseline pre-test.
  const me = await apiFromPage(page, "/api/auth/me")
  t.check("is not asked to consent as a participant", me.body?.needsConsent !== true, me.body)
  t.check("is not asked to sit the baseline pre-test", me.body?.needsBaseline !== true, me.body)

  await go(page, "/researcher")
  await ready(page, 2200)
  t.require("the monitor renders rather than refusing",
    (await page.locator('[data-testid="researcher-overview"]').count()) === 1 &&
      (await page.locator('[data-testid="researcher-denied"]').count()) === 0, page.url())
  t.check("the per-section headcount table is drawn",
    (await page.locator('[data-testid="researcher-sections"]').count()) === 1)
  t.check("the manipulation-check headline is drawn",
    (await page.locator('[data-testid="researcher-coverage"]').count()) === 1)
  t.check("the export controls are present",
    (await page.locator('[data-testid="researcher-export-csv"]').count()) === 1)
  t.check("the forget control is present",
    (await page.locator('[data-testid="researcher-forget-sid"]').count()) === 1)

  const mon = await apiFromPage(page, "/api/researcher/monitor")
  t.check("the monitor API answers 200 for the researcher", mon.status === 200, mon.status)
  t.check("MSC is one of the sections it reports",
    !!mon.body?.accounts?.by_section && "MSC" in mon.body.accounts.by_section,
    Object.keys(mon.body?.accounts?.by_section ?? {}))
  t.check("it carries the coverage headline", typeof mon.body?.coverage?.pairs === "number", mon.body?.coverage)
})

test("the researcher export is pseudonymised — real SIDs never leave", async (page, t) => {
  await signIn(page, RESEARCHER)
  const j = await apiFromPage(page, "/api/researcher/export?format=json")
  t.check("the export is 200 for a researcher", j.status === 200, j.status)
  const blob = JSON.stringify(j.body ?? [])
  t.check("no raw enrolled-SID shape appears anywhere in the export",
    !RAW_SID.test(blob), (blob.match(RAW_SID) || []).slice(0, 3))
})

test("a teacher (admin only) is BLIND to the researcher surface", async (page, t) => {
  // logIn, like teacher-path: the teacher account already exists with the e2e password
  // by the time this suite runs (happy/unhappy created it).
  const url = await logIn(page, TEACHER)
  t.require("the teacher signs in", !url.includes("/login"),
    `${url} — is ${TEACHER} on admin_sids.txt with the e2e password?`)

  await go(page, "/dashboard")
  await ready(page, 1800)
  t.check("the teacher is offered the course-team link",
    (await page.locator('[data-testid="admin-link"]').count()) === 1)
  t.check("but is NOT offered the researcher link (the surface stays off their radar)",
    (await page.locator('[data-testid="researcher-link"]').count()) === 0)

  await go(page, "/admin")
  await ready(page, 2000)
  t.check("the admin page draws for the teacher",
    (await page.locator('[data-testid="admin-denied"]').count()) === 0, page.url())
  t.check("and it hides the researcher-tools link from a non-researcher teacher",
    (await page.locator('[data-testid="researcher-link"]').count()) === 0)

  await go(page, "/researcher")
  await ready(page, 2000)
  t.check("typing /researcher gets a plain refusal, not a broken page",
    (await page.locator('[data-testid="researcher-denied"]').count()) === 1,
    await page.locator("body").innerText())
  // The link is a convenience; THIS is the boundary.
  const mon = await apiFromPage(page, "/api/researcher/monitor")
  t.check("the server refuses the teacher (403) — the real gate", mon.status === 403, mon.status)
  const exp = await apiFromPage(page, "/api/researcher/export")
  t.check("and refuses them the export (403)", exp.status === 403, exp.status)
  const fg = await apiFromPage(page, "/api/researcher/forget", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid: "24E00001A" }),
  })
  t.check("and refuses them the forget (403)", fg.status === 403, fg.status)
})

test("a student is refused the researcher surface", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)
  await go(page, "/dashboard")
  await ready(page, 1500)
  t.check("a student is not shown the researcher link",
    (await page.locator('[data-testid="researcher-link"]').count()) === 0)
  await go(page, "/researcher")
  await ready(page, 2000)
  t.check("and typing the URL is a plain refusal",
    (await page.locator('[data-testid="researcher-denied"]').count()) === 1,
    await page.locator("body").innerText())
  const mon = await apiFromPage(page, "/api/researcher/monitor")
  t.check("the server refuses them (403), which is the real gate", mon.status === 403, mon.status)
})
