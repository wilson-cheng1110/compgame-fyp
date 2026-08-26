// THE HAPPY PATH: a student who does everything right, start to finish.
//
// This is the journey docs/revamp.md Part 2 describes, driven through a real browser:
//
//   landing -> sign in -> consent -> onboarding -> dashboard -> topic unit
//           -> brief -> pre-check -> probe -> game -> post-check -> probe -> tutor -> done
//
// The step ORDER is the independent variable — the server assigns FLIP or CONTROL per
// topic — so the test reads the arm off the API and asserts that the ACTIVITY step
// really did fall before the second check under FLIP, and after it under CONTROL.

import { test, T, go, ready, signIn, giveConsent, onboard, apiFromPage, freshSid } from "./lib.mjs"

test("landing page invites a student in", async (page, t) => {
  await go(page, "/")
  await ready(page, 1500)
  const html = await page.content()

  t.check("names the actual course", /Human.Computer Interaction/i.test(html))
  t.check(
    "does NOT still say 'Computer Science journey'",
    !/computer science journey/i.test(html),
  )
  t.check("has a sign-in call to action", /sign in/i.test(html))
  t.check(
    "no dead /signup links (sign-up was retired)",
    !(await page.locator('a[href="/signup"]').count()),
  )
})

test("sign in -> consent -> onboarding -> dashboard", async (page, t) => {
  const sid = freshSid()

  const afterLogin = await signIn(page, sid)
  t.require("an enrolled SID reaches consent", afterLogin.includes("/consent"), afterLogin)

  // The consent gate must come BEFORE anything is recorded (Part 15). Typing
  // /dashboard must not land there. It is allowed to route via onboarding — what
  // matters is that an un-consented student never ends up ON the dashboard.
  await go(page, "/dashboard")
  await page.waitForTimeout(2500)
  t.check("un-consented student never reaches the dashboard", !page.url().endsWith("/dashboard"), page.url())

  await go(page, "/consent")
  await ready(page, 1500)
  t.require("consent recorded", await giveConsent(page))
  t.check("consent leads to onboarding", page.url().includes("/onboarding"), page.url())

  // THE REGRESSION. This exact hop was an unbreakable loop on 2026-08-21: the
  // avatar page read `needsOnboarding` off a cookie nothing wrote, bounced to
  // /dashboard, which then deleted the cookie and bounced back to /login.
  const end = await onboard(page, "E2E Student")
  t.require("onboarding completes and lands on the dashboard", end.includes("/dashboard"), end)

  const me = await apiFromPage(page, "/api/auth/me")
  t.check("server has the profile, not just the cookie", me.body?.username === "E2E Student", me.body)
  t.check("server no longer wants onboarding", me.body?.needsOnboarding === false, me.body)
})

test("dashboard shows the journey in lecture order", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)
  await go(page, "/dashboard")
  await page.waitForTimeout(2500)

  const journey = await apiFromPage(page, "/api/topics")
  t.require("journey loads", journey.status === 200, journey.status)
  t.check("13 topics", journey.body?.topics?.length === 13, journey.body?.topics?.length)

  const orders = journey.body.topics.map((x) => x.order)
  t.check("returned in order", orders.every((o, i) => i === 0 || o >= orders[i - 1]), orders)

  const body = await page.content()
  t.check("the page renders topic titles", /Weber|Gestalt|Fitts/i.test(body))
  t.check("state is shown as words, not colour alone", /Locked|Open|Done|Late/i.test(body))

  const open = journey.body.topics.filter((x) => x.state === "open")
  t.require(
    "at least one topic is OPEN — otherwise the unit cannot be tested",
    open.length > 0,
    "run backend/make_e2e_schedule.py and point TOPIC_SCHEDULE_PATH at it",
  )
  t.note(`open now: ${open.map((o) => o.topic_id).join(", ")}`)
})

