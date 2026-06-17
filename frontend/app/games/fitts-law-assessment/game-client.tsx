"use client"

import { useState, useCallback, useRef } from "react"
import GameDebrief from "@/components/game-debrief"

// ── Fitts' Law: MT = a + b × log₂(A/W + 0.5)
// The law is about MOVEMENT TIME — how long it takes to acquire a target as a
// function of its distance (A) and width (W). So this assessment MEASURES the
// player's own pointing time: each trial shows a HOME dot; clicking it starts
// the clock and reveals a target of a given width at a given distance; clicking
// the target stops the clock. We record (ID, MT) per trial, then plot the
// player's data against the Fitts' Law line and report their Index of
// Performance (IP = 1/b). This mirrors how the Hick's Law assessment measures
// reaction time — a real experiment, not a sort-the-circles puzzle.

type Phase = "intro" | "home" | "target" | "results"

const BOX_W = 720
const BOX_H = 500
const HOME = { x: BOX_W / 2, y: BOX_H - 44 }
const HOME_D = 54

// Each trial is an (amplitude A in px, width W in px) pair, chosen to span a
// range of Index-of-Difficulty values (~1.0 → ~3.7 bits) so the regression has
// real spread. The first WARMUP_N are unscored practice.
const WARMUP_N = 2
const TRIALS: { a: number; w: number }[] = [
  { a: 200, w: 110 }, // warmup (easy)
  { a: 260, w: 90 },  // warmup
  { a: 150, w: 100 },
  { a: 300, w: 100 },
  { a: 420, w: 100 },
  { a: 200, w: 50 },
  { a: 380, w: 50 },
  { a: 340, w: 70 },
  { a: 260, w: 32 },
  { a: 400, w: 32 },
  { a: 160, w: 40 },
]

interface Trial {
  x: number
  y: number
  w: number
  id: number // actual Index of Difficulty, from the achieved geometry
}

interface TrialResult {
  id: number
  mtMs: number
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Place a target of width w at roughly amplitude a from HOME, in a random
// upward direction, clamped to stay inside the box. ID is computed from the
// ACTUAL distance achieved (after clamping), so it always matches what the
// player really did — fixing the original game's bug of scoring difficulty
// from a fixed start point the cursor had already left.
function buildTrial(a: number, w: number): Trial {
  const theta = (Math.random() * 140 - 70) * (Math.PI / 180) // ±70° from vertical
  const margin = w / 2 + 8
  const rawX = HOME.x + a * Math.sin(theta)
  const rawY = HOME.y - a * Math.cos(theta)
  const x = Math.max(margin, Math.min(BOX_W - margin, rawX))
  const y = Math.max(margin, Math.min(HOME.y - 64, rawY))
  const dist = Math.hypot(x - HOME.x, y - HOME.y)
  const id = Math.log2(dist / w + 0.5)
  return { x, y, w, id }
}

function linearRegression(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length
  const sumX = xs.reduce((s, x) => s + x, 0)
  const sumY = ys.reduce((s, y) => s + y, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumXX = xs.reduce((s, x) => s + x * x, 0)
  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const a = (sumY - b * sumX) / n
  const meanY = sumY / n
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0)
  const ssRes = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { a, b, r2 }
}

export default function FittsLawAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [order] = useState(() => {
    // Keep the two warmups first; shuffle the scored trials.
    const warm = TRIALS.slice(0, WARMUP_N)
    const scored = shuffle(TRIALS.slice(WARMUP_N))
    return [...warm, ...scored]
  })
  const [idx, setIdx] = useState(0)
  const [target, setTarget] = useState<Trial | null>(null)
  const [results, setResults] = useState<TrialResult[]>([])
  const startRef = useRef<number>(0)

  const isWarmup = idx < WARMUP_N

  const start = useCallback(() => {
    setIdx(0)
    setResults([])
    setPhase("home")
  }, [])

  const handleHomeClick = useCallback(() => {
    const t = order[idx]
    setTarget(buildTrial(t.a, t.w))
    startRef.current = performance.now()
    setPhase("target")
  }, [order, idx])

  const handleTargetClick = useCallback(() => {
    const mt = performance.now() - startRef.current
    const recordable = idx >= WARMUP_N && target
    const nextResults = recordable ? [...results, { id: target!.id, mtMs: mt }] : results
    if (recordable) setResults(nextResults)

    const nextIdx = idx + 1
    setTarget(null)
    if (nextIdx >= order.length) {
      setPhase("results")
    } else {
      setIdx(nextIdx)
      setPhase("home")
    }
  }, [idx, target, results, order.length])

  // ── Intro ───────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-2xl md:text-3xl text-[#e35126] mb-4">Fitts&apos; Law</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 font-mono text-[#a16207] text-center text-lg shadow-[4px_4px_0px_0px_#a16207]">
          MT = a + b × log₂(A/W + 0.5)
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          The time to hit a target grows with its distance (A) and shrinks with its size (W).
          Click the <span className="text-[#a16207] font-bold">home dot</span>, then move to the
          target that appears and click it <span className="font-bold">as fast as you can</span>.
          We time every move. At the end, your own pointing times are plotted against the
          Fitts&apos; Law line. First 2 are practice.
        </p>
        <button
          onClick={start}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-base py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start
        </button>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const xs = results.map((r) => r.id)
    const ys = results.map((r) => r.mtMs)
    const { a, b, r2 } = linearRegression(xs, ys)
    const ip = b > 0 ? 1000 / b : 0 // bits per second (1/b, b in ms/bit)

