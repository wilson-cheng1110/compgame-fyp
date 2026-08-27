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

import { test, T, go, ready, signIn, giveConsent, onboard, apiFromPage, freshSid, APP } from "./lib.mjs"

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

  // This test was named for the DASHBOARD and only ever checked the API payload,
  // so it passed while the page rendered topic-definitions.ts order and numbered
  // 01..13 by array index. Ten of the thirteen sat in the wrong place; Gestalt is
  // order 9 on the server and was shown as "02". Assert what the student sees.
  const rendered = await page.evaluate(() =>
    [...document.querySelectorAll("ol li, ol > a")]
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean))
  const expected = [...journey.body.topics].sort((a, b) => a.order - b.order)
  const titleOf = { "fitts-law": "Fitts", gestalt: "Gestalt", "hicks-law": "Hick",
    memory: "Miller", stroop: "Consistency", "webers-law": "Weber",
    norman: "Norman", "mental-model": "Mental Model", "problem-solving": "Problem Solving",
    "visual-perception": "Visual Perception", language: "Language",
    ergonomics: "Ergonomics", "experiment-design": "Experiment Design" }
  const positions = expected.map((tpc) =>
    rendered.findIndex((r) => r.includes(titleOf[tpc.topic_id])))
  t.check(
    "the list is rendered in the order the server releases them",
    positions.every((pos, i) => pos >= 0 && (i === 0 || pos > positions[i - 1])),
    { serverOrder: expected.map((x) => x.topic_id), positions },
  )
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
      // the assessment step reuses "Continue", so no new name is needed here
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
  const iAssess = labels.findIndex((l) => /Test yourself/i.test(l))
  const iSecond = labels.findIndex((l) => /Second check/i.test(l))

  // THE MEASUREMENT INVARIANT. The assessment is a scored task inside the unit, so it
  // must land AFTER the post-check in BOTH arms -- otherwise it sits between the two
  // checks and contaminates the pre->post gain, which is the primary DV. This is the
  // assertion that stops someone tidying the step order later.
  if (iAssess >= 0 && iSecond >= 0) {
    t.check(
      "the assessment comes AFTER the post-check (the measured window has closed)",
      iAssess > iSecond,
      { arm: topic.arm, iSecond, iAssess, labels },
    )
  }
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


test("the topic unit renders WITHOUT JavaScript", async (page, t) => {
  // The regression test for the whole "Loading…" saga. The unit used to be a client
  // component that fetched its own state, so its first meaningful render depended on
  // hydration — and when hydration did not happen the student got "Loading…" forever,
  // silently, with a 200 in the server log. It is a server component now.
  //
  // Disabling JavaScript is the only honest way to assert that: if the content is
  // there with JS off, hydration cannot be a single point of failure again.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const open = journey.body?.topics?.find((x) => x.state === "open")
  const locked = journey.body?.topics?.find((x) => x.state === "locked")
  t.require("an open and a locked topic exist", !!open && !!locked)

  const cookies = await page.context().cookies()
  const browser = page.context().browser()
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  await noJs.addCookies(cookies)
  const q = await noJs.newPage()

  try {
    await q.goto(`${APP}/topics/${open.topic_id}`, { waitUntil: "domcontentloaded" })
    const openText = (await q.locator("body").innerText()).replace(/\s+/g, " ")
    t.check("the OPEN unit has real content with JS off", /Step \d+ of \d+/.test(openText), openText.slice(0, 120))
    t.check("it is not stuck on Loading", !/^\s*Loading/.test(openText), openText.slice(0, 60))

    await q.goto(`${APP}/topics/${locked.topic_id}`, { waitUntil: "domcontentloaded" })
    const lockedText = (await q.locator("body").innerText()).replace(/\s+/g, " ")
    t.check("the LOCKED panel renders with JS off", /not open yet|opens on/i.test(lockedText), lockedText.slice(0, 120))
    t.check(
      "and it still refuses to show the unit",
      !/Step \d+ of \d+/.test(lockedText),
      lockedText.slice(0, 80),
    )
  } finally {
    await noJs.close()
  }
})


// ── the doors out of a game ───────────────────────────────────────────────────
// The unit runs  activity -> post-check -> assessment, and that order is what keeps
// the pre->post gain (the primary DV) clean. Every game shipped a button straight
// from the activity to the assessment, which let a student take a scored round
// BETWEEN the two checks through a door the unit never saw. These two tests hold the
// door shut inside a unit and hold it OPEN in free play -- the second half matters
// just as much, because deleting the button outright would also pass the first.

/** Pick an open topic to launch a game from. Any will do: the behaviour under test
 *  is driven by the ?unit= parameter, not by which topic it names. */
async function openTopicId(page, t) {
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" || x.state === "late")
  t.require("an open topic exists to launch a game from", !!topic)
  return topic.topic_id
}

