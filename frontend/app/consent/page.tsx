"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"

// Blocking consent gate (docs/revamp.md Part 15). Until 2026-08-16 the app had
// ZERO consent machinery — `grep consent|withdraw|ethics|HSESC` returned nothing —
// while already writing participant events to the research sink.
//
// The three disclosures below are the ones that exceed the existing information
// sheet, and each is here because it changes what a reasonable student would agree
// to: behavioural telemetry, the instructor reading their written answers, and the
// retention of their real SID.
//
// The backend refuses to record ANY check submission until a `consent_recorded`
// event exists for this SID, so this page is a real gate, not a formality.

export default function ConsentPage() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [darkMode, setDarkMode] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (Cookies.get("darkMode") === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
    auth.me().then((res) => {
      if (!res.ok || !res.data) {
        router.push("/login")
        return
      }
      if (!res.data.needsConsent) {
        router.push(res.data.needsOnboarding ? "/onboarding/avatar" : "/dashboard")
        return
      }
      setChecking(false)
    })
  }, [router])

  const handleAgree = async () => {
    setError("")
    setBusy(true)
    const res = await auth.consent(true)
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Couldn't record that. Try again.")
      return
    }
    const me = await auth.me()
    router.push(me.data?.needsOnboarding ? "/onboarding/avatar" : "/dashboard")
  }

  const handleDecline = async () => {
    await auth.logout()
    Cookies.remove("user")
    router.push("/")
  }

  // Colour comes from the .shell token layer (app/shell.css); darkMode stays
  // because the toggle writes the body class this reads.
  void darkMode

  if (checking) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-3xl px-5 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-12">
        <div>
          <div className="mb-7">
            <p className="u-eyebrow">Consent</p>
            <h1 className="u-h1 mt-1">Before you start</h1>
            <p className="u-stem u-muted mt-3">
              COMPGame is part of a study on how learning a concept <em>before</em> being tested
              on it affects understanding. Taking part is voluntary and it does not affect your
              grade.
            </p>
          </div>

          <div className="u-card p-8">
            <h2 className="u-h2 mb-4">What gets recorded</h2>
            <ul className="u-stem space-y-4">
              <li>
                <strong>Your answers and scores</strong> on the short quizzes before and after each
                topic, how long you spent, and which activities you completed.
              </li>
              <li>
                <strong>How you worked, not just what you answered.</strong> Mouse movement, pauses,
                typing patterns, and when you switch away from the tab. This is used to understand
                where people hesitate — never to police you, and never shown to your instructor as
                individual behaviour.
              </li>
              <li>
                <strong>Your written answers may be read by the course team</strong> and quoted
                anonymously in tutorial to spark discussion. Your name is never attached when they
                are shown.
              </li>
              <li>
                <strong>Your student ID is stored</strong> so your progress follows you between
                devices and so the course team can see who has finished. It stays on the course
                machine. Data used for the research is separated from your ID before any analysis.
              </li>
              <li>
                <strong>Your conversations with the AI tutor</strong> are recorded as part of the
                study.
              </li>
            </ul>

            <h2 className="u-h2 mt-9 mb-4">You can stop any time</h2>
            <p className="u-stem">
              You can withdraw from your account page whenever you like. Your account is closed
              immediately and you can ask the course team to erase everything recorded about you.
            </p>

            {error && (
              <div
                className="u-card-quiet mt-6 p-3 text-center"
                style={{ borderColor: "var(--state-late)", color: "var(--state-late)" }}
              >
                {error}
              </div>
            )}

            <label className="flex items-start gap-3 mt-8 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 flex-shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="u-stem">
                I have read the above and I agree to take part.
              </span>
            </label>

            {/* Said BEFORE the button, not discovered after it. Declining used to sign the
                student out to the landing page with no explanation, and signing in again
                returned them straight here -- which reads as a bug rather than a choice. */}
            <p className="u-faint mt-6">
              COMPGame is part of the study — there is no separate version without it. Declining
              is completely fine and does not affect your grade, but it does mean not using
              COMPGame. If you change your mind, sign in again and you will be asked once more.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-5">
              <button
                onClick={handleAgree}
                disabled={!agreed || busy}
                className="u-btn u-btn-primary u-btn-lg flex-1"
              >
                {busy ? "Saving…" : "Agree and continue"}
              </button>
              <button
                onClick={handleDecline}
                disabled={busy}
                className="u-btn u-btn-lg sm:w-48"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
