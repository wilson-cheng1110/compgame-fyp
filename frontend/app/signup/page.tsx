"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { auth, type SectionOption } from "@/lib/api"
import { storeSession, nextStep } from "@/lib/session-handoff"

// Sign-up came back on 2026-08-30 (Wilson). This file was a redirect stub for the
// SID-only era, when accounts were pre-created from the class list and there was
// nothing for a student to fill in.
//
// TWO MODES, and the backend decides which:
//
//   roster === true   a class list is configured. It gates who may sign up AND it
//                     dictates the section, so the picker is hidden — showing a
//                     choice we are going to overrule is worse than not asking.
//   roster === false  open sign-up. The student's section choice is then the ONLY
//                     source of their release window: pick Thursday when you attend
//                     Tuesday and you get the wrong topics on the wrong days, with
//                     no way for us to notice. Hence the warning under the picker,
//                     and hence /admin exists to correct it.
//
// Unlike /login, this page DOES surface the backend's specific error — "there's
// already an account", "not on the class list" — because a signup form that will not
// say why it refused you is unusable. Sign-in deliberately says one thing only.

export default function SignupPage() {
  const router = useRouter()
  const [sid, setSid] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [section, setSection] = useState("")
  const [sections, setSections] = useState<SectionOption[] | null>(null)
  const [roster, setRoster] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Already signed in? Don't let them make a second account by accident.
    auth.me().then((res) => {
      if (res.ok && res.data) {
        router.replace(nextStep(res.data.needsConsent, res.data.needsOnboarding, res.data.needsBaseline))
      }
    })
    auth.sections().then((res) => {
      if (res.ok && res.data) {
        setSections(res.data.sections)
        setRoster(res.data.roster)
      }
    })
  }, [router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmed = sid.trim().toUpperCase()
    if (!trimmed) {
      setError("Enter your student ID.")
      return
    }
    if (password.length < 8) {
      setError("Pick a password of at least 8 characters.")
      return
    }
    if (!roster && !section) {
      setError("Choose which session you attend.")
      return
    }

    setBusy(true)
    const res = await auth.signup(trimmed, password, section || undefined, username.trim() || undefined)
    setBusy(false)

    if (!res.ok || !res.data) {
      setError(res.message ?? "Couldn't create that account.")
      return
    }

    storeSession(res.data)
    router.push(nextStep(res.data.needsConsent, res.data.needsOnboarding, res.data.needsBaseline))
  }

  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <Link href="/login" className="u-btn">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-5 py-16">
        <p className="u-eyebrow">COMP3423 · Human–Computer Interaction</p>
        <h1 className="u-h1 mt-1">Create your account</h1>
        <p className="u-stem u-muted mt-2 mb-7">
          One account for the whole semester. It follows you between devices, so you can
          start a topic on a laptop and finish it on a phone.
        </p>

        <div className="u-card p-7">
          <form onSubmit={handleSignup} className="space-y-6">
            {error && (
              <div
                className="u-card-quiet p-3 text-center"
                style={{ borderColor: "var(--state-late)", color: "var(--state-late)" }}
                data-testid="signup-error"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="sid" className="u-eyebrow block">
                Student ID
              </label>
              <input
                id="sid"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="e.g. 22000000D"
                value={sid}
                onChange={(e) => setSid(e.target.value)}
                className="u-field u-num"
                data-testid="signup-sid"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="u-eyebrow block">
                Display name <span className="u-faint">— optional</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="u-field"
                data-testid="signup-username"
              />
              <p className="u-faint pt-1">What the dashboard calls you. Nobody is graded on it.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="u-eyebrow block">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="u-field"
                data-testid="signup-password"
                required
              />
              <p className="u-faint pt-1">
                At least 8 characters. There is no self-serve reset — if you lose it, the
                course team resets it for you.
              </p>
            </div>

            {!roster && sections && (
              <div className="space-y-2">
                <p className="u-eyebrow">Which session do you attend?</p>
                <div className="space-y-2">
                  {sections.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setSection(s.code)}
                      data-testid="signup-section"
                      style={{
                        borderColor: section === s.code ? "var(--accent)" : "var(--rule-strong)",
                        background: section === s.code ? "var(--accent-soft)" : "var(--paper-raised)",
                      }}
                      className="w-full text-left px-4 py-3 border rounded-lg transition-colors flex gap-3 items-baseline"
                    >
                      <span className="u-eyebrow" style={{ opacity: 0.75 }}>
                        {s.code}
                      </span>
                      <span className="flex-1">{s.day ?? "—"}</span>
                    </button>
                  ))}
                </div>
                {/* Said plainly, because we cannot detect a wrong answer here. */}
                <p className="u-faint pt-1">
                  This decides when each topic opens for you. Pick the day you actually
                  attend — if it is wrong, ask the course team to change it rather than
                  making a second account.
                </p>
              </div>
            )}

            {roster && (
              <p className="u-faint">
                Your session comes from the class list, so there is nothing to choose here.
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="u-btn u-btn-primary u-btn-lg u-btn-block"
              data-testid="signup-submit"
            >
              {busy ? "Creating…" : "Create account"}
            </button>

            <p className="u-faint text-center">
              Already have one? <Link href="/login" className="underline">Sign in</Link>.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