    // Performance score (0-100) → badge stars. Completing the experiment earns a
    // 3-star floor (60); faster pointing (higher Index of Performance) and a
    // cleaner Fitts fit (R²) lift it toward 5 stars. IP 3→floor, IP 6+→full.
    // Generous by design — a learning tool, not a motor-skill exam. Also gives
    // the flip-learning paper a non-null assessmentScore for this topic.
    const ipNorm = Math.max(0, Math.min(1, (ip - 3) / 3))
    const fitNorm = Math.max(0, Math.min(1, r2))
    const score = Math.round(60 + (0.7 * ipNorm + 0.3 * fitNorm) * 40)

    const W = 340, H = 210
    const padL = 52, padB = 32, padT = 18, padR = 18
    const chartW = W - padL - padR
    const chartH = H - padB - padT
    const xMin = 0, xMax = Math.max(...xs, 1) * 1.15
    const yMin = 0, yMax = Math.max(...ys) * 1.25
    const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * chartW
    const toY = (v: number) => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH

    const lineX1 = toX(xMin), lineY1 = toY(a + b * xMin)
    const lineX2 = toX(xMax), lineY2 = toY(a + b * xMax)

    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
        <h2 className="font-press-start-2p text-xl text-black mb-1">Your Results</h2>
        <p className="font-pixelify-sans text-gray-600 text-sm mb-1">
          Fitted: MT = {a.toFixed(0)} + {b.toFixed(0)} × ID ms &nbsp;(R² = {r2.toFixed(2)})
        </p>
        <p className="font-pixelify-sans text-[#a16207] text-sm mb-4">
          Your Index of Performance ≈ {ip.toFixed(1)} bits/sec
        </p>

        <svg width={W} height={H} className="border-2 border-black mb-6 bg-white">
          <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#999" strokeWidth={1} />
          <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#999" strokeWidth={1} />
          <text x={padL + chartW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#666">Index of Difficulty (bits)</text>
          <text x={12} y={padT + chartH / 2} textAnchor="middle" fontSize={9} fill="#666" transform={`rotate(-90, 12, ${padT + chartH / 2})`}>MT (ms)</text>
          <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} stroke="#a16207" strokeWidth={2} strokeDasharray="6 3" />
          {results.map((r, i) => (
            <circle key={i} cx={toX(r.id)} cy={toY(r.mtMs)} r={4} fill="#0099db" />
          ))}
        </svg>

        <div className="bg-white border-2 border-black p-4 max-w-sm font-pixelify-sans text-sm text-gray-700 mb-6 leading-relaxed">
          <p className="font-press-start-2p text-black text-[10px] mb-2">What this shows:</p>
          <p>
            Your pointing time rose roughly in a straight line with the Index of Difficulty —
            small, far targets took longest. That linear relationship <span className="font-bold">is</span> Fitts&apos; Law.
            It&apos;s why good UI puts frequent actions on big buttons, at screen edges/corners (infinitely wide),
            or right under the cursor.
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={start}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-6 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            Try Again
          </button>
        </div>

        <GameDebrief gameId="fitts-law-assessment" score={score} totalQuestions={results.length} />
      </div>
    )
  }

  // ── Playing (home / target) ───────────────────────────────────────────────────
  const scoredDone = Math.max(0, idx - WARMUP_N)
  const scoredTotal = order.length - WARMUP_N
  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-4 text-black">
      <p className="font-press-start-2p text-gray-500 text-[9px] mb-1">
        {isWarmup ? "Practice — not scored" : `Trial ${scoredDone + 1} / ${scoredTotal}`}
      </p>
      <p className="font-pixelify-sans text-gray-600 text-xs mb-3">
        {phase === "home" ? "Click the home dot to begin the move" : "Now click the target — fast!"}
      </p>

      <div
        className="relative border-2 border-black bg-white"
        style={{ width: BOX_W, height: BOX_H, maxWidth: "95vw" }}
      >
        {/* Home dot */}
        <button
          onClick={phase === "home" ? handleHomeClick : undefined}
          disabled={phase !== "home"}
          aria-label="Home"
          className={`absolute rounded-full border-2 transition-colors ${
            phase === "home"
              ? "border-[#a16207] bg-[#facc15] hover:bg-[#fde047] animate-pulse cursor-pointer"
              : "border-gray-300 bg-gray-100"
          }`}
          style={{
            width: HOME_D,
            height: HOME_D,
            left: HOME.x - HOME_D / 2,
            top: HOME.y - HOME_D / 2,
          }}
        />

        {/* Target */}
        {phase === "target" && target && (
          <button
            onClick={handleTargetClick}
            aria-label="Target"
            className="absolute rounded-full border-2 border-[#9a1313] bg-[#fd5252] hover:bg-[#ff6b6b] cursor-pointer shadow-[0_0_14px_#fd5252]"
            style={{
              width: target.w,
              height: target.w,
              left: target.x - target.w / 2,
              top: target.y - target.w / 2,
            }}
          />
        )}
      </div>
    </div>
  )
}
