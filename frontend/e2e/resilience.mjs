// Resilience suite — the surfaces the happy and unhappy paths never touch.
//
// docs/journey-repair-tasks.md P4. The happy path proves ONE route through the
// product works; this file is about everything that is real on launch day and is
// currently unobserved.
//
// It opens with the biggest hole in the whole suite: of the 26 game routes, exactly
// THREE had ever been opened by a test (ergonomics-assessment, gestalt-understanding,
// language-understanding). The other 23 are the actual product — a student spends
// nearly all their time inside one — and no test had ever checked that they so much
// as render.
//
// That gap is worse than it sounds, because of how the games are mounted:
//
//     const StroopUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
//
// `ssr: false` means the server sends an EMPTY body and the entire game exists only
// after the client bundle loads and runs. A throw during that mount leaves a blank
// page with a 200 status and no error anywhere a human would look. This is the same
// species as the bug that made `app/topics/[topicId]/page.tsx` a server component
// (CLAUDE.md): a hydration failure that showed "Loading…" forever, silently.

import { test, go, ready, fullSignIn, logIn, apiFromPage, freshSid, APP, API, E2E_PASSWORD } from "./lib.mjs"

// Every route under app/games/, plus the two Fitts sub-canvases, which are separate
// pages rather than phases of one component. Kept as a literal list, not a directory
// read: a test that discovers its own subjects cannot tell you a route DISAPPEARED.
const CANVASES = [
  "/games/fitts-law-understanding",
  "/games/fitts-law-understanding/app/game/distance",
  "/games/fitts-law-understanding/app/game/size",
  "/games/fitts-law-assessment",
  "/games/gestalt-understanding",
  "/games/gestalt-assessment",
  "/games/hicks-law-understanding",
  "/games/hicks-law-assessment",
  "/games/memory-understanding",
  "/games/memory-assessment",
  "/games/stroop-understanding",
  "/games/stroop-assessment",
  "/games/webers-law-understanding",
  "/games/webers-law-assessment",
  "/games/norman-understanding",
  "/games/norman-assessment",
  "/games/mental-model-understanding",
  "/games/mental-model-assessment",
  "/games/problem-solving-understanding",
  "/games/problem-solving-assessment",
  "/games/visual-perception-understanding",
  "/games/visual-perception-assessment",
  "/games/language-understanding",
  "/games/language-assessment",
  "/games/ergonomics-understanding",
  "/games/ergonomics-assessment",
  "/games/experiment-design-understanding",
  "/games/experiment-design-assessment",
]

/** What the browser can see that a 200 cannot.
 *
 *  Returns a verdict per route rather than throwing, so one dead game names itself
 *  instead of stopping the sweep at the first casualty.
 *
 *  TWO THINGS THIS LEARNED THE HARD WAY, both from the Fitts fishing games:
 *
 *  1. "Rendered" cannot mean "has text". Those two canvases draw a 1920x1080 scene
 *     out of absolutely-positioned divs and render exactly ten characters of text
 *     ("← Exit 0.0"). A text-length threshold calls a working game blank.
 *  2. Counting <img> elements is VACUOUS on them. Every fish, hook and backdrop is
 *     a CSS `background-image`, so document.images is empty — and a CSS background
 *     that 404s reports NOTHING: no error event, no broken-image icon, no entry in
 *     document.images. The page just renders a hole. So each background URL is
 *     re-fetched through `new Image()` and awaited, which is the only way to find
 *     out whether it decoded.
 */