test("a game opened from the unit points back at the unit, not past the post-check", async (page, t) => {
  await signIn(page, freshSid())
  await giveConsent(page)
  await onboard(page)
  const unit = await openTopicId(page, t)

  await go(page, `/games/gestalt-understanding?unit=${unit}`)
  await ready(page, 1600)

  const cta = page.locator('[data-testid="gestalt-learned"]')
  await cta.waitFor({ state: "visible", timeout: 15000 }).catch(() => {})
  t.require("the activity's finish button rendered", (await cta.count()) > 0, page.url())

  const label = (await cta.first().innerText()).replace(/\s+/g, " ").trim()
  t.check("it offers the unit, not a jump to the assessment", /Back to the unit/i.test(label), label)
  t.check("and the assessment shortcut is gone from it", !/Assessment/i.test(label), label)

  // The corner Exit -- shipped in 302253a and never covered by this suite until now.
  const exitHref = await page.locator('[data-testid="game-exit"]').first().getAttribute("href")
  t.check("the corner Exit points at the unit too", exitHref === `/topics/${unit}`, exitHref)

  await cta.first().click()
  await page.waitForTimeout(3000)
  t.check("pressing it lands back on the unit", page.url().includes(`/topics/${unit}`), page.url())

  // FREE PLAY MUST BE UNCHANGED. Without this, deleting the button would pass above.
  await go(page, "/games/gestalt-understanding")
  await ready(page, 1600)
  const free = (await page.locator('[data-testid="gestalt-learned"]').first().innerText())
    .replace(/\s+/g, " ")
    .trim()
  t.check("in free play it still hands them on to the assessment", /Assessment/i.test(free), free)
})

/** Click language-understanding through to its debrief. Chosen because it is the
 *  shortest of the twelve games that end in the SHARED debrief component, so this
 *  covers all twelve. */
async function walkToDebrief(page) {
  const start = page.getByRole("button", { name: /Disambiguate/i }).first()
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(600)
  }
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-testid="debrief-cta"]').count()) return true
    const next = page.getByRole("button", { name: /Next sentence|Take Assessment/i }).first()
    if (await next.count()) {
      await next.click()
      await page.waitForTimeout(700)
      continue
    }
    const reading = page.locator(".max-w-xl.space-y-3 button").first()
    if (await reading.count()) {
      await reading.click()
      await page.waitForTimeout(500)
      continue
    }
    break
  }
  await page.waitForTimeout(1200)
  return (await page.locator('[data-testid="debrief-cta"]').count()) > 0
}

test("the shared debrief withdraws the assessment jump inside a unit", async (page, t) => {
  await signIn(page, freshSid())
  await giveConsent(page)
  await onboard(page)
  const unit = await openTopicId(page, t)

  await go(page, `/games/language-understanding?unit=${unit}`)
  await ready(page, 1400)
  t.require("the game reaches its debrief", await walkToDebrief(page), page.url())

  t.check(
    "no jump to the assessment is offered inside a unit",
    (await page.locator('[data-testid="debrief-next-game"]').count()) === 0,
  )
  const back = page.locator('[data-testid="debrief-back"]').first()
  const backLabel = (await back.innerText()).replace(/\s+/g, " ").trim()
  t.check("the last button returns to the unit", /Back to the unit/i.test(backLabel), backLabel)

  await back.click()
  await page.waitForTimeout(3000)
  t.check("and it actually lands there", page.url().includes(`/topics/${unit}`), page.url())

  // FREE PLAY MUST BE UNCHANGED.
  await go(page, "/games/language-understanding")
  await ready(page, 1400)
  t.require("free play reaches the debrief too", await walkToDebrief(page), page.url())
  t.check(
    "in free play the assessment jump is still there",
    (await page.locator('[data-testid="debrief-next-game"]').count()) === 1,
  )
  const freeBack = (await page.locator('[data-testid="debrief-back"]').first().innerText())
    .replace(/\s+/g, " ")
    .trim()
  t.check("and the last button is still the dashboard", /Dashboard/i.test(freeBack), freeBack)
})


