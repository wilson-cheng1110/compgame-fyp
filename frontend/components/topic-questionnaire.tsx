"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

// The end-of-unit battery: IMI, CoI, ARCS and the Paas load item.
//
// PER TOPIC, which is Wilson's decision (2026-08-30) and the stronger design: arm is
// randomised per topic, so a battery attached to a topic attaches to a CONDITION. Run
// once at the end it could only ever have been descriptive -- every student does both
// arms, so there would be nothing to compare.
//
// It also means 29 items, thirteen times. Three things follow from that, and they are
// the whole design of this component:
//
//   1. GROUPED, NOT A WALL. Twenty-nine rows in one column is the shape people
//      straight-line through. Each instrument gets its own heading and its own short
//      framing sentence, so it reads as four short things rather than one long one.
//   2. IT SAYS HOW MUCH IS LEFT. The same "Answer all N to continue" the MC check
//      uses, for the same reason: an unknown remaining cost is what makes people
//      abandon halfway.
//   3. IT IS THE LAST THING, AFTER EVERYTHING IS RECORDED. The unit's completion,
//      checks and probe are already in before this renders, so a student who closes
//      the tab here loses only the questionnaire -- never their learning data.
//
// Renders NOTHING when the server has questionnaires switched off (the GET 404s),
// which is the default until the HSESC amendment lands. No flash, no dead form.

type Instrument = {
  id: string
  title: string
  cite: string
  scale: string[]
  items: { id: string; text: string }[]
}

const WANTED = ["imi", "coi", "arcs", "paas"]

// A sentence per instrument, in the student's terms rather than the construct's.
// "Intrinsic Motivation Inventory" tells them nothing; "how the activities felt"
// tells them how to answer.
const FRAMING: Record<string, string> = {
  imi: "How the activity felt. There are no right answers.",
  coi: "The game and the tutor were doing the teaching here. How well did that work?",
  arcs: "Whether this was worth your time.",
  paas: "One last one, about effort rather than difficulty.",
}

export default function TopicQuestionnaire({ topicId }: { topicId: string }) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [answers, setAnswers] = useState<Record<string, Record<string, number>>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    Promise.all(WANTED.map((n) => api.get<Instrument>(`/api/questionnaire/${n}`)))
      .then((rs) => {
        if (!alive) return
        setInstruments(rs.filter((r) => r.ok && r.data).map((r) => r.data as Instrument))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!instruments.length || done) {
    return done ? (
      <p className="u-faint mt-6" data-testid="questionnaire-done">
        ✓ Thank you — that is recorded.
      </p>
    ) : null
  }

  const total = instruments.reduce((n, i) => n + i.items.length, 0)
  const answered = Object.values(answers).reduce((n, a) => n + Object.keys(a).length, 0)
  const remaining = total - answered

  const set = (inst: string, item: string, value: number) =>
    setAnswers((prev) => ({ ...prev, [inst]: { ...(prev[inst] ?? {}), [item]: value } }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    const durationMs = Date.now() - startedAt
    for (const inst of instruments) {
      const res = await api.post(`/api/questionnaire/${inst.id}`, {
        answers: answers[inst.id] ?? {},
        topic_id: topicId,
        duration_ms: durationMs,
      })
      // 409 is "already submitted" — a double-tap or a second device, and not an
      // error the student should be shown a red box about.
      if (!res.ok && res.status !== 409) {
        setBusy(false)
        setError(res.message ?? "That did not save. Try once more.")
        return
      }
    }
    setBusy(false)
    setDone(true)
  }

  return (
    <div className="u-card p-8 mt-6" data-testid="questionnaire">
      <p className="u-eyebrow">Last part</p>
      <h2 className="u-h2 mt-2">A few questions about how that went</h2>
      <p className="u-stem u-muted mt-3">
        Not marked, and not about the topic — it is about the experience. It is the
        part that tells us whether this way of learning is worth keeping.
      </p>

      {instruments.map((inst) => (
        <section key={inst.id} className="mt-8">
          <h3 style={{ fontWeight: 600 }}>{inst.title}</h3>
          <p className="u-faint mt-1">{FRAMING[inst.id] ?? ""}</p>

          {/* THE LEGEND ONCE, AND IT STAYS. Spelling the scale out on every row
              wrapped each item onto two lines -- twenty-nine items of that is the
              wall this component exists to avoid. But a bare 1-5 makes the student
              guess which end is which, so the words cannot simply go: they move to
              a legend that sticks to the top of its own section and is therefore
              still on screen at item twelve. */}
          <div
            className="u-faint flex flex-wrap gap-x-4 gap-y-1 mt-3 py-2"
            style={{
              position: "sticky",
              top: 0,
              background: "var(--paper-raised)",
              zIndex: 1,
              fontSize: ".75rem",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            {inst.scale.map((label, i) => (
              <span key={label}>
                <span className="u-num">{i + 1}</span> {label}
              </span>
            ))}
          </div>

          {inst.items.map((item) => {
            const chosen = answers[inst.id]?.[item.id]
            return (
              <fieldset key={item.id} className="mt-4">
                <legend className="u-stem">{item.text}</legend>
                {/* Radios, not a select: the whole scale has to be visible or the
                    student cannot see where their answer sits on it. */}
                <div className="flex flex-wrap gap-2 mt-2" role="radiogroup"
                     aria-label={item.text}>
                  {inst.scale.map((label, i) => {
                    const value = i + 1
                    const on = chosen === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        // The full wording still reaches assistive tech and a hover,
                        // it just does not take a line each on screen.
                        aria-label={`${value} ${label}`}
                        title={label}
                        onClick={() => set(inst.id, item.id, value)}
                        data-testid="q-option"
                        className="u-btn u-num"
                        style={{
                          fontSize: ".8125rem",
                          padding: ".3125rem .75rem",
                          minWidth: "2.5rem",
                          background: on ? "var(--accent)" : undefined,
                          color: on ? "var(--accent-ink)" : undefined,
                          borderColor: on ? "var(--accent)" : undefined,
                        }}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
          <p className="u-faint mt-4" style={{ opacity: 0.7, fontSize: ".75rem" }}>
            {inst.cite}
          </p>
        </section>
      ))}

      {error && (
        <p className="u-stem mt-5" style={{ color: "var(--state-late)" }}>{error}</p>
      )}

      <button
        onClick={submit}
        disabled={busy || remaining > 0}
        data-testid="questionnaire-submit"
        className="u-btn u-btn-primary u-btn-lg u-btn-block mt-8"
      >
        {busy
          ? "Saving…"
          : remaining > 0
            ? `Answer all ${remaining} remaining to finish`
            : "Done"}
      </button>
    </div>
  )
}
