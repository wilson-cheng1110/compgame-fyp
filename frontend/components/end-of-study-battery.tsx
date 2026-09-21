"use client"

import { useEffect, useState } from "react"
import {
  retention,
  questionnaires,
  type JourneyTopic,
  type CheckItem,
  type CheckResult,
  type QuestionnaireInstrument,
} from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"

// The end-of-study battery: for every topic the student COMPLETED, a Form-C
// retention re-test (own server-shuffled anti-collusion order — backend/retention.py)
// followed by the 3-item affect_recall instrument, topic by topic. Shown once, gated
// on `journey.end_of_study_open` (the dashboard decides WHEN; this component only
// walks the topics it is given and owns its own step state).
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
//   6. Resumable: a topic whose retention was already recorded (a prior session that
//      dropped mid-battery) is detected via the server's own 409 and skipped straight
//      to that topic's affect step — no re-answering a graded quiz. The 3-item affect
//      step re-submits idempotently (the server 409s a duplicate and this treats that
//      as success, the same pattern topic-questionnaire.tsx already uses for PAAS) —
//      there is no separate per-topic "already answered" signal to check ahead of
//      time for a 3-item Likert, so in the rare case of a reload landing exactly
//      between the two steps, the affect items may be shown again; answering them
//      again costs nothing (the duplicate is silently discarded server-side).

type Phase = "retention" | "affect"

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

  const [affectInst, setAffectInst] = useState<QuestionnaireInstrument | null>(null)
  const [affectAnswers, setAffectAnswers] = useState<Record<string, number>>({})
  const [affectBusy, setAffectBusy] = useState(false)
  const [affectError, setAffectError] = useState("")

  const current = topics[index] as JourneyTopic | undefined
  const def = current ? TOPICS.find((t) => t.id === current.topic_id) : undefined

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
      if (res.error === "already_submitted") {
        setPhase("affect")
        return
      }
      if (!res.ok || !res.data) {
        setRetError(res.message ?? "Couldn't load the retention check.")
        return
      }
      setRetItems(res.data.items)
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
          <p style={{ fontWeight: 600 }}>One last thing: a quick look back</p>
          <p className="u-faint mt-0.5">
            For each topic you finished — a short recap quiz, and three quick questions
            about how it went. About a minute per topic.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="u-btn u-btn-primary"
          data-testid="end-of-study-start"
        >
          Start the review
        </button>
      </div>
    )
  }

  if (!current) return null

  const chooseRet = (itemId: string, letter: string) => {
    if (retResult) return
    setRetAnswers((prev) => ({ ...prev, [itemId]: letter }))
  }

  const submitRet = async () => {
    if (!retItems || retBusy || retResult) return
    setRetBusy(true)
    setRetError("")
    const res = await retention.submit(current.topic_id, retAnswers)
    setRetBusy(false)
    // Lost a race or a resubmit from a second tab — the row is already in.
    if (res.error === "already_submitted") {
      setPhase("affect")
      return
    }
    if (!res.ok || !res.data) {
      setRetError(res.message ?? "Couldn't save your answers.")
      return
    }
    setRetResult(res.data)
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
          <p className="u-stem u-muted">A quick recap — same idea as before, fresh questions.</p>

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
                return (
                  <div key={item.id} className="u-card-quiet p-4" data-testid="retention-item">
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
                    onClick={() => setPhase("affect")}
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
