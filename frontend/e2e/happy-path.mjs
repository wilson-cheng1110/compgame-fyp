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

import { test, T, go, ready, signIn, giveConsent, onboard, fullSignIn, apiFromPage, freshSid, APP, grepBuild, passGatedStep } from "./lib.mjs"

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

    const next = page.getByRole("button", { name: /^(Start|Continue)$/ }).first()
    if (await next.count()) {
      await next.click()
      await page.waitForTimeout(1800)
      continue
    }
    // No Continue: this is a step WAITING on the activity, the assessment or the
    // tutor. See passGatedStep -- the self-declared "I've finished it" is gone.
    if (await passGatedStep(page, `/topics/${topic.topic_id}`)) continue
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
    const next = page.getByRole("button", { name: /Next sentence|Finish and review/i }).first()
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
    const next = page.getByRole("button", { name: /^(Start|Continue)$/ }).first()
    if (await next.count()) { await next.click(); await page.waitForTimeout(1600); continue }
    if (await passGatedStep(page, `/topics/${topic.topic_id}`)) continue
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

// ── stage 5: the polish sweep ─────────────────────────────────────────────────

/** One journey row, filled in with the fields the dashboard actually reads. */
function journeyRow(topic_id, order, over) {
  return {
    topic_id, order, session: order, state: "locked", arm: "FLIP",
    plays_game_first: true, has_bank: true, lecture_terms: [],
    session_provisional: false, opens: null, closes: null, late: false,
    pre_done: false, post_done: false, complete: false, ...over,
  }
}

test("an overdue topic says it is overdue, and says it is still open", async (page, t) => {
  // Stubbed, not seeded. The three states this asserts -- late, locked-far-out and
  // open -- cannot coexist for one student under a real schedule, and the year half
  // of it is invisible until the run crosses a year boundary. The stub is the only
  // way to see all three at once; the shape is lib/api.ts's JourneyTopic.
  const nextYear = new Date().getFullYear() + 1
  await page.route("**/api/topics", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        section: "A",
        telemetry_enabled: true,
        topics: [
          journeyRow("norman", 1, {
            state: "late",
            late: true,
            opens: "2026-09-01T00:00:00",
            closes: "2026-09-08T23:59:00",
          }),
          journeyRow("memory", 2, { opens: nextYear + "-03-04T00:00:00" }),
        ],
      }),
    }),
  )
  await fullSignIn(page, freshSid(), "Overdue")
  await go(page, "/dashboard")
  await page.waitForTimeout(1800)

  const body = await page.locator("body").innerText()
  t.check("the overdue row says it is still open", /Still open/i.test(body), body.slice(0, 400))
  t.check("and names the date it was due", /was due 8 Sep/.test(body))
  t.check("it no longer reads as a window that has closed", !/Until 8 Sep/.test(body))

  // The one topic the student is pushed toward used to render identically whether
  // it was due on Friday or three weeks ago.
  const card = await page.locator('a[href^="/topics/"]').first().innerText().catch(() => "")
  t.check("the Next up card admits the topic is overdue", /overdue since 8 Sep/i.test(card), card.slice(0, 300))
  t.check("and that it has not closed", /still open/i.test(card), card.slice(0, 300))

  // A date in a different year, with no year on it, is a date you cannot plan around.
  t.check("the far-off locked date carries its year", body.includes("4 Mar " + nextYear), body.slice(0, 600))
})

