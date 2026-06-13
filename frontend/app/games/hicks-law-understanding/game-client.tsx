"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// ── Hick's Law Understanding
// Step 1: Read the concept with interactive slider — adjust n, see predicted RT
// Step 2: Compare two UI examples and identify which is slower
// Step 3: Debrief

const A = 0.2   // seconds (typical intercept)
const B = 0.15  // seconds/bit (typical slope)

function predictRT(n: number): number {
  return A + B * Math.log2(n + 1)
}

type Phase = "learn" | "compare" | "debrief"

const COMPARISONS = [
  {
    id: "menus",
    question: "Which menu takes longer to find a food category?",
    optionA: { label: "4 categories", n: 4, items: ["Pizza", "Burgers", "Sushi", "Salads"] },
    optionB: { label: "12 categories", n: 12, items: ["Pizza", "Burgers", "Sushi", "Salads", "Tacos", "Ramen", "BBQ", "Vegan", "Desserts", "Drinks", "Breakfast", "Pasta"] },
    answer: "B",
    reason: "More choices = more decision time. 12 options takes log₂(13) ≈ 3.7 bits vs log₂(5) ≈ 2.3 bits for 4 options.",
  },
  {
    id: "buttons",
    question: "Which emergency interface is faster to act on?",
    optionA: { label: "3 actions", n: 3, items: ["CALL 999", "CANCEL", "INFO"] },
    optionB: { label: "9 actions", n: 9, items: ["CALL 999", "CALL 111", "CALL AMBULANCE", "CALL POLICE", "CALL FIRE", "CANCEL", "INFO", "BACK", "HELP"] },
    answer: "A",
    reason: "Emergency UIs should minimise choices. Fewer options means faster reaction — critical in life-safety situations.",
  },
  {
    id: "nav",
    question: "Which navigation bar leads to faster decisions?",
    optionA: { label: "5 items", n: 5, items: ["Home", "Products", "About", "Blog", "Contact"] },
    optionB: { label: "2 items", n: 2, items: ["Home", "Menu"] },
    answer: "B",
    reason: "Fewer top-level items is faster per Hick's Law, though hiding items behind a hamburger has usability trade-offs.",
  },
]

