"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Weber's Law Assessment
// 8 rounds of "spot the odd one" — one shape differs from 5 others
// JND gap shrinks each round (harder)
// Score based on correct detections

type Phase = "intro" | "playing" | "results"
type ShapeAttr = "size" | "brightness" | "hue"

const ROUND_CONFIGS: { attr: ShapeAttr; jndPct: number; label: string }[] = [
  { attr: "size",       jndPct: 0.40, label: "Warm-up: size ×1.4" },
  { attr: "brightness", jndPct: 0.35, label: "Warm-up: brightness +35%" },
  { attr: "size",       jndPct: 0.20, label: "Size ×1.2" },
  { attr: "brightness", jndPct: 0.20, label: "Brightness +20%" },
  { attr: "hue",        jndPct: 0.15, label: "Hue shift 15°" },
  { attr: "size",       jndPct: 0.12, label: "Size ×1.12 — near JND" },
  { attr: "brightness", jndPct: 0.10, label: "Brightness +10% — near JND" },
  { attr: "hue",        jndPct: 0.08, label: "Hue shift 8° — below JND?" },
]

const COLS = 3
const CELL_COUNT = 6
const BASE_SIZE = 52
const BASE_BRIGHTNESS = 160
const BASE_HUE = 200  // blue-ish

function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0")
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function buildRound(config: typeof ROUND_CONFIGS[0]) {
  const oddIdx = Math.floor(Math.random() * CELL_COUNT)
  const cells = Array.from({ length: CELL_COUNT }, (_, i) => {
    const isOdd = i === oddIdx
    if (config.attr === "size") {
      const size = isOdd ? Math.round(BASE_SIZE * (1 + config.jndPct)) : BASE_SIZE
      return { size, color: "#facc15", borderColor: "#a16207" }
    }
    if (config.attr === "brightness") {
      const b = isOdd ? Math.min(255, Math.round(BASE_BRIGHTNESS * (1 + config.jndPct))) : BASE_BRIGHTNESS
      const hex = `rgb(${b},${b - 20},${b - 50})`
      return { size: BASE_SIZE, color: hex, borderColor: "#000" }
    }
    // hue — jndPct encodes the shift in degrees as a percentage point
    // (0.15 → 15°, 0.08 → 8°), matching the round labels. (Was *360, which
    // produced 54°/29° shifts that contradicted the "15°"/"8°" labels.)
    const hue = isOdd ? BASE_HUE + config.jndPct * 100 : BASE_HUE
    return { size: BASE_SIZE, color: hslToHex(hue, 70, 55), borderColor: "#000" }
  })
  return { cells, oddIdx }
}

export default function WebersLawAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [roundIdx, setRoundIdx] = useState(0)
  const [rounds] = useState(() => ROUND_CONFIGS.map(buildRound))
  const [results, setResults] = useState<boolean[]>([])
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)

  const currentRound = rounds[roundIdx]
  const currentConfig = ROUND_CONFIGS[roundIdx]

  const handleCellClick = useCallback((idx: number) => {
    if (lastCorrect !== null) return
    const correct = idx === currentRound.oddIdx
    setLastCorrect(correct)
    setTimeout(() => {
      const newResults = [...results, correct]
      setResults(newResults)
      setLastCorrect(null)
      if (roundIdx + 1 >= ROUND_CONFIGS.length) {
        setScore(Math.round((newResults.filter(Boolean).length / ROUND_CONFIGS.length) * 100))
        setPhase("results")
      } else {
        setRoundIdx((r) => r + 1)
      }
    }, 700)
  }, [lastCorrect, currentRound, results, roundIdx])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-2xl text-black mb-3">Weber's Law</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-sm">Click the shape that's different</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          8 rounds. One shape in each grid is slightly different — bigger, brighter, or a different hue.
          The difference shrinks each round as you approach the JND threshold.
        </p>
        <button
          onClick={() => setPhase("playing")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start
        </button>
      </div>
    )
  }

  if (phase === "playing") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-1">
          Round {roundIdx + 1} / {ROUND_CONFIGS.length}
        </p>
        <p className="font-pixelify-sans text-gray-500 text-xs mb-6">{currentConfig.label}</p>

        {currentConfig.attr === "hue" && (
          <p className="font-pixelify-sans text-[10px] text-gray-400 mb-3 text-center max-w-xs">
            Hue round — requires color perception. Screen readers: buttons are labelled A–F.
          </p>
        )}

        {lastCorrect !== null && (
          <div className={`font-press-start-2p text-sm mb-4 ${lastCorrect ? "text-green-600" : "text-red-600"}`}>
            {lastCorrect ? "✓ Correct!" : "✗ Missed"}
          </div>
        )}

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {currentRound.cells.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              disabled={lastCorrect !== null}
              aria-label={`Shape ${String.fromCharCode(65 + i)} — ${currentConfig.attr === "size" ? `size ${cell.size}px` : currentConfig.attr === "brightness" ? `brightness sample` : `hue sample`}`}
              className="flex items-center justify-center border-2 transition hover:scale-105 disabled:cursor-default"
              style={{
                width: 80,
                height: 80,
                borderColor: cell.borderColor,
                backgroundColor: "transparent",
              }}
            >
              <div
                style={{
                  width: cell.size,
                  height: cell.size,
                  borderRadius: "50%",
                  backgroundColor: cell.color,
                  border: `2px solid ${cell.borderColor}`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
      <GameDebrief gameId="webers-law-assessment" score={score} totalQuestions={ROUND_CONFIGS.length} />
    </div>
  )
}