test("the first check acknowledges the submission instead of vanishing", async (page, t) => {
  await fullSignIn(page, freshSid(), "Ack")
  const unit = await openTopicId(page, t)
  await go(page, "/topics/" + unit)
  await page.waitForTimeout(1500)

  // Walk forward to the first MC check.
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-testid="mc-option"]').count()) break
    const next = page.getByRole("button", { name: /^(Start|Continue)$/ }).first()
    if (!(await next.count())) break
    await next.click()
    await page.waitForTimeout(1600)
  }
  t.require("reached the first check", (await page.locator('[data-testid="mc-option"]').count()) > 0)

  const cards = await page.locator('[data-testid="mc-option"]').count()
  for (let i = 0; i < cards; i++) await page.locator('[data-testid="mc-option"]').nth(i).click().catch(() => {})
  await page.locator('[data-testid="mc-submit"]').first().click()
  await page.waitForTimeout(2600)

  // The card explaining why the first check shows no score used to be torn down
  // 1.2s after it appeared: the one screen that answers "where is my score" was
  // the one screen nobody had time to read.
  const body = await page.locator("body").innerText()
  t.check("the submission is acknowledged", /recorded/i.test(body), body.slice(0, 300))
  t.check("and it explains the missing score", /No score yet/i.test(body))
  t.check("the student is not moved on for them", (await page.locator('[data-testid="pre-continue"]').count()) > 0)

  await page.locator('[data-testid="pre-continue"]').first().click()
  await page.waitForTimeout(2000)
  t.check("and Continue does move them on", !/No score yet/i.test(await page.locator("body").innerText()))
})

test("a failed assessment has a way back in", async (page, t) => {
  // The shuffle is pinned to the identity permutation -- Fisher-Yates with a random
  // that always picks the last index leaves the order untouched -- so the correct
  // option sits where the source puts it, index 0 for all six ergonomics items.
  // Clicking index 1 six times therefore scores exactly 0/6: the screen the audit
  // flagged, reached deterministically rather than hoped for.
  await page.addInitScript(() => {
    Math.random = () => 0.9999999
  })
  await fullSignIn(page, freshSid(), "Zero")
  await go(page, "/games/ergonomics-assessment")
  await page.waitForTimeout(1500)

  const start = page.getByRole("button", { name: /^Start$/ }).first()
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(700)
  }

  for (let q = 0; q < 6; q++) {
    const opts = page.locator(".max-w-xl.space-y-3 button")
    if (!(await opts.count())) break
    await opts.nth(1).click()
    await page.waitForTimeout(450)
    const on = page.getByRole("button", { name: /(Next →|See Results →)/ }).first()
    if (await on.count()) {
      await on.click()
      await page.waitForTimeout(550)
    }
  }
  await page.waitForTimeout(1800)

  const body = await page.locator("body").innerText()
  t.require("scored zero", /0%/.test(body) && /0\/6/.test(body), body.slice(0, 300))
  t.check("the banner still tells them to try again", /try again/i.test(body))
  t.check("and now there is something to try again WITH", (await page.locator('[data-testid="debrief-retry"]').count()) > 0)

  // The reflection dialog opens itself over the debrief. Assert it is dismissible
  // rather than pretending it is not there.
  const dialog = page.locator('[aria-label^="Reflect on"]')
  if (await dialog.count()) {
    await page.keyboard.press("Escape")
    await page.waitForTimeout(800)
    t.check("the reflection dialog does not trap them on the debrief", (await dialog.count()) === 0)
  } else {
    t.note("the reflection dialog did not open over the debrief")
    t.check("the reflection dialog does not trap them on the debrief", true)
  }
  await page.locator('[data-testid="debrief-retry"]').first().click()
  await page.waitForTimeout(3000)
  t.check("it lands back in the assessment", page.url().includes("/games/ergonomics-assessment"), page.url())
  t.check(
    "and the game restarted rather than redisplaying the old result",
    !/0\/6/.test(await page.locator("body").innerText()),
  )
})

test("the gestalt menu reads as five buttons, not five lines of text", async (page, t) => {
  await fullSignIn(page, freshSid(), "Affordance")
  await go(page, "/games/gestalt-understanding")
  await page.waitForTimeout(2500)

  const items = page.locator('[data-testid="principle-button"]')
  t.require("all five principles are on screen", (await items.count()) === 5, await items.count())

  const box = await items.first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { border: s.borderTopWidth, bg: s.backgroundColor, pad: s.paddingTop }
  })
  t.check("they carry a visible edge", parseFloat(box.border) > 0, box)
  t.check("and a filled surface, not the panel behind them", box.bg !== "rgba(0, 0, 0, 0)" && box.bg !== "transparent", box)
  t.check("with real hit area around the label", parseFloat(box.pad) > 0, box)

  // The Controls card described a keyboard mode the game has never had: the only
  // keydown listener in either gestalt file is the audio unlock.
  const shell = await page.locator("body").innerText()
  t.check("the Controls card no longer promises arrow keys", !/Arrow keys/i.test(shell))
})

