// THE TEACHER'S PATH — the half of the product nothing was testing.
//
// The student path had 43 suites. The teacher had ONE assertion, and it had been red
// all session. That asymmetry is why three defects sat in the teacher path unnoticed
// until 2026-08-30, nine days from go-live:
//
//   1. teachers hit the participant gate chain and their consent, baseline and topic
//      events landed in the research sink looking exactly like a student's
//   2. /admin was linked from nowhere -- grep found the string only in two comments
//   3. the tutorial brief, the teacher's actual weekly job, could not be reached from
//      the app at all
//
// None of them is subtle. All three survived because nothing walked this path.
//
// Needs a SID on backend/admin_sids.txt. Set E2E_TEACHER_SID / E2E_TEACHER_PW when
// the box uses different credentials.

import { test, T, go, ready, logIn, signIn, giveConsent, onboard, apiFromPage, freshSid, APP } from "./lib.mjs"

const TEACHER = process.env.E2E_TEACHER_SID ?? "24E00399A"
const TEACHER_PW = process.env.E2E_TEACHER_PW ?? null   // null => the e2e password

async function teacherIn(page) {
  if (TEACHER_PW) {
    await go(page, "/login")
    await ready(page)
    await page.locator('input[type="text"]').first().fill(TEACHER)
    await page.locator('[data-testid="login-password"]').fill(TEACHER_PW)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForTimeout(3000)
    return page.url()
  }
  return logIn(page, TEACHER)
}

test("a teacher is not treated as a participant", async (page, t) => {
  const url = await teacherIn(page)
  t.require("the teacher can sign in", !url.includes("/login"),
    `${url} — is ${TEACHER} on admin_sids.txt with the e2e password?`)

  const me = await apiFromPage(page, "/api/auth/me")
  const body = me.body ?? {}
  // Consent and the baseline are instruments aimed at PARTICIPANTS. Making the
  // course team agree to an information sheet about their own study, and sit the
  // prior-knowledge pre-test, is how their rows got into the sink.
  t.check("is not asked to consent as a participant", body.needsConsent !== true, body)
  t.check("is not asked to sit the baseline pre-test", body.needsBaseline !== true, body)
  t.check("lands somewhere usable, not stuck in onboarding",
    !page.url().includes("/consent"), page.url())
})

test("a teacher's activity never reaches the research sink", async (page, t) => {
  await teacherIn(page)
  const before = (await apiFromPage(page, "/api/research/summary")).body?.total_events ?? 0

  // Post directly: the point is that the SINK refuses staff rows whatever the UI
  // does, because the UI is not the only thing that can write.
  const r = await apiFromPage(page, "/api/research/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "topic_complete", topic_id: "memory" }),
  })
  await page.waitForTimeout(600)
  const after = (await apiFromPage(page, "/api/research/summary")).body?.total_events ?? 0

  t.check("the write is accepted rather than erroring at them", r.status < 500, r.status)
  t.check("but nothing is stored", after === before, { before, after })
})

test("a teacher can reach the panel by clicking, and a student cannot see it", async (page, t) => {
  await teacherIn(page)
  await go(page, "/dashboard")
  await ready(page, 1800)

  const link = page.locator('[data-testid="admin-link"]')
  t.check("the dashboard offers a way into the course-team panel",
    (await link.count()) === 1,
    "linked from nowhere before 2026-08-30 — a teacher had to type the URL")
  if (await link.count()) {
    await link.click()
    await page.waitForTimeout(2500)
    t.check("and it lands on the panel", page.url().endsWith("/admin"), page.url())
    t.check("which draws itself rather than refusing",
      (await page.locator('[data-testid="admin-denied"]').count()) === 0)
  }

  // The link is a convenience, never the boundary.
  const sid = freshSid()
  // A FRESH CONTEXT, not page.context().newPage(): a new page in the teacher's own
  // context inherits the teacher's session cookie, so /signup and /login redirect
  // an already-authenticated session straight to /dashboard and the student sign-in
  // form never appears (the bug both sweep agents flagged). A separate context is a
  // genuinely different browser session.
  const studentCtx = await page.context().browser().newContext()
  const student = await studentCtx.newPage()
  await signIn(student, sid); await giveConsent(student); await onboard(student)
  await go(student, "/dashboard")
  await ready(student, 1800)
  t.check("a student is not shown the link",
    (await student.locator('[data-testid="admin-link"]').count()) === 0)
  await go(student, "/admin")
  await ready(student, 2000)
  t.check("and typing the URL gets a plain refusal, not a broken page",
    (await student.locator('[data-testid="admin-denied"]').count()) === 1,
    await student.locator("body").innerText())
  const denied = await apiFromPage(student, "/api/admin/participants")
  t.check("the server refuses them too, which is the real gate", denied.status === 403, denied.status)
  await student.close()
  await studentCtx.close()
})

