// THE UNHAPPY PATHS: everything a student can do wrong, and everything that must
// hold when they try to go around the UI.
//
// These matter more than the happy path. The happy path proves the product works;
// these prove the MEASUREMENT is sound — that the answer key never ships, that the
// pre-check reveals nothing, that a topic cannot be entered early, and that a
// determined CS student poking at fetch() in devtools gets the same answer as one
// clicking buttons.
//
// Anything asserted here has a server-side counterpart in backend/tests. It is
// re-asserted through the browser because the client is where it would actually be
// bypassed, and because a UI change can quietly stop honouring a rule the server
// still enforces (the student then just sees a broken page instead of a leak).

import {
  test, T, go, ready, signIn, logIn, fullSignIn, E2E_PASSWORD, giveConsent, onboard, apiFromPage,
  freshSid, UNENROLLED_SID, API, grepBuild,
} from "./lib.mjs"

const POST = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

test("a SID that is not on the class list cannot get in", async (page, t) => {
  await go(page, "/signup")
  await ready(page)
  await page.locator('[data-testid="signup-sid"]').fill(UNENROLLED_SID)
  await page.locator('[data-testid="signup-password"]').fill(E2E_PASSWORD)
  const pick = page.locator('[data-testid="signup-section"]')
  if (await pick.count()) await pick.first().click()
  await page.locator('[data-testid="signup-submit"]').click()
  await page.waitForTimeout(2500)

  t.check("stays on the signup page", page.url().includes("/signup"), page.url())
  const html = await page.content()

  // AUDIT 2026-08-21: this used to test /not|isn't|cannot|class list/, which MATCHES
  // THE CLEAN LOGIN PAGE — it always carries "your SID needs to be on the class
  // list". The assertion passed whether or not an error was ever shown, and was
  // padding the count. It now looks for the backend's actual refusal string, which
  // appears nowhere on an untouched page (auth_api.py: "not_enrolled").
  t.check(
    "the specific refusal is shown",
    /isn't on the class list for this study/i.test(html),
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 180),
  )
  t.check("no stack trace or raw error leaks to the student", !/Traceback|TypeError|undefined is not/i.test(html))

  const me = await apiFromPage(page, "/api/auth/me")
  t.check("no session was created", me.status === 401, me)

  // The OTHER door must stay mute. Sign-in refuses an unknown SID and a wrong
  // password with one identical message, so this page cannot be walked to find out
  // who is on the class list.
  await logIn(page, UNENROLLED_SID)
  t.check("sign-in stays on the login page", page.url().includes("/login"), page.url())
  const loginHtml = await page.content()
  t.check("sign-in does NOT confirm the SID is unknown",
    !/isn't on the class list for this study/i.test(loginHtml))
  t.check("it gives the one generic message instead",
    /don't match an account/i.test(loginHtml),
    loginHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 180))
})

test("signed-out students are sent to login, not to a broken page", async (page, t) => {
  for (const path of ["/dashboard", "/badges", "/topics/webers-law"]) {
    await go(page, path)
    await page.waitForTimeout(1800)
    t.check(`${path} -> /login when signed out`, page.url().includes("/login"), page.url())
  }
})

test("a locked topic cannot be entered early", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const locked = journey.body.topics.find((x) => x.state === "locked")
  t.require("a locked topic exists to test with", !!locked, journey.body?.topics?.map((x) => x.state))

  await go(page, `/topics/${locked.topic_id}`)
  const blocked = page.locator('[data-testid="topic-blocked"]')
  await blocked.waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
  const html = await page.content()
  t.check("the blocked panel is shown", (await blocked.count()) > 0, {
    url: page.url(),
    snippet: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200),
  })
  t.check("and it says when it opens", /not open|opens on|isn't scheduled/i.test(html))
  t.check("no unit steps are rendered", !(await page.locator('[data-testid="step-counter"]').count()))

  // And the server refuses independently of what the page chose to draw.
  const detail = await apiFromPage(page, `/api/topics/${locked.topic_id}`)
  t.check("API refuses the locked topic (403)", detail.status === 403, detail)

  const items = await apiFromPage(page, `/api/topics/${locked.topic_id}/check/A`)
  t.check("its check items are refused too", items.status === 403, items.status)
})