test("a full topic unit, in the arm the server assigned", async (page, t) => {
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic WITH an item bank exists", !!topic, "needed for the check steps")
  t.note(`topic=${topic.topic_id} arm=${topic.arm} plays_game_first=${topic.plays_game_first}`)

  // Diagnostic for the intermittent "Loading…" hang: did the page even ASK for the
  // journey? No request at all means the effect never fired; a request with no
  // response means the API stalled. The two have different fixes.
  let journeyReqs = 0
  let journeyRes = 0
  page.on("request", (r) => { if (r.url().includes("/api/topics")) journeyReqs++ })
  page.on("response", (r) => { if (r.url().includes("/api/topics")) journeyRes++ })

  await go(page, `/topics/${topic.topic_id}`)
  // Wait for the unit to actually render rather than sleeping and hoping. A fixed
  // timeout here is how this test failed twice while the app was fine.
  const counter = page.locator('[data-testid="step-counter"]')
  await counter.waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
  const diag = await page.evaluate(() => {
    const main = document.querySelector("main") || document.body
    const reactKeys = Object.keys(main).filter((k) => k.startsWith("__react"))
    return {
      readyState: document.readyState,
      hydrated: reactKeys.length > 0,
      nextFlight: typeof self.__next_f !== "undefined" ? self.__next_f.length : -1,
      scripts: document.querySelectorAll("script").length,
      bodyStart: (document.body.innerText || "").slice(0, 40),
    }
  }).catch((e) => ({ evalFailed: String(e).slice(0, 80) }))

  t.require("the unit opens (step counter rendered)", await counter.count() > 0, {
    journeyRequests: journeyReqs,
    journeyResponses: journeyRes,
    diag,
    url: page.url(),
    snippet: (await page.content()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200),
  })

  // The rendered step order must match the assigned arm. FLIP plays the game before
  // the post-check; CONTROL plays it after. Getting this backwards would silently
  // invert the experiment.
  const stepLine = await page.locator("text=/Step \\d+ of \\d+/").first().textContent()
  t.check("a step counter is shown", /Step \d+ of \d+/.test(stepLine ?? ""), stepLine)

  const total = Number((stepLine ?? "").match(/of (\d+)/)?.[1] ?? 0)
  t.check("the unit has more than the brief alone", total >= 4, total)

  // Walk it. Each step is either a button we press or a form we fill.
  let guard = 0
  const seen = []
  while (guard++ < 14) {
    const html = await page.content()
    const label = (await page.locator("text=/Step \\d+ of \\d+/").first().textContent()) ?? ""
    seen.push(label.replace(/\s+/g, " ").trim())

    if (/Your answers are saved and this topic is complete/i.test(html)) break

    // Short-answer probe
    const probe = page.locator('[data-testid="probe-answer"]')
    if (await probe.count()) {
      await probe.fill(
        "It is the ratio that matters rather than the fixed amount you add, so a bigger starting value needs a bigger change before anyone notices it.",
      )
      await page.locator('[data-testid="probe-submit"]').first().click()
      await page.waitForTimeout(2200)
      const cont = page.getByRole("button", { name: /^Continue/ }).first()
      if (await cont.count()) { await cont.click(); await page.waitForTimeout(1500) }
      continue
    }

    // MC check: answer EVERY question (the submit button stays disabled and
    // relabelled "Answer all N to continue" until they are all in), then submit.
    const options = page.locator('[data-testid="mc-option"]')
    const n = await options.count()
    if (n) {
      for (let i = 0; i < n; i++) {
        const o = options.nth(i)
        if (await o.isEnabled().catch(() => false)) await o.click().catch(() => {})
      }
      const submit = page.locator('[data-testid="mc-submit"]').first()
      if (await submit.count()) {
        await submit.click()
        await page.waitForTimeout(2800)
        const cont = page.getByRole("button", { name: /^Continue$/ }).first()
        if (await cont.count()) { await cont.click(); await page.waitForTimeout(1500) }
        continue
      }
    }

    const next = page
      .getByRole("button", { name: /^(Start|Continue|Done reflecting|I've finished it — continue)$/ })
      .first()
    if (await next.count()) {
      await next.click()
      await page.waitForTimeout(1800)
      continue
    }
    break
  }

  t.note(`walked: ${seen.slice(0, 12).join(" -> ")}`)

  // THE INDEPENDENT VARIABLE, ASSERTED — not merely logged.
  // AUDIT 2026-08-21: this file's header claimed the test "checks the rendered steps
  // match the arm it was actually given". It did not. The only mention of `arm` was a
  // t.note(), which is a log line. A comment promising an invariant the code never
  // checks is worse than no comment: it stops the next person from adding the check.
  //
  //   FLIP    (plays_game_first) ... pre-check -> ACTIVITY -> post-check ...
  //   CONTROL                    ... pre-check -> post-check -> ACTIVITY ...
  //
  // Getting this backwards silently inverts the experiment for every student in that
  // arm, and nothing downstream would notice — the sink would faithfully record the
  // wrong thing.
  const labels = seen.map((x) => x.split("·").pop()?.trim() ?? "")
  const iActivity = labels.findIndex((l) => /Activity/i.test(l))
  const iSecond = labels.findIndex((l) => /Second check/i.test(l))

  if (t.check("the walk saw both the activity and the second check", iActivity >= 0 && iSecond >= 0, labels)) {
    t.check(
      topic.plays_game_first
        ? "FLIP: the activity came BEFORE the second check"
        : "CONTROL: the activity came AFTER the second check",
      topic.plays_game_first ? iActivity < iSecond : iActivity > iSecond,
      { arm: topic.arm, plays_game_first: topic.plays_game_first, iActivity, iSecond, labels },
    )
  }

  const events = await apiFromPage(page, "/api/topics")
  const after = events.body.topics.find((x) => x.topic_id === topic.topic_id)
  t.check("the pre-check was recorded", after?.pre_done === true, {
    pre_done: after?.pre_done, post_done: after?.post_done, complete: after?.complete,
  })
  t.check("the post-check was recorded", after?.post_done === true, {
    pre_done: after?.pre_done, post_done: after?.post_done,
  })
  t.check("the unit is marked complete", after?.complete === true, { complete: after?.complete })
})