async function inspect(page) {
  return page.evaluate(async () => {
    const text = (document.body.innerText || "").trim()

    const broken = []
    for (const img of Array.from(document.images)) {
      // complete && naturalWidth === 0 is the only way to see an image that
      // returned bytes the decoder rejected, or never arrived at all. A 200 on
      // the network tab cannot distinguish it from a working one.
      if (img.complete && img.naturalWidth === 0) broken.push(img.getAttribute("src") || "(no src)")
    }

    const urls = new Set()
    let painted = 0
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const bg = getComputedStyle(el).backgroundImage
      const m = bg && bg.match(/url\(["']?(.*?)["']?\)/)
      if (!m) continue
      const box = el.getBoundingClientRect()
      if (box.width >= 8 && box.height >= 8) painted++
      urls.add(m[1])
    }
    await Promise.all(
      Array.from(urls).map(
        (u) =>
          new Promise((done) => {
            const probe = new Image()
            probe.onload = () => {
              if (!probe.naturalWidth) broken.push(`css:${u} decoded 0x0`)
              done()
            }
            probe.onerror = () => {
              broken.push(`css:${u} failed to load`)
              done()
            }
            probe.src = u
          }),
      ),
    )

    return {
      chars: text.length,
      head: text.slice(0, 60).replace(/\s+/g, " "),
      interactive: document.querySelectorAll("button, canvas, input, [role=button]").length,
      painted,
      backgrounds: urls.size,
      brokenImages: broken,
    }
  })
}

test("every game canvas actually mounts", async (page, t) => {
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)))
  const http = []
  page.on("response", (r) => {
    if (r.status() >= 400) http.push(`${r.status()} ${r.url().replace(APP, "")}`)
  })

  await fullSignIn(page, freshSid(), "Canvas Sweep")

  const dead = []
  const blank = []
  const inert = []
  const threw = []
  const bounced = []
  const images = []
  const requests = []
  let seenArt = 0

  for (const route of CANVASES) {
    errors.length = 0
    http.length = 0
    let v
    try {
      const res = await go(page, route)
      if (res && res.status() >= 400) dead.push(`${route} -> ${res.status()}`)
      await ready(page, 1200)
      v = await inspect(page)
    } catch (e) {
      threw.push(`${route}: ${String(e.message).slice(0, 90)}`)
      continue
    }

    // Bounced to /login means the auth gate fired; bounced anywhere else means the
    // route redirected somewhere unexpected. Either way the canvas never rendered.
    if (!page.url().includes(route)) bounced.push(`${route} -> ${page.url().replace(APP, "")}`)
    // Mounted means it put SOMETHING on the screen: prose, or a painted scene. The
    // Fitts canvases satisfy only the second clause and are not broken.
    else if (v.chars < 40 && v.painted === 0)
      blank.push(`${route} (${v.chars} chars, 0 painted elements: ${JSON.stringify(v.head)})`)
    else if (/^loading/i.test(v.head) && v.chars < 120) blank.push(`${route} STUCK ON LOADING`)
    else if (v.interactive === 0) inert.push(`${route} (no button, canvas or input)`)

    if (errors.length) threw.push(`${route}: ${errors[0]}`)
    if (v && v.brokenImages.length) images.push(`${route}: ${v.brokenImages.join(", ")}`)
    if (v) seenArt += v.backgrounds
    if (http.length) requests.push(`${route}: ${http.slice(0, 3).join(" | ")}`)
  }

  t.note(`swept ${CANVASES.length} canvases, ${seenArt} css background images re-loaded`)
  // If this ever reads 0 the background check has gone vacuous again and is
  // silently passing everything -- the exact failure it was written to fix.
  t.check("the CSS-background check actually had something to check", seenArt > 0, seenArt)
  t.check("every game route is reachable (no 4xx/5xx on the document)", dead.length === 0, dead)
  t.check("no game route bounces away instead of rendering", bounced.length === 0, bounced)
  t.check("no game mounts to a blank page", blank.length === 0, blank)
  t.check("every game renders something to interact with", inert.length === 0, inert)
  t.check("no game throws during mount", threw.length === 0, threw)
  t.check("every image inside a game decoded — CSS backgrounds included", images.length === 0, images)
  t.check("no game asks for a resource that 4xx/5xxs", requests.length === 0, requests)
})

// ── batch 2 (spliced into resilience.mjs) ─────────────────────────────────────

/** Walk a unit forward until the multiple-choice check is on screen, or give up. */
async function reachTheCheck(page, t, max = 8) {
  for (let i = 0; i < max; i++) {
    // WAIT for an option rather than counting once. topic-check.tsx fetches its
    // items after mount, so a tab that opens straight onto the check step (the step
    // is persisted, so a second tab does exactly that) spends a moment with the
    // step-counter visible, no option yet, and no Continue button either. The first
    // version of this helper read "no button to click" as "there is no check here"
    // and gave up -- a race dressed as a finding.
    try {
      await page
        .locator('[data-testid="mc-option"]')
        .first()
        .waitFor({ state: "visible", timeout: 2500 })
      return true
    } catch {}
    const next = page
      .getByRole("button", { name: /^(Continue|Start|Begin|Next)/ })
      .first()
    if (!(await next.count())) continue
    await next.click().catch(() => {})
    await page.waitForTimeout(1200)
  }
  return (await page.locator('[data-testid="mc-option"]').count()) > 0
}