test("THE ANSWER KEY NEVER REACHES THE CLIENT", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open banked topic exists", !!topic)

  let items0 = null
  for (const form of ["A", "B"]) {
    const res = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/${form}`)
    if (form === "A") items0 = res.body?.items?.[0]
    t.require(`form ${form} items load`, res.status === 200, res.status)
    const blob = JSON.stringify(res.body)

    t.check(`form ${form}: no "correct" field`, !/"correct/.test(blob))
    t.check(`form ${form}: no ✓ marker`, !blob.includes("✓"))
    t.check(
      `form ${form}: every item has id/stem/options and nothing else`,
      res.body.items.every((i) => JSON.stringify(Object.keys(i).sort()) === '["id","options","stem"]'),
      res.body.items?.[0] && Object.keys(res.body.items[0]),
    )
  }

  // The rendered page is the other place it could leak.
  await go(page, `/topics/${topic.topic_id}`)
  await page.waitForTimeout(2200)
  const start = page.getByRole("button", { name: /^Start$/ }).first()
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(2500)
  }
  const html = await page.content()
  t.check("no correct_option in the served markup", !/correct_option/.test(html))

  // AUDIT 2026-08-21: docs/revamp.md Part 17 asks for exactly this — "grep the built
  // bundle for a known pre-check answer string". The suite checked the API payload
  // and the markup but never the SHIPPED JAVASCRIPT, which is a third, independent
  // place the bank could leak (an innocent-looking import of the item bank into a
  // client component would put every stem and every key in a file anyone can read).
  // The needle is taken from the live API rather than hard-coded, so it cannot drift
  // out of date with the bank.
  const needle = (items0?.stem ?? "").slice(0, 34)
  if (t.check("got a real stem to search for", needle.length > 20, needle)) {
    const hits = await grepBuild(needle)
    t.check("the stem is NOT in the built client bundle", hits.length === 0, hits.slice(0, 3))
    // NOT a generic grep for '"correct":' — that was the first attempt and it is a
    // FALSE POSITIVE: game bundles contain the literal "correct" as a UI state value
    // (`state === answer ? "correct" : "wrong"`). Grep for the item bank's own marker
    // instead, which appears nowhere else.
    const keyHits = await grepBuild("Answer key")
    t.check("the item bank's answer key is not in the bundle", keyHits.length === 0, keyHits.slice(0, 3))

    // The in-game assessments too. gestalt-assessment shipped all ten of its answers
    // as `answer:"similarity"` etc. until 2026-08-21; the score is a secondary DV and
    // a freely-readable key made it a measure of curiosity. The option LABELS are
    // still in the bundle and must be — they are the buttons. What must not be there
    // is the question -> answer mapping.
    // NARROWED, deliberately. A grep for any `answer:"` also flags the UNDERSTANDING
    // games, which ship answers alongside `reason:` explanations — that is teaching
    // content the student is meant to see, and no Understanding game feeds a DV.
    // What must not ship is an ASSESSMENT key, so this greps for gestalt's principle
    // answers specifically; if that key ever comes back, these reappear.
    for (const needle of ['answer:"similarity"', 'answer:"closure"', 'answer:"proximity"']) {
      const hits = await grepBuild(needle)
      t.check(`gestalt assessment key absent: ${needle}`, hits.length === 0, hits.slice(0, 2))
    }
  }
})

