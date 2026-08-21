"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"

// SID-only sign-in (docs/revamp.md Part 0). There is no password:
//
//  * The gate is the enrolled-SID allowlist the lecturer supplies. An arbitrary
//    string won't work, but one enrolled student CAN enter as another. That is a
//    deliberate, disclosed trade for a low-stakes formative tool — not an oversight.
//  * The real credential is the HttpOnly `session` cookie the backend sets. This
//    page never sees it.
//  * The JS-readable `user` cookie keeps its exact historic shape
//    `{sid, username, avatarId}` so all 15 `Cookies.get("user")` call sites across
//    the app keep working untouched.
//
// The old "Forgot password?" button called removeUsers(), which wiped EVERY account
// on the machine. With no password there is nothing to reset, and it's gone.

export default function LoginPage() {
  const router = useRouter()
  const [sid, setSid] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }

    // Server session is authoritative — a stale `user` cookie must not look like
    // being signed in. If the session is gone, clear the decoration and stay put.
    auth.me().then((res) => {
      if (res.ok && res.data) {
        Cookies.set(
          "user",
          JSON.stringify({
            sid: res.data.sid,
            username: res.data.username,
            avatarId: res.data.avatarId,
            // MUST be written, and it was not until 2026-08-21. The onboarding gate
            // reads this key off the cookie; the old signup flow used to set it and
            // retiring signup left nothing writing it. Undefined here sent a brand
            // new student: login -> avatar page (reads !undefined -> true, bounces
            // to dashboard) -> dashboard (no username/avatarId, DELETES the cookie)
            // -> login. An unbreakable loop, and on day one every one of the 300
            // accounts is in exactly that state.
            needsOnboarding: res.data.needsOnboarding,
          }),
          { expires: 120 },
        )
        router.push(nextStep(res.data.needsConsent, res.data.needsOnboarding))
      } else if (res.status === 401) {
        Cookies.remove("user")
      }
    })
  }, [router])

  function nextStep(needsConsent: boolean, needsOnboarding: boolean) {
    if (needsConsent) return "/consent"
    if (needsOnboarding) return "/onboarding/avatar"
    return "/dashboard"
  }

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.body.classList.add("dark-mode")
      Cookies.set("darkMode", "true", { expires: 365 })
    } else {
      document.body.classList.remove("dark-mode")
      Cookies.set("darkMode", "false", { expires: 365 })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmed = sid.trim().toUpperCase()
    if (!trimmed) {
      setError("Enter your student ID to continue.")
      return
    }

    setBusy(true)
    const res = await auth.start(trimmed)
    setBusy(false)

    if (!res.ok || !res.data) {
      setError(res.message ?? "Couldn't sign you in.")
      return
    }

    Cookies.set(
      "user",
      JSON.stringify({
        sid: res.data.sid,
        username: res.data.username,
        avatarId: res.data.avatarId,
        needsOnboarding: res.data.needsOnboarding,   // see the note above
      }),
      { expires: 120 },
    )
    router.push(nextStep(res.data.needsConsent, res.data.needsOnboarding))
  }

  return (
    <main className="shell min-h-screen">
      <header style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper-raised)" }}>
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>

          <button
            onClick={toggleDarkMode}
            className="u-btn"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-5 py-16">
        <div>
          <p className="u-eyebrow">COMP3423 · Human–Computer Interaction</p>
          <h1 className="u-h1 mt-1">Sign in</h1>
          <p className="u-stem u-muted mt-2 mb-7">
            Your student ID is all you need. There is no password to forget.
          </p>

          <div className="u-card p-7">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div
                  className="u-card-quiet p-3 text-center"
                  style={{ borderColor: "var(--state-late)", color: "var(--state-late)" }}
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
                  inputMode="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="e.g. 22000000D"
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  className="u-field u-num"
                  required
                />
                <p className="u-faint pt-1">
                  Your SID needs to be on the class list for this study.
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="u-btn u-btn-primary u-btn-lg u-btn-block"
              >
                {busy ? "Checking…" : "Sign in"}
              </button>

              <p className="u-faint text-center">
                Not recognised? Ask the course team to add your SID to the study list.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
