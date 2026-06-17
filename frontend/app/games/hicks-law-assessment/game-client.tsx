"use client"

import { useState, useCallback, useRef } from "react"
import GameDebrief from "@/components/game-debrief"

// ── Hick's Law: RT = a + b × log₂(n + 1)
// Each round doubles the number of coloured buttons. Player clicks the
// highlighted (blinking) one as fast as possible.  After all rounds the
// game plots their measured RTs against log₂(n+1) to show the linear fit.

const ROUNDS = [
  { n: 2,  label: "2 choices" },
  { n: 4,  label: "4 choices" },
  { n: 8,  label: "8 choices" },
  { n: 16, label: "16 choices" },
]

const COLORS = [
  "#e63946","#457b9d","#2a9d8f","#e9c46a","#f4a261",
  "#8338ec","#06d6a0","#ff6b6b","#4cc9f0","#f72585",
  "#3a0ca3","#4361ee","#7209b7","#b5179e","#560bad","#023e8a",
]

type Phase = "intro" | "warmupReady" | "warmupPlay" | "warmupDone" | "fixation" | "playing" | "between" | "results"

const WARMUP_N = 3

interface RoundResult {
  n: number
  rtMs: number
}

function linearRegression(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length
  const sumX = xs.reduce((s, x) => s + x, 0)
  const sumY = ys.reduce((s, y) => s + y, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumXX = xs.reduce((s, x) => s + x * x, 0)
  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const a = (sumY - b * sumX) / n
  return { a, b }
}

export default function HicksLawAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [roundIdx, setRoundIdx] = useState(0)
  const [targetIdx, setTargetIdx] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])
  const [warmupTarget, setWarmupTarget] = useState(0)
  const startRef = useRef<number>(0)

  const currentRound = ROUNDS[roundIdx]

  // Unscored practice round so the first SCORED round isn't inflated by
  // the player still figuring out the mechanic.
  const startWarmup = useCallback(() => {
    setWarmupTarget(Math.floor(Math.random() * WARMUP_N))
    setPhase("warmupPlay")
  }, [])

  const handleWarmupClick = useCallback((idx: number) => {
    if (idx === warmupTarget) setPhase("warmupDone")
    else setWarmupTarget(Math.floor(Math.random() * WARMUP_N))
  }, [warmupTarget])

  const startRound = useCallback(() => {
    const n = ROUNDS[roundIdx].n
    setTargetIdx(Math.floor(Math.random() * n))
    setPhase("fixation")
    const delay = 600 + Math.random() * 800
    setTimeout(() => {
      startRef.current = performance.now()
      setPhase("playing")
    }, delay)
  }, [roundIdx])

  const handleButtonClick = useCallback(
    (idx: number) => {
      if (phase !== "playing") return
      const rt = performance.now() - startRef.current
      if (idx !== targetIdx) {
        setPhase("fixation")
        const delay = 600 + Math.random() * 600
        setTimeout(() => {
          const n = ROUNDS[roundIdx].n
          setTargetIdx(Math.floor(Math.random() * n))
          startRef.current = performance.now()
          setPhase("playing")
        }, delay)
        return
      }
      const newResults = [...results, { n: currentRound.n, rtMs: rt }]
      setResults(newResults)
      if (roundIdx + 1 < ROUNDS.length) {
        setPhase("between")
      } else {
        setPhase("results")
      }
    },
    [phase, targetIdx, roundIdx, results, currentRound],
  )

  const nextRound = useCallback(() => {
    setRoundIdx((r) => r + 1)
    setPhase("fixation")
    const delay = 600 + Math.random() * 800
    setTimeout(() => {
      const n = ROUNDS[roundIdx + 1].n
      setTargetIdx(Math.floor(Math.random() * n))
      startRef.current = performance.now()
      setPhase("playing")
    }, delay)
  }, [roundIdx])

  const restart = useCallback(() => {
    setRoundIdx(0)
    setResults([])
    setPhase("intro")
  }, [])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-2xl md:text-3xl text-black mb-4">
          Hick's Law
        </h1>
        <div className="bg-white border-2 border-black p-4 mb-4 font-mono text-[#a16207] text-center text-lg shadow-[4px_4px_0px_0px_#a16207]">
          RT = a + b × log₂(n + 1)
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          Reaction time increases logarithmically with the number of choices.
          You'll do 4 rounds with 2, 4, 8, and 16 buttons. Click the{" "}
          <span className="text-[#a16207] font-bold">glowing</span> button as fast as you can.
          At the end, your data will be plotted against the Hick's Law curve.
        </p>
        <button
          onClick={startWarmup}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-base py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start
        </button>
      </div>
    )
  }

  // ── Warmup (unscored practice) ──────────────────────────────────────────────
  if (phase === "warmupPlay") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-4 text-black">
        <p className="font-press-start-2p text-[#a16207] text-[10px] mb-1">Practice — not scored</p>
        <p className="font-pixelify-sans text-gray-600 text-xs mb-6">Warm up: click the glowing button</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${WARMUP_N}, minmax(0, 1fr))` }}>
          {Array.from({ length: WARMUP_N }, (_, i) => (
            <button
              key={i}
              onClick={() => handleWarmupClick(i)}
              className={`transition-all duration-75 border-2 ${
                i === warmupTarget
                  ? "border-[#facc15] scale-110 shadow-[0_0_20px_#facc15] animate-pulse"
                  : "border-transparent opacity-80 hover:opacity-100"
              }`}
              style={{ width: 90, height: 90, backgroundColor: COLORS[i] }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (phase === "warmupDone") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-press-start-2p text-green-700 text-lg mb-2">Nice — you've got it!</p>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8">
          That was a practice round. The next 4 rounds are scored and plotted against the Hick's Law curve.
        </p>
        <button
          onClick={startRound}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-base py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Begin scored rounds →
        </button>
      </div>
    )
  }

  if (phase === "fixation" || phase === "between") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        {phase === "between" && (
          <div className="mb-8 text-center">
            <p className="font-press-start-2p text-green-700 text-lg mb-2">
              Round {roundIdx + 1} done — {results[results.length - 1]?.rtMs.toFixed(0)} ms
            </p>
            <p className="font-pixelify-sans text-gray-600">
              Next: {ROUNDS[roundIdx + 1].label}
            </p>
            <button
              onClick={nextRound}
              className="mt-4 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
            >
              Next Round
            </button>
          </div>
        )}
        {phase === "fixation" && (
          <>
            <div className="w-6 h-6 bg-black animate-pulse mb-4" />
            <p className="font-pixelify-sans text-gray-600">Get ready…</p>
          </>
        )}
      </div>
    )
  }

  if (phase === "playing") {
    const n = currentRound.n
    const cols = n <= 4 ? n : n <= 8 ? 4 : 8
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-4 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-1">
          Round {roundIdx + 1} / {ROUNDS.length} — {currentRound.label}
        </p>
        <p className="font-pixelify-sans text-gray-600 text-xs mb-6">Click the glowing button</p>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: n }, (_, i) => (
            <button
              key={i}
              onClick={() => handleButtonClick(i)}
              className={`transition-all duration-75 border-2 ${
                i === targetIdx
                  ? "border-[#facc15] scale-110 shadow-[0_0_20px_#facc15] animate-pulse"
                  : "border-transparent opacity-80 hover:opacity-100"
              }`}
              style={{
                width: n <= 4 ? 90 : n <= 8 ? 70 : 52,
                height: n <= 4 ? 90 : n <= 8 ? 70 : 52,
                backgroundColor: COLORS[i],
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (phase === "results") {
    const xs = results.map((r) => Math.log2(r.n + 1))
    const ys = results.map((r) => r.rtMs)
    const { a, b } = linearRegression(xs, ys)

    const W = 320; const H = 200
    const padL = 50; const padB = 30; const padT = 20; const padR = 20
    const chartW = W - padL - padR
    const chartH = H - padB - padT
    const xMin = 0; const xMax = Math.log2(17)
    const yMin = 0; const yMax = Math.max(...ys) * 1.3
    const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * chartW
    const toY = (v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH

    const lineX1 = toX(Math.log2(2 + 1)); const lineY1 = toY(a + b * Math.log2(2 + 1))
    const lineX2 = toX(Math.log2(16 + 1)); const lineY2 = toY(a + b * Math.log2(16 + 1))

    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h2 className="font-press-start-2p text-xl text-black mb-1">Your Results</h2>
        <p className="font-pixelify-sans text-gray-600 text-sm mb-4">
          Fitted: RT = {a.toFixed(0)} + {b.toFixed(0)} × log₂(n + 1) ms
        </p>

        <svg width={W} height={H} className="border-2 border-black mb-6 bg-white">
          <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#999" strokeWidth={1} />
          <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#999" strokeWidth={1} />
          <text x={padL + chartW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#666">log₂(n+1)</text>
          <text x={12} y={padT + chartH / 2} textAnchor="middle" fontSize={9} fill="#666" transform={`rotate(-90, 12, ${padT + chartH / 2})`}>RT (ms)</text>
          <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke="#a16207" strokeWidth={2} strokeDasharray="6 3" />
          {results.map((r, i) => (
            <g key={i}>
              <circle cx={toX(Math.log2(r.n + 1))} cy={toY(r.rtMs)} r={5} fill="#0099db" />
              <text x={toX(Math.log2(r.n + 1)) + 7} y={toY(r.rtMs) + 4} fontSize={8} fill="#005a81">
                n={r.n}: {r.rtMs.toFixed(0)}ms
              </text>
            </g>
          ))}
        </svg>

        <div className="bg-white border-2 border-black p-4 max-w-sm font-pixelify-sans text-sm text-gray-700 mb-6 leading-relaxed">
          <p className="font-press-start-2p text-black text-[10px] mb-2">What this shows:</p>
          <p>
            Even a small increase in choices significantly increases reaction time.
            This is why good UI design keeps menus short and contextual.
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={restart}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-6 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            Try Again
          </button>
        </div>

        <GameDebrief gameId="hicks-law-assessment" />
      </div>
    )
  }

  return null
}
