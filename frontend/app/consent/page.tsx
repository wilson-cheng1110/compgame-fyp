"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
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

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

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

  const panel = darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"

  if (checking) {
    return (
      <main className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable}`}>
        <p className="font-pixelify-sans">Loading…</p>
      </main>
    )
  }

  return (
    <main
      className={`min-h-screen ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable} ${pressStart2P.variable}`}
    >
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
        <div className="container mx-auto px-8 md:px-16 flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto py-10 px-4 flex justify-center">
        <div className="max-w-3xl w-full">
          <div className={`p-6 border-2 border-black mb-6 ${panel}`}>
            <h1 className="font-press-start-2p text-base leading-relaxed">
              Before you start
            </h1>
            <p className="font-pixelify-sans mt-3 text-lg">
              COMPGame is part of a study on how learning a concept <em>before</em> being tested
              on it affects understanding. Taking part is voluntary and it does not affect your
              grade.
            </p>
          </div>

          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${panel}`}>
            <h2 className="font-press-start-2p text-[11px] mb-4">What gets recorded</h2>
            <ul className="font-pixelify-sans text-lg space-y-4">
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

            <h2 className="font-press-start-2p text-[11px] mt-8 mb-4">You can stop any time</h2>
            <p className="font-pixelify-sans text-lg">
              You can withdraw from your account page whenever you like. Your account is closed
              immediately and you can ask the course team to erase everything recorded about you.
              You can still use COMPGame to learn without taking part in the study — just tell the
              course team.
            </p>

            {error && (
              <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-2 font-pixelify-sans text-center">
                {error}
              </div>
            )}

            <label className="flex items-start gap-3 mt-8 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1.5 w-5 h-5 border-2 border-black accent-[#0099db] flex-shrink-0"
              />
              <span className="font-pixelify-sans text-lg">
                I have read the above and I agree to take part.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                onClick={handleAgree}
                disabled={!agreed || busy}
                className="flex-1 bg-[#0099db] border-2 border-black hover:bg-[#007cb2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-press-start-2p py-4 text-[11px] transition-transform active:scale-95 shadow-[4px_4px_0px_0px_#000]"
              >
                {busy ? "Saving…" : "Agree and continue"}
              </button>
              <button
                onClick={handleDecline}
                disabled={busy}
                className="sm:w-56 bg-white border-2 border-black hover:bg-gray-100 text-black font-press-start-2p py-4 text-[11px] transition-transform active:scale-95 shadow-[4px_4px_0px_0px_#000]"
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
