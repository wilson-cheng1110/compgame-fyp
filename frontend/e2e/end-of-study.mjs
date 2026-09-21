// THE END-OF-STUDY BATTERY — retention Form C + per-topic affect recall.
// backend/retention.py + components/end-of-study-battery.tsx.
//
// EXTRA SETUP this suite needs, beyond the usual three (README §Run it):
//
//   1. `QUESTIONNAIRES_ENABLED=1` on the running backend — the battery's affect_recall
//      half rides the same instrument mechanism every other questionnaire suite needs
//      on for (`longUnits` on the dashboard). Without it the battery never renders,
//      by design (same gate as demographics/feedback).
//   2. The end-of-study window forced OPEN. Generate the schedule with `--eos-open`:
//        python backend/make_e2e_schedule.py /tmp/sched.json --eos-open
//      This is OPT-IN and changes NOTHING for any other suite (see the flag's own
//      docstring) — every other suite keeps seeing the real, currently-future
//      (closed) 2026-11-23..26 window.
//   3. `E2E_SCHEDULE_PATH` pointed at that SAME file (default `/tmp/sched.json`,
//      matching the README's own example) — this suite also flips the window closed
//      and back open MID-RUN (via the schedule's own mtime hot-reload, the same
//      mechanism `schedule.set_session_date` uses in production) to prove the
//      battery is genuinely ABSENT when the window is shut. If the file cannot be
//      found this degrades gracefully: the "window closed" test is skipped with a
//      note rather than failing the whole suite over an environment mismatch.
//
// What this proves that `backend/tests/test_retention.py` cannot: the whole flow
// survives a real browser (React state, the two-phase per-topic wizard, the
// resumability skip), and the retention item payload — inspected over the actual
// network response, not through Python — carries no answer key.

import fs from "node:fs"
import {
  test, go, ready, signIn, giveConsent, onboard, apiFromPage, freshSid,
} from "./lib.mjs"

const SCHEDULE_PATH = process.env.E2E_SCHEDULE_PATH ?? "/tmp/sched.json"

function readSchedule() {
  return JSON.parse(fs.readFileSync(SCHEDULE_PATH, "utf8"))
}
function writeSchedule(cfg) {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(cfg, null, 2))
}
/** Flip the end-of-study window open/closed for every section, by editing the SAME
 *  schedule file the live backend reads (mtime hot-reload — no restart needed).
 *  Returns false (does nothing) if the file cannot be reached, so callers can degrade
 *  gracefully instead of throwing the whole suite into SETUP failure. */
function setEndOfStudyOpen(open) {
  let cfg
  try {
    cfg = readSchedule()
  } catch {
    return false
  }
  if (!cfg.end_of_study) return false
  const sections = Object.keys(cfg.sections ?? {})
  if (open) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    cfg.end_of_study.opens = Object.fromEntries(sections.map((s) => [s, yesterday]))
    cfg.end_of_study.closes_days_after = 30
  } else {
    const farFuture = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    cfg.end_of_study.opens = Object.fromEntries(sections.map((s) => [s, farFuture]))
  }
  try {
    writeSchedule(cfg)
    return true
  } catch {
    return false
  }
}

const scheduleWritable = setEndOfStudyOpen(true)

/** Complete one topic's pre- and post-check via the API (setup, not the thing under
 *  test — the pre/post-check path is already covered end-to-end by happy-path.mjs).
 *  Returns the topic_id it completed, or null if no bankable topic is open. */
