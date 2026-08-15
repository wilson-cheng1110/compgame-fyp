"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// There is no sign-up any more. Accounts are pre-enrolled: the course team supplies
// the class list (backend/enrolled_sids.txt) and a student's first sign-in creates
// their account (docs/revamp.md Part 0). Anyone who lands here — from a bookmark,
// or the old "Sign up here" link — belongs on /login.
//
// ⚠ LOOSE END, deliberately left visible rather than papered over:
// this page used to host a 5-item multiple-choice PRE-TEST, logged as
// `pre_test_complete` and referenced by CLAUDE.md and experiment-design.md §8.
// The decision of 2026-08-16 demoted it from "the H1 instrument" to "a one-off
// prior-knowledge baseline covariate" — demoted, NOT deleted. It still needs a
// home in the new flow (most naturally a final onboarding step at
// /onboarding/baseline). Until that is built, the baseline covariate is NOT being
// collected. The per-topic Form A pre-checks are unaffected and are the actual
// H1 measure.

export default function SignupRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/login")
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-black">
      <p className="font-pixelify-sans">Taking you to sign in…</p>
    </main>
  )
}
