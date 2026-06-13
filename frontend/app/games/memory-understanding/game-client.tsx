"use client"

import { useState } from "react"
import GameDebrief from "@/components/game-debrief"

// ── Miller's Law Understanding
// Interactive chunking demo + STM vs LTM comparison

type Phase = "learn" | "chunk-demo" | "debrief"

const CHUNKING_EXAMPLES = [
  {
    id: "phone",
    title: "Phone Number",
    raw: "12345678901",
    chunked: "123-4567-8901",
    rawChunks: 11,
    chunkedChunks: 3,
    explanation: "11 individual digits → 3 meaningful groups. STM now holds 3 chunks, not 11.",
  },
  {
    id: "password",
    title: "Password",
    raw: "correcthorsebatterystaple",
    chunked: "correct horse battery staple",
    rawChunks: 25,
    chunkedChunks: 4,
    explanation: "25 letters → 4 common words. Each word is one chunk. Much easier to remember.",
  },
  {
    id: "date",
    title: "Date",
    raw: "20260613",
    chunked: "2026-06-13",
    rawChunks: 8,
    chunkedChunks: 3,
    explanation: "8 digits → year, month, day. Context transforms digits into meaningful chunks.",
  },
  {
    id: "menu",
    title: "Navigation Menu",
    raw: "HomeProductsElectronicsLaptopsKeyboardsMiceMonitorsCablesHDMI",
    chunked: "Home | Products → Electronics → [Laptops, Keyboards, Mice, Monitors, Cables, HDMI]",
    rawChunks: 9,
    chunkedChunks: 3,
    explanation: "Flat list of 9 items → hierarchy of 3 levels. Each level fits within 7±2.",
  },
]

export default function MemoryUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [activeExample, setActiveExample] = useState(0)
  const [showChunked, setShowChunked] = useState(false)

  const ex = CHUNKING_EXAMPLES[activeExample]

  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-1">Miller's Law</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-2 text-lg">
          <span className="text-black font-bold">Short-term memory holds 7 ± 2 chunks</span>
        </p>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center max-w-md mb-8">
          George Miller (1956) established that working memory has a fixed capacity of 7 ± 2 items.
          A "chunk" is any meaningful unit — a digit, word, or concept grouped together.
        </p>

        {/* Three-memory-type diagram */}
        <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-8">
          {[
            { name: "Sensory", duration: "< 1 second", capacity: "Large", border: "border-red-500", bg: "bg-red-50" },
            { name: "Short-term (STM)", duration: "~20 seconds", capacity: "7 ± 2 chunks", border: "border-[#facc15]", bg: "bg-[#fefce8]" },
            { name: "Long-term (LTM)", duration: "Permanent", capacity: "Unlimited", border: "border-[#0099db]", bg: "bg-[#dbeafe]" },
          ].map((m) => (
            <div key={m.name} className={`border-2 ${m.border} ${m.bg} p-4`}>
              <p className="font-press-start-2p text-black text-[10px] mb-2">{m.name}</p>
              <p className="font-pixelify-sans text-xs text-gray-500">Duration: <span className="text-black font-bold">{m.duration}</span></p>
              <p className="font-pixelify-sans text-xs text-gray-500 mt-1">Capacity: <span className="text-black font-bold">{m.capacity}</span></p>
            </div>
          ))}
        </div>

        <div className="bg-white border-2 border-black p-5 w-full max-w-2xl mb-6">
          <h3 className="font-press-start-2p text-[#005a81] text-[10px] mb-3">Why it matters for UI design</h3>
          <ul className="font-pixelify-sans text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>Users scanning a menu can hold ~7 items in working memory before losing track</li>
            <li>Error messages requiring memory of previous steps overload STM</li>
            <li>Multi-step wizards should not exceed 7 steps without clear progress indicators</li>
            <li>Grouping controls into labelled sections creates chunks, reducing perceived complexity</li>
          </ul>
        </div>

        <button
          onClick={() => setPhase("chunk-demo")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Experience Chunking →
        </button>
      </div>
    )
  }

  if (phase === "chunk-demo") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Chunking in Action</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center mb-6 max-w-md">
          Chunking organises information into meaningful groups, reducing the STM load.
          Toggle to see both versions.
        </p>

        {/* Example selector */}
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {CHUNKING_EXAMPLES.map((e, i) => (
            <button
              key={e.id}
              onClick={() => { setActiveExample(i); setShowChunked(false) }}
              className={`px-3 py-1 border-2 font-pixelify-sans text-sm transition ${
                i === activeExample
                  ? "bg-[#facc15] border-[#a16207] text-black"
                  : "bg-white border-black text-black hover:bg-[#f8f6ee]"
              }`}
            >
              {e.title}
            </button>
          ))}
        </div>

        {/* Toggle */}
        <div className="w-full max-w-xl bg-white border-2 border-black p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className={`font-press-start-2p text-[10px] ${!showChunked ? "text-red-600" : "text-gray-400"}`}>
              Raw ({ex.rawChunks} items)
            </span>
            <button
              onClick={() => setShowChunked((v) => !v)}
              className={`relative w-14 h-7 border-2 border-black transition-colors ${showChunked ? "bg-[#facc15]" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black transition-transform ${showChunked ? "translate-x-7" : "translate-x-0"}`} />
            </button>
            <span className={`font-press-start-2p text-[10px] ${showChunked ? "text-green-700" : "text-gray-400"}`}>
              Chunked ({ex.chunkedChunks} items)
            </span>
          </div>

          <div className="bg-[#f8f6ee] border-2 border-black p-4 text-center font-mono text-lg break-all">
            {showChunked ? (
              <span className="text-green-700">{ex.chunked}</span>
            ) : (
              <span className="text-red-600">{ex.raw}</span>
            )}
          </div>

          <div className="mt-3 flex justify-center gap-2">
            {Array.from({ length: showChunked ? ex.chunkedChunks : ex.rawChunks }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 border border-black transition-colors ${
                  i < 7 ? (showChunked ? "bg-green-500" : "bg-[#facc15]") : "bg-red-600"
                }`}
              />
            ))}
          </div>
          <p className="font-pixelify-sans text-xs text-gray-500 text-center mt-1">
            Red squares exceed the 7±2 STM limit
          </p>
        </div>

        <div className="bg-[#dbeafe] border-2 border-[#0099db] p-4 w-full max-w-xl font-pixelify-sans text-sm text-gray-800 mb-6">
          {ex.explanation}
        </div>

        <button
          onClick={() => setPhase("debrief")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Complete Understanding →
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="memory-understanding" />
    </div>
  )
}
