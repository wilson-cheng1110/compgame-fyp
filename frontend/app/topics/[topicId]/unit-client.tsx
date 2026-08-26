"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Cookies from "js-cookie"
import { type JourneyTopic } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import TopicCheck from "@/components/topic-check"
import TopicProbe from "@/components/topic-probe"
import UnitHeader from "./unit-header"

// The INTERACTIVE half of the topic unit. Everything the student clicks.
//
// It no longer fetches anything on mount. The server component next door
// (page.tsx) already has the topic state and hands it in as a prop, so this
// component's FIRST render is the real unit — title, session, step rail, brief —
// not a "Loading…" placeholder.
//
// WHY THAT MATTERS, and why it is the actual fix rather than a nicety: when this
// page fetched its own state, its first meaningful render depended on hydration.
// If the client bundle never arrived or never ran, the student sat on "Loading…"
// forever with nothing to click, no error, and a 200 in the server log. That is
// exactly the failure that took a day to pin down. A client-side timeout cannot
// rescue it either — a timer needs hydration too. Rendering the content on the
// server is the only guard that does not depend on the thing that breaks.
//
// What still needs hydration: advancing between steps, and the check/probe forms.
// A student with no JS now sees their topic, its state and its brief, and simply
// cannot press Start — a visibly limited page instead of an invisible dead end.

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

export default function TopicUnitClient({
  state,
  telemetryEnabled,
}: {
  state: JourneyTopic
  telemetryEnabled: boolean
}) {
  const topicId = state.topic_id
  const [step, setStep] = useState<Step>("brief")
  const [postDone, setPostDone] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const meta = useMemo(() => TOPICS.find((t) => t.id === topicId), [topicId])
  const stepKey = `compgame:unit:${topicId}:step`

  // Steps in this student's arm order. A topic with no item bank yet simply has no
  // check steps — the unit still runs (docs/revamp.md Part 8.4).
  const steps: Step[] = useMemo(() => {
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



  // Resume where they left off — students close laptops mid-topic. This runs after
  // hydration; until then the unit simply shows step 1, which is correct and readable.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(stepKey) : null
    if (saved) setStep(saved as Step)
  }, [stepKey])

  const go = (next: Step) => {
    setStep(next)
    if (typeof window !== "undefined") window.localStorage.setItem(stepKey, next)
  }

  const advance = () => {
    const i = steps.indexOf(step)
    if (i >= 0 && i < steps.length - 1) go(steps[i + 1])
  }

  // The server component already resolved this topic against TOPICS before rendering
  // us, so `meta` is present in every real path. The guard is here so TypeScript can
  // see it and so a future caller cannot render this component with a bad id.
  if (!meta) return null

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
            <p className="u-faint u-num whitespace-nowrap pt-1" data-testid="step-counter">
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