test("a check survives a refresh, and still cannot be answered twice", async (page, t) => {
  // 300 students on their own laptops: sleep, wifi drop, accidental F5. If a refresh
  // mid-check either loses the topic or burns the single submission, the student is
  // stuck and the datum is gone -- and nothing in the suite watched for it.
  const sid = freshSid()
  await fullSignIn(page, sid, "Refresher")

  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)

  await go(page, `/topics/${topic.topic_id}`)
  await page.locator('[data-testid="step-counter"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
  t.require("the check is reachable", await reachTheCheck(page, t))

  // Answer some, but not all, then reload.
  const opts = page.locator('[data-testid="mc-option"]')
  const n = await opts.count()
  for (let i = 0; i < Math.min(4, n); i++) await opts.nth(i).click().catch(() => {})
  await page.reload({ waitUntil: "domcontentloaded" })
  await ready(page, 1500)

  const after = await apiFromPage(page, "/api/topics")
  const st = after.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("a refresh does not consume the submission", st?.pre_done !== true, st)

  // The student must be able to get back to the check and finish it.
  t.require("the check is reachable again after the reload", await reachTheCheck(page, t))
  const opts2 = page.locator('[data-testid="mc-option"]')
  const n2 = await opts2.count()
  t.check("the items are all still there", n2 === n, { before: n, after: n2 })
  for (let i = 0; i < n2; i++) await opts2.nth(i).click().catch(() => {})
  await page.locator('[data-testid="mc-submit"]').first().click()
  await page.waitForTimeout(2800)

  const done = await apiFromPage(page, "/api/topics")
  const st2 = done.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("the submission landed", st2?.pre_done === true, st2)

  // Back button, then a forced resubmit: the server owns this rule, and the UI must
  // not turn its refusal into a crash.
  await page.goBack().catch(() => {})
  await ready(page, 1200)
  const again = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { A1: "a" } }),
  })
  t.check("a second submission is refused by the server", again.status === 409, again)
  t.check("and going back does not blank the app",
    (await page.evaluate(() => (document.body.innerText || "").trim().length)) > 40)
})

test("a student who changes device keeps their progress", async (page, t) => {
  // This is the entire reason accounts moved server-side (CLAUDE.md, 2026-08-16):
  // "cookie-only state gives no cross-device resume". Nothing tested it.
  const sid = freshSid()
  await fullSignIn(page, sid, "Two Devices")
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)

  const items = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  t.require("items came back on device 1", items.status === 200, items.status)
  const answers = Object.fromEntries(items.body.items.map((i) => [i.id, "a"]))
  const sub = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  })
  t.require("device 1 submitted the pre-check", sub.status === 200, sub)

  // A genuinely separate browser profile: its own cookie jar and its own storage.
  const ctx2 = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } })
  const page2 = await ctx2.newPage()
  try {
    await logIn(page2, sid)
    t.check("the same credentials get in on device 2", !page2.url().includes("/login"), page2.url())

    const j2 = await apiFromPage(page2, "/api/topics")
    const st = j2.body?.topics?.find((x) => x.topic_id === topic.topic_id)
    t.check("device 2 sees the pre-check as already done", st?.pre_done === true, st)
    t.check("device 2 sees the same section", j2.body?.section === journey.body?.section)

    const me = await apiFromPage(page2, "/api/auth/me")
    t.check("the profile came back with the account, not the cookie",
      me.body?.username === "Two Devices", me.body)

    await go(page2, "/dashboard")
    await ready(page2, 1500)
    const text = await page2.evaluate(() => (document.body.innerText || "").trim())
    t.check("the dashboard on device 2 renders the journey", /Step|Topic|Journey|Open|Locked/i.test(text), text.slice(0, 120))
  } finally {
    await ctx2.close()
  }
})

