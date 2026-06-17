"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Ergonomics & I/O Devices — Understanding
// Phase 1: Learn — fitting the system to the human
// Phase 2a: Spot the ergonomic hazards in a workstation
// Phase 2b: Explore haptic resolution (two-point threshold) across the body
// Phase 3: Debrief

type Phase = "learn" | "hazards" | "haptics" | "debrief"

const HAZARDS = [
  { id: "neck", label: "Head bent forward", rule: "Neck bent >30° for >2 hrs/day causes strain — the head weighs 10–12 lb." },
  { id: "screen", label: "Screen too low", rule: "Top of the screen should be at eye level, an arm's length away, to keep the neck neutral." },
  { id: "wrist", label: "Bent wrists", rule: "Wrist flexion >30°, extension >45°, or ulnar deviation >30° risks carpal tunnel syndrome." },
  { id: "feet", label: "Feet dangling", rule: "Feet should rest flat on the floor with knees level with the hips to support the lower back." },
]

const BODY = [
  { region: "Fingertip", threshold: 2, note: "Most sensitive — densest receptors. Put fine haptic detail here (e.g., VR glove fingertips)." },
  { region: "Palm", threshold: 10, note: "Moderate resolution — good for general taps and clicks." },
  { region: "Forearm", threshold: 35, note: "Coarse — only large, well-separated cues are felt (e.g., a watch buzz)." },
  { region: "Back / calf", threshold: 42, note: "Coarsest — two points must be ~40 mm apart to feel distinct. Detailed feedback is wasted here." },
]

export default function ErgonomicsUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [found, setFound] = useState<string[]>([])
  const [body, setBody] = useState(0)

  const findHazard = useCallback((id: string) => {
    setFound((f) => (f.includes(id) ? f : [...f, id]))
  }, [])

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-xl text-black mb-2">Ergonomics &amp; I/O Devices</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          Ergonomics (human factors) fits the <span className="font-bold text-black">system to the human</span> — body,
          perception, and mind — to optimise well-being and overall performance. The &lsquo;system&rsquo; is the human
          and the machine together, not the technology alone.
        </p>
        <div className="w-full max-w-2xl grid md:grid-cols-2 gap-4 mb-8 font-pixelify-sans text-sm text-gray-700">
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Physical ergonomics</p>
            Posture, anthropometry, repetitive strain. Bad fit → musculoskeletal disorders like carpal tunnel syndrome.
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">I/O devices</p>
            Inputs and outputs are the user interface. Judge them by how they fit the eye, the hand, and motor limits (Fitts&apos; Law, haptics).
          </div>
        </div>
        <button
          onClick={() => setPhase("hazards")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Spot the hazards →
        </button>
      </div>
    )
  }

  // ── Hazards ────────────────────────────────────────────────────────────────
  if (phase === "hazards") {
    const allFound = found.length === HAZARDS.length
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-8 p-6">
        <h2 className="font-press-start-2p text-lg text-black mb-1">Spot the ergonomic hazards</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm mb-6">Found {found.length} / {HAZARDS.length}</p>

        <p className="font-pixelify-sans text-gray-500 text-xs mb-4 max-w-md text-center">
          A person slumped at a laptop. Click each <span className="font-bold">⚠ body zone</span> to reveal what&apos;s wrong with it.
        </p>

        {/* Labeled side-view workstation — each hotspot sits on its body region */}
        <div className="relative bg-white border-2 border-black w-80 h-72 mb-6 shadow-[4px_4px_0px_0px_#a16207]">
          {/* head bent toward a low screen */}
          <div className="absolute top-4 left-10 text-5xl rotate-[25deg]">🧑</div>
          <div className="absolute top-20 left-2 text-4xl">🖥️</div>
          {/* arms/desk */}
          <div className="absolute top-32 left-1/2 -translate-x-1/2 w-64 h-2 bg-[#a16207]" />
          <div className="absolute top-28 right-10 text-3xl">🖐️</div>
          {/* dangling feet */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-3xl">🦶</div>

          {HAZARDS.map((h, i) => {
            // hotspot positioned ON the relevant body region, with its body-part label
            const spot = [
              { pos: "top-3 left-24", part: "Neck" },     // head bent forward
              { pos: "top-20 left-1", part: "Screen" },    // screen too low
              { pos: "top-28 right-6", part: "Wrists" },   // bent wrists
              { pos: "bottom-4 left-1/2 -translate-x-1/2", part: "Feet" }, // dangling feet
            ][i]
            const got = found.includes(h.id)
            return (
              <button
                key={h.id}
                onClick={() => findHazard(h.id)}
                className={`absolute ${spot.pos} flex flex-col items-center`}
                aria-label={`Hazard: ${spot.part}`}
              >
                <span
                  className={`w-7 h-7 rounded-full border-2 font-press-start-2p text-[10px] flex items-center justify-center ${
                    got ? "bg-red-500 border-black text-white" : "bg-[#facc15] border-black animate-pulse"
                  }`}
                >
                  {got ? "!" : "?"}
                </span>
                <span className={`font-press-start-2p text-[7px] mt-0.5 px-1 ${got ? "text-red-700" : "text-black bg-white/80"}`}>
                  {spot.part}
                </span>
              </button>
            )
          })}
        </div>

        <div className="w-full max-w-xl space-y-2 mb-6">
          {HAZARDS.map((h) => found.includes(h.id) && (
            <div key={h.id} className="bg-red-50 border-2 border-red-400 p-3 font-pixelify-sans text-sm text-gray-800">
              <span className="font-bold text-red-700">{h.label}: </span>{h.rule}
            </div>
          ))}
        </div>

        <button
          onClick={() => setPhase("haptics")}
          disabled={!allFound}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000] disabled:opacity-40"
        >
          {allFound ? "Next: Haptics →" : `Find ${HAZARDS.length - found.length} more`}
        </button>
      </div>
    )
  }

  // ── Haptics ────────────────────────────────────────────────────────────────
  if (phase === "haptics") {
    const b = BODY[body]
    const maxT = 42
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-8 p-6">
        <h2 className="font-press-start-2p text-lg text-black mb-1">Haptic resolution</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm mb-6 max-w-md text-center">
          The two-point threshold is the smallest gap at which two touches feel like two, not one. It varies hugely across the body.
        </p>

        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {BODY.map((r, i) => (
            <button
              key={r.region}
              onClick={() => setBody(i)}
              className={`font-press-start-2p text-[9px] py-2 px-3 border-2 border-black ${i === body ? "bg-[#facc15]" : "bg-white hover:bg-[#f8f6ee]"}`}
            >
              {r.region}
            </button>
          ))}
        </div>

        <div className="w-full max-w-md bg-white border-2 border-black p-5 mb-6 shadow-[4px_4px_0px_0px_#a16207]">
          <div className="flex justify-between font-pixelify-sans text-sm mb-1">
            <span className="font-bold">{b.region}</span>
            <span>~{b.threshold} mm</span>
          </div>
          <div className="h-5 bg-gray-200 border border-black overflow-hidden mb-3">
            <div className="h-full bg-[#0099db]" style={{ width: `${(b.threshold / maxT) * 100}%` }} />
          </div>
          <p className="font-pixelify-sans text-sm text-gray-700 leading-relaxed">{b.note}</p>
        </div>

        <button
          onClick={() => setPhase("debrief")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Take Assessment →
        </button>
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="ergonomics-understanding" />
    </div>
  )
}
