"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"
import { topics as topicsApi, type JourneyTopic } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import TopicCheck from "@/components/topic-check"

// The topic unit (docs/revamp.md Part 2). This is the shell that turns "a grid of
// games you can play in any order" into a sequenced journey.
//
// THE STEP ORDER IS THE EXPERIMENT. The server assigns each student an arm per
// topic and this component renders the steps in that order:
//
//   FLIP     brief -> pre-check -> GAME -> post-check -> tutor -> close
//   CONTROL  brief -> pre-check -> post-check -> GAME -> tutor -> close
//
// The arm is never chosen here and never stored here — it comes down with the
// topic state and is recorded server-side on every submission, so observation and
// assignment can be cross-checked (any mismatch is a bug, not noise).
//
// The 26 existing game routes are UNTOUCHED. The unit links out to them and the
// student returns; nothing about the games had to change.

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

type Step = "brief" | "pre" | "game" | "post" | "tutor" | "close"

export default function TopicUnitPage() {
  const router = useRouter()
  const params = useParams<{ topicId: string }>()
  const topicId = params?.topicId

  const [state, setState] = useState<JourneyTopic | null>(null)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const [step, setStep] = useState<Step>("brief")
  const [postDone, setPostDone] = useState(false)
  const [error, setError] = useState("")
  const [darkMode, setDarkMode] = useState(false)

  const meta = useMemo(() => TOPICS.find((t) => t.id === topicId), [topicId])
  const stepKey = `compgame:unit:${topicId}:step`

  // Steps in this student's arm order. A topic with no item bank yet simply has no
  // check steps — the unit still runs (docs/revamp.md Part 8.4).
  const steps: Step[] = useMemo(() => {
    if (!state) return ["brief"]
    const hasChecks = state.has_bank
    const game: Step[] = ["game"]
    const pre: Step[] = hasChecks ? ["pre"] : []
    const post: Step[] = hasChecks ? ["post"] : []
    return state.plays_game_first
      ? ["brief", ...pre, ...game, ...post, "tutor", "close"]
      : ["brief", ...pre, ...post, ...game, "tutor", "close"]
  }, [state])

  useEffect(() => {
    if (Cookies.get("darkMode") === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [])

  useEffect(() => {
    if (!topicId) return
    let alive = true
    topicsApi.journey().then((j) => {
      if (!alive) return
      if (!j.ok || !j.data) {
        router.push("/login")
        return
      }
      setTelemetryEnabled(j.data.telemetry_enabled)
      const found = j.data.topics.find((t) => t.topic_id === topicId)
      if (!found) {
        setError("That topic doesn't exist.")
        return
      }
      if (found.state === "locked" || found.state === "unscheduled") {
        setError(
          found.opens
            ? `This topic opens on ${new Date(found.opens).toLocaleDateString()}.`
            : "This topic isn't scheduled yet.",
        )
        setState(found)
        return
      }
      setState(found)
      // Resume where they left off — students close laptops mid-topic.
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(stepKey) : null
      if (saved) setStep(saved as Step)
    })
    return () => {
      alive = false
    }
  }, [topicId, router, stepKey])

  const go = (next: Step) => {
    setStep(next)
    if (typeof window !== "undefined") window.localStorage.setItem(stepKey, next)
  }

  const advance = () => {
    const i = steps.indexOf(step)
    if (i >= 0 && i < steps.length - 1) go(steps[i + 1])
  }

  const panel = darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"
  const shell = darkMode ? "bg-[#020617] text-white" : "bg-white text-black"

  if (error) {
    return (
      <main className={`min-h-screen ${shell} ${pixelifySans.variable} ${pressStart2P.variable}`}>
        <UnitHeader />
        <div className="container mx-auto py-16 px-4 max-w-2xl">
          <div className={`p-8 border-2 border-black ${panel}`}>
            <p className="font-press-start-2p text-[11px] leading-relaxed">Not open yet</p>
            <p className="font-pixelify-sans text-lg mt-3">{error}</p>
            <Link href="/dashboard">
              <button className="mt-6 bg-[#0099db] border-2 border-black text-white font-press-start-2p px-6 py-3 text-[10px] shadow-[4px_4px_0px_0px_#000]">
                Back to my journey
              </button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!state || !meta) {
    return (
      <main className={`min-h-screen flex items-center justify-center ${shell} ${pixelifySans.variable}`}>
        <p className="font-pixelify-sans">Loading…</p>
      </main>
    )
  }

  const position = steps.indexOf(step) + 1

  return (
    <main className={`min-h-screen ${shell} ${pixelifySans.variable} ${pressStart2P.variable}`}>
      <UnitHeader />

      <div className="container mx-auto py-8 px-4 max-w-3xl">
        {/* Where am I in this unit */}
        <div className={`p-5 border-2 border-black mb-6 ${panel}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-press-start-2p text-[12px] leading-relaxed">
                <span className="mr-2">{meta.icon}</span>
                {meta.title}
              </p>
              <p className="font-pixelify-sans text-lg opacity-70 mt-1">{meta.description}</p>
            </div>
            <p className="font-press-start-2p text-[9px] opacity-60 whitespace-nowrap">
              Step {position} of {steps.length}
            </p>
          </div>

          <div className="flex gap-1.5 mt-4">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-2 flex-1 border border-black ${
                  i < position - 1 ? "bg-[#0099db]" : i === position - 1 ? "bg-[#facc15]" : "bg-white"
                }`}
              />
            ))}
          </div>

          {state.late && (
            <p className="font-pixelify-sans text-sm mt-3 text-[#a16207]">
              This topic&apos;s window has closed — you can still work through it, and it will be
              marked as late.
            </p>
          )}
        </div>

        {step === "brief" && (
          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${panel}`}>
            <h2 className="font-press-start-2p text-[12px] leading-relaxed">Before you begin</h2>
            <p className="font-pixelify-sans text-lg mt-4">{meta.description}.</p>
            <p className="font-pixelify-sans text-lg mt-3 opacity-80">
              {state.has_bank
                ? "You'll answer a few quick questions first, work through an activity, then answer a different set to see what changed."
                : "You'll work through an activity for this topic, then reflect on it with the tutor."}
            </p>
            <button
              onClick={advance}
              className="mt-6 w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p py-4 text-[11px] active:scale-95 transition-transform shadow-[4px_4px_0px_0px_#000]"
            >
              Start
            </button>
          </div>
        )}

        {step === "pre" && (
          <TopicCheck
            topicId={state.topic_id}
            form="A"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={() => setTimeout(advance, 1200)}
          />
        )}

        {step === "post" && (
          <TopicCheck
            topicId={state.topic_id}
            form="B"
            telemetryEnabled={telemetryEnabled}
            darkMode={darkMode}
            onDone={() => setPostDone(true)}
          />
        )}

        {step === "game" && (
          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${panel}`}>
            <h2 className="font-press-start-2p text-[12px] leading-relaxed">The activity</h2>
            <p className="font-pixelify-sans text-lg mt-4">
              Work through the {meta.title} activity, then come back here to carry on.
            </p>
            <Link href={`/games/${meta.understandingGameId}`}>
              <button className="mt-6 w-full bg-[#facc15] border-2 border-[#a16207] hover:bg-[#fde047] text-black font-press-start-2p py-4 text-[11px] active:scale-95 transition-transform shadow-[4px_4px_0px_0px_#000]">
                Open the activity
              </button>
            </Link>
            <button
              onClick={advance}
              className="mt-3 w-full bg-white border-2 border-black hover:bg-gray-100 text-black font-press-start-2p py-3 text-[10px] active:scale-95 transition-transform"
            >
              I&apos;ve finished it — continue
            </button>
          </div>
        )}

        {/* Only after they've submitted and seen the answers — the post-check is
            where the feedback lands, so don't let them skip past it unread. */}
        {step === "post" && postDone && (
          <button
            onClick={advance}
            className="mt-5 w-full bg-white border-2 border-black hover:bg-gray-100 text-black font-press-start-2p py-3 text-[10px] active:scale-95 transition-transform"
          >
            Continue
          </button>
        )}

        {step === "tutor" && (
          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${panel}`}>
            <h2 className="font-press-start-2p text-[12px] leading-relaxed">Talk it through</h2>
            <p className="font-pixelify-sans text-lg mt-4">
              Open the tutor (bottom-right) and explain {meta.title} in your own words. It will
              push back with questions rather than hand you answers — that&apos;s the point.
            </p>
            <p className="font-pixelify-sans text-lg mt-3 opacity-70 italic">
              {meta.reflectionQuestion}
            </p>
            <button
              onClick={advance}
              className="mt-6 w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p py-4 text-[11px] active:scale-95 transition-transform shadow-[4px_4px_0px_0px_#000]"
            >
              Done reflecting
            </button>
          </div>
        )}

        {step === "close" && (
          <div className={`p-8 border-2 border-black shadow-[8px_8px_0px_0px_#000] ${panel}`}>
            <h2 className="font-press-start-2p text-[12px] leading-relaxed">
              {meta.title} — finished
            </h2>
            <p className="font-pixelify-sans text-lg mt-4">
              Nice work. Your answers are saved and this topic is complete.
            </p>
            <Link href="/dashboard">
              <button className="mt-6 w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p py-4 text-[11px] active:scale-95 transition-transform shadow-[4px_4px_0px_0px_#000]">
                Back to my journey
              </button>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

function UnitHeader() {
  return (
    <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
      <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
            alt="COMPGame Logo"
            width={40}
            height={40}
            className="mr-3"
          />
          <span className="font-press-start-2p text-black text-xl">COMPGame</span>
        </Link>
        <Link href="/dashboard" className="font-pixelify-sans text-black font-bold hover:underline">
          My journey
        </Link>
      </div>
    </header>
  )
}
