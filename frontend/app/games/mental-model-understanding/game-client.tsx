"use client"

import { useState } from "react"
import GameDebrief from "@/components/game-debrief"

// Mental Models & Affordances Understanding
// Phase 1: Intro — mental models + affordances + signifiers
// Phase 2: Affordance sort — drag UI elements to Good / Bad columns
// Phase 3: Mental model mismatch — predict which UI is faster to learn
// Debrief

type Phase = "intro" | "affordance-sort" | "mismatch" | "debrief"

type SortItem = {
  id: string
  label: string
  description: string
  isGoodAffordance: boolean
  explanation: string
}

// A small live preview of each UI element so learners SEE the affordance,
// not just read its name. Keyed by SortItem.id.
function ElementPreview({ id }: { id: string }) {
  switch (id) {
    case "raised-btn":
      return (
        <button className="bg-[#facc15] border-2 border-[#a16207] rounded-md px-4 py-1.5 font-pixelify-sans text-sm text-black shadow-[3px_3px_0px_0px_#000]">
          Submit
        </button>
      )
    case "flat-link":
      return <span className="text-blue-600 underline font-pixelify-sans text-sm cursor-pointer">View details</span>
    case "flat-icon":
      return <div className="w-7 h-7 bg-gray-300 rounded-sm" />
    case "drag-handle":
      return <span className="text-gray-500 text-xl leading-none select-none">⠿</span>
    case "disabled-btn":
      return (
        <button disabled className="bg-gray-200 border-2 border-gray-300 rounded-md px-4 py-1.5 font-pixelify-sans text-sm text-gray-400 cursor-not-allowed">
          Submit
        </button>
      )
    default:
      return null
  }
}

const SORT_ITEMS: SortItem[] = [
  {
    id: "raised-btn",
    label: "Raised button (drop-shadow, rounded)",
    description: "Looks clickable due to 3D depth cue",
    isGoodAffordance: true,
    explanation: "The raised appearance signals 'press me' — a visual affordance learned from physical buttons.",
  },
  {
    id: "flat-link",
    label: "Flat blue underlined text",
    description: "Standard hyperlink visual convention",
    isGoodAffordance: true,
    explanation: "Colour + underline is a universal signifier for 'clickable link'. Learned convention makes it a clear affordance.",
  },
  {
    id: "flat-icon",
    label: "Flat grey icon — no label, no hover",
    description: "Could be decorative or interactive",
    isGoodAffordance: false,
    explanation: "Without hover state, tooltip, or label, there's no signifier that this is interactive. Users won't know to click it.",
  },
  {
    id: "drag-handle",
    label: "Six-dot drag handle (⠿)",
    description: "Common signifier for drag-to-reorder",
    isGoodAffordance: true,
    explanation: "The six-dot pattern is an established signifier for draggable items — users familiar with modern UIs recognise it immediately.",
  },
  {
    id: "disabled-btn",
    label: "Greyed-out button — no tooltip",
    description: "Visually disabled but no explanation why",
    isGoodAffordance: false,
    explanation: "Users can perceive the button is disabled but can't evaluate why. No signifier explaining the condition creates confusion and frustration.",
  },
]

const MISMATCH_PAIRS = [
  {
    scenario: "A file manager on a new OS.",
    optionA: {
      label: "Folder metaphor — yellow folders, file icons, drag-to-move",
      reason: "Matches users' existing mental model from real desks and 30 years of OS conventions.",
    },
    optionB: {
      label: "Tag-based system — all files in one flat list, filtered by coloured tags",
      reason: "More powerful but requires building a new mental model from scratch.",
    },
    faster: "A",
    explanation: "Option A matches the existing mental model (physical desk analogy). Option B is more powerful but demands that users discard their entire mental model — very high initial error rate.",
  },
  {
    scenario: "A mobile app to set a reminder.",
    optionA: {
      label: "Type the time into a text field: '14:30'",
      reason: "Matches how you'd tell someone verbally.",
    },
    optionB: {
      label: "Scroll a drum-roll picker: hour | minute | AM/PM",
      reason: "Matches the mental model of an analogue clock.",
    },
    faster: "B",
    explanation: "Drum-roll pickers match the spatial mental model of a clock face — users can scroll to the right position intuitively. Text entry requires remembering exact format (14:30 vs 2:30 PM vs 1430).",
  },
]

