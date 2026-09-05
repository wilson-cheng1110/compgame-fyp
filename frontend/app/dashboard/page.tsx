"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { getUsers } from "@/lib/user-store"
import { useForceScrollbar } from "@/lib/use-force-scrollbar"
import { useBadges } from "@/lib/badge-context"
import { useProgress } from "@/lib/progress-context"
import { topics as topicsApi, auth, admin, researcher, type JourneyTopic } from "@/lib/api"
import { nextStep } from "@/lib/session-handoff"
import { badgesFromJourney, completedCount } from "@/lib/badges"
import JourneyPath from "@/components/journey-path"
import SessionMap from "@/components/session-map"
import { TOPICS } from "@/lib/topic-definitions"
import { useSlowLoad } from "@/lib/use-slow-load"
import type { TopicId } from "@/lib/topic-definitions"

const AVATAR_URLS: Record<number, string> = {
  1: "/images/avatar_1.png",
  2: "/images/avatar_2.png",
}


export default function DashboardPage() {
  const router = useRouter()
  useForceScrollbar()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  // `badges` is no longer read here: the rail counts completed topics from the
  // journey. refreshBadges stays because the games still write the cookie store
  // until stage 3 rewires them.
  const { refreshBadges } = useBadges()
  const { progress, refreshProgress, getTopicProgress } = useProgress()

  // Server-assigned release state per topic (docs/revamp.md Parts 7, 10). This is
  // what turns the grid into a journey: which topic is open, when the rest unlock,
  // and — invisibly to the student — which arm they're in. Local progress still
  // drives badges and the avatar's speech bubble; it just no longer decides what
  // the student is allowed to open.
  const [journey, setJourney] = useState<Record<string, JourneyTopic>>({})
  const [journeyLoaded, setJourneyLoaded] = useState(false)
  // The student's own lecture day ("Tue"), so a row can explain itself in terms
  // of THEIR class rather than the timetable in general.
  const [sectionDay, setSectionDay] = useState<string>("")
  // The battery adds 29 items to every unit; the promised time has to follow.
  const [longUnits, setLongUnits] = useState(false)
  // Is this the course team? `/admin` was linked from NOWHERE -- grep found the
  // string only inside two code comments -- so a teacher reached the panel by
  // typing the URL from memory or not at all. whoami is the same check the panel
  // itself makes; this only decides whether to draw a link, and a student who
  // forges it still meets a 403 from the server.
  const [isStaff, setIsStaff] = useState(false)
  // Is this the researcher (PI)? A SEPARATE gate from the teacher one, so a teacher-only
  // account (Jeff) never sees the researcher link — the monitoring surface is kept off
  // the teacher's radar on purpose. A researcher-only account has no admin-link and this
  // is their only way into /researcher from the UI.
  const [isResearcher, setIsResearcher] = useState(false)
  // No page may hang forever — see lib/use-slow-load.ts.
  const slowToLoad = useSlowLoad(!user)

  useEffect(() => {
    let alive = true
    admin.whoami().then((r) => { if (alive && r.ok) setIsStaff(true) }).catch(() => {})
    researcher.whoami().then((r) => { if (alive && r.ok) setIsResearcher(true) }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    topicsApi.journey().then((res) => {
      if (!alive) return
      if (res.ok && res.data) {
        const byId: Record<string, JourneyTopic> = {}
        res.data.topics.forEach((t) => { byId[t.topic_id] = t })
        setJourney(byId)
        setSectionDay(res.data.section_day ?? "")
        setLongUnits(res.data.questionnaires_enabled === true)
      }
      setJourneyLoaded(true)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => { refreshBadges(); refreshProgress() }, 3000)
    return () => clearInterval(interval)
  }, [refreshBadges, refreshProgress])

  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) { router.push("/login"); return }
    const userData = JSON.parse(userCookie)
    // NOTE: the onboarding/consent/baseline ordering is decided below from SERVER
    // truth via nextStep(), not from this cookie. The cookie carries needsOnboarding
    // but NOT needsConsent, so redirecting to onboarding here (as this did) sent an
    // unconsented student to /onboarding/avatar instead of /consent — inverting the
    // gate order nextStep() defines (consent first). The cookie is decoration; the
    // gate is the server's to set.
    if (!userData.avatarId || !userData.username) { Cookies.remove("user"); router.push("/login"); return }
    setUser(userData)
    refreshBadges()
    refreshProgress()

    // THE SERVER SESSION IS THE TRUTH; THE COOKIE IS DECORATION (revamp.md Part 0).
    // Everything above only reads the cookie, so a student whose session is gone —
    // expired, server restarted with a fresh DB, or WITHDRAWN, which is supposed to
    // kill every session immediately — still saw a full dashboard whose every data
    // call quietly 401'd. Withdrawal that leaves you looking signed in is the one
    // that matters: it is a promise made on the consent form.
    // Found by the browser tests, 2026-08-21. The login page has always done this
    // check; the dashboard did not.
    auth.me().then((res) => {
      if (res.status === 401) {
        Cookies.remove("user")
        router.push("/login")
        return
      }
      // The FULL gate order, from server truth, in one place — consent → onboarding
      // → baseline (lib/session-handoff.ts nextStep). Doing it here rather than in
      // scattered synchronous cookie checks is what fixes the inverted order: an
      // unconsented student now reaches /consent, not /onboarding/avatar.
      const step = nextStep(
        res.data?.needsConsent ?? false,
        res.data?.needsOnboarding ?? false,
        res.data?.needsBaseline,
      )
      if (step !== "/dashboard") router.push(step)
    })
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") { setDarkMode(true); document.body.classList.add("dark-mode") }
  }, [router, refreshBadges, refreshProgress])

  useEffect(() => {
    const onFocus = () => { refreshBadges(); refreshProgress() }
    const onVis = () => { if (document.visibilityState === "visible") onFocus() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis) }
  }, [refreshBadges, refreshProgress])

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    if (next) { document.body.classList.add("dark-mode"); Cookies.set("darkMode", "true", { expires: 365 }) }
    else { document.body.classList.remove("dark-mode"); Cookies.set("darkMode", "false", { expires: 365 }) }
  }

  const handleSignOut = async () => {
    // Kill the server session (HttpOnly cookie) BEFORE clearing the UI cookie —
    // otherwise /login re-authenticates whoever still holds a live session.
    try { await auth.logout() } catch { /* sign out locally regardless */ }
    Cookies.remove("user")
    router.push("/")
  }

  if (!user) {
    if (slowToLoad) {
      return (
        <main className="shell min-h-screen flex items-center justify-center px-5">
          <div className="u-card p-8 max-w-md">
            <p className="u-eyebrow">Couldn&apos;t load your topics</p>
            <p className="u-stem mt-3">
              It&apos;s taking longer than it should — usually a dropped connection.
              Nothing of yours is lost.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="u-btn u-btn-primary mt-7"
            >
              Try again
            </button>
          </div>
        </main>
      )
    }
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  // Server truth, not the cookie. This used to read `assessmentCompleted` out of
  // `topicProgress`, which the unit never sets -- so a student could finish a topic,
  // watch it turn "Done" in the list, and read "0 of 13" in the rail beside it.
  // A release date with no year is only unambiguous while you are inside the year
  // it belongs to. These are dates a student plans around, so the year appears as
  // soon as it is not the current one, and stays out of the way when it is.
  const shortDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(
      undefined,
      d.getFullYear() === new Date().getFullYear()
        ? { day: "numeric", month: "short" }
        : { day: "numeric", month: "short", year: "numeric" },
    )
  }

  const journeyList = Object.values(journey)
  const doneCount = completedCount(journeyList)
  const earned = badgesFromJourney(journeyList)

  // Rendered in the order the SERVER releases them, not the order they happen to sit
  // in topic-definitions.ts. Those disagreed for 10 of the 13 topics -- Gestalt is
  // order 9 on the server and was rendered as "02" here -- while the copy above
  // promises "topics open in the order they are lectured" and the comment below
  // calls that order the independent variable. Now they agree.
  const orderedTopics =
    journeyLoaded && journeyList.length
      ? [...journeyList]
          .sort((a, b) => a.order - b.order)
          .map((j) => TOPICS.find((t) => t.id === j.topic_id))
          .filter((t): t is (typeof TOPICS)[number] => !!t)
      : TOPICS

  // SEVEN LECTURES, NOT THIRTEEN ERRANDS.
  //
  // The thirteen topics are released one to three at a time, with the lecture they
  // belong to. Rendered flat, that structure is invisible and the page reads as a
  // wall of thirteen equal chores -- which is exactly the shape that makes a tired
  // student in November close the tab. Grouped, the same list reads as "one lecture
  // at a time" and the two or three topics that share a release date sit together
  // where they belong.
  //
  // Groups are contiguous because orderedTopics is already in release order, so a
  // single pass builds them and the numbering (01..13) keeps running across the
  // groups -- the sequence IS the independent variable and it must not restart.
  const sessionGroups = (() => {
    const out: {
      session: number | null
      start: number
      topics: (typeof TOPICS)[number][]
    }[] = []
    orderedTopics.forEach((t, i) => {
      const sn = journey[t.id]?.session ?? null
      const last = out[out.length - 1]
      if (last && last.session === sn) last.topics.push(t)
      else out.push({ session: sn, start: i, topics: [t] })
    })
    return out
  })()

  // THE ONE THING TO DO NEXT. This replaced an avatar with a speech bubble telling
  // the student they were doing great. At 13 topics released on a schedule, exactly
  // one is normally actionable, and surfacing it is more useful than encouragement
  // — it answers the question they actually arrived with. The avatar is not gone;
  // it moved to the profile card, which is docs/revamp.md Part 14's "demote, don't
  // delete" (the badge/avatar layer is the H2 motivation construct's reason to exist).
  const nextUp = journeyLoaded
    ? TOPICS.find((t) => {
        const js = journey[t.id]
        return js && !js.complete && (js.state === "open" || js.state === "late")
      })
    : undefined
  const nextUpState = nextUp ? journey[nextUp.id] : undefined


  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="u-btn" aria-label="Toggle theme">
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={handleSignOut} className="u-btn">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        {/* A teacher lands on the STUDENT dashboard, whose one primary CTA ("Start")
            is for a topic that is not theirs. The panel link is in the sidebar, but a
            lecturer 30 minutes before a tutorial should not have to hunt. This banner
            names the course-team panel up top for staff, and is invisible to students. */}
        {isStaff && (
          <Link href="/admin" data-testid="admin-banner">
            <div
              className="u-card p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
              style={{ borderColor: "var(--accent)" }}
            >
              <div>
                <p style={{ fontWeight: 600 }}>You&apos;re on the course team</p>
                <p className="u-faint mt-0.5">
                  Tutorial briefs, accounts and lecture dates are in the course-team panel.
                </p>
              </div>
              <span className="u-btn u-btn-primary">Open the panel →</span>
            </div>
          </Link>
        )}
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 min-w-0">
            <p className="u-eyebrow">COMP3423 · Human–Computer Interaction</p>
            <h1 className="u-h1 mt-1">Your topics</h1>
            <p className="u-stem u-muted mt-2">
              Topics open in the order they are lectured. Work through the one that is open;
              the rest unlock on their own.
            </p>

            {/* The run as one thing, above the list rather than instead of it --
                thirteen states still scan better as rows than as nodes. */}
            {journeyLoaded && journeyList.length > 0 && (
              <div className="mt-6">
                <JourneyPath topics={journeyList} currentId={nextUp?.id} />
              </div>
            )}

            {nextUp && nextUpState && (
              <Link href={`/topics/${nextUp.id}`} className="block mt-6">
                <div className="u-row u-row-actionable p-5" style={{ borderColor: "var(--accent)" }}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="u-eyebrow" style={{ color: "var(--accent)" }}>
                        Next up
                      </p>
                      <p className="u-h2 mt-1">{nextUp.title}</p>
                      {/* WHAT AN EXHAUSTED STUDENT IN NOVEMBER NEEDS TO KNOW, before
                          they will open anything: how long, does it count, and can I
                          stop. All three were true already and none of them were said
                          here. "Check, activity, then check again" described the
                          MECHANISM, which is the one thing they were not asking. */}
                      <p className="u-faint mt-1">
                        {longUnits ? "About 20 minutes" : "About 12 minutes"}. Not
                        graded — it just helps us see whether this way of learning
                        works.
                        {nextUpState.closes && nextUpState.late
                          ? ` Overdue since ${shortDate(nextUpState.closes)}, and still open.`
                          : nextUpState.closes
                            ? ` Open until ${shortDate(nextUpState.closes)}.`
                            : ""}
                      </p>
                      <p className="u-faint mt-0.5" style={{ opacity: 0.8 }}>
                        You can stop whenever you like — everything saves as you go.
                      </p>
                    </div>
                    <span className="u-btn u-btn-primary">Start →</span>
                  </div>
                </div>
              </Link>
            )}

            {/* Orientation before navigation: what this is, then where things are. */}
            <div className="mt-8">
              <SessionMap topics={journeyList} longUnits={longUnits} />
            </div>

            <div className="mt-3 space-y-3">
              {sessionGroups.map((grp) => {
                const st = grp.topics.map((t) => journey[t.id])
                const anyLive = st.some(
                  (j) => j && !j.complete && (j.state === "open" || j.state === "late"),
                )
                const allDone = grp.topics.every(
                  (t) => journey[t.id]?.complete || getTopicProgress(t.id as TopicId).assessmentCompleted,
                )
                const opensOn = st.find((j) => j?.opens)?.opens
                // A one-glance summary, so a collapsed group still answers "is
                // there anything here for me". Words, never colour alone.
                const note = allDone
                  ? "All done"
                  : anyLive
                    ? `${st.filter((j) => j && !j.complete && (j.state === "open" || j.state === "late")).length} to do`
                    : opensOn
                      ? `Opens ${shortDate(opensOn)}`
                      : "Not scheduled yet"

                return (
                  // OPEN ONLY WHAT IS ACTIONABLE. A group with nothing live is shut
                  // by default -- it is still one click away, and shutting it is the
                  // difference between a page you scan and a page you scroll.
                  <details key={`s${grp.session ?? "none"}-${grp.start}`} className="u-group" open={anyLive}>
                    <summary className="u-group-head">
                      <span style={{ fontWeight: 600 }}>
                        {grp.session === null ? "Not yet scheduled" : `Lecture ${grp.session}`}
                      </span>
                      <span className="u-faint" style={{ marginLeft: "auto" }}>
                        {note}
                      </span>
                    </summary>
                    <ol className="u-group-body space-y-2.5">
              {grp.topics.map((topic, gi) => {
                const idx = grp.start + gi
                const tp = getTopicProgress(topic.id as TopicId)
                const aDone = tp.assessmentCompleted
                const js = journey[topic.id]

                const locked = !js || js.state === "locked" || js.state === "unscheduled"
                const done = js?.complete || aDone
                const openable = !!js && !locked

                const chip = done
                  ? { cls: "u-chip-done", label: "Done" }
                  : locked
                    ? { cls: "u-chip-locked", label: "Locked" }
                    : js?.late
                      ? { cls: "u-chip-late", label: "Late" }
                      : { cls: "u-chip-open", label: "Open" }

                const when =
                  locked && js?.opens
                    ? `Opens ${shortDate(js.opens)}`
                    : done
                      ? null
                      : js?.late && js?.closes
                        ? `Still open · was due ${shortDate(js.closes)}`
                        : js?.closes
                          ? `Until ${shortDate(js.closes)}`
                          : null

                // SAY WHY. A state chip and a date answer "what" and leave "why"
                // to the student's imagination, which on a platform for teaching
                // HCI is not a defensible place to leave it. Everything below is
                // already in the journey payload -- the server knew all of it and
                // the page simply never said it out loud.
                const why = !js
                  ? null
                  : locked
                    ? `Opens with lecture ${js.session}, a week before your ${sectionDay || "section's"} class`
                    : js.late
                      ? `Lecture ${js.session} has passed — still open, so it still counts`
                      : `Lecture ${js.session} · open now, closes two days before the next class`

                const row = (
                  <div
                    className={`u-row p-4 ${openable ? "u-row-actionable" : ""} ${locked ? "u-row-locked" : ""}`}
                  >
                    <div className="flex items-baseline gap-4">
                      {/* The number is not decoration: these 13 topics ARE a
                          sequence, released in lecture order, and the order is
                          the independent variable. */}
                      <span
                        className="u-eyebrow u-num"
                        style={{ minWidth: "1.5rem", color: "var(--ink-faint)" }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span style={{ fontWeight: 600 }}>{topic.title}</span>
                          <span className={`u-chip ${chip.cls}`}>{chip.label}</span>
                          {when && <span className="u-faint">{when}</span>}
                        </div>
                        <p className="u-faint mt-0.5 truncate">{topic.description}</p>
                        {/* The REASON, under the description. A state chip answers
                            "what" and a date answers "when"; neither answers "why is
                            this one shut", which is the question a student actually
                            has. Deliberately allowed to wrap onto two lines -- a
                            reason clipped mid-sentence is worse than no reason. */}
                        {why && (
                          <p className="u-faint mt-0.5" style={{ opacity: 0.75 }}>
                            {why}
                          </p>
                        )}
                      </div>
                      {openable && (
                        <span className="u-faint" aria-hidden>
                          →
                        </span>
                      )}
                    </div>

                    {/* The tutor reflection stays reachable after the unit closes,
                        which is the resume path for anyone who skipped it. */}
                    {aDone && !tp.reflectionCompleted && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          window.dispatchEvent(
                            new CustomEvent("start-reflection", { detail: { topicId: topic.id } }),
                          )
                        }}
                        className="u-btn mt-3"
                        style={{ fontSize: ".8125rem", padding: ".4375rem .875rem" }}
                      >
                        Discuss with the tutor
                      </button>
                    )}
                  </div>
                )

                return (
                  <li key={topic.id}>
                    {openable ? (
                      <Link href={`/topics/${topic.id}`} className="block">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                )
              })}
                    </ol>
                  </details>
                )
              })}
            </div>
          </div>

          {/* ── SIDEBAR: profile, progress, and the demoted reward layer ── */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="u-card p-5 lg:sticky lg:top-20 space-y-5">
              <div className="flex items-center gap-3">
                <Image
                  src={AVATAR_URLS[user.avatarId ?? 1]}
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate" style={{ fontWeight: 600 }}>
                    {user.username}
                  </p>
                  <p className="u-faint u-num">{user.sid}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between u-faint mb-1.5">
                  <span>Progress</span>
                  <span className="u-num">
                    {doneCount} of {TOPICS.length}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--paper-sunken)",
                    border: "1px solid var(--rule)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(doneCount / TOPICS.length) * 100}%`,
                      background: "var(--accent)",
                      transition: "width .4s ease",
                    }}
                  />
                </div>
              </div>

              <div className="u-hr" style={{ borderTop: "1px solid var(--rule)" }} />

              <div className="flex items-center justify-between gap-2">
                <span className="u-faint">
                  <span className="u-num">{earned.length}</span> badge
                  {earned.length === 1 ? "" : "s"}
                </span>
                <Link href="/badges" className="u-faint hover:underline">
                  View
                </Link>
              </div>

              {/* One home for data and consent actions -- the consent form points at
                  "your account page", so it has to be a place, not a scattered button. */}
              <Link href="/account" className="u-btn u-btn-block" data-testid="account-link">
                Account &amp; my data
              </Link>

              {isStaff && (
                <Link
                  href="/admin"
                  className="u-btn u-btn-block mt-2"
                  data-testid="admin-link"
                >
                  Course team →
                </Link>
              )}

              {isResearcher && (
                <Link
                  href="/researcher"
                  className="u-btn u-btn-block mt-2"
                  data-testid="researcher-link"
                >
                  Researcher →
                </Link>
              )}

              <p className="u-faint">
                Stuck on anything? The tutor is the chat button, bottom right.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function SunIcon() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" /></svg> }
function MoonIcon() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /></svg> }
