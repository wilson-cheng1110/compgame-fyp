"use client"

import { useState } from "react"
import GameDebrief from "@/components/game-debrief"

// Weber's Law Understanding
// Phase 1: Learn ΔI/I = k with an interactive size slider
// Phase 2: JND demos for 3 attributes (size, brightness, count)
// Phase 3: UI design implications
// Debrief

type Phase = "learn" | "jnd-demo" | "ui-examples" | "debrief"
type Attribute = "size" | "brightness" | "count"

const ATTRS: Attribute[] = ["size", "brightness", "count"]
const ATTR_LABELS: Record<Attribute, string> = {
  size: "Size",
  brightness: "Brightness",
  count: "Count",
}
// Weber's fraction k for each attribute (approximate)
const WEBER_K: Record<Attribute, number> = {
  size: 0.10,       // ~10% change needed
  brightness: 0.08, // ~8%
  count: 0.14,      // ~14% (subitising limit)
}
const BASE: Record<Attribute, number> = { size: 60, brightness: 128, count: 10 }

export default function WebersLawUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [learnSlider, setLearnSlider] = useState(60)   // circle radius px
  const [attrIdx, setAttrIdx] = useState(0)
  const [userSlider, setUserSlider] = useState<Record<Attribute, number>>({ size: 60, brightness: 128, count: 10 })
  const [noticed, setNoticed] = useState<Record<Attribute, number | null>>({ size: null, brightness: null, count: null })

  const attr = ATTRS[attrIdx]
  const baseVal = BASE[attr]
  const k = WEBER_K[attr]
  const jndThreshold = baseVal * (1 + k) // absolute value at which change is just noticeable

  const refVal = BASE[attr]
  const currentVal = userSlider[attr]
  const personalJND = ((currentVal - refVal) / refVal * 100).toFixed(1)

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    const refRadius = 60
    const changePct = ((learnSlider - refRadius) / refRadius * 100)
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-2">Weber's Law</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-6 leading-relaxed">
          Ernst Weber (1834) discovered that the smallest detectable change in a stimulus is not a fixed amount — it is a constant <em>fraction</em> of the original. This fraction is called the <strong>Weber fraction (k)</strong>.
        </p>

        <div className="bg-white border-2 border-black p-5 w-full max-w-md mb-6 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px] uppercase tracking-widest mb-2">The Formula</p>
          <p className="font-mono text-[#a16207] text-xl font-bold">ΔI / I = k</p>
          <div className="mt-3 font-pixelify-sans text-sm text-gray-600 space-y-1">
            <p><span className="text-black font-bold">ΔI</span> = just noticeable difference (JND)</p>
            <p><span className="text-black font-bold">I</span> = original stimulus intensity</p>
            <p><span className="text-black font-bold">k</span> = Weber fraction (constant per sense)</p>
          </div>
        </div>

        {/* Interactive size demo */}
        <div className="bg-white border-2 border-black p-5 w-full max-w-md mb-6">
          <p className="font-pixelify-sans text-gray-600 text-sm text-center mb-4">
            Drag the slider — at what point does the right circle look clearly bigger?
          </p>
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className="border-2 border-black bg-[#facc15]"
                style={{ width: refRadius * 2, height: refRadius * 2, borderRadius: "50%" }}
              />
              <span className="font-pixelify-sans text-xs text-gray-500">Reference</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className="border-2 border-black bg-[#0099db]"
                style={{ width: learnSlider * 2, height: learnSlider * 2, borderRadius: "50%" }}
              />
              <span className="font-pixelify-sans text-xs text-gray-500">Variable</span>
            </div>
          </div>
          <input
            type="range"
            min={refRadius}
            max={refRadius * 2}
            value={learnSlider}
            onChange={(e) => setLearnSlider(Number(e.target.value))}
            className="w-full accent-[#facc15] mb-2"
          />
          <div className="text-center font-pixelify-sans text-sm">
            Change: <strong className={changePct > 10 ? "text-green-700" : "text-gray-500"}>+{changePct.toFixed(1)}%</strong>
            {changePct > 10 && <span className="text-green-700 ml-2">(above typical JND of ~10%)</span>}
          </div>
        </div>

        <div className="bg-[#dbeafe] border-2 border-[#0099db] p-4 w-full max-w-md mb-8 font-pixelify-sans text-sm text-gray-800">
          <p className="font-press-start-2p text-[#005a81] text-[10px] mb-2">Key insight</p>
          <p>A 5px change on a 10px element (50%) is obvious. The same 5px on a 200px element (2.5%) is invisible. Weber's Law explains why: the ratio matters, not the absolute amount.</p>
        </div>

        <button
          onClick={() => setPhase("jnd-demo")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Find Your JND →
        </button>
      </div>
    )
  }

  // ── JND Demo ───────────────────────────────────────────────────────────────
  if (phase === "jnd-demo") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Find Your JND</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center mb-6 max-w-md">
          Move the slider until the right shape is clearly different from the left. Then click "I notice it!"
        </p>

        {/* Attribute tabs */}
        <div className="flex gap-2 mb-6">
          {ATTRS.map((a, i) => (
            <button
              key={a}
              onClick={() => setAttrIdx(i)}
              className={`px-3 py-1 border-2 font-pixelify-sans text-sm transition ${
                i === attrIdx
                  ? "bg-[#facc15] border-[#a16207] text-black"
                  : "bg-white border-black text-black hover:bg-[#f8f6ee]"
              }`}
            >
              {ATTR_LABELS[a]}
              {noticed[a] !== null && " ✓"}
            </button>
          ))}
        </div>

        {/* Reference + variable display */}
        <div className="bg-white border-2 border-black p-6 w-full max-w-sm mb-4">
          <div className="flex items-center justify-around mb-4">
            {/* Reference */}
            <div className="flex flex-col items-center gap-2">
              {attr === "size" && (
                <div className="border-2 border-black bg-[#facc15]" style={{ width: BASE.size * 2, height: BASE.size * 2, borderRadius: "50%" }} />
              )}
              {attr === "brightness" && (
                <div className="border-2 border-black" style={{ width: 80, height: 80, backgroundColor: `rgb(${BASE.brightness},${BASE.brightness},${BASE.brightness})` }} />
              )}
              {attr === "count" && (
                <div className="flex flex-wrap gap-1 w-[80px]">
                  {Array.from({ length: Math.round(BASE.count) }, (_, i) => (
                    <div key={i} className="w-4 h-4 bg-[#facc15] border border-black" />
                  ))}
                </div>
              )}
              <span className="font-pixelify-sans text-xs text-gray-500">Reference</span>
            </div>
            {/* Variable */}
            <div className="flex flex-col items-center gap-2">
              {attr === "size" && (
                <div className="border-2 border-black bg-[#0099db]" style={{ width: currentVal * 2, height: currentVal * 2, borderRadius: "50%" }} />
              )}
              {attr === "brightness" && (
                <div className="border-2 border-black" style={{ width: 80, height: 80, backgroundColor: `rgb(${currentVal},${currentVal},${currentVal})` }} />
              )}
              {attr === "count" && (
                <div className="flex flex-wrap gap-1 w-[80px]">
                  {Array.from({ length: Math.round(currentVal) }, (_, i) => (
                    <div key={i} className="w-4 h-4 bg-[#0099db] border border-black" />
                  ))}
                </div>
              )}
              <span className="font-pixelify-sans text-xs text-gray-500">Variable</span>
            </div>
          </div>

          <input
            type="range"
            min={attr === "size" ? BASE.size : attr === "brightness" ? BASE.brightness : BASE.count}
            max={attr === "size" ? BASE.size * 2 : attr === "brightness" ? 255 : BASE.count * 3}
            step={attr === "count" ? 1 : 1}
            value={currentVal}
            onChange={(e) => setUserSlider((prev) => ({ ...prev, [attr]: Number(e.target.value) }))}
            className="w-full accent-[#facc15] mb-3"
          />

          <div className="text-center font-pixelify-sans text-sm mb-3">
            Change: <strong>+{personalJND}%</strong> · Weber's k ≈ {(k * 100).toFixed(0)}%
          </div>

          {noticed[attr] === null ? (
            <button
              onClick={() => setNoticed((prev) => ({ ...prev, [attr]: currentVal }))}
              className="w-full bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[10px] py-2 hover:bg-[#007cb2] transition-colors shadow-[3px_3px_0px_0px_#005a81]"
            >
              I notice it!
            </button>
          ) : (
            <div className="bg-green-100 border-2 border-green-600 p-2 text-center font-pixelify-sans text-sm text-green-800">
              Your JND: +{((noticed[attr]! - refVal) / refVal * 100).toFixed(1)}% (theory: ~{(k * 100).toFixed(0)}%)
            </div>
          )}
        </div>

        {Object.values(noticed).filter(Boolean).length === ATTRS.length ? (
          <button
            onClick={() => setPhase("ui-examples")}
            className="mt-4 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            UI Design Implications →
          </button>
        ) : (
          <p className="font-pixelify-sans text-gray-500 text-sm mt-4">
            Complete all {ATTRS.length} attributes to continue
          </p>
        )}
      </div>
    )
  }

  // ── UI Examples ────────────────────────────────────────────────────────────
  if (phase === "ui-examples") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Weber's Law in UI</h2>
        <p className="font-pixelify-sans text-gray-500 text-sm text-center mb-6 max-w-md">
          If a UI change is below the user's JND threshold, it goes unnoticed. Designers must ensure feedback exceeds that threshold.
        </p>
        <div className="w-full max-w-xl space-y-4 mb-8">
          {[
            {
              title: "Progress bars",
              good: "Jump from 0% to 12% visible — exceeds JND (~10% of current value)",
              bad: "Jump from 95% to 96% may be imperceptible — too small a fraction",
              border: "border-[#0099db]",
              bg: "bg-[#dbeafe]",
            },
            {
              title: "Error highlight contrast",
              good: "Increase input border from 1px grey to 2px red + background tint — well above JND",
              bad: "Change border from grey #9CA3AF to grey #8B96A8 — likely invisible",
              border: "border-[#a16207]",
              bg: "bg-[#fefce8]",
            },
            {
              title: "Hover state on buttons",
              good: "Darken background by 15%+ — clearly signals interactivity",
              bad: "Darken by 3% — falls below brightness JND (~8%), button feels unresponsive",
              border: "border-green-600",
              bg: "bg-green-50",
            },
          ].map((item) => (
            <div key={item.title} className={`border-2 ${item.border} ${item.bg} p-4`}>
              <p className="font-press-start-2p text-black text-[10px] mb-2">{item.title}</p>
              <p className="font-pixelify-sans text-sm text-green-800 mb-1">✓ {item.good}</p>
              <p className="font-pixelify-sans text-sm text-red-700">✗ {item.bad}</p>
            </div>
          ))}
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
      <GameDebrief gameId="webers-law-understanding" />
    </div>
  )
}