export default function MentalModelUnderstanding() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [sortAnswers, setSortAnswers] = useState<Record<string, "good" | "bad" | null>>(
    Object.fromEntries(SORT_ITEMS.map((item) => [item.id, null]))
  )
  const [showSortResult, setShowSortResult] = useState(false)
  const [mismatchIdx, setMismatchIdx] = useState(0)
  const [mismatchSelected, setMismatchSelected] = useState<"A" | "B" | null>(null)

  const allSorted = Object.values(sortAnswers).every((v) => v !== null)

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-xl text-black mb-2">Mental Models & Affordances</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-6 leading-relaxed">
          Users don't read manuals — they build a <strong>mental model</strong> of how a system works based on past experience and visible cues. <strong>Affordances</strong> are properties that suggest how something should be used. <strong>Signifiers</strong> are the visible cues that communicate those affordances.
        </p>

        <div className="w-full max-w-xl space-y-3 mb-8">
          {[
            {
              term: "Mental Model",
              def: "The user's internal representation of how the system works. Built from past experience, metaphors, and instruction. Good UIs match users' existing mental models.",
              border: "border-[#a16207]",
              bg: "bg-[#fefce8]",
            },
            {
              term: "Affordance",
              def: "A property (real or perceived) that suggests a possible action. A door handle affords pulling. A button affords pressing. The physical shape communicates use.",
              border: "border-[#0099db]",
              bg: "bg-[#dbeafe]",
            },
            {
              term: "Signifier",
              def: "A visible signal that communicates an affordance. The underline on a link. The shadow on a button. Without signifiers, affordances are invisible — and actions undiscoverable.",
              border: "border-black",
              bg: "bg-white",
            },
          ].map((item) => (
            <div key={item.term} className={`border-2 ${item.border} ${item.bg} p-4`}>
              <p className="font-press-start-2p text-black text-[10px] mb-2">{item.term}</p>
              <p className="font-pixelify-sans text-sm text-gray-700">{item.def}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPhase("affordance-sort")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Sort UI Elements →
        </button>
      </div>
    )
  }

  // ── Affordance Sort ────────────────────────────────────────────────────────
  if (phase === "affordance-sort") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Affordance Sort</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center mb-6 max-w-md">
          For each UI element, decide: does it have a <strong>clear affordance</strong> (user knows what to do) or a <strong>weak affordance</strong> (user might not)?
        </p>

        <div className="w-full max-w-xl space-y-3 mb-6">
          {SORT_ITEMS.map((item) => {
            const answer = sortAnswers[item.id]
            const isCorrect = answer === (item.isGoodAffordance ? "good" : "bad")
            return (
              <div key={item.id} className="bg-white border-2 border-black p-4">
                <div className="flex items-center gap-4 mb-1">
                  <div className="shrink-0 w-24 flex items-center justify-center min-h-[2.5rem] bg-[#f8f6ee] border border-gray-200 rounded">
                    <ElementPreview id={item.id} />
                  </div>
                  <p className="font-pixelify-sans text-sm font-bold text-black">{item.label}</p>
                </div>
                <p className="font-pixelify-sans text-xs text-gray-500 mb-3">{item.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortAnswers((prev) => ({ ...prev, [item.id]: "good" }))}
                    className={`px-3 py-1 border-2 font-pixelify-sans text-sm transition ${
                      answer === "good" ? "bg-green-500 border-green-700 text-white" : "bg-white border-black hover:bg-green-50"
                    }`}
                  >
                    ✓ Clear affordance
                  </button>
                  <button
                    onClick={() => setSortAnswers((prev) => ({ ...prev, [item.id]: "bad" }))}
                    className={`px-3 py-1 border-2 font-pixelify-sans text-sm transition ${
                      answer === "bad" ? "bg-red-500 border-red-700 text-white" : "bg-white border-black hover:bg-red-50"
                    }`}
                  >
                    ✗ Weak affordance
                  </button>
                </div>
                {showSortResult && answer !== null && (
                  <div className={`mt-2 p-2 border font-pixelify-sans text-xs leading-relaxed ${isCorrect ? "bg-green-50 border-green-400 text-green-800" : "bg-red-50 border-red-400 text-red-800"}`}>
                    {isCorrect ? "✓ " : "✗ "}{item.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!showSortResult ? (
          <button
            onClick={() => setShowSortResult(true)}
            disabled={!allSorted}
            className="bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#007cb2] transition-colors shadow-[3px_3px_0px_0px_#005a81] disabled:opacity-40"
          >
            Check Answers
          </button>
        ) : (
          <button
            onClick={() => setPhase("mismatch")}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            Mental Model Match →
          </button>
        )}
      </div>
    )
  }

  // ── Mismatch ───────────────────────────────────────────────────────────────
  if (phase === "mismatch") {
    const pair = MISMATCH_PAIRS[mismatchIdx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4">
          {mismatchIdx + 1} / {MISMATCH_PAIRS.length}
        </p>
        <p className="font-pixelify-sans text-black text-base font-bold max-w-xl text-center mb-2 leading-relaxed">
          Scenario: {pair.scenario}
        </p>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center mb-6">Which will be faster to learn for a new user?</p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl mb-4">
          {(["A", "B"] as const).map((side) => {
            const opt = side === "A" ? pair.optionA : pair.optionB
            const isCorrect = side === pair.faster
            let cls = "border-gray-400 bg-white"
            if (mismatchSelected !== null) {
              cls = isCorrect ? "border-green-600 bg-green-50" : mismatchSelected === side ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"
            }
            return (
              <button
                key={side}
                onClick={() => { if (!mismatchSelected) setMismatchSelected(side) }}
                disabled={!!mismatchSelected}
                className={`flex-1 border-2 p-4 text-left transition ${cls} ${!mismatchSelected ? "hover:border-[#a16207] cursor-pointer" : "cursor-default"}`}
              >
                <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Option {side}</p>
                <p className="font-pixelify-sans text-sm text-black mb-2 font-bold">{opt.label}</p>
                <p className="font-pixelify-sans text-xs text-gray-600">{opt.reason}</p>
              </button>
            )
          })}
        </div>

        {mismatchSelected && (
          <div className={`w-full max-w-2xl border-2 p-4 font-pixelify-sans text-sm mb-4 leading-relaxed ${mismatchSelected === pair.faster ? "bg-green-100 border-green-600 text-green-800" : "bg-red-100 border-red-500 text-red-800"}`}>
            <strong>{mismatchSelected === pair.faster ? "Correct! " : `Option ${pair.faster} is faster. `}</strong>
            {pair.explanation}
          </div>
        )}

        {mismatchSelected && (
          <button
            onClick={() => {
              setMismatchSelected(null)
              if (mismatchIdx + 1 >= MISMATCH_PAIRS.length) {
                setPhase("debrief")
              } else {
                setMismatchIdx((i) => i + 1)
              }
            }}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {mismatchIdx + 1 >= MISMATCH_PAIRS.length ? "Complete Understanding →" : "Next Scenario →"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="mental-model-understanding" />
    </div>
  )
}
