"use client"

import { useState, useCallback, useRef } from "react"
import GameDebrief from "@/components/game-debrief"

// Stroop / Principle of Consistency
// Phase 1: Learn the concept
// Phase 2: 5 consistent mapping rounds (green=GO, red=STOP) — measure RT
// Phase 3: 5 inconsistent mapping rounds (red=GO, green=STOP) — measure RT
// Phase 4: Compare your own consistent vs inconsistent RT
// Phase 5: GameDebrief

type Phase = "learn" | "rt-test" | "results" | "debrief"
type Signal = "green" | "red" | null

const CONSISTENT_ROUNDS = 5
const INCONSISTENT_ROUNDS = 5
const FIXATION_MS = 800
const SIGNAL_TIMEOUT_MS = 2500

export default function StroopUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [round, setRound] = useState(0)              // 0-9: 0-4 consistent, 5-9 inconsistent
  const [signal, setSignal] = useState<Signal>(null)
  const [rts, setRts] = useState<number[]>([])
  const [missed, setMissed] = useState(false)
  const startRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isConsistentBlock = round < CONSISTENT_ROUNDS
  // In consistent block: green=GO (correct=go), red=STOP (correct=stop)
  // In inconsistent block: green=STOP (correct=stop), red=GO (correct=go)
  const correctActionForSignal = useCallback((sig: Signal): "go" | "stop" => {
    if (sig === "green") return isConsistentBlock ? "go" : "stop"
    return isConsistentBlock ? "stop" : "go"
  }, [isConsistentBlock])

  const showSignal = useCallback(() => {
    const sig: Signal = Math.random() < 0.5 ? "green" : "red"
    setSignal(sig)
    setMissed(false)
    startRef.current = performance.now()
    timeoutRef.current = setTimeout(() => {
      setSignal(null)
      setMissed(true)
      setRts((prev) => [...prev, SIGNAL_TIMEOUT_MS])
    }, SIGNAL_TIMEOUT_MS)
  }, [])

  const startRound = useCallback(() => {
    setSignal(null)
    setMissed(false)
    setTimeout(showSignal, FIXATION_MS)
  }, [showSignal])

  const handleAction = useCallback((action: "go" | "stop") => {
    if (!signal) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const rt = performance.now() - startRef.current
    const correct = action === correctActionForSignal(signal)
    setRts((prev) => [...prev, correct ? rt : SIGNAL_TIMEOUT_MS])
    setSignal(null)
    const nextRound = round + 1
    if (nextRound >= CONSISTENT_ROUNDS + INCONSISTENT_ROUNDS) {
      setPhase("results")
    } else {
      setRound(nextRound)
      setTimeout(showSignal, FIXATION_MS + 400)
    }
  }, [signal, round, correctActionForSignal, showSignal])

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-2">Principle of Consistency</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          When a UI breaks established conventions, users slow down and make more errors — even when they know the rules. This is the{" "}
          <span className="font-bold text-black">Stroop Effect</span>: cognitive interference from inconsistent stimulus-response mapping.
        </p>

        <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-8">
          <div className="border-2 border-green-600 bg-green-50 p-5">
            <p className="font-press-start-2p text-green-800 text-[10px] mb-3">Consistent</p>
            <div className="flex flex-col gap-2 font-pixelify-sans text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 border border-black" />
                <span>Green → GO</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500 border border-black" />
                <span>Red → STOP</span>
              </div>
            </div>
            <p className="font-pixelify-sans text-xs text-green-700 mt-3">Matches learned convention → fast response</p>
          </div>
          <div className="border-2 border-red-500 bg-red-50 p-5">
            <p className="font-press-start-2p text-red-800 text-[10px] mb-3">Inconsistent</p>
            <div className="flex flex-col gap-2 font-pixelify-sans text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-red-500 border border-black" />
                <span>Red → GO</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 border border-black" />
                <span>Green → STOP</span>
              </div>
            </div>
            <p className="font-pixelify-sans text-xs text-red-700 mt-3">Conflicts with convention → slower, more errors</p>
          </div>
        </div>

        <div className="bg-white border-2 border-black p-5 w-full max-w-2xl mb-6">
          <h3 className="font-press-start-2p text-[#005a81] text-[10px] mb-3">Why this matters in UI design</h3>
          <ul className="font-pixelify-sans text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>Green = success, red = error — breaking this causes errors and frustration</li>
            <li>Ctrl+Z = undo globally — apps that break this mapping surprise and slow users</li>
            <li>Consistent icon meanings across a UI reduce cognitive load</li>
            <li>New interaction paradigms take time to learn and have high error rates initially</li>
          </ul>
        </div>

        <button
          onClick={() => { setPhase("rt-test"); startRound() }}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Experience It →
        </button>
      </div>
    )
  }

  // ── RT Test ────────────────────────────────────────────────────────────────
  if (phase === "rt-test") {
    const blockLabel = isConsistentBlock ? "Consistent" : "Inconsistent"
    const blockRound = isConsistentBlock ? round + 1 : round - CONSISTENT_ROUNDS + 1
    const blockTotal = CONSISTENT_ROUNDS
    const isTransition = round === CONSISTENT_ROUNDS && !signal && rts.length === CONSISTENT_ROUNDS

    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-press-start-2p text-[10px] text-gray-500 mb-1">
          {blockLabel} Block — Round {blockRound} / {blockTotal}
        </p>

        {isTransition ? (
          <div className="text-center">
            <p className="font-press-start-2p text-[#a16207] text-sm mb-3">Block complete!</p>
            <p className="font-pixelify-sans text-gray-600 mb-2">
              Avg RT: <strong>{avg(rts).toFixed(0)} ms</strong>
            </p>
            <p className="font-pixelify-sans text-gray-500 text-sm mb-6">
              Now the rules are REVERSED. Red = GO, Green = STOP.
            </p>
            <button
              onClick={startRound}
              className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
            >
              Start Inconsistent Block →
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center min-h-[80px] flex flex-col items-center justify-center">
              {signal === "green" && (
                <div className="w-20 h-20 rounded-full bg-green-500 border-4 border-black shadow-[4px_4px_0px_0px_#000] animate-pulse" />
              )}
              {signal === "red" && (
                <div className="w-20 h-20 rounded-full bg-red-500 border-4 border-black shadow-[4px_4px_0px_0px_#000] animate-pulse" />
              )}
              {!signal && !missed && (
                <div className="w-4 h-4 bg-black" />
              )}
              {missed && (
                <p className="font-press-start-2p text-red-600 text-xs">Too slow!</p>
              )}
            </div>

            <div className="mb-4 font-pixelify-sans text-sm text-gray-500 text-center">
              {isConsistentBlock
                ? "Green = GO · Red = STOP"
                : <span className="text-red-600 font-bold">Red = GO · Green = STOP (reversed!)</span>
              }
            </div>

            <div className="flex gap-6">
              <button
                onClick={() => handleAction("go")}
                disabled={!signal}
                className="bg-green-500 border-2 border-black text-white font-press-start-2p text-sm w-28 h-14 hover:bg-green-400 disabled:opacity-30 shadow-[3px_3px_0px_0px_#000] transition-colors"
              >
                GO
              </button>
              <button
                onClick={() => handleAction("stop")}
                disabled={!signal}
                className="bg-red-500 border-2 border-black text-white font-press-start-2p text-sm w-28 h-14 hover:bg-red-400 disabled:opacity-30 shadow-[3px_3px_0px_0px_#000] transition-colors"
              >
                STOP
              </button>
            </div>

            {!signal && !missed && rts.length < round && (
              <button
                onClick={startRound}
                className="mt-8 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
              >
                Next Round
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const conRTs = rts.slice(0, CONSISTENT_ROUNDS)
    const incRTs = rts.slice(CONSISTENT_ROUNDS)
    const conAvg = avg(conRTs)
    const incAvg = avg(incRTs)
    const delta = incAvg - conAvg
    const maxBar = Math.max(conAvg, incAvg)

    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Your Results</h2>
        <p className="font-pixelify-sans text-gray-600 text-sm mb-6 text-center">
          Inconsistency cost you <strong className="text-red-600">{delta > 0 ? `+${delta.toFixed(0)} ms` : `${delta.toFixed(0)} ms`}</strong> per response
        </p>

        <div className="w-full max-w-sm bg-white border-2 border-black p-5 mb-6">
          <div className="space-y-4">
            {[
              { label: "Consistent (green=GO)", avg: conAvg, color: "bg-green-500" },
              { label: "Inconsistent (red=GO)", avg: incAvg, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between font-pixelify-sans text-sm mb-1">
                  <span>{item.label}</span>
                  <span className="font-bold">{item.avg.toFixed(0)} ms</span>
                </div>
                <div className="h-5 bg-gray-200 border border-black overflow-hidden">
                  <div
                    className={`h-full ${item.color}`}
                    style={{ width: `${(item.avg / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#dbeafe] border-2 border-[#0099db] p-4 w-full max-w-sm font-pixelify-sans text-sm text-gray-800 mb-6 text-center leading-relaxed">
          {delta > 50
            ? `You slowed ${delta.toFixed(0)} ms when the rules were reversed — classic Stroop interference.`
            : delta > 0
            ? "Slight slowdown detected. Consistent mappings help but your adaptation was fast."
            : "You adapted quickly! But most users take longer — good reason to keep conventions."}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setPhase("debrief")}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            Take Assessment →
          </button>
        </div>
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="stroop-understanding" />
    </div>
  )
}
