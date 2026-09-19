"use client"

import { useState, type ReactNode } from "react"
import { questionnaires, type QuestionnaireInstrument } from "@/lib/api"

export type { QuestionnaireInstrument as Instrument }

// A GENERIC renderer for one questionnaire instrument, covering all three item
// shapes (docs spec: extend the existing renderer to handle `single` and `text` in
// addition to the original `likert`). `components/topic-questionnaire.tsx` renders
// its own four LIKERT-ONLY instruments (imi/coi/arcs/paas) inline and is left alone
// on purpose -- this component is the shared renderer for the two NEW instruments
// (demographics, feedback), which is where `single`/`text` actually appear, so it
// is used by `demographics-gate.tsx` and `feedback-card.tsx` rather than folded into
// topic-questionnaire.tsx's already-tested per-topic flow.
//
// COMPLETENESS RULE: `text` items are NEVER required, even when `requireAll` is set.
// You cannot meaningfully coerce a real free-text answer out of someone (decided
// live: "just let them input" -- said of AGE, generalised here to every text item),
// so only `likert`/`single` items count toward "remaining". This is also why an
// untouched text item is dropped rather than sent as `""` on submit -- leaving a box
// empty must read as "skipped", never as a recorded blank answer.
//
// BOUNDED TEXT (AGE): a `text` item carrying `min`/`max` renders as a numeric input
// instead of a textarea, and stays optional -- but a NON-EMPTY value is validated
// client-side against the same [min, max]-whole-number rule the server enforces
// (questionnaire_api.py `invalid_age`), with an inline error, and blocks submit
// while invalid regardless of `requireAll`. This is a UX nicety, not the source of
// truth: the server re-validates independently, so a client that skips this check
// (or is bypassed via `fetch`) still cannot record an out-of-range or non-numeric age.

export default function InstrumentForm({
  instrument,
  requireAll = true,
  allowSkip = false,
  onSkip,
  onDone,
  submitLabel = "Continue",
  intro,
}: {
  instrument: QuestionnaireInstrument
  /** Disable submit until every non-text item has a value (demographics: every
   *  choice has "Prefer not to say", so requiring a pick is not coercive). */
  requireAll?: boolean
  allowSkip?: boolean
  onSkip?: () => void
  onDone: () => void
  submitLabel?: string
  intro?: ReactNode
}) {
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (id: string, value: number | string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  // Mirrors the server's `invalid_age` rule (questionnaire_api.py): optional, but a
  // NON-EMPTY value must be a whole number (digits only) in [min, max]. Blank always
  // passes -- this only ever blocks a value someone actually typed.
  const isValidBounded = (item: { min?: number; max?: number }, raw: unknown): boolean => {
    if (item.min == null || item.max == null) return true
    const trimmed = (raw ?? "").toString().trim()
    if (trimmed === "") return true
    if (!/^[0-9]+$/.test(trimmed)) return false
    const n = Number(trimmed)
    return n >= item.min && n <= item.max
  }

  const requiredItems = instrument.items.filter((it) => (it.type ?? "likert") !== "text")
  const answeredRequired = requiredItems.filter((it) => answers[it.id] !== undefined).length
  const remaining = requiredItems.length - answeredRequired
  const hasAnyAnswer = Object.keys(answers).some((id) => {
    const v = answers[id]
    return typeof v === "number" || (typeof v === "string" && v.trim().length > 0)
  })
  const hasInvalidBounded = instrument.items.some(
    (it) => (it.type ?? "likert") === "text" && !isValidBounded(it, answers[it.id]),
  )
  const canSubmit = (requireAll ? remaining === 0 : hasAnyAnswer) && !hasInvalidBounded

  const submit = async () => {
    setBusy(true)
    setError(null)
    // An untouched or blank text box is a SKIP, not an empty string on the record.
    const cleaned: Record<string, number | string> = {}
    for (const item of instrument.items) {
      const v = answers[item.id]
      if (v === undefined) continue
      if (typeof v === "string" && v.trim() === "") continue
      cleaned[item.id] = v
    }
    const res = await questionnaires.submit(instrument.id, cleaned)
    setBusy(false)
    // 409 is "already submitted" -- a double-tap or a second tab, not an error the
    // student should see a red box about (same read as topic-questionnaire.tsx).
    if (!res.ok && res.status !== 409) {
      setError(res.message ?? "That did not save. Try once more.")
      return
    }
    onDone()
  }

  return (
    <div className="u-card p-8" data-testid={`instrument-${instrument.id}`}>
      {intro}

      {instrument.items.map((item) => {
        const itype = item.type ?? "likert"
        const chosen = answers[item.id]
        const bounded = itype === "text" && item.min != null && item.max != null
        const boundedInvalid = bounded && !isValidBounded(item, chosen)
        return (
          <fieldset key={item.id} className="mt-6">
            <legend className="u-stem">{item.text}</legend>

            {itype === "text" ? (
              bounded ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={(chosen as string) ?? ""}
                    onChange={(e) => set(item.id, e.target.value)}
                    maxLength={10}
                    className="u-field mt-2"
                    style={{ maxWidth: "8rem" }}
                    data-testid="q-text"
                    aria-label={item.text}
                    aria-invalid={boundedInvalid}
                  />
                  <p
                    className="u-faint mt-1"
                    style={boundedInvalid ? { color: "var(--state-late)" } : undefined}
                    data-testid={boundedInvalid ? "q-invalid-age" : undefined}
                  >
                    {boundedInvalid
                      ? `Enter a whole number between ${item.min} and ${item.max}, or leave it blank.`
                      : `Optional -- a whole number between ${item.min} and ${item.max}.`}
                  </p>
                </>
              ) : (
                <textarea
                  value={(chosen as string) ?? ""}
                  onChange={(e) => set(item.id, e.target.value)}
                  maxLength={2000}
                  rows={item.text.length > 60 ? 4 : 2}
                  className="u-field mt-2"
                  data-testid="q-text"
                  aria-label={item.text}
                />
              )
            ) : (
              <div
                className="flex flex-wrap gap-2 mt-2"
                role="radiogroup"
                aria-label={item.text}
              >
                {(itype === "single" ? (item.options ?? []) : instrument.scale).map(
                  (label, i) => {
                    const value = i + 1
                    const on = chosen === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set(item.id, value)}
                        data-testid="q-option"
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
                  },
                )}
              </div>
            )}
          </fieldset>
        )
      })}

      {error && (
        <p className="u-stem mt-5" style={{ color: "var(--state-late)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-8">
        <button
          onClick={submit}
          disabled={busy || !canSubmit}
          data-testid="instrument-submit"
          className="u-btn u-btn-primary u-btn-lg flex-1"
        >
          {busy
            ? "Saving…"
            : requireAll && remaining > 0
              ? `Answer ${remaining} more to continue`
              : submitLabel}
        </button>
        {allowSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="u-btn u-btn-lg"
            data-testid="instrument-skip"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  )
}