/** Every asset a game reaches for, now that they all live in this repo. */
const SHIPPED_ASSETS = [
  ["the click the gestalt games play", "/click.mp3", "audio"],
  ["the menu music", "/audio/menu-music.mp3", "audio"],
  ["the correct sting", "/audio/correct.mp3", "audio"],
  ["the wrong sting", "/audio/wrong.mp3", "audio"],
  ["the congratulations sting", "/audio/congratulations.mp3", "audio"],
  ["the rolling loop", "/audio/rolling.mp3", "audio"],
  ["the Fitts play background", "/images/games/fitts-background.png", "image"],
  ["the Fitts menu background", "/images/games/fitts-menu-background.png", "image"],
  ["the fish both Fitts modules use", "/images/games/fitts-fish-a.png", "image"],
  ["the distance module's second fish", "/images/games/fitts-distance-fish-b.png", "image"],
  ["the size module's second fish", "/images/games/fitts-size-fish-b.png", "image"],
  ["the Gestalt symmetry figure", "/images/games/gestalt-symmetry-question.png", "image"],
  ["the Gestalt continuity figure", "/images/games/gestalt-continuity-question.png", "image"],
  ["its answer figure", "/images/games/gestalt-continuity-answer.png", "image"],
  ["the Gestalt closure figure", "/images/games/gestalt-closure-question.png", "image"],
  ["the avatars the dashboard draws", "/images/avatar_1.png", "image"],
  ["the second avatar", "/images/avatar_2.png", "image"],
  ["the logo the game shell draws", "/images/logo.png", "image"],
]

test("every asset the games ask for is actually shipped", async (page, t) => {
  // `new Audio("/click.mp3")` in five gestalt files once pointed at a file that was
  // not in public/. Nothing throws on a 404 there -- the click was simply silent,
  // which is the same shape as the assets-400 deploy bug this suite exists to catch.
  // The images had the opposite problem: they WERE served, by someone else's host.
  await go(page, "/")
  for (const [label, path, kind] of SHIPPED_ASSETS) {
    const res = await page.request.get(APP + path)
    const type = res.headers()["content-type"] ?? ""
    t.check(`${label} is served`, res.status() === 200, { path, status: res.status() })
    // A 200 is not enough on its own: a misrouted path can return the HTML shell,
    // and an <img> pointed at that shows a broken icon while the status looks fine.
    t.check(`${label} is really ${kind === "audio" ? "audio" : "an image"}`,
      type.startsWith(kind + "/"), { path, type })
  }
})

test("no game asset is fetched from a third party any more", async (page, t) => {
  // 21 references across 12 files pointed at a v0 blob host nobody here controls.
  // Three of the thirteen assets turned out to be byte-identical to files already
  // sitting in public/images -- the app was going over the network for its own
  // avatars and its own logo. If that host goes away, 26 games render empty, and
  // nothing in the build would have told us.
  const hits = await grepBuild("public.blob.vercel-storage.com")
  t.check("the built bundle names no external asset host", hits.length === 0, hits.slice(0, 3))
})

test("the built bundle hardcodes no API origin", async (page, t) => {
  // THE DEPLOY FOOTGUN, made impossible to fire by omission. NEXT_PUBLIC_API_BASE is
  // inlined at BUILD time. A bundle built with an absolute `http://localhost:8080`
  // deploys to a real host, serves every page with a 200, and then does nothing at
  // all -- no data, no error, nothing in any log. It is the failure most likely to
  // survive a smoke test and reach students.
  //
  // The browser now calls a RELATIVE /api/... which next.config.mjs rewrites to
  // loopback, so the shipped bundle should name no origin whatsoever. Server-side
  // callers (app/topics/[topicId]/page.tsx, app/api/export-data/route.ts) still use an
  // absolute loopback URL and are correct to -- they run on the server, where a
  // relative URL has no origin to resolve against -- but they are not in the client
  // bundle, which is what grepBuild reads.
  for (const origin of ["localhost:8080", "127.0.0.1:8080"]) {
    const hits = await grepBuild(origin)
    t.check(`the client bundle names no ${origin}`, hits.length === 0, hits.slice(0, 3))
  }
})

