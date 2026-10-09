"use client"

import { useEffect, useRef, useState } from "react"
import { ItemTracker, watchVisibility } from "@/lib/telemetry"
import {
  retention,
  retentionProbe,
  questionnaires,
  type JourneyTopic,
  type CheckItem,
  type CheckResult,
  type QuestionnaireInstrument,
} from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import { suppressTutor } from "@/lib/tutor-suppress"
import RetentionReview from "@/components/retention-review"

// The end-of-study battery: for every topic the student COMPLETED, three steps,
// topic by topic —
//   1. a Form-C retention MC re-test (own server-shuffled anti-collusion order —
//      backend/retention.py), the recognition floor;
//   2. an application SHORT-ANSWER probe (backend/retention_probe.py) — the
//      constructed-response transfer DV, the discriminating half (recognition is
//      easy; APPLYING the law is the hard part). Capture-only, like the live probe:
//      prompt in, no grade back (offline blind grading);
//   3. the 3-item affect_recall instrument.
// Shown once, gated on `journey.end_of_study_open` (the dashboard decides WHEN; this
// component only walks the topics it is given and owns its own step state).
//
// UX (docs/end-of-study-battery-plan.md, "dogfood HCI" — this IS an HCI-teaching
// platform, so the instrument itself has to model good practice):
//   1. Tap-to-select radio chips, one tap per answer — same idiom as topic-check.tsx
//      and instrument-form.tsx, reused rather than reinvented.
//   2. ONE topic's items per screen (retention MC, then its 3 affect items), not a
//      wall of thirteen topics' worth of questions.
//   3. "Topic X of N" + a progress bar (Nielsen #1, visibility of system status).
//   4. Topic name + icon, not just an id (Nielsen #6, recognition not recall).
//   5. Continue/Submit disabled until every required item on screen is answered.
//   6. Resumable, step by step, off each router's own 409: a prior session that
//      dropped mid-battery is walked forward without re-answering anything already
//      recorded. Retention already in → land on the probe; probe already in → land
//      on affect (each step's loader detects its own "already_submitted" and skips
//      ahead — no re-answering a graded quiz or a spent one-shot short answer). The
//      3-item affect step re-submits idempotently (the server 409s a duplicate and
//      this treats that as success, the same pattern topic-questionnaire.tsx already
//      uses for PAAS) — there is no separate per-topic "already answered" signal to
//      check ahead of time for a 3-item Likert, so in the rare case of a reload
//      landing exactly on it, the affect items may be shown again; answering them
//      again costs nothing (the duplicate is silently discarded server-side).

type Phase = "retention" | "probe" | "affect"