export default function HicksLawUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [sliderN, setSliderN] = useState(4)
  const [compareIdx, setCompareIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<"A" | "B" | null>(null)
  const [compareResults, setCompareResults] = useState<boolean[]>([])

  const rt = predictRT(sliderN)
  const currentComp = COMPARISONS[compareIdx]

  const handleCompareSelect = useCallback(
    (choice: "A" | "B") => {
      if (selectedAnswer) return
      setSelectedAnswer(choice)
    },
    [selectedAnswer],
  )

  const nextCompare = useCallback(() => {
    const correct = selectedAnswer === currentComp.answer
    const newResults = [...compareResults, correct]
    setCompareResults(newResults)
    setSelectedAnswer(null)
    if (compareIdx + 1 >= COMPARISONS.length) {
      setPhase("debrief")
    } else {
      setCompareIdx((i) => i + 1)
    }
  }, [selectedAnswer, currentComp, compareResults, compareIdx])

  // ── Learn phase ───────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-1">Hick's Law</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          In 1952, William Edmund Hick showed that decision time grows logarithmically with the number of choices.
          More options = slower decisions — but the penalty decreases with each additional item.
        </p>

        {/* Formula box */}
        <div className="bg-white border-2 border-black p-5 w-full max-w-md mb-6 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px] uppercase tracking-widest mb-2">The Formula</p>
          <p className="font-mono text-[#a16207] text-xl font-bold">RT = a + b × log₂(n + 1)</p>
          <div className="mt-3 font-pixelify-sans text-sm text-gray-600 space-y-1">
            <p><span className="text-black font-bold">RT</span> = reaction time (seconds)</p>
            <p><span className="text-black font-bold">a</span> = motor/cognitive baseline (~0.2 s)</p>
            <p><span className="text-black font-bold">b</span> = information processing rate</p>
            <p><span className="text-black font-bold">n</span> = number of equally probable choices</p>
          </div>
        </div>

        {/* Interactive slider */}
        <div className="bg-white border-2 border-black p-5 w-full max-w-md mb-6">
          <p className="font-pixelify-sans text-gray-600 text-sm mb-3 text-center">Try it: adjust the number of menu items</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-pixelify-sans text-xs text-gray-500 w-4">1</span>
            <input
              type="range"
              min={1}
              max={20}
              value={sliderN}
              onChange={(e) => setSliderN(Number(e.target.value))}
              className="flex-1 accent-[#facc15]"
            />
            <span className="font-pixelify-sans text-xs text-gray-500 w-6">20</span>
          </div>
          <div className="text-center">
            <span className="font-press-start-2p text-4xl text-[#a16207]">{sliderN}</span>
            <span className="font-pixelify-sans text-gray-600 ml-2">choices</span>
          </div>
          <div className="mt-4 bg-[#f8f6ee] border-2 border-black p-3 text-center">
            <p className="font-pixelify-sans text-xs text-gray-500 mb-1">Predicted reaction time</p>
            <p className="font-press-start-2p text-2xl text-black">{(rt * 1000).toFixed(0)} ms</p>
            <p className="font-pixelify-sans text-xs text-gray-500 mt-1">
              = 0.2 + 0.15 × log₂({sliderN} + 1) = 0.2 + 0.15 × {Math.log2(sliderN + 1).toFixed(2)}
            </p>
          </div>
          {/* Mini bar chart */}
          <div className="mt-4 flex items-end gap-1 h-16 justify-center">
            {[1, 2, 4, 8, 16, 20].map((n) => {
              const h = Math.round(((predictRT(n) - predictRT(1)) / (predictRT(20) - predictRT(1))) * 48 + 8)
              return (
                <div key={n} className="flex flex-col items-center">
                  <div
                    className={`w-7 transition-all ${n === sliderN ? "bg-[#facc15] border border-[#a16207]" : "bg-gray-300"}`}
                    style={{ height: h }}
                  />
                  <span className="font-pixelify-sans text-xs text-gray-500 mt-1">{n}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-[#dbeafe] border-2 border-[#0099db] p-4 w-full max-w-md mb-8 font-pixelify-sans text-sm text-gray-800">
          <p className="font-press-start-2p text-[#005a81] text-[10px] mb-2">Key Insight</p>
          <p>Going from 1→2 choices adds more time than going from 9→10. The logarithm means diminishing returns — reducing a large menu has less impact than eliminating early choices.</p>
        </div>

        <button
          onClick={() => setPhase("compare")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Apply It: Compare UIs →
        </button>
      </div>
    )
  }

  // ── Compare phase ─────────────────────────────────────────────────────────
  if (phase === "compare") {
    const comp = COMPARISONS[compareIdx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4 uppercase tracking-wider">
          Compare {compareIdx + 1} / {COMPARISONS.length}
        </p>
        <p className="font-pixelify-sans text-black text-lg font-bold max-w-xl text-center mb-6">{comp.question}</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl mb-4">
          {(["A", "B"] as const).map((side) => {
            const opt = side === "A" ? comp.optionA : comp.optionB
            const isCorrect = side === comp.answer
            let borderCls = "border-gray-400 bg-white"
            if (selectedAnswer !== null) {
              borderCls = isCorrect
                ? "border-green-600 bg-green-50"
                : selectedAnswer === side
                ? "border-red-500 bg-red-50"
                : "border-gray-400 bg-white"
            }
            return (
              <button
                key={side}
                onClick={() => handleCompareSelect(side)}
                disabled={selectedAnswer !== null}
                className={`flex-1 border-2 p-4 text-left transition ${borderCls} ${selectedAnswer === null ? "hover:border-[#a16207] cursor-pointer hover:shadow-[3px_3px_0px_0px_#a16207]" : "cursor-default"}`}
              >
                <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Option {side}: {opt.label}</p>
                <div className="flex flex-wrap gap-2">
                  {opt.items.map((item) => (
                    <span key={item} className="bg-[#f8f6ee] border border-black font-pixelify-sans text-black text-xs px-2 py-1">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="font-pixelify-sans text-xs text-gray-500 mt-3">
                  RT ∝ log₂({opt.n} + 1) = {Math.log2(opt.n + 1).toFixed(2)} bits
                </p>
              </button>
            )
          })}
        </div>
        {selectedAnswer && (
          <div className={`w-full max-w-2xl border-2 p-4 font-pixelify-sans text-sm mb-4 ${selectedAnswer === comp.answer ? "bg-green-100 border-green-600 text-green-800" : "bg-red-100 border-red-500 text-red-800"}`}>
            <strong>{selectedAnswer === comp.answer ? "Correct! " : `Wrong. Option ${comp.answer} is slower. `}</strong>
            {comp.reason}
          </div>
        )}
        {selectedAnswer && (
          <button
            onClick={nextCompare}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {compareIdx + 1 >= COMPARISONS.length ? "See Summary →" : "Next →"}
          </button>
        )}
      </div>
    )
  }

  // ── Debrief ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Understanding Complete</h2>
      <p className="font-pixelify-sans text-gray-600 text-sm mb-4">
        {compareResults.filter(Boolean).length} / {COMPARISONS.length} comparisons correct
      </p>
      <GameDebrief gameId="hicks-law-understanding" />
    </div>
  )
}
