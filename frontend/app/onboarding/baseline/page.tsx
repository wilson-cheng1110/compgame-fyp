"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { auth, type BaselineItem } from "@/lib/api"

// The baseline pre-test — the third and last onboarding step.
// docs/experiment-design.md §8, backend/baseline.py.
//
// WHAT THIS IS. Five multiple-choice items across five topics, sat ONCE, before the
// student sees any topic content. It is not the H1 measure — that is the per-topic
// Form A/B inventory — it is the prior-knowledge covariate. Someone arriving already
// knowing some HCI is a different participant from someone who is not, and without
// this there is no way to say so in the analysis.
//
// It went missing when signup was retired: the page that used to host it became a
// redirect stub, and nothing replaced it, so the covariate was silently not being
// collected. It has readers (the data export still asks for `preTestScore`) and, until
// now, no writer.
//
// THREE THINGS THAT LOOK LIKE OMISSIONS AND ARE NOT:
//
//  1. No score comes back, ever. These five items cover Fitts' Law, Miller's Law,
//     Norman, Gestalt and Hick's Law — five of the thirteen units this same student is
//     about to be measured on. Telling them how they did, or which ones they missed,
//     is a head start on those units and contaminates the gain this covariate exists
//     to adjust for. The student is told this rather than left to wonder.
//  2. Questions can be skipped. Skipping is itself information about prior knowledge,
//     and a forced answer is a guess wearing a datum's clothes. The server records
//     unanswered as unanswered.
//  3. The answer key is not here. The old version shipped it in the client, opening
//     with `// Correct answers: [0, 1, 2, 1, 2]`. Items arrive without it and grading
//     happens server-side, the same rule checks.py enforces for the topic banks.

export default function BaselinePage() {
  const router = useRouter()
  const [items, setItems] = useState<BaselineItem[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loadError, setLoadError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [busy, setBusy] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (Cookies.get("darkMode") === "true") document.body.classList.add("dark-mode")

    auth.getBaseline().then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        startedAt.current = Date.now()
        return
      }
      // 409 = already sat it. Not an error the student can act on — move them on.
      if (res.error === "already_taken") {
        router.push("/dashboard")
        return
      }
      if (res.status === 401) {
        router.push("/login")
        return
      }
      setLoadError(res.message ?? "Couldn't load the questions.")
    })
  }, [router])

  const answeredCount = items ? items.filter((i) => answers[i.id] !== undefined).length : 0

  async function submit() {
    if (busy || !items) return
    setBusy(true)
    setSubmitError("")
    const res = await auth.submitBaseline(answers, Date.now() - startedAt.current)
    setBusy(false)
    if (!res.ok && res.error !== "already_taken") {
      setSubmitError(res.message ?? "Couldn't save that. Try again.")
      return
    }
    router.push("/dashboard")
  }

  if (loadError) {
    return (
      <main className="shell min-h-screen flex items-center justify-center px-5">
        <div className="u-card p-8 max-w-md">
          <p className="u-stem">{loadError}</p>
        </div>
      </main>
    )
  }

  if (!items) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="shell min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-5 py-16">
        {/* Three onboarding steps, and this is the last one. */}
        <div className="u-rail mb-8">
          <div className="u-rail-seg is-done" />
          <div className="u-rail-seg is-done" />
          <div className="u-rail-seg is-now" />
        </div>

        <p className="u-eyebrow">Step 3 of 3</p>
        <h1 className="u-h1 mt-1">Before you start, five quick questions</h1>
        <p className="u-stem u-muted mt-3">
          These tell us what people already know before using COMPGame at all. You are not
          expected to know them, they do not affect your grade, and you will not be asked
          them again.
        </p>

        <div className="mt-8 space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="u-card p-6" data-testid="baseline-item">
              <p className="u-eyebrow u-num mb-2">
                Question {idx + 1} of {items.length}
              </p>
              <p className="u-stem mb-5">{item.stem}</p>

              <div className="space-y-2">
                {item.options.map((opt, oi) => {
                  const picked = answers[item.id] === oi
                  return (
                    <button
                      key={oi}
                      type="button"
                      data-testid="baseline-option"
                      onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: oi }))}
                      style={{
                        borderColor: picked ? "var(--accent)" : "var(--rule-strong)",
                        background: picked ? "var(--accent-soft)" : "var(--paper-raised)",
                      }}
                      className="w-full text-left px-4 py-3 border rounded-lg transition-colors flex gap-3 items-baseline"
                    >
                      <span className="u-eyebrow" style={{ opacity: 0.75 }}>
                        {String.fromCharCode(97 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {submitError && (
          <p className="u-faint mt-4" style={{ color: "var(--state-late)" }}>
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap mt-7">
          <p className="u-faint u-num">
            {answeredCount} of {items.length} answered
          </p>
          <button
            onClick={submit}
            disabled={busy}
            data-testid="baseline-submit"
            className="u-btn u-btn-primary u-btn-lg"
          >
            {busy ? "Saving…" : answeredCount === items.length ? "Finish" : "Skip the rest and finish"}
          </button>
        </div>

        <p className="u-faint mt-4" style={{ borderTop: "1px solid var(--rule)", paddingTop: ".75rem" }}>
          You won&apos;t see a score for this. It measures where everyone started, and showing
          you the answers now would give away parts of the topics you are about to work
          through.
        </p>
      </div>
    </main>
  )
}
