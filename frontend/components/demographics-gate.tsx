"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { questionnaires, type QuestionnaireInstrument } from "@/lib/api"
import InstrumentForm from "@/components/instrument-form"

// A ONE-TIME prompt, shown by the dashboard after consent and before the topics
// list renders, once per participant (docs spec). Every choice item has a low-
// commitment option ("Prefer not to say"), and AGE is free-typed rather than
// bucketed (Wilson, live: "just let them input"), so requiring the form to be
// COMPLETE before continuing does not coerce a specific answer out of anyone -- it
// only asks that every item get *some* response, including a declined one.
//
// The dashboard decides WHETHER to render this (journey.questionnaires_enabled +
// `_status` not yet including "demographics"); this component only fetches its own
// item bank and renders the form. Styled to match consent/page.tsx -- same shell
// nav, same narrow column, same u-card -- since this sits in the identical spot in
// the journey (a blocking one-time gate before the real app).

export default function DemographicsGate({ onDone }: { onDone: () => void }) {
  const [instrument, setInstrument] = useState<QuestionnaireInstrument | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    questionnaires.get("demographics").then((res) => {
      if (!alive) return
      if (res.ok && res.data) setInstrument(res.data)
      else setError(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-2xl px-5 h-14 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>HCI Playground</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-12" data-testid="demographics-gate">
        <p className="u-eyebrow">Before your first topic</p>
        <h1 className="u-h1 mt-1">A few quick questions about you</h1>
        <p className="u-stem u-muted mt-3 mb-7">
          Four short questions, asked once. Every one has a low-commitment answer if
          you&apos;d rather not say — pick that, or type your own for age.
        </p>

        {error && (
          <div
            className="u-card-quiet p-3 text-center"
            style={{ borderColor: "var(--state-late)", color: "var(--state-late)" }}
          >
            Couldn&apos;t load that. Refresh to try again.
          </div>
        )}

        {instrument && (
          <InstrumentForm
            instrument={instrument}
            requireAll
            submitLabel="Continue"
            onDone={onDone}
          />
        )}

        {!instrument && !error && <p className="u-muted">Loading…</p>}
      </div>
    </main>
  )
}