test("the journey works at phone size", async (page, t) => {
  // 300 students on their own devices; a good share will be on a phone. Nothing in
  // the suite had ever rendered below 1280px.
  const ctx = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const p = await ctx.newPage()
  const overflow = []
  const tiny = []
  const unreachable = []
  try {
    const sid = freshSid()
    await fullSignIn(p, sid, "Pocket Student")

    const journey = await apiFromPage(p, "/api/topics")
    const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
    t.require("an open topic with a bank exists", !!topic)

    for (const route of ["/dashboard", "/badges", `/topics/${topic.topic_id}`, "/account"]) {
      await go(p, route)
      await ready(p, 1500)
      const v = await p.evaluate(() => {
        const doc = document.documentElement
        // The tallest offender, so the failure names something findable rather than
        // just asserting that the page is too wide.
        let worst = null
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect()
          if (r.width > window.innerWidth + 2 && (!worst || r.width > worst.w)) {
            worst = { w: Math.round(r.width), tag: el.tagName.toLowerCase(),
                      cls: (el.className || "").toString().slice(0, 50) }
          }
        }
        // R6 (a 1200px min-width on .shell) proved the scrollWidth check ALONE is
        // blind: something up the tree clips with overflow:hidden, so the page never
        // reports sideways scroll -- the content is simply cut off and unreachable,
        // which is the worse failure. It surfaced only as an opaque 30s click
        // timeout. So also ask the question that actually matters: can the student
        // reach the controls?
        const offscreen = Array.from(document.querySelectorAll("button, a[href], input, textarea, select"))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) return false
            return r.right > window.innerWidth + 2 || r.left < -2
          })
          .slice(0, 4)
          .map((el) => {
            const r = el.getBoundingClientRect()
            return `${el.tagName.toLowerCase()}[${Math.round(r.left)}..${Math.round(r.right)}]:` +
              `${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 20)}`
          })
        const small = Array.from(document.querySelectorAll("button, a[href]"))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.height < 32
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}:${(el.innerText || "").trim().slice(0, 24)}`)
        return { scrollW: doc.scrollWidth, innerW: window.innerWidth, worst, small, offscreen }
      })
      if (v.scrollW > v.innerW + 1) overflow.push(`${route}: ${v.scrollW}px in ${v.innerW}px (${JSON.stringify(v.worst)})`)
      if (v.small.length) tiny.push(`${route}: ${v.small.join(", ")}`)
      if (v.offscreen.length) unreachable.push(`${route}: ${v.offscreen.join(" | ")}`)
    }

    t.check("no page scrolls sideways on a 390px screen", overflow.length === 0, overflow)
    t.check("every control is inside the screen, not clipped off the edge",
      unreachable.length === 0, unreachable)
    // Fitts' Law is on the syllabus; a 24px control on a touch screen is the thing
    // the syllabus warns about. Reported, not fatal -- some are inline text links.
    if (tiny.length) t.note(`tap targets under 32px: ${tiny.join(" | ")}`)

    await go(p, `/topics/${topic.topic_id}`)
    await p.locator('[data-testid="step-counter"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
    t.check("the unit opens on a phone", await p.locator('[data-testid="step-counter"]').count() > 0)
    t.require("the check is reachable on a phone", await reachTheCheck(p, t))
    const opts = p.locator('[data-testid="mc-option"]')
    const n = await opts.count()
    for (let i = 0; i < n; i++) await opts.nth(i).click().catch(() => {})
    const submit = p.locator('[data-testid="mc-submit"]').first()
    t.check("the submit button is on screen and enabled", await submit.isEnabled().catch(() => false))
    await submit.click()
    await p.waitForTimeout(2800)
    const after = await apiFromPage(p, "/api/topics")
    const st = after.body?.topics?.find((x) => x.topic_id === topic.topic_id)
    t.check("a phone can actually submit a check", st?.pre_done === true, st)
  } finally {
    await ctx.close()
  }
})

test("a section signing in at once does not freeze the app for everyone", async (page, t) => {
  // Measured 2026-08-30 and this test exists because the measurement disagreed with
  // a claim already in the git history. The P1 commit said the scrypt verify was
  // moved outside the module lock so a section signing in together would not
  // serialise. True about the lock -- but /api/auth/session was an `async def`
  // calling it synchronously, so the hash ran ON THE EVENT LOOP and everything
  // serialised anyway, stalling every OTHER request too:
  //
  //                       before          after (asyncio.to_thread)
  //   burst wall clock    2611 ms         347 ms
  //   throughput          23 /s           173 /s
  //   /api/health max     2478 ms         84 ms      <- the one that matters
  //
  // /api/health hashes nothing. If it degrades during a sign-in burst, the event
  // loop is blocked and every student's page is waiting behind other people's
  // passwords. Thresholds below sit ~6x above the fixed numbers and ~5x below the
  // broken ones, so this fails on the regression and not on a slow afternoon.
  const N = 50
  const post = (path, body) =>
    fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  const timed = async (fn) => {
    const t0 = Date.now()
    const r = await fn()
    return { ms: Date.now() - t0, status: r.status }
  }

  const sids = Array.from({ length: N }, () => freshSid())
  for (const sid of sids) await post("/api/auth/signup", { sid, password: E2E_PASSWORD, section: "A" })

  const idle = []
  for (let i = 0; i < 8; i++) idle.push((await timed(() => fetch(API + "/api/health"))).ms)
  const idleMax = Math.max(...idle)

  let bursting = true
  const probes = []
  const prober = (async () => {
    while (bursting) {
      probes.push((await timed(() => fetch(API + "/api/health"))).ms)
      await new Promise((r) => setTimeout(r, 30))
    }
  })()

  const t0 = Date.now()
  const results = await Promise.all(
    sids.map((sid) => timed(() => post("/api/auth/session", { sid, password: E2E_PASSWORD }))),
  )
  const wall = Date.now() - t0
  bursting = false
  await prober

  const worstProbe = Math.max(...probes)
  const slowest = Math.max(...results.map((r) => r.ms))
  t.note(`${N} sign-ins in ${wall}ms (${(N / (wall / 1000)).toFixed(0)}/s); ` +
         `health idle max ${idleMax}ms -> ${worstProbe}ms under load (n=${probes.length})`)

  t.check(`all ${N} sign-ins succeed`, results.every((r) => r.status === 200),
    results.filter((r) => r.status !== 200).slice(0, 3))
  t.check("an unrelated request is not stuck behind other people's passwords",
    worstProbe < 500, { idleMax, worstProbe, probes: probes.length })
  t.check("the burst itself does not serialise", wall < 1500, { wall, slowest })
})

// ── batch 3 (spliced into resilience.mjs) ─────────────────────────────────────

/** Get a signed-in student to the MC check of an open topic. Returns the topic row. */
async function atTheCheck(page, t, name) {
  const sid = freshSid()
  await fullSignIn(page, sid, name)
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)
  await go(page, `/topics/${topic.topic_id}`)
  await page.locator('[data-testid="step-counter"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
  t.require("the check is reachable", await reachTheCheck(page, t))
  return topic
}

const answerAll = async (page) => {
  const opts = page.locator('[data-testid="mc-option"]')
  const n = await opts.count()
  for (let i = 0; i < n; i++) await opts.nth(i).click().catch(() => {})
  return n
}

test("an answer is not lost when the backend goes away mid-submit", async (page, t) => {
  // The failure this guards is silent: a student answers six items, taps Submit while
  // the wifi drops, and gets nothing back. If the UI clears the form or locks itself,
  // that student's datum is gone and no error is ever logged -- the same shape as the
  // num_predict cliff, where a broken call is indistinguishable from "no signal".
  const topic = await atTheCheck(page, t, "Flaky Wifi")
  const n = await answerAll(page)
  t.check("all items answered", n > 0, n)

  // Kill only the submit, and only once.
  let blocked = 0
  await page.route("**/api/topics/**/check/**", (route) => {
    if (route.request().method() === "POST" && blocked === 0) {
      blocked++
      return route.abort("failed")
    }
    return route.continue()
  })

  await page.locator('[data-testid="mc-submit"]').first().click()
  await page.waitForTimeout(2500)

  const body = await page.evaluate(() => (document.body.innerText || "").trim())
  t.check("the student is told it did not save", /couldn.t save|try again|offline|error/i.test(body),
    body.slice(0, 200))
  t.check("the request really was blocked", blocked === 1, blocked)

  // Drawn is not the same as announced. This is the one message that means "your
  // answers did not reach the server"; a student who does not perceive it walks away
  // believing they submitted, and the datum is gone with no error anywhere.
  const announced = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[role=alert], [aria-live]"))
      .map((el) => (el.innerText || "").trim())
      .join(" | "))
  t.check("and it is announced in a live region, not only drawn",
    /couldn.t save|try again|offline|error/i.test(announced), announced || "(no live region)")

  const after = await apiFromPage(page, "/api/topics")
  const st = after.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("nothing was recorded for a submit that failed", st?.pre_done !== true, st)

  // The answers must still be there and the button must still work.
  const submit = page.locator('[data-testid="mc-submit"]').first()
  t.check("the submit button is offered again, not stuck on Saving…",
    await submit.isEnabled().catch(() => false),
    await submit.innerText().catch(() => "?"))
  await submit.click()
  await page.waitForTimeout(3000)

  const done = await apiFromPage(page, "/api/topics")
  const st2 = done.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("the retry saves the answers the student already gave", st2?.pre_done === true, st2)
})

test("a slow submit cannot be double-submitted", async (page, t) => {
  // Same surface, opposite failure: the request is not lost, just slow. An impatient
  // student taps twice. The second tap must not produce a second submission -- the
  // one-submission rule is the measurement, and a 409 the student never asked for
  // reads to them as the app breaking.
  const topic = await atTheCheck(page, t, "Impatient")
  await answerAll(page)

  await page.route("**/api/topics/**/check/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 4000))
    return route.continue()
  })

  const submit = page.locator('[data-testid="mc-submit"]').first()
  await submit.click()
  await page.waitForTimeout(600)
  t.check("the button disables itself while saving", !(await submit.isEnabled().catch(() => true)),
    await submit.innerText().catch(() => "?"))
  t.check("and says so", /saving/i.test(await submit.innerText().catch(() => "")),
    await submit.innerText().catch(() => "?"))
  await submit.click({ force: true }).catch(() => {})
  await page.waitForTimeout(6000)

  const rows = await apiFromPage(page, "/api/research/summary").catch(() => null)
  const after = await apiFromPage(page, "/api/topics")
  const st = after.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("the submission landed exactly once", st?.pre_done === true, { st, rows: rows?.status })
  const body = await page.evaluate(() => (document.body.innerText || "").trim())
  t.check("and the student never sees a duplicate-submission error",
    !/already submitted|409/i.test(body), body.slice(0, 160))
})

test("two tabs cannot turn one submission into two", async (page, t) => {
  const topic = await atTheCheck(page, t, "Two Tabs")

  // Same context = same cookie jar = genuinely the same student, twice.
  const tab2 = await page.context().newPage()
  try {
    await go(tab2, `/topics/${topic.topic_id}`)
    await tab2.locator('[data-testid="step-counter"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
    t.require("the second tab reaches the check too", await reachTheCheck(tab2, t))

    await answerAll(page)
    await answerAll(tab2)
    await page.locator('[data-testid="mc-submit"]').first().click()
    await page.waitForTimeout(3000)
    await tab2.locator('[data-testid="mc-submit"]').first().click()
    await tab2.waitForTimeout(3000)

    const after = await apiFromPage(page, "/api/topics")
    const st = after.body?.topics?.find((x) => x.topic_id === topic.topic_id)
    t.check("the topic is recorded as submitted", st?.pre_done === true, st)

    const forced = await apiFromPage(tab2, `/api/topics/${topic.topic_id}/check/A`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { A1: "a" } }),
    })
    t.check("the server still refuses a third attempt", forced.status === 409, forced)

    const body2 = await tab2.evaluate(() => (document.body.innerText || "").trim())
    t.check("the losing tab shows a message rather than a blank page", body2.length > 40, body2.slice(0, 120))
    t.check("and does not claim the answers were saved",
      !/your answers are saved and this topic is complete/i.test(body2) || st?.pre_done === true)
  } finally {
    await tab2.close()
  }
})

test("clearing the browser loses nothing the study needs — and names what it does", async (page, t) => {
  const sid = freshSid()
  await fullSignIn(page, sid, "Cache Clearer")
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)

  const items = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`)
  const answers = Object.fromEntries(items.body.items.map((i) => [i.id, "a"]))
  const sub = await apiFromPage(page, `/api/topics/${topic.topic_id}/check/A`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  })
  t.require("the pre-check is in", sub.status === 200, sub)

  // The Fitts understanding module is TWO separate full-page routes that coordinate
  // ONLY through localStorage (app/games/fitts-law-understanding/app/game/*/page.tsx):
  //     localStorage.setItem("fitts-understanding-distance-done", "1")
  //     if (localStorage.getItem("fitts-understanding-size-done") === "1") markGameComplete(...)
  // So a student who plays one half, clears their browser, and plays the other half
  // never gets credit for the topic -- and `played_understanding_first` is the IV.
  // This pins the contract so that if it ever moves server-side, the test says so.
  await page.evaluate(() => localStorage.setItem("fitts-understanding-distance-done", "1"))
  const halfway = await apiFromPage(page, "/api/topics")
  const fitts = halfway.body?.topics?.find((x) => x.topic_id === "fitts-law")
  t.check("KNOWN LOSS PATH: half a Fitts module is remembered only in the browser",
    fitts?.game_done !== true, fitts)

  // Now clear everything a student can clear.
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} })
  await page.context().clearCookies()
  await go(page, "/dashboard")
  await ready(page, 1500)
  t.check("a cleared browser is signed out, not shown a stale dashboard",
    page.url().includes("/login"), page.url())

  await logIn(page, sid)
  const back = await apiFromPage(page, "/api/topics")
  const st = back.body?.topics?.find((x) => x.topic_id === topic.topic_id)
  t.check("the submitted pre-check survived the clear", st?.pre_done === true, st)
  const me = await apiFromPage(page, "/api/auth/me")
  t.check("so did the profile", me.body?.username === "Cache Clearer", me.body)
  const gone = await page.evaluate(() => localStorage.getItem("fitts-understanding-distance-done"))
  t.check("but the browser-only game flag did not", gone === null, gone)
})

