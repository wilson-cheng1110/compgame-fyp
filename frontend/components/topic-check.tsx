"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { topics, type CheckItem, type CheckResult } from "@/lib/api"
import { ItemTracker, watchVisibility } from "@/lib/telemetry"
import { inlineMarkdown } from "@/lib/inline-markdown"

// The pre-check and the post-check are the SAME component with one flag, because
// the difference between them is exactly one thing: whether answers come back.
//
//   Form A (pre)  -> reveals nothing. Not the score, not which items were right.
//                    A pre-check that leaks anything lets a student infer the key
//                    and contaminates the post-check — which is the measurement
//                    this whole system exists to take.
//   Form B (post) -> reveals everything. Correct option and per-item outcome. This
//                    is where the teaching value of testing lands, and it costs the
//                    study nothing because measurement is already complete.
//
// "MC limit 1" means one SUBMISSION, not one interaction: changing your mind before
// committing is free, and each change is recorded as `selection_changes` — that
// hesitation is signal. After submit, the form locks and the server 409s a resubmit.
//
// docs/revamp.md Parts 2, 8.5, 11.

interface Props {
  topicId: string
  form: "A" | "B"
  telemetryEnabled: boolean
  onDone: (result?: CheckResult) => void
  darkMode?: boolean
}

export default function TopicCheck({ topicId, form, telemetryEnabled, onDone, darkMode }: Props) {
  const [items, setItems] = useState<CheckItem[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string>("")
  const [submitError, setSubmitError] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  const startedAt = useRef(Date.now())
  const trackers = useRef<Record<string, ItemTracker>>({})

  const isPost = form === "B"
  // Colour comes from the .shell token layer now (app/shell.css), so this component
  // inherits light/dark instead of hard-coding two hex values and hoping they match
  // whatever the page around it is doing. `darkMode` stays in the signature because
  // it is the app's existing theme contract and every caller passes it.
  void darkMode

  useEffect(() => {
    let alive = true
    topics.getCheck(topicId, form).then((res) => {
      if (!alive) return
      if (!res.ok || !res.data) {
        // A student who reloads after submitting used to land on a DEAD SCREEN:
        // the mount-time GET 409s "already_submitted" and this rendered only the
        // message with NO button, no way forward (sweep finding H1). The probe
        // already handles the identical case by advancing; the check must too — the
        // one submission is in, there is nothing to answer, so move them along.
        if (res.status === 409 || res.error === "already_submitted") {
          onDone()
          return
        }
        setLoadError(res.message ?? "Couldn't load the questions.")
        return
      }
      setItems(res.data.items)
      res.data.items.forEach((i) => {
        trackers.current[i.id] = new ItemTracker(telemetryEnabled)
      })
      startedAt.current = Date.now()
    })
    return () => {
      alive = false
    }
  }, [topicId, form, telemetryEnabled])

  useEffect(
    () => watchVisibility(() => Object.values(trackers.current)),
    [],
  )

  const allAnswered = useMemo(
    () => !!items && items.every((i) => answers[i.id]),
    [items, answers],
  )

  const choose = (itemId: string, letter: string) => {
    if (result) return // locked after submit
    if (answers[itemId] && answers[itemId] !== letter) {
      trackers.current[itemId]?.onSelectionChange()
    }
    setAnswers((prev) => ({ ...prev, [itemId]: letter }))
  }

  const submit = async () => {
    if (!items || busy || result) return
    setSubmitError("")
    setBusy(true)

    const telemetry: Record<string, unknown> = {}
    for (const item of items) {
      const snap = trackers.current[item.id]?.snapshot()
      if (snap) telemetry[item.id] = snap
    }

    const res = await topics.submitCheck(
      topicId,
      form,
      answers,
      Date.now() - startedAt.current,
      Object.keys(telemetry).length ? telemetry : undefined,
    )
    setBusy(false)

    // Lost the one-submission race, or a double-submit (finding C1): the winning
    // request already persisted this check. The server deliberately does NOT return a
    // reveal here — the answers behind it may not be ours — so treat it as done rather
    // than surface an error or a score that was never stored.
    //
    // Key on the ERROR STRING, not a bare 409: submit_check ALSO returns 409 for
    // `pre_check_first` (a POST submitted before the PRE was recorded — the ordering
    // gate). Auto-advancing on that would silently fake a completed post-check with no
    // grade and no message. Only `already_submitted` means "the row is safely in"; any
    // other 409 must fall through to a visible error below.
    if (res.error === "already_submitted") {
      onDone()
      return
    }

    if (!res.ok || !res.data) {
      setSubmitError(res.message ?? "Couldn't save your answers.")
      return
    }
    setResult(res.data)
    onDone(res.data)
  }

  if (loadError) {
    return (
      <div className="u-card p-6">
        <p className="u-stem">{loadError}</p>
      </div>
    )
  }

  if (!items) {
    return (
      <div className="u-card p-6">
        <p className="u-muted">Loading questions…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="u-card p-6">
        <p className="u-eyebrow">{isPost ? "Second check" : "First check"}</p>
        <h2 className="u-h2 mt-2">
          {isPost ? "Check what you've learned" : "Before you start"}
        </h2>
        <p className="u-stem u-muted mt-3">
          {isPost
            ? "Same idea, different questions. You'll see the answers straight after."
            : "Answer as best you can — you're not expected to know these yet, and this doesn't affect your grade. You'll get one attempt, and no answers until the end of the topic."}
        </p>
      </div>

      {items.map((item, idx) => {
        const graded = result?.items?.find((g) => g.id === item.id)
        const t = trackers.current[item.id]
        return (
          <div
            key={item.id}
            className="u-card p-6"
            onMouseMove={(e) => t?.onPointerMove(e.clientX, e.clientY)}
            onTouchStart={() => t?.onTouch()}
          >
            <p className="u-eyebrow u-num mb-2">
              Question {idx + 1} of {items.length}
            </p>
            {/* Serif, measure-limited. This is the sentence the whole study turns
                on; it gets the typography of something meant to be read once and
                carefully, rather than scanned. */}
            <p id={`stem-${item.id}`} className="u-stem mb-5">{inlineMarkdown(item.stem)}</p>

            {/* radiogroup + radio, not six loose buttons. The comment below is
                right that OUTCOME never rests on hue alone -- but SELECTION did:
                a picked option was a border and a background colour and nothing
                else, so a student using a screen reader could not tell which
                answer they had chosen, or whether they had chosen one at all.
                An item they believe they answered and did not is a missing datum,
                which makes this a measurement problem as much as an access one. */}
            <div className="space-y-2" role="radiogroup" aria-labelledby={`stem-${item.id}`}>
              {item.options.map((opt) => {
                const picked = answers[item.id] === opt.letter
                const isCorrect = graded?.correct_option === opt.letter
                const pickedWrong = graded && picked && !graded.was_correct

                // Outcome is carried by a border, a background AND a glyph — never
                // by hue alone. Same reason the state chips have shapes.
                const style: React.CSSProperties = {
                  borderColor: "var(--rule-strong)",
                  background: "var(--paper-raised)",
                }
                if (picked && !graded) {
                  style.borderColor = "var(--accent)"
                  style.background = "var(--accent-soft)"
                }
                if (isCorrect) {
                  style.borderColor = "var(--state-done)"
                  style.background = "var(--accent-soft)"
                } else if (pickedWrong) {
                  style.borderColor = "var(--state-late)"
                }

                return (
                  <button
                    key={opt.letter}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    disabled={!!result}
                    onClick={() => choose(item.id, opt.letter)}
                    onMouseEnter={() => t?.onHoverStart(opt.letter)}
                    onMouseLeave={() => t?.onHoverEnd(opt.letter)}
                    style={style}
                    data-testid="mc-option"
                    className="w-full text-left px-4 py-3 border rounded-lg transition-colors disabled:cursor-default flex gap-3 items-baseline"
                  >
                    <span className="u-eyebrow" style={{ opacity: 0.75 }}>
                      {opt.letter}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                    {isCorrect && <span style={{ color: "var(--state-done)" }}>✓</span>}
                    {pickedWrong && <span style={{ color: "var(--state-late)" }}>×</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {submitError && (
        <div
          role="alert"
          className="u-card p-4 text-center"
          style={{ borderColor: "var(--state-late)", color: "var(--state-late)" }}
        >
          {submitError}
        </div>
      )}

      {!result && (
        <>
          <p className="u-faint text-center">
            One attempt — you can change your mind until you submit.
          </p>
          <button
            onClick={submit}
            disabled={!allAnswered || busy}
            data-testid="mc-submit"
            className="u-btn u-btn-primary u-btn-lg u-btn-block"
          >
            {busy ? "Saving…" : allAnswered ? "Submit" : `Answer all ${items.length} to continue`}
          </button>
        </>
      )}

      {result && (
        <div className="u-card p-6">
          {isPost ? (
            <>
              <p className="u-eyebrow">Result</p>
              <p className="u-h1 u-num mt-1">
                {result.correct}/{result.total}
              </p>
              <p className="u-stem u-muted mt-2">The correct answers are marked above.</p>
            </>
          ) : (
            <>
              <p className="u-eyebrow">Recorded</p>
              <p className="u-stem u-muted mt-2">
                No score yet — that is on purpose. You will see how you did at the end of the
                topic.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