test("onboarding counts to the number of screens it actually has", async (page, t) => {
  await signIn(page, freshSid())
  await giveConsent(page)
  t.require("landed on the avatar step", page.url().includes("/onboarding/avatar"), page.url())
  t.check("step 1 of 3", /step 1 of 3/i.test(await page.locator("body").innerText()))

  await page.getByRole("button", { name: "Continue", exact: true }).first().click()
  await page.waitForTimeout(2400)
  t.require("landed on the username step", page.url().includes("/onboarding/username"), page.url())
  t.check("step 2 of 3", /step 2 of 3/i.test(await page.locator("body").innerText()))

  await page.locator('input[type="text"]').first().fill("Counter")
  await page.getByRole("button", { name: "Continue", exact: true }).first().click()
  await page.waitForTimeout(2800)
  t.require("landed on the baseline step", page.url().includes("/onboarding/baseline"), page.url())
  t.check("step 3 of 3 -- and the two before it now agree with it", /step 3 of 3/i.test(await page.locator("body").innerText()))

  // The baseline is the study's own pre-measure, and at zero answered the PRIMARY
  // button was an invitation to skip the whole instrument. Skipping stays possible;
  // it is just no longer what the page recommends.
  const submit = page.locator('[data-testid="baseline-submit"]').first()
  await submit.waitFor({ timeout: 15000 })
  const label0 = await submit.innerText()
  t.check("the skip does not name a remainder that does not exist", !/Skip the rest/.test(label0), label0)
  t.check("it says what it actually does", /Skip these questions/.test(label0), label0)
  const class0 = (await submit.getAttribute("class")) ?? ""
  t.check("and it is not the page's primary action", !class0.includes("u-btn-primary"), class0)

  await page.locator('[data-testid="baseline-item"]').first().locator('[data-testid="baseline-option"]').first().click()
  await page.waitForTimeout(500)
  const class1 = (await submit.getAttribute("class")) ?? ""
  t.check("answering one brings the primary action back", class1.includes("u-btn-primary"), class1)
})

test("the in-game button names the screen it actually opens", async (page, t) => {
  // Six understanding games shipped a "Take Assessment" that calls setPhase
  // ("debrief"). It has never opened an assessment, and since stage 3 the debrief
  // does not offer one inside a unit either, so the label had become a dead end.
  await fullSignIn(page, freshSid(), "Label")
  await go(page, "/games/language-understanding")
  await page.waitForTimeout(2000)

  const start = page.getByRole("button", { name: /Disambiguate/i }).first()
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(700)
  }

  let lastLabel = ""
  let sawLie = false
  for (let i = 0; i < 14; i++) {
    if (await page.locator('[data-testid="debrief-cta"]').count()) break
    if (/Take Assessment/i.test(await page.locator("body").innerText())) sawLie = true

    const adv = page.getByRole("button", { name: /(Next sentence|Finish and review|Take Assessment)/i }).first()
    if (await adv.count()) {
      lastLabel = (await adv.innerText()).trim()
      await adv.click()
      await page.waitForTimeout(700)
      continue
    }

    // No advance button yet, so the sentence still needs an answer. Only an ENABLED
    // option can be clicked: picking one disables the whole set, and the first cut of
    // this test kept clicking a dead element until the 30s timeout.
    const opts = page.locator(".max-w-xl.space-y-3 button")
    const n = await opts.count()
    let clicked = false
    for (let k = 0; k < n; k++) {
      if (await opts.nth(k).isEnabled().catch(() => false)) {
        await opts.nth(k).click()
        clicked = true
        break
      }
    }
    if (!clicked) break
    await page.waitForTimeout(600)
  }

  t.check("no screen in the game still says Take Assessment", !sawLie)
  t.check("the last in-game button names the debrief it opens", /Finish and review/i.test(lastLabel), lastLabel)
  t.check("and it does open the debrief", (await page.locator('[data-testid="debrief-cta"]').count()) > 0)
})