test("the tutorial deck is downloadable in the browser, and the research copy stays blind", async (page, t) => {
  await teacherIn(page)
  await go(page, "/admin")
  await ready(page, 2500)

  // The panel is tabbed now (Accounts · Tutorial briefs · Lecture dates). The brief
  // lives under its own tab; open it before asserting the panel renders.
  await page.locator('[data-testid="admin-tab-briefs"]').click()
  await ready(page, 1500)

  t.check("the briefs panel renders",
    (await page.locator('[data-testid="admin-reports"]').count()) === 1)

  const list = await apiFromPage(page, "/api/admin/reports")
  t.check("the API lists briefs", list.status === 200, list.status)
  const reports = list.body?.reports ?? []
  t.note(`${reports.length} brief(s) on disk`)

  // THE BLINDING. The -research copy is the only one that names arms and sequence.
  // A lecturer who learns the manipulation exists can teach to compensate, and
  // differential instruction by condition lands on H1 and cannot be undone.
  t.check("no -research copy is listed",
    !reports.some((r) => r.path.endsWith("-research.md")),
    reports.filter((r) => r.path.endsWith("-research.md")).map((r) => r.path))
  const direct = await apiFromPage(page,
    "/api/admin/reports/file?path=" + encodeURIComponent("COMP3423/section-A/x-research.md"))
  t.check("and asking for one by name is refused", direct.status === 403, direct.status)

  // Path traversal, next to a directory of files containing student SIDs.
  for (const bad of ["../../backend/enrolled_sids.txt", "..%2F..%2Fbackend%2Fauth_store.db"]) {
    const r = await apiFromPage(page, "/api/admin/reports/file?path=" + encodeURIComponent(bad))
    t.check(`traversal is refused: ${bad.slice(0, 28)}`, r.status === 400 || r.status === 404, r.status)
  }

  // THE PAGE SURFACES DECKS NOW, not the .md brief. The deck is the .pptx the teacher
  // runs; the .md endpoints tested above still exist and stay blinded. Every deck is
  // blind + SID-free by construction, so the list marks them all safe to project.
  const decks = await apiFromPage(page, "/api/admin/reports/decks")
  t.check("the API lists tutorial decks", decks.status === 200, decks.status)
  const deckRows = decks.body?.reports ?? []
  t.note(`${deckRows.length} deck(s) on disk`)
  t.check("every listed deck is a .pptx marked safe to project",
    deckRows.every((r) => r.path.toLowerCase().endsWith("-tutorial.pptx") && r.projectable === true),
    deckRows.map((r) => r.path).slice(0, 3))

  // The download endpoint carries the SAME allowlist + traversal defences as the
  // brief reader: only a -tutorial.pptx can ever come back, never a -research copy
  // and never a file outside reports/.
  const notDeck = await apiFromPage(page,
    "/api/admin/reports/download?path=" + encodeURIComponent("COMP3423/section-A/x-research.md"))
  t.check("the deck download refuses a non-deck file", notDeck.status === 403, notDeck.status)
  for (const bad of ["../../backend/enrolled_sids.txt", "..%2F..%2Fbackend%2Fauth_store.db"]) {
    const r = await apiFromPage(page, "/api/admin/reports/download?path=" + encodeURIComponent(bad))
    t.check(`deck traversal is refused: ${bad.slice(0, 28)}`, r.status === 400 || r.status === 404, r.status)
  }

  if (deckRows.length) {
    const one = deckRows[0]
    const dl = await apiFromPage(page,
      "/api/admin/reports/download?path=" + encodeURIComponent(one.path))
    t.check("a deck can actually be downloaded", dl.status === 200, dl.status)
    t.check("the page offers a Download control",
      (await page.locator('[data-testid="report-download"]').count()) >= 1)
  } else {
    t.check("with nothing generated it says so rather than showing an empty list",
      (await page.locator('[data-testid="reports-empty"]').count()) === 1)
  }
})

test("the panel still cannot read answers, scores, or password material", async (page, t) => {
  await teacherIn(page)
  const parts = await apiFromPage(page, "/api/admin/participants")
  const blob = JSON.stringify(parts.body ?? {})
  t.check("no password hash or salt is returned", !/pw_hash|pw_salt|scrypt|\$2[aby]\$/.test(blob))
  t.check("no answers are returned", !/"answers"/.test(blob))
  t.check("no scores are returned", !/"score"/.test(blob))
  t.check("it does say who has claimed an account", /has_password/.test(blob), blob.slice(0, 120))

  const audit = await apiFromPage(page, "/api/admin/audit")
  t.check("the audit log is readable — one nobody can read is decoration",
    audit.status === 200 && Array.isArray(audit.body?.entries), audit.status)
})
