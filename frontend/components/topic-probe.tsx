"use client"

import { useEffect, useRef, useState } from "react"
import { topics } from "@/lib/api"
import { ItemTracker, watchVisibility } from "@/lib/telemetry"

// The short-answer probe. docs/revamp.md Part 8.1.
//
// The other half of the hybrid: the MC check measures the primary DV with a fixed
// key, and this measures whether the student can say the idea in their own words.
// The two are kept strictly separate in what they're used for — this one is NEVER
// scored into the normalized gain.
//
// THREE THINGS THAT LOOK LIKE OMISSIONS AND ARE NOT:
//
//  1. No grade comes back. Ever. Grading is offline and blind (Part 8.2), and a
//     level shown here would leak the rubric's judgement mid-unit. On the
//     pre-check it is exactly the feedback Part 8.5 withholds — the student would
//     learn from the test instead of from the intervention. The student is TOLD
//     this rather than left to wonder why nothing happened.
//  2. No minimum length is enforced. A short answer is a real datum (the server's
//     null filter records *why* it wasn't gradeable), and a hard gate would push
//     students into padding, which corrupts the text we actually want to read.
//     The hint nudges; it never blocks.
//  3. The question is the same for everyone. A per-student generated probe is a
//     different instrument per student, and answers to different questions cannot
//     be pooled or compared pre to post.

interface Props {
  topicId: string
  form: "A" | "B"
  telemetryEnabled: boolean
  onDone: () => void
  darkMode?: boolean
}

export default function TopicProbe({ topicId, form, telemetryEnabled, onDone, darkMode }: Props) {
  const [probe, setProbe] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")
  const [loadError, setLoadError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const startedAt = useRef(Date.now())
  const tracker = useRef(new ItemTracker(telemetryEnabled))

  const panel = darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0

  useEffect(() => {
    let alive = true
    topics.getProbe(topicId, form).then((res) => {
      if (!alive) return
      if (!res.ok || !res.data) {
        // 409 already_submitted is not an error the student needs to solve —
        // they've done this one, move them along rather than stranding them.
        if (res.error === "already_submitted") {
          onDone()
          return
        }
        setLoadError(res.message ?? "Couldn't load the question.")
        return
      }
      setProbe(res.data.probe)
      startedAt.current = Date.now()
    })
    return () => {
      alive = false
    }
  }, [topicId, form, onDone])

  useEffect(() => watchVisibility(() => [tracker.current]), [])

  async function submit() {
    if (busy || sent) return
    setBusy(true)
    setSubmitError("")
    // Wrapped in a per-item map keyed "probe", matching how TopicCheck sends one
    // entry per MC item. The probe has exactly one item, so this is a one-entry
    // map rather than a different shape — analysis code reads both the same way.
    const snap = tracker.current.snapshot()
    const res = await topics.submitProbe(
      topicId,
      form,
      answer,
      Date.now() - startedAt.current,
      snap ? { probe: snap } : undefined,
    )
    setBusy(false)
    if (!res.ok) {
      if (res.error === "already_submitted") {
        onDone()
        return
      }
      setSubmitError(res.message ?? "Couldn't save that. Try again.")
      return
    }
    setSent(true)
  }

  if (loadError) {
    return (
      <div className={`${panel} border-4 border-black p-6 rounded-lg`}>
        <p className="text-sm">{loadError}</p>
      </div>
    )
  }

  if (!probe) {
    return (
      <div className={`${panel} border-4 border-black p-6 rounded-lg`}>
        <p className="text-sm opacity-70">Loading…</p>
      </div>
    )
  }

  if (sent) {
    return (
      <div className={`${panel} border-4 border-black p-6 rounded-lg space-y-4`}>
        <h3 className="text-lg font-bold">Saved.</h3>
        <p className="text-sm leading-relaxed">
          {form === "A"
            ? "That's recorded. You won't get feedback on it now — seeing the answer here would give away what the rest of this topic is about."
            : "That's recorded. Your tutor will see the class's answers as a group, without names attached."}
        </p>
        <button
          onClick={onDone}
          className="px-5 py-2 border-4 border-black bg-[#ffd166] font-bold rounded hover:translate-y-[-2px] transition-transform"
        >
          Continue →
        </button>
      </div>
    )
  }

  return (
    <div className={`${panel} border-4 border-black p-6 rounded-lg space-y-5`}>
      <div>
        <p className="text-xs uppercase tracking-widest opacity-60 mb-2">
          In your own words
        </p>
        <p className="text-base leading-relaxed font-medium">{probe}</p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => tracker.current.onKey(e.key)}
        onPaste={() => tracker.current.onPaste()}
        onMouseMove={(e) => tracker.current.onPointerMove(e.clientX, e.clientY)}
        onTouchStart={() => tracker.current.onTouch()}
        rows={7}
        maxLength={4000}
        placeholder="Two or three sentences is plenty. Everyday words are fine — you don't need the textbook term."
        className="w-full p-3 border-4 border-black rounded bg-white text-black resize-y focus:outline-none focus:ring-4 focus:ring-[#ffd166]"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs opacity-60">
          {words === 0
            ? "Not marked for spelling or grammar."
            : words < 4
            ? `${words} word${words === 1 ? "" : "s"} — a bit more and it'll be easier to read.`
            : `${words} words`}
        </p>
        <button
          onClick={submit}
          disabled={busy}
          className="px-6 py-2 border-4 border-black bg-[#06d6a0] font-bold rounded disabled:opacity-50 hover:translate-y-[-2px] transition-transform"
        >
          {busy ? "Saving…" : "Submit"}
        </button>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <p className="text-xs opacity-50 leading-relaxed border-t-2 border-black/10 pt-3">
        One submission. This isn&apos;t marked for a grade — it goes to your tutor as
        part of the class picture, and it helps the AI tutor pitch its questions to
        where you actually are.
      </p>
    </div>
  )
}