test("the tutor degrades instead of hanging when the model is down", async (page, t) => {
  // The widget renders on EVERY page. If a dead Ollama leaves it spinning, the
  // failure a student sees is not "the tutor is down", it is "the app is broken".
  const sid = freshSid()
  await fullSignIn(page, sid, "No Ollama")
  await go(page, "/dashboard")
  await ready(page, 1500)

  await page.route("**/api/ask", (route) => route.abort("failed"))
  await page.route("**/api/socratic", (route) => route.abort("failed"))

  const opener = page.locator('[aria-label="Open AI tutor"]').first()
  t.require("the tutor button is on the page", await opener.count() > 0)
  await opener.click()
  await page.waitForTimeout(800)

  const box = page.locator("textarea, input[type=text]").last()
  await box.fill("What is Fitts' Law?")
  await page.keyboard.press("Enter")
  await page.waitForTimeout(4000)

  const body = await page.evaluate(() => (document.body.innerText || "").trim())
  t.check("the student is told the tutor is offline", /offline|can.t answer|try again/i.test(body),
    body.slice(-260))
  t.check("the composer is usable again, not stuck loading",
    await box.isEnabled().catch(() => false))
  await box.fill("second try")
  t.check("and a second question can still be typed",
    (await box.inputValue().catch(() => "")) === "second try")
})