export default function EndOfStudyBattery({
  topics,
  onDone,
}: {
  /** Every topic this student COMPLETED, in release order. */
  topics: JourneyTopic[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>("retention")
  const [done, setDone] = useState(false)

  const [retItems, setRetItems] = useState<CheckItem[] | null>(null)
  const [retAnswers, setRetAnswers] = useState<Record<string, string>>({})
  const [retResult, setRetResult] = useState<CheckResult | null>(null)
  const [retBusy, setRetBusy] = useState(false)
  const [retError, setRetError] = useState("")
  // Per-item interaction telemetry on the Form C items, mirroring topic-check.tsx. Kept
  // only when the server says TELEMETRY_ENABLED (and the server drops it otherwise). On the
  // live checks, selection changes + options hovered tracked doubt and showed a FLIP effect
  // the 6-item score could not (2026-10-08) -- pre-reg 01b's decisiveness DV needs it here.
  const retTrackers = useRef<Record<string, ItemTracker>>({})
  const retStartedAt = useRef<number>(0)
  // Copying a question is blocked and COUNTED (2026-10-09): on the immediate checks,
  // leaving the page went with +7 points (external help). Counts ride each item's
  // telemetry snapshot, so they are kept only when TELEMETRY_ENABLED.
  const retCopies = useRef<Record<string, number>>({})
  const probeTracker = useRef<ItemTracker | null>(null)
  const probeCopies = useRef(0)
  useEffect(
    () => watchVisibility(() => [...Object.values(retTrackers.current),
                                 ...(probeTracker.current ? [probeTracker.current] : [])]),
    [],
  )
  const [reviewScores, setReviewScores] = useState<{ topic_id: string; score: number }[]>([])

  const [probePrompt, setProbePrompt] = useState<string | null>(null)
  const [probeAnswer, setProbeAnswer] = useState("")
  const [probeBusy, setProbeBusy] = useState(false)
  const [probeError, setProbeError] = useState("")
  const probeStartedAt = useRef(Date.now())

  const [affectInst, setAffectInst] = useState<QuestionnaireInstrument | null>(null)
  const [affectAnswers, setAffectAnswers] = useState<Record<string, number>>({})
  const [affectBusy, setAffectBusy] = useState(false)
  const [affectError, setAffectError] = useState("")

  const current = topics[index] as JourneyTopic | undefined
  const def = current ? TOPICS.find((t) => t.id === current.topic_id) : undefined

  // The AI tutor steps aside while the battery is open (lib/tutor-suppress.ts).
  useEffect(() => {
    if (!open || done) return
    return suppressTutor()
  }, [open, done])

  // The payoff for answering honestly: which topics to revise before the exam.
  useEffect(() => {
    if (!done) return
    retention.status().then((res) => {
      if (res.ok && res.data?.scores) setReviewScores(res.data.scores)
    })
  }, [done])

  // Load the current topic's retention step whenever we land on it. A 409 here means
  // a previous session already recorded it — skip straight to the affect step rather
  // than error or re-show a graded quiz.
  useEffect(() => {
    if (!open || done || !current || phase !== "retention") return
    let alive = true
    setRetItems(null)
    setRetAnswers({})
    setRetResult(null)
    setRetError("")
    retention.get(current.topic_id).then((res) => {
      if (!alive) return
      // Already recorded (a dropped prior session) → the MC is done; walk forward
      // to the application probe rather than re-showing a graded quiz.
      if (res.error === "already_submitted") {
        setPhase("probe")
        return
      }
      if (!res.ok || !res.data) {
        setRetError(res.message ?? "Couldn't load the retention check.")
        return
      }
      const tel = !!res.data.telemetry_enabled
      retTrackers.current = {}
      retCopies.current = {}
      res.data.items.forEach((i) => {
        retTrackers.current[i.id] = new ItemTracker(tel)
      })
      retStartedAt.current = Date.now()
      setRetItems(res.data.items)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, current?.topic_id, phase])

  // Load the current topic's application-probe prompt when we land on it. A 409 here
  // means this topic's short answer is already recorded (a dropped prior session) —
  // skip straight to the affect step rather than re-showing a spent one-shot prompt.
  useEffect(() => {
    if (!open || done || !current || phase !== "probe") return
    let alive = true
    setProbePrompt(null)
    setProbeAnswer("")
    setProbeError("")
    retentionProbe.get(current.topic_id).then((res) => {
      if (!alive) return
      if (res.error === "already_submitted") {
        setPhase("affect")
        return
      }
      if (!res.ok || !res.data) {
        setProbeError(res.message ?? "Couldn't load the question.")
        return
      }
      probeTracker.current = new ItemTracker(!!res.data.telemetry_enabled)
      probeCopies.current = 0
      setProbePrompt(res.data.prompt)
      probeStartedAt.current = Date.now()
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, current?.topic_id, phase])

  // The affect_recall item bank is the SAME 3 items for every topic — fetched once.
  useEffect(() => {
    if (!open) return
    let alive = true
    questionnaires.get("affect_recall").then((res) => {
      if (alive && res.ok && res.data) setAffectInst(res.data)
    })
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    setAffectAnswers({})
    setAffectError("")
  }, [current?.topic_id, phase])

  if (!topics.length || done) {
    return done ? (
      <div className="u-card p-5 mt-6" data-testid="end-of-study-done">
        <p className="u-stem">Thanks — that&apos;s the whole review, recorded.</p>
        <RetentionReview scores={reviewScores} />
      </div>
    ) : null
  }

  if (!open) {
    return (
      <div
        className="u-card p-5 mt-6 flex items-center justify-between gap-4 flex-wrap"
        data-testid="end-of-study-prompt"
      >
        <div>
          <p style={{ fontWeight: 600 }}>Exam revision check: what do you still remember?</p>
          <p className="u-faint mt-0.5">
            For each topic you finished — a short recap quiz, one short-answer
            question, and three quick questions about how it went. A couple of minutes
            per topic. At the end you get the list of topics worth revising before the exam.
          </p>
          <p className="u-faint mt-1" data-testid="end-of-study-honesty">
            It isn&apos;t graded. Answer from memory — looking answers up only hides the
            topics you actually need to revise.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="u-btn u-btn-primary"
          data-testid="end-of-study-start"
        >
          I&apos;ll answer from memory — start
        </button>
      </div>
    )
  }

  if (!current) return null

  const chooseRet = (itemId: string, letter: string) => {
    if (retResult) return
    if (retAnswers[itemId] && retAnswers[itemId] !== letter) {
      retTrackers.current[itemId]?.onSelectionChange()
    }
    setRetAnswers((prev) => ({ ...prev, [itemId]: letter }))
  }

  const submitRet = async () => {
    if (!retItems || retBusy || retResult) return
    setRetBusy(true)
    setRetError("")
    const telemetry: Record<string, unknown> = {}
    for (const item of retItems) {
      const snap = retTrackers.current[item.id]?.snapshot()
      if (snap) telemetry[item.id] = { ...snap, copy_attempts: retCopies.current[item.id] ?? 0 }
    }
    const res = await retention.submit(
      current.topic_id,
      retAnswers,
      Date.now() - retStartedAt.current,
      Object.keys(telemetry).length ? telemetry : undefined,
    )
    setRetBusy(false)
    // Lost a race or a resubmit from a second tab — the row is already in.
    if (res.error === "already_submitted") {
      setPhase("probe")
      return
    }
    if (!res.ok || !res.data) {
      setRetError(res.message ?? "Couldn't save your answers.")
      return
    }
    setRetResult(res.data)
  }

  // Same empty-guard as the live topic-probe.tsx: no MINIMUM length (a two-word
  // answer is a real datum), but Submit is dead until there's a character, because
  // the one-submission rule means an accidental empty click spends the only chance.
  const probeWords = probeAnswer.trim() ? probeAnswer.trim().split(/\s+/).length : 0

  const submitProbe = async () => {
    if (!probePrompt || probeBusy || probeWords === 0) return
    setProbeBusy(true)
    setProbeError("")
    const psnap = probeTracker.current?.snapshot()
    const res = await retentionProbe.submit(
      current.topic_id,
      probeAnswer,
      Date.now() - probeStartedAt.current,
      psnap ? { probe: { ...psnap, copy_attempts: probeCopies.current } } : undefined,
    )
    setProbeBusy(false)
    // NO grade ever comes back (offline blind grading, like the live probe). Success —
    // or a 409 from a race / second tab where the row is already in — just advances.
    if (!res.ok && res.status !== 409 && res.error !== "already_submitted") {
      setProbeError(res.message ?? "Couldn't save that. Try again.")
      return
    }
    setPhase("affect")
  }

  const setAffect = (id: string, value: number) =>
    setAffectAnswers((prev) => ({ ...prev, [id]: value }))

  const affectRemaining = affectInst
    ? affectInst.items.filter((it) => affectAnswers[it.id] === undefined).length
    : 1

  const isLastTopic = index + 1 >= topics.length

  const finishBattery = async () => {
    // Best-effort terminal marker — the server independently re-verifies every
    // topic's retention is in before it will accept this, so a network hiccup here
    // just leaves the prompt reappearing next visit rather than losing anything.
    await retention.complete()
    setDone(true)
    onDone()
  }

  const submitAffect = async () => {
    if (!affectInst || affectBusy) return
    setAffectBusy(true)
    setAffectError("")
    const res = await questionnaires.submit("affect_recall", affectAnswers, {
      topic_id: current.topic_id,
    })
    setAffectBusy(false)
    // 409 is "already submitted" (a resubmit or a second tab) — not an error to show.
    if (!res.ok && res.status !== 409) {
      setAffectError(res.message ?? "That did not save. Try once more.")
      return
    }
    if (isLastTopic) {
      await finishBattery()
    } else {
      setIndex((i) => i + 1)
      setPhase("retention")
    }
  }

  const retAllAnswered = !!retItems && retItems.every((i) => retAnswers[i.id])

  return (
    <div className="u-card p-6 mt-6" data-testid="end-of-study-battery">
      <p className="u-eyebrow">
        End-of-study review · Topic {index + 1} of {topics.length}
      </p>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--paper-sunken)",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(index / topics.length) * 100}%`,
            background: "var(--accent)",
            transition: "width .4s ease",
          }}
        />
      </div>
      <h2 className="u-h2 mt-3 flex items-center gap-2">
        <span aria-hidden>{def?.icon}</span> {def?.title ?? current.topic_id}
      </h2>

      {phase === "retention" && (
        <div className="mt-5" data-testid="end-of-study-retention">
          <p className="u-stem u-muted">
            A quick recap — same idea as before, fresh questions. Answer from memory; it only
            shows you what to revise.
          </p>

          {retError && (
            <p className="u-stem mt-3" style={{ color: "var(--state-late)" }}>
              {retError}
            </p>
          )}
          {!retItems && !retError && <p className="u-muted mt-4">Loading…</p>}

          {retItems && (
            <div className="space-y-4 mt-4">
              {retItems.map((item, idx) => {
                const graded = retResult?.items?.find((g) => g.id === item.id)
                const t = retTrackers.current[item.id]
                return (
                  <div
                    key={item.id}
                    className="u-card-quiet p-4"
                    data-testid="retention-item"
                    onMouseMove={(e) => t?.onPointerMove(e.clientX, e.clientY)}
                    onTouchStart={() => t?.onTouch()}
                    onCopy={(e) => {
                      e.preventDefault()
                      retCopies.current[item.id] = (retCopies.current[item.id] ?? 0) + 1
                    }}
                    onCut={(e) => e.preventDefault()}
                    style={{ userSelect: "none" }}
                  >
                    <p className="u-eyebrow u-num mb-2">
                      Question {idx + 1} of {retItems.length}
                    </p>
                    <p id={`ret-stem-${item.id}`} className="u-stem mb-3">
                      {item.stem}
                    </p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="radiogroup"
                      aria-labelledby={`ret-stem-${item.id}`}
                    >
                      {item.options.map((opt) => {
                        const picked = retAnswers[item.id] === opt.letter
                        const isCorrect = graded?.correct_option === opt.letter
                        const pickedWrong = graded && picked && !graded.was_correct
                        return (
                          <button
                            key={opt.letter}
                            type="button"
                            role="radio"
                            aria-checked={picked}
                            disabled={!!retResult}
                            onClick={() => chooseRet(item.id, opt.letter)}
                            onMouseEnter={() => t?.onHoverStart(opt.letter)}
                            onMouseLeave={() => t?.onHoverEnd(opt.letter)}
                            data-testid="retention-option"
                            className="u-btn"
                            style={{
                              textAlign: "left",
                              borderColor: isCorrect
                                ? "var(--state-done)"
                                : pickedWrong
                                  ? "var(--state-late)"
                                  : picked
                                    ? "var(--accent)"
                                    : undefined,
                              background:
                                picked && !graded
                                  ? "var(--accent-soft)"
                                  : isCorrect
                                    ? "var(--accent-soft)"
                                    : undefined,
                            }}
                          >
                            <span className="u-eyebrow" style={{ opacity: 0.75, marginRight: 8 }}>
                              {opt.letter}
                            </span>
                            {opt.text}
                            {isCorrect && " ✓"}
                            {pickedWrong && " ×"}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {!retResult ? (
                <button
                  onClick={submitRet}
                  disabled={!retAllAnswered || retBusy}
                  data-testid="retention-submit"
                  className="u-btn u-btn-primary u-btn-lg u-btn-block mt-2"
                >
                  {retBusy ? "Saving…" : retAllAnswered ? "Submit" : `Answer all ${retItems.length} to continue`}
                </button>
              ) : (
                <div className="u-card-quiet p-4 mt-2">
                  <p className="u-eyebrow">Result</p>
                  <p className="u-h1 u-num mt-1">
                    {retResult.correct}/{retResult.total}
                  </p>
                  <button
                    onClick={() => setPhase("probe")}
                    data-testid="retention-continue"
                    className="u-btn u-btn-primary mt-4"
                  >
                    Continue →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "probe" && (
        <div className="mt-5" data-testid="end-of-study-probe">
          <p className="u-stem u-muted">
            In your own words — a short answer this time, not multiple choice.
          </p>

          {probeError && (
            <p className="u-stem mt-3" style={{ color: "var(--state-late)" }}>
              {probeError}
            </p>
          )}
          {!probePrompt && !probeError && <p className="u-muted mt-4">Loading…</p>}

          {probePrompt && (
            <div className="mt-4 space-y-4">
              <p
                className="u-stem"
                data-testid="retention-probe-prompt"
                style={{ userSelect: "none" }}
                onCopy={(e) => {
                  e.preventDefault()
                  probeCopies.current += 1
                }}
                onCut={(e) => e.preventDefault()}
              >
                {probePrompt}
              </p>
              <textarea
                value={probeAnswer}
                onChange={(e) => setProbeAnswer(e.target.value)}
                onKeyDown={(e) => probeTracker.current?.onKey(e.key)}
                onPaste={() => probeTracker.current?.onPaste()}
                onMouseMove={(e) => probeTracker.current?.onPointerMove(e.clientX, e.clientY)}
                onTouchStart={() => probeTracker.current?.onTouch()}
                rows={7}
                maxLength={4000}
                data-testid="retention-probe-answer"
                placeholder="Two or three sentences is plenty. Everyday words are fine — you don't need the textbook term."
                className="u-field resize-y"
              />
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="u-faint">
                  {probeWords === 0
                    ? "Not marked for spelling or grammar."
                    : `${probeWords} word${probeWords === 1 ? "" : "s"}`}
                </p>
                <button
                  onClick={submitProbe}
                  disabled={probeBusy || probeWords === 0}
                  data-testid="retention-probe-submit"
                  className="u-btn u-btn-primary u-btn-lg u-btn-block"
                >
                  {probeBusy
                    ? "Saving…"
                    : probeWords === 0
                      ? "Write something to continue"
                      : "Continue →"}
                </button>
              </div>
              <p
                className="u-faint u-hr pt-3"
                style={{ borderTop: "1px solid var(--rule)" }}
              >
                One submission. This isn&apos;t marked for a grade — it just helps show
                what stuck.
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "affect" && (
        <div className="mt-5" data-testid="end-of-study-affect">
          <p className="u-stem u-muted">Three quick questions about this topic, looking back.</p>

          {!affectInst && <p className="u-muted mt-4">Loading…</p>}

          {affectInst && (
            <>
              {affectInst.items.map((item) => {
                const chosen = affectAnswers[item.id]
                return (
                  <fieldset key={item.id} className="mt-5" data-testid="affect-item">
                    <legend className="u-stem">{item.text}</legend>
                    <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label={item.text}>
                      {affectInst.scale.map((label, i) => {
                        const value = i + 1
                        const on = chosen === value
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setAffect(item.id, value)}
                            data-testid="affect-option"
                            className="u-btn"
                            style={{
                              fontSize: ".8125rem",
                              padding: ".3125rem .75rem",
                              background: on ? "var(--accent)" : undefined,
                              color: on ? "var(--accent-ink)" : undefined,
                              borderColor: on ? "var(--accent)" : undefined,
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}

              {affectError && (
                <p className="u-stem mt-4" style={{ color: "var(--state-late)" }}>
                  {affectError}
                </p>
              )}

              <button
                onClick={submitAffect}
                disabled={affectBusy || affectRemaining > 0}
                data-testid="affect-submit"
                className="u-btn u-btn-primary u-btn-lg u-btn-block mt-5"
              >
                {affectBusy
                  ? "Saving…"
                  : affectRemaining > 0
                    ? `Answer ${affectRemaining} more to continue`
                    : isLastTopic
                      ? "Finish"
                      : "Continue →"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