test("the unit cannot be walked past the activity without opening it", async (page, t) => {
  // THE HOLE THIS CLOSES. The activity step used to carry an always-enabled
  // "I've finished it — continue", under a line that said you could carry on
  // either way. One click and a student had "completed" the treatment without
  // seeing it -- and `played_understanding_first`, the independent variable, would
  // have recorded that it happened. Over 13 topics and 300 students that is not a
  // UX blemish, it is the study measuring nothing.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)
  const url = `/topics/${topic.topic_id}`
  await go(page, url)
  await ready(page, 1500)

  // Walk until the activity step. Checks and probes still advance normally --
  // this change gates the ACTIVITY, not the instruments.
  let reached = false
  for (let i = 0; i < 10 && !reached; i++) {
    if (await page.locator('[data-testid="game-observed"]').count()) { reached = true; break }
    const probe = page.locator('[data-testid="probe-answer"]')
    if (await probe.count()) {
      await probe.fill("The ratio is what matters, not the fixed amount added.")
      await page.locator('[data-testid="probe-submit"]').first().click()
      await page.waitForTimeout(2200)
    }
    const options = page.locator('[data-testid="mc-option"]')
    const n = await options.count()
    for (let k = 0; k < n; k++) await options.nth(k).click().catch(() => {})
    const submit = page.locator('[data-testid="mc-submit"]').first()
    if (await submit.count()) { await submit.click(); await page.waitForTimeout(2600) }
    // PREFIX, not exact: the probe step's button is "Continue →". An exact /^Continue$/
    // silently matches nothing there and the walk stalls on step 3 forever.
    const cont = page.getByRole("button", { name: /^(Start|Continue)/ }).first()
    if (await cont.count()) { await cont.click(); await page.waitForTimeout(1600) }
  }
  t.require("the walk reached the activity step", reached, page.url())

  const body = await page.locator("body").innerText()
  t.check("the self-declared completion button is gone",
    !/I've finished it|Done reflecting/i.test(body), body.slice(0, 200))
  t.check("and there is no Continue to press yet",
    (await page.getByRole("button", { name: /^Continue$/ }).count()) === 0)
  t.check("and no escape is offered to someone who has not been there",
    (await page.locator('[data-testid="unit-carry-on"]').count()) === 0)
  t.check("the step says what will open it",
    /records that you got to the end/i.test(body), body.slice(0, 300))

  // Go and try. The escape is for the student whose game died, so it has to be
  // reachable AFTER an attempt -- in FLIP the activity sits between the two
  // checks, and a dead end there would cost the post-check of stuck FLIP students
  // and none of CONTROL's, which is differential attrition by condition.
  await page.getByRole("button", { name: /^Open the activity/ }).first().click()
  await page.waitForTimeout(2500)
  t.check("Open the activity actually opens the game", page.url().includes("/games/"), page.url())
  await go(page, url)
  await ready(page, 1500)

  const carry = page.locator('[data-testid="unit-carry-on"]').first()
  t.check("after a genuine attempt the escape appears", (await carry.count()) === 1)

  // A skip that is RECORDED is data the analysis can flag or drop; a skip that
  // looks identical to a completion is contamination. Watch the wire rather than
  // the sink: /api/research/summary returns counts only ({total_events,
  // participants}) and cannot tell you WHICH event landed, so the request body is
  // the only place the event type is actually visible.
  let logged = null
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/research/event")) {
      try {
        const b = JSON.parse(r.postData() || "{}")
        if (b.event_type === "activity_not_recorded") logged = b
      } catch { /* not ours */ }
    }
  })
  const before = (await apiFromPage(page, "/api/research/summary")).body?.total_events ?? 0

  await carry.click()
  await page.waitForTimeout(1800)
  t.check("and it moves the unit on",
    (await page.locator('[data-testid="game-observed"]').count()) === 0, page.url())
  t.check("taking the escape sends activity_not_recorded", !!logged, logged)
  t.check("tagged with the topic it happened on",
    logged?.topic_id === topic.topic_id, { got: logged?.topic_id, want: topic.topic_id })

  const after = (await apiFromPage(page, "/api/research/summary")).body?.total_events ?? 0
  t.check("and the sink accepted it", after > before, { before, after })
})