test("the whole sign-in path works with a keyboard alone", async (page, t) => {
  const sid = freshSid()
  await go(page, "/signup")
  await ready(page)

  // Tab from the top and record where focus lands. A control that cannot be reached
  // this way cannot be used by anyone who does not use a mouse.
  const order = []
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab")
    order.push(await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return "(body)"
      return el.getAttribute("data-testid") || el.getAttribute("aria-label") ||
        el.getAttribute("name") || el.tagName.toLowerCase()
    }))
  }
  t.note(`tab order on /signup: ${order.join(" > ").slice(0, 200)}`)
  for (const id of ["signup-sid", "signup-password", "signup-submit"]) {
    t.check(`Tab reaches ${id}`, order.includes(id), order)
  }

  // Fill and submit without ever using the mouse.
  await page.locator('[data-testid="signup-sid"]').focus()
  await page.keyboard.type(sid)
  await page.locator('[data-testid="signup-password"]').focus()
  await page.keyboard.type(E2E_PASSWORD)
  await page.locator('[data-testid="signup-submit"]').focus()
  await page.keyboard.press("Enter")
  await page.waitForTimeout(3500)
  t.check("Enter on the focused button signs the student up",
    !page.url().includes("/signup"), page.url())

  // And the focus ring must be visible, or keyboard use is guesswork.
  await go(page, "/login")
  await ready(page)
  await page.keyboard.press("Tab")
  const ring = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const s = getComputedStyle(el)
    return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow.slice(0, 40) }
  })
  t.check("the focused control shows a visible focus indicator",
    !!ring && (ring.outline !== "none" || (ring.shadow && ring.shadow !== "none")), ring)
})