// ── the tutor keeps the step's promise ────────────────────────────────────────
// The tutor step tells a student the tutor "will push back with questions rather
// than hand you answers". It then pointed them at the floating widget, which POSTs
// /api/ask -- the endpoint that hands answers. The Socratic surface is
// ReflectionDialog (/api/socratic, turn floor, insight detection, transcript to the
// sink), mounted globally and opened by a `start-reflection` event.
//
// BOTH endpoints are STUBBED here. The invariant under test is WHICH endpoint each
// control calls, not what the model says -- and stubbing means this test is fast and
// still runs when Ollama is down, which it was for most of this suite's life.
test("the tutor step opens the Socratic surface, not the explain path", async (page, t) => {
  const socratic = []
  const ask = []
  await page.route("**/api/socratic", async (route) => {
    socratic.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "What would happen if you moved them apart?", sources: [], understood: false, counts: true }),
    })
  })
  await page.route("**/api/ask", async (route) => {
    ask.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ answer: "The key idea is **chunking**.", sources: [] }),
    })
  })

  await signIn(page, freshSid())
  await giveConsent(page)
  await onboard(page)
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => (x.state === "open" || x.state === "late") && x.has_bank)
  t.require("an open topic with an item bank exists", !!topic)

  await go(page, `/topics/${topic.topic_id}`)
  await ready(page, 1600)

  // The floating tutor must know which unit it is in. It only ever matched GAME ids,
  // so on /topics/<id> it showed "AI Teaching Assistant" and "Ask anything...".
  await page.locator('button[aria-label="Open AI tutor"]').click()
  await page.waitForTimeout(800)
  t.check("the floating tutor names the unit it is in",
    (await page.locator("text=/Studying:/").count()) > 0,
    await page.locator("div.fixed.bottom-20 span").first().innerText().catch(() => "?"))
  const greeting = await page.locator("div.fixed.bottom-20 div.whitespace-pre-wrap").first().innerText().catch(() => "")
  t.check("its greeting renders **bold** rather than printing the asterisks",
    (await page.locator("div.fixed.bottom-20 strong").count()) > 0 && !/\*\*/.test(greeting),
    greeting.slice(0, 120))
  await page.locator('button[aria-label="Open AI tutor"]').click()
  await page.waitForTimeout(300)

  // Walk to the tutor step.
  const submitted = new Set()
  for (let i = 0; i < 16; i++) {
    if (await page.locator('[data-testid="open-reflection"]').count()) break
    const counter = (await page.locator('[data-testid="step-counter"]').first().innerText().catch(() => "")).replace(/\s+/g, " ")
    const probe = page.locator('[data-testid="probe-answer"]')
    if (await probe.count()) {
      await probe.fill("Items sitting closer together read as one group, so spacing does the grouping.")
      await page.locator('[data-testid="probe-submit"]').first().click()
      await page.waitForTimeout(2200)
      const cont = page.getByRole("button", { name: /^Continue/ }).first()
      if (await cont.count()) { await cont.click(); await page.waitForTimeout(1400) }
      continue
    }
    const options = page.locator('[data-testid="mc-option"]')
    const n = await options.count()
    if (n && !submitted.has(counter)) {
      for (let k = 0; k < n; k++) await options.nth(k).click().catch(() => {})
      await page.locator('[data-testid="mc-submit"]').first().click().catch(() => {})
      await page.waitForTimeout(2600)
      submitted.add(counter)
      const cont = page.getByRole("button", { name: /^Continue$/ }).first()
      if (await cont.count()) { await cont.click(); await page.waitForTimeout(1400) }
      continue
    }
    const next = page.getByRole("button", { name: /^(Start|Continue|I've finished it — continue)$/ }).first()
    if (await next.count()) { await next.click(); await page.waitForTimeout(1600); continue }
    break
  }

  t.require("the walk reached the tutor step", (await page.locator('[data-testid="open-reflection"]').count()) > 0, page.url())
  const stepText = await page.evaluate(() => document.body.innerText)
  t.check("the step no longer sends them to the corner widget", !/bottom-right/i.test(stepText))

  await page.locator('[data-testid="open-reflection"]').click()
  await page.waitForTimeout(1000)
  t.require("it opens the reflection dialog", (await page.locator('[role="dialog"]').count()) > 0)

  // A reflection turn goes to the SOCRATIC endpoint.
  await page.locator('[role="dialog"] input').fill("Things placed close together get read as one group.")
  await page.locator('[role="dialog"] button[aria-label="Send"]').click()
  await page.waitForTimeout(2500)
  t.check("a reflection turn posts to /api/socratic", socratic.length === 1, { socratic, ask })
  t.check("and never to the explain path", ask.length === 0, { socratic, ask })
  const afterTurn = await page.locator('[role="dialog"]').innerText()
  t.check("the reflection floor advanced", /1\/3/.test(afterTurn), afterTurn.match(/\d\/3/)?.[0])

  // The way out of the loop goes to the EXPLAIN endpoint, and does not buy progress.
  t.require("a visible way out of the loop exists", (await page.locator('[data-testid="tell-me"]').count()) > 0)
  await page.locator('[data-testid="tell-me"]').click()
  await page.waitForTimeout(2500)
  t.check("'just tell me' posts to /api/ask", ask.length === 1, { socratic, ask })
  t.check("and not to the socratic path", socratic.length === 1, { socratic, ask })
  const afterTell = await page.locator('[role="dialog"]').innerText()
  t.check("the told answer is labelled as one", /Straight answer/i.test(afterTell), afterTell.slice(-200))
  t.check("being told does NOT advance the reflection floor", /1\/3/.test(afterTell), afterTell.match(/\d\/3/)?.[0])
  t.check("and the dialog renders **bold** too",
    (await page.locator('[role="dialog"] strong').count()) > 0 && !/\*\*/.test(afterTell))
})