async function completeATopic(page) {
  const journey = await apiFromPage(page, "/api/topics")
  const candidate = (journey.body?.topics ?? []).find(
    (t) => t.has_bank && (t.state === "open" || t.state === "late") && !t.complete,
  )
  if (!candidate) return null
  const topicId = candidate.topic_id

  for (const form of ["A", "B"]) {
    const got = await apiFromPage(page, `/api/topics/${topicId}/check/${form}`)
    if (got.status !== 200) return null
    const answers = {}
    for (const item of got.body.items) answers[item.id] = item.options[0].letter
    const posted = await apiFromPage(page, `/api/topics/${topicId}/check/${form}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
    if (posted.status !== 200) return null
  }
  return topicId
}

test("the end-of-study battery: served without the answer key, graded, recorded, one-submission", async (page, t) => {
  if (!scheduleWritable) {
    t.note(`E2E_SCHEDULE_PATH (${SCHEDULE_PATH}) not reachable — relying on --eos-open ` +
      "having been passed to make_e2e_schedule.py before the server started")
  }
  setEndOfStudyOpen(true)

  const sid = freshSid()
  const url = await signIn(page, sid)
  t.require("the student signs in", !url.includes("/login"), url)
  await giveConsent(page)
  await onboard(page)

  const topicId = await completeATopic(page)
  t.require("at least one bankable topic was open and got completed",
    !!topicId, "no open+banked topic — is the schedule generated with today-relative dates?")

  await go(page, "/dashboard")
  await ready(page, 2000)

  const prompt = page.locator('[data-testid="end-of-study-prompt"]')
  const promptShown = await prompt
    .waitFor({ state: "attached", timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  t.require("the end-of-study prompt appears once a topic is complete and the window is open",
    promptShown,
    "did the server actually launch with QUESTIONNAIRES_ENABLED=1 and the --eos-open schedule?")

  await prompt.locator('[data-testid="end-of-study-start"]').click()
  await ready(page, 800)
  t.check("the battery wizard renders", (await page.locator('[data-testid="end-of-study-battery"]').count()) === 1)
  t.check("it starts on the retention step",
    (await page.locator('[data-testid="end-of-study-retention"]').count()) === 1)

  // Inspect the retention payload over the REAL network response — no answer key.
  const ret = await apiFromPage(page, `/api/retention/${topicId}`)
  t.check("the retention GET is 200 (topic complete, window open, not yet submitted)",
    ret.status === 200, ret.status)
  const blob = JSON.stringify(ret.body ?? {})
  t.check("no `correct` field anywhere in the retention payload — the key never ships",
    !blob.includes('"correct"'), blob.slice(0, 300))
  t.check("options are relabelled a../d. sequentially (this student's own shuffle)",
    (ret.body?.items ?? []).every((it) =>
      it.options.map((o) => o.letter).join("") === it.options.map((_, i) => String.fromCharCode(97 + i)).join("")))

  await page.locator('[data-testid="retention-option"]').first().waitFor({ timeout: 8000 })
  const items = page.locator('[data-testid="retention-item"]')
  const nItems = await items.count()
  for (let i = 0; i < nItems; i++) {
    await items.nth(i).locator('[data-testid="retention-option"]').first().click()
  }
  await page.locator('[data-testid="retention-submit"]').click()
  await page.waitForTimeout(1200)
  t.check("a result (score out of total) is shown after submitting",
    (await page.locator('[data-testid="retention-continue"]').count()) === 1)

  await page.locator('[data-testid="retention-continue"]').click()
  await page.waitForTimeout(600)
  t.check("the affect-recall step renders next, on the SAME topic",
    (await page.locator('[data-testid="end-of-study-affect"]').count()) === 1)
  const affectItems = page.locator('[data-testid="affect-item"]')
  const groups = await affectItems.count()
  t.check("all 3 affect_recall items are shown", groups === 3, groups)
  for (let g = 0; g < groups; g++) {
    await affectItems.nth(g).locator('[data-testid="affect-option"]').first().click()
  }
  await page.locator('[data-testid="affect-submit"]').click()
  await page.waitForTimeout(1500)

  // Only one completed topic exists for this fresh student, so finishing its affect
  // step finishes the whole battery.
  const doneShown = await page
    .locator('[data-testid="end-of-study-done"]')
    .waitFor({ state: "attached", timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  t.check("the battery shows a completion state once every completed topic is walked", doneShown)

  const status = await apiFromPage(page, "/api/retention/_status")
  t.check("the terminal marker is recorded server-side", status.body?.done === true, status.body)

  const again = await apiFromPage(page, `/api/retention/${topicId}`)
  t.check("re-fetching the SAME topic's retention is refused (409) — one submission",
    again.status === 409, again.status)

  const qstatus = await apiFromPage(page, "/api/questionnaire/_status")
  t.check("affect_recall shows as a submitted instrument",
    (qstatus.body?.submitted ?? []).includes("affect_recall"), qstatus.body)

  // Reload the dashboard: the battery must not reappear.
  await go(page, "/dashboard")
  await ready(page, 1500)
  t.check("the battery prompt does not reappear after finishing it",
    (await page.locator('[data-testid="end-of-study-prompt"]').count()) === 0)
  t.check("and the battery wizard itself is gone too",
    (await page.locator('[data-testid="end-of-study-battery"]').count()) === 0)
})

test("the battery is ABSENT when the end-of-study window is closed", async (page, t) => {
  if (!scheduleWritable) {
    t.note("E2E_SCHEDULE_PATH not reachable — skipping the window-closed check " +
      "(cannot flip the live window from this process without it)")
    return
  }

  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)
  const topicId = await completeATopic(page)
  t.require("a topic was completed for the closed-window check", !!topicId)

  setEndOfStudyOpen(false)
  await page.waitForTimeout(300)   // let the mtime tick land before the next request

  const ret = await apiFromPage(page, `/api/retention/${topicId}`)
  t.check("the retention API refuses (403 not_open) while the window is closed",
    ret.status === 403 && ret.body?.error === "not_open", ret.body)

  await go(page, "/dashboard")
  await ready(page, 1500)
  t.check("the battery prompt does not render while the window is closed",
    (await page.locator('[data-testid="end-of-study-prompt"]').count()) === 0)

  // Restore the open window for any test that runs after this one.
  setEndOfStudyOpen(true)
})
