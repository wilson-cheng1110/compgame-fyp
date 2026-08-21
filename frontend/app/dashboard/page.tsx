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
import { topics as topicsApi, type JourneyTopic } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import type { TopicId } from "@/lib/topic-definitions"

const AVATAR_URLS: Record<number, string> = {
  1: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
  2: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
}


export default function DashboardPage() {
  const router = useRouter()
  useForceScrollbar()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const { badges, refreshBadges } = useBadges()
  const { progress, refreshProgress, getTopicProgress } = useProgress()

  // Server-assigned release state per topic (docs/revamp.md Parts 7, 10). This is
  // what turns the grid into a journey: which topic is open, when the rest unlock,
  // and — invisibly to the student — which arm they're in. Local progress still
  // drives badges and the avatar's speech bubble; it just no longer decides what
  // the student is allowed to open.
  const [journey, setJourney] = useState<Record<string, JourneyTopic>>({})
  const [journeyLoaded, setJourneyLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    topicsApi.journey().then((res) => {
      if (!alive) return
      if (res.ok && res.data) {
        const byId: Record<string, JourneyTopic> = {}
        res.data.topics.forEach((t) => { byId[t.topic_id] = t })
        setJourney(byId)
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
    if (userData.needsOnboarding) { router.push("/onboarding/avatar"); return }
    if (!userData.avatarId || !userData.username) { Cookies.remove("user"); router.push("/login"); return }
    setUser(userData)
    refreshBadges()
    refreshProgress()
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

  const handleSignOut = () => { Cookies.remove("user"); router.push("/") }

  const handleExportData = () => {
    if (!user?.sid) return
    try {
      const users = getUsers()
      const userData = users[user.sid] ?? {}

      const exportData = {
        exportDate: new Date().toISOString(),
        sid: user.sid,
        username: user.username,
        avatarId: user.avatarId,
        badges: userData.badges ?? [],
        topicProgress: userData.topicProgress ?? {},
        // Pre-test baseline (captured at signup — key DV control for the paper)
        preTest: {
          score: userData.preTestScore ?? null,
          answers: userData.preTestAnswers ?? null,
          completedAt: userData.preTestCompletedAt ?? null,
        },
        // Flip-learning metrics for paper
        flipMetrics: Object.fromEntries(
          TOPICS.map((t) => {
            const tp = (userData.topicProgress ?? {})[t.id]
            return [t.id, {
              understandingCompleted: tp?.understandingCompleted ?? false,
              assessmentCompleted: tp?.assessmentCompleted ?? false,
              playedUnderstandingFirst: tp?.playedUnderstandingFirst ?? false,
              assessmentScore: tp?.assessmentScore ?? null,
            }]
          })
        ),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `COMPGame_Progress_${user.sid}.json`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
    } catch (e) { console.error("Export failed", e) }
  }

  if (!user) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  const doneCount = Object.values(progress).filter((p) => p?.assessmentCompleted).length

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
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 min-w-0">
            <p className="u-eyebrow">COMP3423 · Human–Computer Interaction</p>
            <h1 className="u-h1 mt-1">Your topics</h1>
            <p className="u-stem u-muted mt-2">
              Topics open in the order they are lectured. Work through the one that is open;
              the rest unlock on their own.
            </p>

            {nextUp && nextUpState && (
              <Link href={`/topics/${nextUp.id}`} className="block mt-6">
                <div className="u-row u-row-actionable p-5" style={{ borderColor: "var(--accent)" }}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="u-eyebrow" style={{ color: "var(--accent)" }}>
                        Next up
                      </p>
                      <p className="u-h2 mt-1">{nextUp.title}</p>
                      <p className="u-faint mt-1">
                        {nextUpState.has_bank
                          ? "Check, activity, then check again"
                          : "Activity, then talk it through"}
                        {nextUpState.closes && !nextUpState.late
                          ? ` · finish by ${new Date(nextUpState.closes).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`
                          : ""}
                      </p>
                    </div>
                    <span className="u-btn u-btn-primary">Continue →</span>
                  </div>
                </div>
              </Link>
            )}

            <ol className="mt-8 space-y-2.5">
              {TOPICS.map((topic, idx) => {
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
                    ? `Opens ${new Date(js.opens).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                    : !locked && !done && js?.closes
                      ? `Until ${new Date(js.closes).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                      : null

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
                  <span className="u-num">{badges.length}</span> badge
                  {badges.length === 1 ? "" : "s"}
                </span>
                <Link href="/badges" className="u-faint hover:underline">
                  View
                </Link>
              </div>

              <button onClick={handleExportData} className="u-btn u-btn-block">
                Export my data
              </button>

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
