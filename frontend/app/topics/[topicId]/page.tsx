"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { topics as topicsApi, type JourneyTopic } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import TopicCheck from "@/components/topic-check"
import TopicProbe from "@/components/topic-probe"

// The topic unit (docs/revamp.md Part 2). This is the shell that turns "a grid of
// games you can play in any order" into a sequenced journey.
//
// THE STEP ORDER IS THE EXPERIMENT. The server assigns each student an arm per
// topic and this component renders the steps in that order:
//
//   FLIP     brief -> pre-check -> GAME -> post-check -> tutor -> close
//   CONTROL  brief -> pre-check -> post-check -> GAME -> tutor -> close
//
// Each check is followed by its short-answer probe when the topic has one. The two
// instruments roll out on DIFFERENT schedules (4 topics have MC banks, 4 have
// rubric probes, and they are not the same four), so `has_bank` and `has_probe`
// are independent flags and neither is inferred from the other. A topic with
// neither still runs — it is just brief -> game -> tutor -> close.
//
// The arm is never chosen here and never stored here — it comes down with the
// topic state and is recorded server-side on every submission, so observation and
// assignment can be cross-checked (any mismatch is a bug, not noise).
//
// The 26 existing game routes are UNTOUCHED. The unit links out to them and the
// student returns; nothing about the games had to change.
//
// VISUAL REGISTER (Part 14.1). This file is `.shell`: the CUBIK system — Inter,
// white/light-gray grounds, teal accent, glass cards. The game it launches is not.
// That contrast is deliberate — stepping into the game should feel like stepping
// somewhere else, which it cannot if the measured steps are dressed as an arcade.

type Step = "brief" | "pre" | "preProbe" | "game" | "post" | "postProbe" | "tutor" | "close"

const STEP_LABEL: Record<Step, string> = {
  brief: "Brief",
  pre: "First check",
  preProbe: "In your words",
  game: "Activity",
  post: "Second check",
  postProbe: "In your words",
  tutor: "Talk it through",
  close: "Done",
}

