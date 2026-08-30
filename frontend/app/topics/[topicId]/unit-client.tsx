"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Cookies from "js-cookie"
import { topics as topicsApi, type JourneyTopic } from "@/lib/api"
import { logResearchEvent } from "@/lib/research-log"
import JourneyPath from "@/components/journey-path"
import { TOPICS, type TopicId } from "@/lib/topic-definitions"
import { useProgress } from "@/lib/progress-context"
import TopicCheck from "@/components/topic-check"
import TopicProbe from "@/components/topic-probe"
import TopicQuestionnaire from "@/components/topic-questionnaire"
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

type Step =
  | "brief" | "pre" | "preProbe" | "game" | "post" | "postProbe"
  | "assess" | "tutor" | "close"

const STEP_LABEL: Record<Step, string> = {
  brief: "Brief",
  pre: "First check",
  preProbe: "In your words",
  game: "Activity",
  post: "Second check",
  postProbe: "In your words",
  assess: "Test yourself",
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
  const [preDone, setPreDone] = useState(false)
  const [postDone, setPostDone] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const meta = useMemo(() => TOPICS.find((t) => t.id === topicId), [topicId])
  const stepKey = `compgame:unit:${topicId}:step`

  // WHAT THE SERVER HAS SEEN, kept fresh.
  //
  // `state` is a prop from the server component and never changes after the first
  // render. That was fine while the step buttons were self-declared, and is not
  // fine now that Continue waits on `game_done`: coming back from the activity is
  // a client-side navigation that can be served from the router cache, so a
  // student who HAD just finished would return to a step that still says they
  // hadn't. Re-ask on mount and whenever the tab comes back to the front.
  const [live, setLive] = useState<JourneyTopic>(state)
  useEffect(() => {
    let alive = true
    const pull = async () => {
      const r = await topicsApi.detail(topicId)
      if (alive && r.ok && r.data) setLive(r.data)
    }
    void pull()
    const onBack = () => void pull()
    window.addEventListener("focus", onBack)
    document.addEventListener("visibilitychange", onBack)
    return () => {
      alive = false
      window.removeEventListener("focus", onBack)
      document.removeEventListener("visibilitychange", onBack)
    }
  }, [topicId])

  // The student's own device also knows. `done` is server OR local on purpose:
  // the server flag is what the PAPER uses, but a student whose record call was
  // eaten by a dropped connection genuinely finished, and stranding them on a
  // step they have completed is the failure this whole change must not cause.
  const { getTopicProgress } = useProgress()
  const localProgress = getTopicProgress(topicId as TopicId)
  const done = {
    game: !!live.game_done || localProgress.understandingCompleted,
    assess: !!live.assess_done || localProgress.assessmentCompleted,
    tutor: !!live.reflection_done || localProgress.reflectionCompleted,
  }

  // Did they actually go and try? Set when they open the thing, read back when
  // they return. Per-device and clearable -- it is not a security boundary and is
  // not trying to be. It exists so the "it didn't record" escape below is offered
  // to someone who has been there, rather than to someone who has just arrived.
  const [tried, setTried] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // RE-READ ON RETURN, not just first mount (finding FE1). The game writes these
    // keys on mount (games/layout.tsx GameClock); coming back to the unit is a
    // client-side navigation served from the router cache, so THIS component instance
    // persists and a mount-only effect would leave `tried` false forever after a
    // genuine attempt — hiding the "it didn't record — continue without it" escape
    // from the stuck student it exists for. Same reason `live` above re-pulls on
    // focus/visibilitychange; mirror it exactly.
    const readTried = () => {
      try {
        setTried({
          game: !!localStorage.getItem(`compgame:unit:${topicId}:tried:game`),
          assess: !!localStorage.getItem(`compgame:unit:${topicId}:tried:assess`),
          tutor: !!localStorage.getItem(`compgame:unit:${topicId}:tried:tutor`),
        })
      } catch {
        /* private mode: no memory of the attempt, so they open it once more */
      }
    }
    readTried()
    window.addEventListener("focus", readTried)
    document.addEventListener("visibilitychange", readTried)
    return () => {
      window.removeEventListener("focus", readTried)
      document.removeEventListener("visibilitychange", readTried)
    }
  }, [topicId])
  const markTried = (what: string) => {
    try {
      localStorage.setItem(`compgame:unit:${topicId}:tried:${what}`, "1")
    } catch {
      /* ignore */
    }
    setTried((t) => ({ ...t, [what]: true }))
  }

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
    // ASSESSMENT SITS AFTER THE POST-CHECK, IN BOTH ARMS (Wilson, 2026-08-27).
    // FLIP     brief -> pre -> GAME -> post -> ASSESS -> tutor -> close
    // CONTROL  brief -> pre -> post -> GAME -> ASSESS -> tutor -> close
    // Both already ended ...tutor, close, so one insertion covers both -- and in
    // each the pre->post window has closed before the assessment starts, which is
    // what keeps the primary DV clean by placement rather than by exclusion.
    return state.plays_game_first
      ? ["brief", ...pre, ...game, ...post, "assess", "tutor", "close"]
      : ["brief", ...pre, ...post, ...game, "assess", "tutor", "close"]
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

  // THE ESCAPE, AND WHY THERE HAS TO BE ONE.
  //
  // Requiring the activity is the point of this screen. But in the FLIP arm the
  // activity sits BETWEEN the pre- and post-check, and in CONTROL it sits after
  // both -- so a hard gate with no way past would lose the post-check of stuck
  // FLIP students and none of CONTROL's. That is differential attrition by
  // condition, which is a Campbell & Stanley internal-validity threat and the
  // exact class of problem docs/experiment-design.md already argues about. A
  // fallback is therefore part of the DESIGN, not a softness in it.
  //
  // What makes it not a free skip: it is offered only to someone who has already
  // opened the thing, it says out loud what it is, and it LOGS. A skip that is
  // recorded is data the analysis can flag or exclude; a skip indistinguishable
  // from a completion is contamination, which is what the old
  // "I've finished it -- continue" button quietly produced.
  //
  // NOT gated on `telemetryEnabled`, and that is deliberate rather than an
  // oversight. `markGameComplete` mirrors `understanding_complete` to the sink
  // with no such guard, so recording the completion but not the non-completion
  // would leave a dataset where the two are indistinguishable by absence.
  //
  // And absence is not enough on its own any more. Replay means a student can
  // take this escape at step four and finish the activity properly at step nine;
  // the sink would then hold `understanding_complete` and `topic_complete` and no
  // trace that the treatment was skipped IN SEQUENCE -- which is the thing the
  // flip-learning claim actually rests on. Only an event at the moment it happens
  // records that.
  const carryOn = (what: "game" | "assess" | "tutor", eventType: string) => {
    logResearchEvent({ event_type: eventType, topic_id: topicId, meta: { step: what } })
    advance()
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
              <p className="u-eyebrow">Lecture {state.session}</p>
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
              It takes about 12 minutes. You can stop and come back — this page remembers where
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
            onDone={() => setPreDone(true)}
          />
        )}

        {step === "pre" && preDone && (
          <button onClick={advance} className="u-btn u-btn-primary u-btn-lg u-btn-block mt-5" data-testid="pre-continue">
            Continue
          </button>
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
              This is the part the unit is built around. Play it through to the end —
              the game tells us when you finish, and the next step opens then.
            </p>
            {/* No onClick markTried here: "tried" is set from the GAME side on mount
                (games/layout.tsx GameClock), so the escape below only unlocks once the
                activity actually loaded — not on this click, which a Back could beat in
                a second (finding FE1). */}
            <Link
              href={`/games/${meta.understandingGameId}?unit=${state.topic_id}&step=${position}&of=${steps.length}`}
            >
              <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
                {tried.game && !done.game ? "Back into the activity →" : "Open the activity →"}
              </button>
            </Link>

            {done.game ? (
              <>
                <button onClick={advance} className="u-btn u-btn-block mt-3" data-testid="unit-continue">
                  Continue
                </button>
                <p className="u-faint mt-3" data-testid="game-observed">
                  ✓ We have your activity recorded.
                </p>
              </>
            ) : (
              <>
                {/* NO SELF-DECLARED COMPLETION. This used to be an always-enabled
                    "I've finished it — continue", under a line saying you could
                    carry on either way. So the cheapest path through a twelve-week
                    study was one click and nothing else, and `played_understanding_
                    first` -- the independent variable -- would have recorded a
                    treatment that never happened. */}
                <p className="u-faint mt-3" data-testid="game-observed">
                  Not finished yet. Continue opens by itself as soon as the activity
                  records that you got to the end.
                </p>
                {tried.game && (
                  <button
                    onClick={() => carryOn("game", "activity_not_recorded")}
                    data-testid="unit-carry-on"
                    className="u-btn u-btn-block mt-3"
                    style={{ fontSize: ".8125rem" }}
                  >
                    The activity didn&apos;t record — continue without it
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Only after they've submitted and seen the answers — the post-check is
            where the feedback lands, so don't let them skip past it unread. */}
        {step === "post" && postDone && (
          <button onClick={advance} className="u-btn u-btn-block mt-5" data-testid="post-continue">
            Continue
          </button>
        )}

        {step === "assess" && (
          <div className="u-card p-8">
            <p className="u-eyebrow">Test yourself</p>
            <h2 className="u-h2 mt-2">How much of {meta.title} stuck?</h2>
            <p className="u-stem u-muted mt-4">
              A scored round on what you just worked through. It does not change the
              answers you already gave — those are recorded — and it is how your badge
              levels up.
            </p>
            {/* "tried" set on game mount (GameClock), not this click — see the
                understanding step above (finding FE1). */}
            <Link
              href={`/games/${meta.assessmentGameId}?unit=${state.topic_id}&step=${position}&of=${steps.length}`}
            >
              <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7">
                {tried.assess && !done.assess ? "Back into the assessment →" : "Open the assessment →"}
              </button>
            </Link>

            {done.assess ? (
              <>
                <button onClick={advance} className="u-btn u-btn-block mt-3" data-testid="unit-continue">
                  Continue
                </button>
                <p className="u-faint mt-3" data-testid="assess-observed">
                  ✓ Recorded
                  {typeof live.assess_score === "number" ? ` — ${Math.round(live.assess_score)}%` : ""}.
                </p>
              </>
            ) : (
              <>
                <p className="u-faint mt-3" data-testid="assess-observed">
                  Not played yet. Continue opens once the round is recorded.
                </p>
                {tried.assess && (
                  <button
                    onClick={() => carryOn("assess", "assessment_not_recorded")}
                    data-testid="unit-carry-on"
                    className="u-btn u-btn-block mt-3"
                    style={{ fontSize: ".8125rem" }}
                  >
                    The assessment didn&apos;t record — continue without it
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {step === "tutor" && (
          <div className="u-card p-8">
            <p className="u-eyebrow">Talk it through</p>
            <h2 className="u-h2 mt-2">Explain {meta.title} in your own words</h2>
            <p className="u-stem u-muted mt-4">
              The tutor will push back with questions rather than hand you answers —
              that&apos;s the point. If you get stuck it can just tell you; that button is
              in there too.
            </p>
            <blockquote
              className="u-stem mt-5 pl-4"
              style={{ borderLeft: "3px solid var(--accent)" }}
            >
              {meta.reflectionQuestion}
            </blockquote>
            {/* This step used to say "open the tutor (bottom-right)" and stop there.
                The thing bottom-right is the FLOATING tutor, which answers questions
                (POST /api/ask) — the opposite of what this step promises one line
                above. The Socratic surface is ReflectionDialog: it posts to
                /api/socratic, seeds itself with this very reflectionQuestion, holds a
                turn floor, detects genuine insight, and logs the transcript to the
                sink. It is mounted globally in app/layout.tsx and opens on this event
                — the dashboard already opens it the same way.
                Two tutors calling two endpoints would also mean two differently-shaped
                reflection rows for one construct, which the paper cannot use. */}
            <button
              onClick={() => {
                markTried("tutor")
                window.dispatchEvent(
                  new CustomEvent("start-reflection", { detail: { topicId: state.topic_id } }),
                )
              }}
              data-testid="open-reflection"
              className="u-btn u-btn-primary u-btn-lg u-btn-block mt-7"
            >
              {tried.tutor && !done.tutor
                ? "Back to the tutor →"
                : "Talk it through with the tutor →"}
            </button>

            {done.tutor ? (
              <>
                <button onClick={advance} className="u-btn u-btn-block mt-3" data-testid="unit-continue">
                  Continue
                </button>
                <p className="u-faint mt-3" data-testid="tutor-observed">
                  ✓ We have your reflection.
                </p>
              </>
            ) : (
              <>
                {/* Was "Done reflecting" -- always enabled, next to a tutor nobody
                    had to open. */}
                <p className="u-faint mt-3" data-testid="tutor-observed">
                  Continue opens once you have talked it through. There is no length
                  it has to reach.
                </p>
                {tried.tutor && (
                  <button
                    onClick={() => carryOn("tutor", "reflection_not_recorded")}
                    data-testid="unit-carry-on"
                    className="u-btn u-btn-block mt-3"
                    style={{ fontSize: ".8125rem" }}
                  >
                    The tutor isn&apos;t responding — continue without it
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {step === "close" && <RecordCompletion topicId={state.topic_id} arm={state.arm} />}
        {step === "close" && (
          <CloseScreen
            topicId={state.topic_id}
            title={meta.title}
            understandingGameId={meta.understandingGameId}
            assessmentGameId={meta.assessmentGameId}
          />
        )}
      </div>
    </main>
  )
}

// The unit recorded nothing of its own. Every row in the sink came from a check, a
// probe or a game, so "this student finished this topic" was only ever inferred from
// the post-check. Now it is stated.
//
// Fires once per browser per topic. The sink is append-only and a duplicate from a
// refresh would be harmless, but the guard keeps the table honest.
function RecordCompletion({ topicId, arm }: { topicId: string; arm: string }) {
  useEffect(() => {
    const key = `compgame:unit:${topicId}:recorded`
    try {
      if (window.localStorage.getItem(key)) return
      window.localStorage.setItem(key, "1")
    } catch {
      /* storage blocked -- record anyway; a duplicate beats a missing row */
    }
    logResearchEvent({ event_type: "topic_complete", topic_id: topicId, meta: { arm } })
  }, [topicId, arm])
  return null
}

// The end of a topic. It used to say "Your answers are saved and this topic is
// complete" and offer a link back to a list -- a full stop on the one screen that
// should feel like an arrival, after eight steps and about half an hour.
//
// It now leads with the thing no other product can tell a student: what changed
// between the check they sat before the activity and the one after it. Both numbers
// were already in the sink; the journey just never returned them.
//
// Fetched rather than lifted out of TopicCheck on purpose. The close step is
// resumable -- localStorage remembers it -- so a student who reloads here has to see
// the same thing, and only the server still knows it.
function CloseScreen({
  topicId,
  title,
  understandingGameId,
  assessmentGameId,
}: {
  topicId: string
  title: string
  understandingGameId: string
  assessmentGameId: string
}) {
  const [journey, setJourney] = useState<JourneyTopic[] | null>(null)

  useEffect(() => {
    topicsApi.journey().then((r) => setJourney(r.ok && r.data ? r.data.topics : []))
  }, [])

  const me = journey?.find((t) => t.topic_id === topicId)
  const pre = me?.pre_correct
  const post = me?.post_correct
  const hasDelta = typeof pre === "number" && typeof post === "number"
  const delta = hasDelta ? post - pre : 0

  // Said plainly, and only what the numbers support. A drop is not scolded: the two
  // forms are different items, and a student who went down needs the tutor, not a
  // telling-off.
  const sentence = !hasDelta
    ? "Your answers are saved."
    : delta > 0
      ? `You got ${delta} more right after the activity than before it.`
      : delta === 0
        ? "Same score both times — the tutor is a good place to take that."
        : "The second set asked different things, and some landed differently. Worth a word with the tutor."

  return (
    <div className="u-card p-8" data-testid="close-screen">
      <p className="u-eyebrow" style={{ color: "var(--state-done)" }}>
        ✓ Finished
      </p>
      <h2 className="u-h2 mt-2">{title}</h2>

      {hasDelta && (
        <div className="mt-6" data-testid="delta">
          <div className="flex items-baseline justify-between gap-4">
            <span className="u-muted">Before you started</span>
            <span className="u-num">{pre} / {me?.pre_total}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 mt-2">
            <span className="u-muted">After the activity</span>
            <span className="u-num">{post} / {me?.post_total}</span>
          </div>
          <p
            className="u-h2 mt-3"
            style={{ color: delta > 0 ? "var(--state-done)" : "var(--muted)" }}
          >
            {delta > 0 ? `▲ +${delta}` : delta === 0 ? "no change" : `▼ ${delta}`}
          </p>
        </div>
      )}

      <p className="u-stem u-muted mt-4">{sentence}</p>

      {journey && journey.length > 0 && (
        <div className="mt-7 pt-6" style={{ borderTop: "1px solid var(--rule)" }}>
          <JourneyPath topics={journey} showNext />
        </div>
      )}

      {/* AFTER the unit is recorded, never before. A student who closes the tab on
          this loses the questionnaire and nothing else -- their checks, probe and
          completion are already in. It renders nothing at all while questionnaires
          are switched off, which is the default. */}
      <TopicQuestionnaire topicId={topicId} />

      <Link href="/dashboard">
        <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-6">
          Continue the path →
        </button>
      </Link>

      {/* REPLAY. Until now finishing a topic made its game unreachable: this screen
          offered only "Continue the path", and reopening a finished topic resumes
          at the step it left off on, which is this one. So the last thing a student
          saw of an activity was the moment they completed it, and "I'd like to look
          at that again" had no answer.
          It matters more now that the steps above WAIT for real completion, because
          "you have to do it" is only fair next to "and you can do it again".
          No `?unit=` on purpose: the unit is finished and its answers are in. These
          open the games in free play, where nothing is re-sequenced and no check can
          be re-submitted -- the server allows one submission per check regardless. */}
      <div className="mt-7 pt-6" style={{ borderTop: "1px solid var(--rule)" }} data-testid="replay">
        <p className="u-eyebrow">Come back to it</p>
        <p className="u-faint mt-1.5">
          Your answers are already saved — replaying changes nothing you have
          submitted.
        </p>
        <div className="flex gap-3 mt-3 flex-wrap">
          <Link href={`/games/${understandingGameId}`} data-testid="replay-activity">
            <button className="u-btn">Play the activity again</button>
          </Link>
          <Link href={`/games/${assessmentGameId}`} data-testid="replay-assessment">
            <button className="u-btn">Retry the assessment</button>
          </Link>
        </div>
      </div>
    </div>
  )
}
