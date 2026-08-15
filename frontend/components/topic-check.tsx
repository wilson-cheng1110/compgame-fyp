"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { topics, type CheckItem, type CheckResult } from "@/lib/api"
import { ItemTracker, watchVisibility } from "@/lib/telemetry"

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
  onDone: (result: CheckResult) => void
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
  const panel = darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"

  useEffect(() => {
    let alive = true
    topics.getCheck(topicId, form).then((res) => {
      if (!alive) return
      if (!res.ok || !res.data) {
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

    if (!res.ok || !res.data) {
      setSubmitError(res.message ?? "Couldn't save your answers.")
      return
    }
    setResult(res.data)
    onDone(res.data)
  }

  if (loadError) {
    return (
      <div className={`p-6 border-2 border-black ${panel}`}>
        <p className="font-pixelify-sans text-lg">{loadError}</p>
      </div>
    )
  }

  if (!items) {
    return (
      <div className={`p-6 border-2 border-black ${panel}`}>
        <p className="font-pixelify-sans text-lg">Loading questions…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={`p-5 border-2 border-black ${panel}`}>
        <h2 className="font-press-start-2p text-[11px] leading-relaxed">
          {isPost ? "Check what you've learned" : "Quick check before you start"}
        </h2>
        <p className="font-pixelify-sans text-lg mt-2 opacity-80">
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
            className={`p-5 border-2 border-black ${panel}`}
            onMouseMove={(e) => t?.onPointerMove(e.clientX, e.clientY)}
            onTouchStart={() => t?.onTouch()}
          >
            <p className="font-pixelify-sans text-lg font-bold mb-4">
              <span className="font-press-start-2p text-[10px] mr-2 opacity-60">
                {idx + 1}/{items.length}
              </span>
              {item.stem}
            </p>

            <div className="space-y-2">
              {item.options.map((opt) => {
                const picked = answers[item.id] === opt.letter
                const isCorrect = graded?.correct_option === opt.letter
                const pickedWrong = graded && picked && !graded.was_correct

                let cls = "border-black bg-white text-black hover:bg-[#e6f4fb]"
                if (picked && !graded) cls = "border-[#0099db] bg-[#cfeaf7] text-black"
                if (isCorrect) cls = "border-green-700 bg-green-100 text-black"
                else if (pickedWrong) cls = "border-red-700 bg-red-100 text-black"

                return (
                  <button
                    key={opt.letter}
                    type="button"
                    disabled={!!result}
                    onClick={() => choose(item.id, opt.letter)}
                    onMouseEnter={() => t?.onHoverStart(opt.letter)}
                    onMouseLeave={() => t?.onHoverEnd(opt.letter)}
                    className={`w-full text-left px-4 py-3 border-2 font-pixelify-sans transition-colors disabled:cursor-default ${cls}`}
                  >
                    <span className="font-bold mr-2">{opt.letter})</span>
                    {opt.text}
                    {isCorrect && <span className="ml-2 font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {submitError && (
        <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 font-pixelify-sans text-center">
          {submitError}
        </div>
      )}

      {!result && (
        <>
          <p className="font-pixelify-sans text-center opacity-70">
            One attempt — you can change your mind until you submit.
          </p>
          <button
            onClick={submit}
            disabled={!allAnswered || busy}
            className="w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-press-start-2p py-4 text-[11px] transition-transform active:scale-95 shadow-[4px_4px_0px_0px_#000]"
          >
            {busy ? "Saving…" : allAnswered ? "Submit" : `Answer all ${items.length} to continue`}
          </button>
        </>
      )}

      {result && (
        <div className={`p-6 border-2 border-black ${panel}`}>
          {isPost ? (
            <>
              <p className="font-press-start-2p text-[13px]">
                {result.correct}/{result.total} correct
              </p>
              <p className="font-pixelify-sans text-lg mt-2 opacity-80">
                The correct answers are marked above.
              </p>
            </>
          ) : (
            <>
              <p className="font-press-start-2p text-[11px]">Answers recorded</p>
              <p className="font-pixelify-sans text-lg mt-2 opacity-80">
                No score yet — that's on purpose. You'll see how you did at the end of the topic.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