export default function TopicUnitPage() {
  const router = useRouter()
  const params = useParams<{ topicId: string }>()
  const topicId = params?.topicId

  const [state, setState] = useState<JourneyTopic | null>(null)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const [step, setStep] = useState<Step>("brief")
  const [postDone, setPostDone] = useState(false)
  const [error, setError] = useState("")
  const [darkMode, setDarkMode] = useState(false)

  const meta = useMemo(() => TOPICS.find((t) => t.id === topicId), [topicId])
  const stepKey = `compgame:unit:${topicId}:step`

  // Steps in this student's arm order. A topic with no item bank yet simply has no
  // check steps — the unit still runs (docs/revamp.md Part 8.4).
  const steps: Step[] = useMemo(() => {
    if (!state) return ["brief"]
    const hasChecks = state.has_bank
    const hasProbe = state.has_probe === true
    const game: Step[] = ["game"]
    const pre: Step[] = [
      ...(hasChecks ? (["pre"] as Step[]) : []),
      ...(hasProbe ? (["preProbe"] as Step[]) : []),
    ]
    const post: Step[] = [
      ...(hasChecks ? (["post"] as Step[]) : []),
      ...(hasProbe ? (["postProbe"] as Step[]) : []),
    ]
    return state.plays_game_first
      ? ["brief", ...pre, ...game, ...post, "tutor", "close"]
      : ["brief", ...pre, ...post, ...game, "tutor", "close"]
  }, [state])

  useEffect(() => {
    if (Cookies.get("darkMode") === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [])

  useEffect(() => {
    if (!topicId) return
    let alive = true
    topicsApi.journey().then((j) => {
      if (!alive) return
      if (!j.ok || !j.data) {
        router.push("/login")
        return
      }
      setTelemetryEnabled(j.data.telemetry_enabled)
      const found = j.data.topics.find((t) => t.topic_id === topicId)
      if (!found) {
        setError("That topic doesn't exist.")
        return
      }
      if (found.state === "locked" || found.state === "unscheduled") {
        setError(
          found.opens
            ? `This topic opens on ${new Date(found.opens).toLocaleDateString()}.`
            : "This topic isn't scheduled yet.",
        )
        setState(found)
        return
      }
      setState(found)
      // Resume where they left off — students close laptops mid-topic.
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(stepKey) : null
      if (saved) setStep(saved as Step)
    })
    return () => {
      alive = false
    }
  }, [topicId, router, stepKey])

  const go = (next: Step) => {
    setStep(next)
    if (typeof window !== "undefined") window.localStorage.setItem(stepKey, next)
  }

  const advance = () => {
    const i = steps.indexOf(step)
    if (i >= 0 && i < steps.length - 1) go(steps[i + 1])
  }

  if (error) {
    return (
      <main className="shell min-h-screen">
        <UnitHeader />
        <div className="mx-auto w-full max-w-2xl px-5 py-16">
          <div className="u-card p-8">
            <p className="u-eyebrow">Not open yet</p>
            <p className="u-stem mt-3">{error}</p>
            <Link href="/dashboard">
              <button className="u-btn u-btn-primary mt-7">Back to my topics</button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!state || !meta) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  const position = steps.indexOf(step) + 1

  return (
    <main className="shell min-h-screen">
      <UnitHeader />

      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {/* Where am I in this unit. The rail is the only loud graphic left on the
            page, and it earns it by encoding position in a real sequence. */}
        <div className="u-card p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="u-eyebrow">Session {state.session}</p>
              <h1 className="u-h1 mt-1">{meta.title}</h1>
            </div>
            <p className="u-faint u-num whitespace-nowrap pt-1">
              Step {position} of {steps.length} · {STEP_LABEL[step]}
            </p>
          </div>

          <div className="u-rail mt-4">
            {steps.map((s, i) => (
              <div
                key={s + i}
                className={`u-rail-seg ${
                  i < position - 1 ? "is-done" : i === position - 1 ? "is-now" : ""
                }`}
              />
            ))}
          </div>

          {state.late && (
            <p className="u-faint mt-3" style={{ color: "var(--state-late)" }}>
              ▲ This topic&apos;s window has closed — you can still work through it, and it will
              be recorded as late.
            </p>
          )}
        </div>

        {step === "brief" && (
          <div className="u-card p-8">
            <p className="u-eyebrow">Before you begin</p>
            <h2 className="u-h2 mt-2">{meta.description}</h2>
            <p className="u-stem u-muted mt-4">
              {state.has_bank
                ? "You'll answer a few questions first, work through an activity, then answer a different set to see what changed."
                : "You'll work through an activity, then talk it through with the tutor."}
            </p>
            <p className="u-stem u-muted mt-3">
              It takes about 20 minutes. You can stop and come back — this page remembers where
              you were.
            </p>
            <button onClick={advance} className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
              Start
            </button>
          </div>
        )}

        {step === "pre" && (
          <TopicCheck
            topicId={state.topic_id}
            form="A"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={() => setTimeout(advance, 1200)}
          />
        )}

        {step === "post" && (
          <TopicCheck
            topicId={state.topic_id}
            form="B"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={() => setPostDone(true)}
          />
        )}

        {step === "preProbe" && (
          <TopicProbe
            topicId={state.topic_id}
            form="A"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={advance}
          />
        )}

        {step === "postProbe" && (
          <TopicProbe
            topicId={state.topic_id}
            form="B"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={advance}
          />
        )}

        {step === "game" && (
          <div className="u-card p-8">
            <p className="u-eyebrow">The activity</p>
            <h2 className="u-h2 mt-2">Play through {meta.title}</h2>
            <p className="u-stem u-muted mt-4">
              This part is a game. Come back here when you&apos;ve finished it — the rest of the
              unit is waiting.
            </p>
            <Link href={`/games/${meta.understandingGameId}`}>
              <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
                Open the activity →
              </button>
            </Link>
            <button onClick={advance} className="u-btn u-btn-block mt-3">
              I&apos;ve finished it — continue
            </button>
          </div>
        )}

        {/* Only after they've submitted and seen the answers — the post-check is
            where the feedback lands, so don't let them skip past it unread. */}
        {step === "post" && postDone && (
          <button onClick={advance} className="u-btn u-btn-block mt-5">
            Continue
          </button>
        )}

        {step === "tutor" && (
          <div className="u-card p-8">
            <p className="u-eyebrow">Talk it through</p>
            <h2 className="u-h2 mt-2">Explain {meta.title} in your own words</h2>
            <p className="u-stem u-muted mt-4">
              Open the tutor (bottom-right) and try to explain it. It will push back with
              questions rather than hand you answers — that&apos;s the point.
            </p>
            <blockquote
              className="u-stem mt-5 pl-4"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              {meta.reflectionQuestion}
            </blockquote>
            <button onClick={advance} className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
              Done reflecting
            </button>
          </div>
        )}

        {step === "close" && (
          <div className="u-card p-8">
            <p className="u-eyebrow" style={{ color: "var(--state-done)" }}>
              ✓ Finished
            </p>
            <h2 className="u-h2 mt-2">{meta.title}</h2>
            <p className="u-stem u-muted mt-4">
              Your answers are saved and this topic is complete.
            </p>
            <Link href="/dashboard">
              <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
                Back to my topics
              </button>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

function UnitHeader() {
  return (
    <header className="u-nav">
      <div className="mx-auto w-full max-w-3xl px-5 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {/* Local asset rather than the v0-generated vercel-storage blob URL the
              rest of the app still points at — one less external dependency on a
              page 300 students load from a home broadband connection. */}
          <Image src="/images/logo.png" alt="" width={26} height={26} priority />
          <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
        </Link>
        <Link href="/dashboard" className="u-faint hover:underline">
          All topics
        </Link>
      </div>
    </header>
  )
}