test("the pre-check reveals nothing; the post-check reveals everything", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open banked topic exists", !!topic)

  const items = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  const answers = Object.fromEntries(items.body.items.map((i) => [i.id, "a"]))

  const pre = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, POST({ answers }))
  t.require("pre-check submits", pre.status === 200, pre)
  t.check("pre-check returns NO score", pre.body.score === undefined, pre.body)
  t.check("pre-check returns NO correct answers", !/"correct_option"/.test(JSON.stringify(pre.body)))
  t.check("pre-check returns NO per-item outcome", !/"was_correct"/.test(JSON.stringify(pre.body)))
  t.check("but does confirm it was recorded", pre.body.ok === true, pre.body)

  const post = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/B`, POST({ answers }))
  t.require("post-check submits", post.status === 200, post)
  t.check("post-check DOES return a score", typeof post.body.score === "number", post.body)
  t.check("post-check DOES reveal correct answers", /"correct_option"/.test(JSON.stringify(post.body)))
})

test("one submission means one submission", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open banked topic exists", !!topic)

  const items = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  const answers = Object.fromEntries(items.body.items.map((i) => [i.id, "b"]))

  const first = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, POST({ answers }))
  t.require("first submission accepted", first.status === 200, first.status)

  const second = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, POST({ answers }))
  t.check("second submission refused with 409", second.status === 409, second)
  t.check("and says so in words a student can read", /already/i.test(JSON.stringify(second.body)))

  const reload = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  t.check("re-fetching the items is refused too", reload.status === 409, reload.status)
})

test("nothing is recorded before consent, even bypassing the UI", async (page, t) => {
  const sid = freshSid()
  const url = await signIn(page, sid)
  t.require("signed in, consent still pending", url.includes("/consent"), url)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open banked topic exists", !!topic)

  const items = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  const answers = Object.fromEntries((items.body.items ?? []).map((i) => [i.id, "c"]))

  const res = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, POST({ answers }))
  t.check("submitting without consent is refused (403)", res.status === 403, res)
  t.check("and names the reason", /consent/i.test(JSON.stringify(res.body)), res.body)

  const probe = await apiFromPage(page, `/api/topics/${topic.topic_id}/probe/A`, POST({ answer: "anything" }))
  t.check("the short-answer probe is refused too", probe.status === 403, probe.status)
})

test("the offline-only endpoints fail closed", async (page, t) => {
  // Grading and the research export are deliberately unreachable unless a token is
  // configured. Unset means OFF — the safe direction — and a student must never be
  // able to reach either.
  const grade = await apiFromPage(page, "/api/grade", POST({ topic_id: "webers-law", answer: "x" }))
  t.check("/api/grade is 503 with no GRADE_TOKEN", grade.status === 503, grade)
  t.check("and does not grade anything", !/"level"/.test(JSON.stringify(grade.body)), grade.body)

  const rubric = await apiFromPage(page, "/api/grade/rubric")
  t.check("the rubric is not browsable either", rubric.status === 503, rubric.status)

  const exp = await apiFromPage(page, "/api/research/export")
  t.check("the research export is refused without a token", exp.status === 503 || exp.status === 403, exp.status)
  t.check("no participant rows leak in the refusal", !/participant_id/.test(JSON.stringify(exp.body)), exp.body)
})

test("signing out actually ends the session", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const before = await apiFromPage(page, "/api/auth/me")
  t.require("session is live", before.status === 200, before.status)

  await apiFromPage(page, "/api/auth/logout", POST({}))
  await page.waitForTimeout(500)

  const after = await apiFromPage(page, "/api/auth/me")
  t.check("session is gone server-side", after.status === 401, after)

  await go(page, "/dashboard")
  await page.waitForTimeout(2000)
  t.check("and the dashboard is no longer reachable", page.url().includes("/login"), page.url())
})


test("the baseline pre-test is a gate, sat once, and reveals nothing", async (page, t) => {
  // docs/experiment-design.md §8. Five items across five topics the student is about
  // to be measured on, so this one leaks harder than any other check if it leaks.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)

  // Get past avatar + username but STOP before the baseline.
  for (let i = 0; i < 3 && page.url().includes("/onboarding") && !page.url().includes("/baseline"); i++) {
    const field = page.locator('input[type="text"]').first()
    if (await field.count()) await field.fill("E2E Student")
    const next = page.getByRole("button", { name: "Continue", exact: true }).first()
    if (!(await next.count())) break
    await next.click()
    await page.waitForTimeout(2200)
  }
  t.require("onboarding routes to the baseline, not the dashboard", page.url().includes("/baseline"), page.url())

  // IT IS A GATE: the covariate is sat once and then gone forever, so a student who
  // types /dashboard must not be able to skip past it.
  await go(page, "/dashboard")
  await page.waitForTimeout(2500)
  t.check("typing /dashboard does not skip the baseline", !page.url().endsWith("/dashboard"), page.url())

  const payload = await apiFromPage(page, "/api/auth/baseline")
  t.require("items load", payload.status === 200, payload.status)
  const blob = JSON.stringify(payload.body)
  t.check("5 items", payload.body.items?.length === 5, payload.body.items?.length)
  t.check("NO answer key in the payload", !/"correct/.test(blob))
  t.check(
    "each item is id/stem/options and nothing else",
    payload.body.items.every((i) => JSON.stringify(Object.keys(i).sort()) === '["id","options","stem"]'),
    payload.body.items?.[0] && Object.keys(payload.body.items[0]),
  )

  const answers = Object.fromEntries(payload.body.items.map((i) => [i.id, 0]))
  const first = await apiFromPage(page, "/api/auth/baseline", POST({ answers }))
  t.require("submits", first.status === 200, first)
  t.check("NO score comes back", first.body.score === undefined, first.body)
  t.check("no per-item outcome comes back", !/"correct|was_correct/.test(JSON.stringify(first.body)))

  const second = await apiFromPage(page, "/api/auth/baseline", POST({ answers }))
  t.check("a second sitting is refused (409)", second.status === 409, second)

  const me = await apiFromPage(page, "/api/auth/me")
  t.check("the session stops asking for it", me.body?.needsBaseline === false, me.body)
})

test("a student can actually withdraw, and withdrawal holds", async (page, t) => {
  // The consent form has always said "you can withdraw from your account page".
  // There was no account page and auth.withdraw() had zero call sites, so the one
  // thing a participant is unconditionally entitled to do was unreachable. This
  // test exists so that cannot quietly become true again.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  await go(page, "/dashboard")
  await ready(page)
  t.check(
    "the dashboard offers a route to the account page",
    (await page.locator('[data-testid="account-link"]').count()) > 0,
  )

  await go(page, "/account")
  await ready(page)
  t.require(
    "the account page has a withdraw control",
    (await page.locator('[data-testid="withdraw-start"]').count()) > 0,
    page.url(),
  )

  await page.locator('[data-testid="withdraw-start"]').click()
  await page.waitForTimeout(400)
  t.check(
    "withdrawing asks for confirmation rather than firing on one click",
    (await page.locator('[data-testid="withdraw-confirm"]').count()) > 0,
  )

  await page.locator('[data-testid="withdraw-confirm"]').click()
  await page.waitForTimeout(2000)

  const me = await apiFromPage(page, "/api/auth/me")
  t.check("the server session is gone", me.status === 401, me)

  // With the RIGHT password, which is the only version of this worth asserting: a
  // withdrawn account must stay shut to the person who owns it, not merely to someone
  // guessing. 401 rather than the old 403 -- /session has one failure mode now, so a
  // withdrawal is indistinguishable from a wrong password and cannot be confirmed
  // back to whoever typed the SID.
  const back = await apiFromPage(page, "/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid, password: E2E_PASSWORD }),
  })
  t.check("a withdrawn SID cannot sign back in", back.status === 401, back)
  t.check("and the refusal does not reveal that they withdrew",
    back.body?.error === "bad_credentials", back.body)
  // Nor can they start over: create_account refuses a tombstoned SID outright.
  const again = await apiFromPage(page, "/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid, password: E2E_PASSWORD }),
  })
  t.check("and cannot sign up again to get around it", again.status === 409, again)

  await go(page, "/dashboard")
  await page.waitForTimeout(1500)
  t.check("and gated pages are closed to them", page.url().includes("/login"), page.url())
})

test("the consent form describes what its own buttons do", async (page, t) => {
  // It used to promise study-free use of COMPGame, then sign a declining student
  // out to the landing page; signing in again returned them straight to consent.
  const sid = freshSid()
  await signIn(page, sid)
  await ready(page)
  const html = await page.evaluate(() => document.body.innerText)

  t.check(
    "it no longer offers a study-free mode that does not exist",
    !/still use COMPGame to learn without taking part/i.test(html),
  )
  t.check(
    "it says plainly what declining means",
    /no separate version without it/i.test(html),
    html.slice(0, 200),
  )

  const notice = await page.locator("text=there is no separate version").boundingBox()
  const decline = await page.getByRole("button", { name: /no thanks/i }).boundingBox()
  t.check(
    "and says it above the decline button, not after it",
    notice && decline && notice.y < decline.y,
    { notice: notice?.y, decline: decline?.y },
  )
})

// ── the teacher surface ───────────────────────────────────────────────────────

const TEACHER_SID = "24E00399A" // matches backend/admin_sids.txt; high in the roster
                                // so freshSid() never allocates it out from under us

test("a student who finds /admin learns nothing from it", async (page, t) => {
  // The interesting case is not the teacher, it is everyone else. A student who
  // guesses this URL must get a refusal, not an empty table and not a stack trace.
  await fullSignIn(page, freshSid(), "NotATeacher")
  await go(page, "/admin")
  await page.waitForTimeout(2500)

  t.check("they get a plain refusal", (await page.locator('[data-testid="admin-denied"]').count()) > 0)
  t.check("no account list is rendered", (await page.locator('[data-testid="admin-list"]').count()) === 0)
  const html = await page.content()
  t.check("no other student's SID is on the page", !/24E00\d{3}A[\s\S]{0,40}Section/.test(html))
  t.check("and no stack trace leaks", !/Traceback|TypeError|undefined is not/i.test(html))

  // The page is only a door. The server is the lock, so ask it directly.
  const api = await apiFromPage(page, "/api/admin/participants")
  t.check("the API refuses them (403)", api.status === 403, api.status)
  t.check("and returns no participant data", !JSON.stringify(api.body ?? {}).includes("has_password"), api.body)
  const sect = await apiFromPage(page, "/api/admin/section", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid: TEACHER_SID, section: "A" }),
  })
  t.check("a student cannot move anyone between sections", sect.status === 403, sect.status)
})

test("a teacher can reset a lost password, and the class list still wins on sections", async (page, t) => {
  const student = freshSid()
  await fullSignIn(page, student, "Forgetful")

  // Same browser, different account: the teacher.
  // context.clearCookies(), NOT document.cookie: the session cookie is HttpOnly and
  // therefore invisible to page JS. Clearing from the page left the student session
  // standing, so /signup and /login both bounced the "teacher" straight back to the
  // dashboard and the test ground through three 30s locator timeouts before failing.
  await page.context().clearCookies()
  await signIn(page, TEACHER_SID)
  await giveConsent(page)
  await onboard(page, "Dr E2E")

  await go(page, "/admin")
  await page.waitForTimeout(2500)
  t.require("the teacher gets the page", (await page.locator('[data-testid="admin-list"]').count()) > 0, page.url())
  t.check("it counts the accounts", (await page.locator('[data-testid="admin-counts"]').count()) > 0)

  // The e2e fixture HAS a class list, so the section buttons must be inert and the
  // page must say why -- sign-in re-reads that file every time and would revert them.
  await page.locator('[data-testid="admin-search"]').fill(student)
  await page.waitForTimeout(600)
  await page.locator('[data-testid="admin-manage"]').first().click()
  await page.waitForTimeout(500)
  const sectionBtn = page.locator('[data-testid="admin-section"]').first()
  t.check("section buttons are disabled while a roster is configured",
    await sectionBtn.isDisabled().catch(() => false))
  t.check("and the page explains why rather than just greying out",
    /class list is configured/i.test(await page.locator("body").innerText()))

  // The reset is the whole reason this panel exists: there is no self-serve path.
  await page.locator('[data-testid="admin-newpw"]').fill("reset-passw0rd")
  await page.locator('[data-testid="admin-reset"]').click()
  await page.waitForTimeout(2000)
  const note = await page.locator('[data-testid="admin-note"]').innerText().catch(() => "")
  t.check("the new password is shown to the teacher once", /reset-passw0rd/.test(note), note.slice(0, 160))
  t.check("and it says to pass it on now", /tell them now/i.test(note))

  t.check("the change is in the audit log",
    /reset_password/.test(await page.locator('[data-testid="admin-audit"]').innerText().catch(() => "")))

  // The proof is at the door, not in the log: the OLD password must stop working.
  const ctx = await page.context().browser().newContext()
  const fresh = await ctx.newPage()
  await logIn(fresh, student)                    // logIn uses E2E_PASSWORD -- the old one
  t.check("the student's old password no longer works", fresh.url().includes("/login"), fresh.url())
  await ctx.close()
})