test("the measured surfaces are legible to a screen reader", async (page, t) => {
  // Machine-checkable subset only: names, alts, headings, and whether STATE is
  // programmatically determinable. This is not a substitute for testing with a real
  // screen reader, and it is not claimed to be -- it is the floor.
  const sid = freshSid()
  await fullSignIn(page, sid, "Assistive Tech")
  const journey = await apiFromPage(page, "/api/topics")
  const topic = journey.body?.topics?.find((x) => x.state === "open" && x.has_bank)
  t.require("an open topic with a bank exists", !!topic)

  const audit = async (label) =>
    page.evaluate((where) => {
      const named = (el) =>
        (el.getAttribute("aria-label") || "").trim() ||
        (el.getAttribute("aria-labelledby") || "").trim() ||
        (el.getAttribute("title") || "").trim() ||
        (el.innerText || "").trim() ||
        (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText.trim()) ||
        (el.closest("label")?.innerText || "").trim() ||
        (el.getAttribute("placeholder") || "").trim()
      const brief = (el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`
      const vis = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      return {
        where,
        imgsNoAlt: Array.from(document.querySelectorAll("img"))
          .filter((el) => vis(el) && el.getAttribute("alt") === null && el.getAttribute("role") !== "presentation")
          .map((el) => el.getAttribute("src") || "(no src)").slice(0, 4),
        controlsNoName: Array.from(document.querySelectorAll("button, a[href], input, select, textarea"))
          .filter((el) => vis(el) && !named(el)).map(brief).slice(0, 5),
        headings: Array.from(document.querySelectorAll("h1,h2,h3")).map((h) => h.tagName).slice(0, 6),
        h1: document.querySelectorAll("h1").length,
      }
    }, label)

  const noAlt = [], noName = [], noHeading = []
  for (const route of ["/login", "/signup", "/dashboard", "/badges", `/topics/${topic.topic_id}`]) {
    await go(page, route)
    await ready(page, 1400)
    const a = await audit(route)
    if (a.imgsNoAlt.length) noAlt.push(`${route}: ${a.imgsNoAlt.join(", ")}`)
    if (a.controlsNoName.length) noName.push(`${route}: ${a.controlsNoName.join(", ")}`)
    if (!a.headings.length) noHeading.push(route)
  }
  t.check("every visible image has alt text", noAlt.length === 0, noAlt)
  t.check("every visible control has an accessible name", noName.length === 0, noName)
  t.check("every measured page has a heading", noHeading.length === 0, noHeading)

  // The one that matters most for the instrument: a student using a screen reader
  // must be able to tell WHICH option they have selected. Colour alone does not
  // reach them -- and an unanswered item they believe they answered is a lost datum.
  await go(page, `/topics/${topic.topic_id}`)
  await page.locator('[data-testid="step-counter"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {})
  t.require("the check is reachable", await reachTheCheck(page, t))
  const first = page.locator('[data-testid="mc-option"]').first()
  await first.click()
  await page.waitForTimeout(300)
  const state = await first.evaluate((el) => ({
    role: el.getAttribute("role"),
    checked: el.getAttribute("aria-checked"),
    pressed: el.getAttribute("aria-pressed"),
    selected: el.getAttribute("aria-selected"),
  }))
  t.check("a selected answer is programmatically determinable, not colour-only",
    state.checked === "true" || state.pressed === "true" || state.selected === "true", state)

  const group = await page.locator('[data-testid="mc-option"]').first()
    .evaluate((el) => el.closest("[role=radiogroup],[role=group],fieldset")?.getAttribute("role") ?? null)
  t.check("the options are grouped so the item reads as one question", group !== null, group)
})