test("playing the activity opens the gate, without the escape", async (page, t) => {
  // THE OTHER HALF, and the one that must not be taken on trust. Gating Continue on
  // a real completion is only safe if a real completion actually arrives -- and the
  // path it travels is not obvious: the debrief calls markGameComplete, which writes
  // the student's local progress AND mirrors `understanding_complete` to the sink
  // with no telemetry guard, while TELEMETRY_ENABLED ships 0 pending the HSESC
  // amendment. If that mirror had been gated, this gate would be a WALL on the
  // default configuration and every student would meet it. Assert it, do not read it.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)
  const url = `/topics/${topic.topic_id}`
  t.note(`topic=${topic.topic_id} telemetry_enabled=${journey.body.telemetry_enabled}`)

  await go(page, url)
  await ready(page, 1500)

  // Walk to the activity step.
  let reached = false
  for (let i = 0; i < 10 && !reached; i++) {
    if (await page.locator('[data-testid="game-observed"]').count()) { reached = true; break }
    const probe = page.locator('[data-testid="probe-answer"]')
    if (await probe.count()) {
      await probe.fill("The ratio is what matters, not the fixed amount added.")
      await page.locator('[data-testid="probe-submit"]').first().click()
      await page.waitForTimeout(2200)
    }
    const options = page.locator('[data-testid="mc-option"]')
    const n = await options.count()
    for (let k = 0; k < n; k++) await options.nth(k).click().catch(() => {})
    const submit = page.locator('[data-testid="mc-submit"]').first()
    if (await submit.count()) { await submit.click(); await page.waitForTimeout(2600) }
    const cont = page.getByRole("button", { name: /^(Start|Continue)/ }).first()
    if (await cont.count()) { await cont.click(); await page.waitForTimeout(1600) }
  }
  t.require("reached the activity step", reached, page.url())

  // Actually play it. These are short state machines -- click the forward control
  // until the debrief appears. This is the one game surface the suite plays to the
  // END rather than merely mounting.
  let completion = null
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/research/event")) {
      try {
        const b = JSON.parse(r.postData() || "{}")
        if (b.event_type === "understanding_complete") completion = b
      } catch { /* not ours */ }
    }
  })

  await page.getByRole("button", { name: /^Open the activity/ }).first().click()
  await page.waitForTimeout(2200)
  let debrief = false
  for (let i = 0; i < 12 && !debrief; i++) {
    const txt = await page.locator("body").innerText().catch(() => "")
    if (/what you just experienced|understanding complete|assessment complete|key takeaway/i.test(txt)) { debrief = true; break }
    const fwd = page
      .getByRole("button", { name: /^(Continue|Next|Experience|Complete|Finish|See|Start|Try|Play|Got it|Apply|Explore)/i })
      .first()
    if (!(await fwd.count())) break
    await fwd.click().catch(() => {})
    await page.waitForTimeout(1300)
  }
  t.check("the activity reached its debrief", debrief, (await page.locator("body").innerText()).slice(0, 160))

  await go(page, url)
  await ready(page, 1800)
  const observed = await page.locator('[data-testid="game-observed"]').innerText().catch(() => "")
  t.check("the unit now says the activity is recorded", /We have your activity recorded/i.test(observed), observed)
  t.check("Continue is offered", (await page.locator('[data-testid="unit-continue"]').count()) === 1)
  t.check("and no escape is shown, because none is needed",
    (await page.locator('[data-testid="unit-carry-on"]').count()) === 0)

  // The SERVER agrees -- not just this browser's localStorage. That distinction is
  // the whole point: the paper reads game_done, the student's device does not.
  const after = await apiFromPage(page, "/api/topics")
  const row = after.body.topics.find((x) => x.topic_id === topic.topic_id)
  t.check("and the server recorded understanding_complete", row?.game_done === true,
    { game_done: row?.game_done })

  // HOW LONG, not just whether. Completion is binary; twenty seconds and eight
  // minutes were the same datum until this landed, and for a flip-learning claim
  // they are not the same treatment.
  //
  // Asserted on the WIRE. There is no per-participant read endpoint and adding one
  // to satisfy a test would put every student's event stream behind a URL, which is
  // a poor trade for an assertion the request body already answers.
  t.check("the activity reported how long it took, not just that it happened",
    typeof completion?.duration_ms === "number" && completion.duration_ms > 0, completion)
})


