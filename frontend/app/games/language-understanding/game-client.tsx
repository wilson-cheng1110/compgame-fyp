"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Language & Ambiguity — Understanding
// Phase 1: Learn the three levels (syntax / semantics / pragmatics)
// Phase 2: Disambiguate real sentences — pick a reading, then see that BOTH are valid
// Phase 3: Debrief

type Phase = "learn" | "play" | "debrief"

const SENTENCES = [
  {
    text: "I saw the man with the telescope.",
    readings: ["I used a telescope to see the man.", "I saw a man who was holding a telescope."],
    level: "Syntactic (attachment)",
    note: "Both readings are grammatical. 'with the telescope' can attach to the verb (saw) or the noun (man) — only context resolves it.",
  },
  {
    text: "Visiting relatives can be boring.",
    readings: ["Going to visit your relatives can be boring.", "Relatives who are visiting you can be boring."],
    level: "Syntactic",
    note: "'Visiting' is either a verb (the act of visiting) or an adjective (relatives who visit). Same words, two structures.",
  },
  {
    text: "The chicken is ready to eat.",
    readings: ["The cooked chicken is ready to be eaten.", "The live chicken is ready to eat its food."],
    level: "Semantic / pragmatic",
    note: "Grammatically identical, but the meaning flips depending on whether 'chicken' is food or animal — resolved only by context (pragmatics).",
  },
  {
    text: "Put the book on the table in the kitchen.",
    readings: ["Put (the book) onto (the table in the kitchen).", "Put (the book that is on the table) into the kitchen."],
    level: "Syntactic (attachment)",
    note: "Where does 'in the kitchen' attach? This is exactly the kind of ambiguity a voice assistant must resolve before acting.",
  },
]

export default function LanguageUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  const pick = useCallback((i: number) => {
    if (picked !== null) return
    setPicked(i)
  }, [picked])

  const next = useCallback(() => {
    setPicked(null)
    if (idx + 1 >= SENTENCES.length) setPhase("debrief")
    else setIdx((i) => i + 1)
  }, [idx])

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-2">Language &amp; Ambiguity</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          Natural language is processed at three levels — and ambiguity can strike at each one. That&apos;s why
          conversational and voice interfaces are hard: the same words can carry many meanings.
        </p>
        <div className="w-full max-w-2xl grid md:grid-cols-3 gap-4 mb-8 font-pixelify-sans text-sm text-gray-700">
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Syntax</p>
            Is the sentence well-formed? How do the words structurally fit together?
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Semantics</p>
            What does it literally mean — independent of who said it or when?
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Pragmatics</p>
            What did the speaker actually intend, given the context?
          </div>
        </div>
        <button
          onClick={() => setPhase("play")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Disambiguate sentences →
        </button>
      </div>
    )
  }

  // ── Play ───────────────────────────────────────────────────────────────────
  if (phase === "play") {
    const s = SENTENCES[idx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4">Sentence {idx + 1} / {SENTENCES.length}</p>
        <div className="bg-white border-2 border-black p-5 mb-6 max-w-xl text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-pixelify-sans text-xl text-black">&ldquo;{s.text}&rdquo;</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-sm mb-4">What does it mean? Pick the reading you assumed:</p>

        <div className="w-full max-w-xl space-y-3 mb-4">
          {s.readings.map((r, i) => {
            let cls = "bg-white border-black hover:bg-[#f8f6ee] hover:shadow-[2px_2px_0px_0px_#000]"
            if (picked !== null) cls = "bg-[#dbeafe] border-[#0099db]"
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={picked !== null}
                className={`w-full text-left border-2 p-3 font-pixelify-sans text-sm transition ${cls}`}
              >
                {r}
              </button>
            )
          })}
        </div>

        {picked !== null && (
          <>
            <div className="w-full max-w-xl bg-[#fef9c3] border-2 border-[#facc15] p-4 font-pixelify-sans text-sm text-gray-800 leading-relaxed mb-4">
              <p className="font-press-start-2p text-[#a16207] text-[9px] mb-2">Both readings are valid — {s.level}</p>
              {s.note}
            </div>
            <button
              onClick={next}
              className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
            >
              {idx + 1 >= SENTENCES.length ? "Take Assessment →" : "Next sentence →"}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="language-understanding" />
    </div>
  )
}
