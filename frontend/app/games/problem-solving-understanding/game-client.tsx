"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Problem Solving — Understanding
// Phase 1: Learn the problem space + means-end analysis
// Phase 2: Solve the classic water-jug puzzle (5L + 3L, goal 4L) — each operator is a move
//          through the problem space; the app narrates means-end progress toward the goal.
// Phase 3: Debrief

type Phase = "learn" | "puzzle" | "debrief"
type State = { five: number; three: number }

const GOAL = 4
const START: State = { five: 0, three: 0 }

type Op = { id: string; label: string; apply: (s: State) => State }

const OPS: Op[] = [
  { id: "fill5", label: "Fill 5L jug", apply: (s) => ({ ...s, five: 5 }) },
  { id: "fill3", label: "Fill 3L jug", apply: (s) => ({ ...s, three: 3 }) },
  { id: "empty5", label: "Empty 5L jug", apply: (s) => ({ ...s, five: 0 }) },
  { id: "empty3", label: "Empty 3L jug", apply: (s) => ({ ...s, three: 0 }) },
  {
    id: "p5to3",
    label: "Pour 5L → 3L",
    apply: (s) => {
      const amt = Math.min(s.five, 3 - s.three)
      return { five: s.five - amt, three: s.three + amt }
    },
  },
  {
    id: "p3to5",
    label: "Pour 3L → 5L",
    apply: (s) => {
      const amt = Math.min(s.three, 5 - s.five)
      return { five: s.five + amt, three: s.three - amt }
    },
  },
]

function Jug({ capacity, amount, label }: { capacity: number; amount: number; label: string }) {
  const pct = (amount / capacity) * 100
  const isGoal = amount === GOAL
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-40 border-4 border-black bg-white overflow-hidden shadow-[3px_3px_0px_0px_#000]">
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${isGoal ? "bg-green-500" : "bg-[#0099db]"}`}
          style={{ height: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-press-start-2p text-sm text-black z-10">
          {amount}L
        </span>
      </div>
      <p className="font-pixelify-sans text-sm text-gray-700">{label} ({capacity}L)</p>
    </div>
  )
}

export default function ProblemSolvingUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [state, setState] = useState<State>(START)
  const [moves, setMoves] = useState<string[]>([])
  const [solved, setSolved] = useState(false)

  const applyOp = useCallback((op: Op) => {
    if (solved) return
    setState((prev) => {
      const next = op.apply(prev)
      const reached = next.five === GOAL || next.three === GOAL
      if (reached) setSolved(true)
      return next
    })
    setMoves((m) => [...m, op.label])
  }, [solved])

  const reset = useCallback(() => {
    setState(START)
    setMoves([])
    setSolved(false)
  }, [])

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-2">Problem Solving</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          Humans solve problems by searching a <span className="font-bold text-black">problem space</span> — the web of
          states between where you start and where you want to be. The trick is choosing the right move at each step.
        </p>

        <div className="w-full max-w-2xl grid md:grid-cols-3 gap-4 mb-8">
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">State</p>
            <p className="font-pixelify-sans text-sm text-gray-700">A snapshot of the world — e.g. how much water is in each jug right now.</p>
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Operator</p>
            <p className="font-pixelify-sans text-sm text-gray-700">An action that changes the state — fill, empty, or pour a jug.</p>
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Means-End</p>
            <p className="font-pixelify-sans text-sm text-gray-700">At each step, pick the operator that most reduces the gap to the goal.</p>
          </div>
        </div>

        <div className="bg-[#dbeafe] border-2 border-[#0099db] p-5 w-full max-w-2xl mb-6 font-pixelify-sans text-sm text-gray-800 leading-relaxed">
          <span className="font-press-start-2p text-[#005a81] text-[10px]">Your puzzle: </span>
          You have a <strong>5-litre</strong> jug and a <strong>3-litre</strong> jug, and a tap. Measure out exactly{" "}
          <strong>4 litres</strong>. There&apos;s no marking on the jugs — you can only fill, empty, and pour between them.
        </div>

        <button
          onClick={() => setPhase("puzzle")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start Solving →
        </button>
      </div>
    )
  }

  // ── Puzzle ─────────────────────────────────────────────────────────────────
  if (phase === "puzzle") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-8 p-6">
        <h2 className="font-press-start-2p text-lg text-black mb-1">Measure exactly {GOAL}L</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm mb-6">Moves: {moves.length}</p>

        <div className="flex gap-10 mb-8">
          <Jug capacity={5} amount={state.five} label="Big jug" />
          <Jug capacity={3} amount={state.three} label="Small jug" />
        </div>

        {solved ? (
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="bg-green-100 border-2 border-green-600 p-5 max-w-md text-center font-pixelify-sans text-sm text-green-800 leading-relaxed">
              <p className="font-press-start-2p text-xs mb-2">✓ Solved in {moves.length} moves!</p>
              Each click was an <strong>operator</strong> moving you to a new <strong>state</strong>. A means-end solver
              picks moves that shrink the distance to 4L — fill the 5, pour 3 into the small jug, leaving 2; empty the
              small jug, pour the 2 over, fill the 5 again and top up the small jug, leaving exactly 4 in the big jug.
            </div>
            <button
              onClick={() => setPhase("debrief")}
              className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
            >
              Take Assessment →
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl mb-4">
              {OPS.map((op) => (
                <button
                  key={op.id}
                  onClick={() => applyOp(op)}
                  className="bg-white border-2 border-black font-pixelify-sans text-sm py-3 px-2 hover:bg-[#facc15] transition-colors shadow-[2px_2px_0px_0px_#000]"
                >
                  {op.label}
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="font-pixelify-sans text-xs text-gray-500 underline hover:text-black"
            >
              Reset jugs
            </button>
          </>
        )}

        {moves.length > 0 && (
          <div className="mt-6 w-full max-w-xl">
            <p className="font-press-start-2p text-[9px] text-gray-400 mb-1">Your path through the problem space:</p>
            <p className="font-pixelify-sans text-xs text-gray-600">{moves.join("  →  ")}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="problem-solving-understanding" />
    </div>
  )
}