test("the end-of-unit battery, in whichever state it is deployed", async (page, t) => {
  // Covers BOTH configurations from one test, because both ship: questionnaires are
  // off by default pending the HSESC amendment, and on is what September needs. A
  // test that only ran in one of them would leave the other unverified on the day it
  // is switched.
  const sid = freshSid()
  await signIn(page, sid)
  await giveConsent(page)
  await onboard(page)

  const journey = await apiFromPage(page, "/api/topics")
  const on = journey.body?.questionnaires_enabled === true
  const topic = journey.body.topics.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic exists", !!topic)
  t.note(`questionnaires_enabled=${on}`)

  // The promised duration has to follow the deployment. 29 extra items roughly
  // doubles a unit, and opening the study by breaking a promise to a tired student
  // is the thing the shell was rebuilt to stop doing.
  await go(page, "/dashboard")
  await ready(page, 1500)
  const dash = await page.locator("body").innerText()
  t.check("the dashboard promises a time that matches the deployment",
    on ? /About 20 minutes/.test(dash) : /About 12 minutes/.test(dash),
    dash.match(/About \d+ minutes/)?.[0] ?? "(no time promised)")

  // Jump to the close step rather than re-walking a unit the suite already walks
  // twice: this test is about the battery, not the flow, and the flow has its own
  // tests. The unit resumes from this key by design (students close laptops).
  await go(page, `/topics/${topic.topic_id}`)
  await ready(page, 1200)
  await page.evaluate((id) => localStorage.setItem(`compgame:unit:${id}:step`, "close"), topic.topic_id)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)

  const form = page.locator('[data-testid="questionnaire"]')
  if (!on) {
    // The default. A disabled instrument must leave NO trace -- not a heading, not
    // an empty card, not a dead submit.
    t.check("with questionnaires off the close screen shows no form",
      (await form.count()) === 0)
    t.check("and no stray options are rendered",
      (await page.locator('[data-testid="q-option"]').count()) === 0)
    t.check("the student can still leave the unit",
      (await page.getByRole("button", { name: /Continue the path/ }).count()) > 0)
    return
  }

  t.check("the battery renders", (await form.count()) === 1)
  const opts = await page.locator('[data-testid="q-option"]').count()
  // 12 IMI + 8 CoI + 8 ARCS on a 5-point scale, plus 1 Paas on a 9-point.
  t.check("every item and every scale point is on screen", opts === 28 * 5 + 9, opts)

  const submit = page.locator('[data-testid="questionnaire-submit"]')
  t.check("submit is shut until every item is answered", await submit.isDisabled())
  t.check("and it says how many are left",
    /Answer all 29 remaining/.test(await submit.innerText()), await submit.innerText())

  // The scoring key must not travel. The pack is explicit that reverse items and
  // subscale membership are researcher-only: a student who can see M9 is reversed
  // is being told which way looks good.
  const html = await page.content()
  t.check("the reverse-scored items are not in the page", !/\bM9\b.*reverse|reverse.*\bM9\b/i.test(html))
  t.check("subscale names are not in the page", !/Interest \/ Enjoyment|Teaching Presence/i.test(html))

  // Answer everything: click the first option of each item's group.
  const groups = page.locator('[role="radiogroup"]')
  const n = await groups.count()
  for (let i = 0; i < n; i++) {
    await groups.nth(i).locator('[data-testid="q-option"]').first().click().catch(() => {})
  }
  await page.waitForTimeout(400)
  t.check("answering everything opens submit", !(await submit.isDisabled()),
    await submit.innerText())

  await submit.click()
  await page.waitForTimeout(2500)
  t.check("it acknowledges rather than vanishing",
    (await page.locator('[data-testid="questionnaire-done"]').count()) === 1)

  // One measurement occasion per topic. A second pass would silently double-weight
  // one participant.
  const again = await apiFromPage(page, "/api/questionnaire/paas", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { P1: 5 }, topic_id: topic.topic_id }),
  })
  t.check("a second submission for the same topic is refused", again.status === 409, again.status)
})
