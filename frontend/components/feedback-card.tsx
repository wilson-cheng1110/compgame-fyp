"use client"

import { useEffect, useState } from "react"
import { questionnaires, type QuestionnaireInstrument } from "@/lib/api"
import InstrumentForm from "@/components/instrument-form"

// Offered ONCE, at the natural "you're caught up" moment: every topic released so
// far is complete (docs spec: "the natural study-complete / all-released-topics-done
// surface" -- there is no dedicated end-of-study page, so the dashboard is it). The
// whole instrument is OPTIONAL and skippable -- this is feedback about the
// experience, not a study instrument anyone is obliged to finish, so declining
// costs nothing and the collapsed prompt just reappears next visit until submitted.
//
// The dashboard decides WHEN to mount this (all released topics done, enabled, not
// yet in `_status`); this component fetches its own item bank and owns its own
// collapsed/expanded/done local state.

export default function FeedbackCard({ onDone }: { onDone: () => void }) {
  const [instrument, setInstrument] = useState<QuestionnaireInstrument | null>(null)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    questionnaires.get("feedback").then((res) => {
      if (alive && res.ok && res.data) setInstrument(res.data)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!instrument) return null

  if (done) {
    return (
      <div className="u-card p-5 mt-6" data-testid="feedback-done">
        <p className="u-stem">Thanks for the feedback — that&apos;s recorded.</p>
      </div>
    )
  }

  if (!open) {
    return (
      <div
        className="u-card p-5 mt-6 flex items-center justify-between gap-4 flex-wrap"
        data-testid="feedback-prompt"
      >
        <div>
          <p style={{ fontWeight: 600 }}>You&apos;re caught up on everything released so far</p>
          <p className="u-faint mt-0.5">
            A short, optional form about the AI tutor and the games. Not graded, and
            nothing here is required.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="u-btn u-btn-primary">
          Give feedback
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <InstrumentForm
        instrument={instrument}
        requireAll={false}
        allowSkip
        submitLabel="Send feedback"
        onSkip={() => setOpen(false)}
        onDone={() => {
          setDone(true)
          onDone()
        }}
        intro={
          <>
            <p className="u-eyebrow">Optional feedback</p>
            <h3 className="u-h2 mt-1">How this went for you</h3>
            <p className="u-stem u-muted mt-2">
              Answer as many or as few as you like — anything left blank is simply not
              recorded.
            </p>
          </>
        }
      />
    </div>
  )
}
