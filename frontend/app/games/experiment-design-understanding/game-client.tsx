"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// HCI Experiment Design — Understanding
// Phase 1: Learn the vocabulary (IV/DV, H0/HA, between/within, confounds, order effects)
// Phase 2: Build an experiment — choose design, order control, and assignment; then run it
//          and see whether your design is valid or threatened.
// Phase 3: Debrief

type Phase = "learn" | "build" | "debrief"
type Design = "between" | "within" | null
type Order = "counter" | "none" | null
type Assign = "random" | "convenience" | null

export default function ExperimentDesignUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [step, setStep] = useState(0) // 0 design, 1 order, 2 assign, 3 result
  const [design, setDesign] = useState<Design>(null)
  const [order, setOrder] = useState<Order>(null)
  const [assign, setAssign] = useState<Assign>(null)

  const chooseDesign = useCallback((d: Design) => {
    setDesign(d)
    setOrder(null)
    // between-subjects has no within-condition order effects → skip order step
    setStep(d === "within" ? 1 : 2)
  }, [])

  const chooseOrder = useCallback((o: Order) => { setOrder(o); setStep(2) }, [])
  const chooseAssign = useCallback((a: Assign) => { setAssign(a); setStep(3) }, [])

  const reset = useCallback(() => {
    setDesign(null); setOrder(null); setAssign(null); setStep(0)
  }, [])

  // Validity verdict
  const verdict = (() => {
    if (assign === "convenience") {
      return { ok: false, title: "Confounded", body: "Convenience sampling (friends/family, or unmatched groups) means an uncontrolled variable can track your conditions — any difference might be due to who the people are, not the keypad. Use random assignment to matched groups." }
    }
    if (design === "within" && order === "none") {
      return { ok: false, title: "Order effects", body: "In a within-subjects design everyone does both layouts, so practice (warm-up) and fatigue/boredom bias whichever layout comes first or second. Without counter-balancing, the order confounds the comparison." }
    }
    if (design === "within" && order === "counter") {
      return { ok: true, title: "Valid (within-subjects, counter-balanced)", body: "Each participant does both layouts, and counter-balancing (half do A→B, half do B→A) distributes order effects evenly. Variance is low because the same people are compared under both conditions." }
    }
    if (design === "between" && assign === "random") {
      return { ok: true, title: "Valid (between-subjects, randomised)", body: "Different people do each layout, so there are no order effects. Random assignment to demographically matched groups keeps the comparison clean — at the cost of higher between-person variance." }
    }
    return { ok: true, title: "Valid", body: "A defensible design." }
  })()

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-lg text-black mb-2">HCI Experiment Design</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          HCI claims are tested with experiments: manipulate an <span className="font-bold text-black">independent
          variable (IV)</span> and measure its effect on a <span className="font-bold text-black">dependent variable
          (DV)</span>, while controlling everything else. This is also exactly how a flip-learning study is run.
        </p>
        <div className="w-full max-w-2xl grid md:grid-cols-2 gap-4 mb-8 font-pixelify-sans text-sm text-gray-700">
          <div className="border-2 border-black bg-white p-4"><p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">H₀ vs H₁ (Hₐ)</p><strong>H₀</strong> (null) = &ldquo;no difference&rdquo;, e.g. <em>layout B is NOT faster than A</em>. <strong>H₁</strong> (alternative, also written Hₐ) = &ldquo;there is a difference&rdquo;, e.g. <em>B IS faster</em>. You gather data and try to <strong>reject H₀</strong>.</div>
          <div className="border-2 border-black bg-white p-4"><p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Between vs within</p>Between = different people per condition (no order effects, more variance). Within = same people all conditions (less variance, but order effects).</div>
          <div className="border-2 border-black bg-white p-4"><p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Confound</p>An uncontrolled variable that co-varies with the IV, so you can&apos;t tell what caused the effect.</div>
          <div className="border-2 border-black bg-white p-4"><p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Order effects</p>Practice and fatigue bias within-subjects results — controlled by counter-balancing.</div>
        </div>
        <button
          onClick={() => setPhase("build")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Build an experiment →
        </button>
      </div>
    )
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  if (phase === "build") {
    const Option = ({ onClick, title, sub }: { onClick: () => void; title: string; sub: string }) => (
      <button
        onClick={onClick}
        className="w-full text-left border-2 border-black bg-white p-4 hover:bg-[#facc15] transition-colors shadow-[2px_2px_0px_0px_#000]"
      >
        <p className="font-press-start-2p text-[10px] mb-1">{title}</p>
        <p className="font-pixelify-sans text-sm text-gray-700">{sub}</p>
      </button>
    )

    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-8 p-6">
        <div className="bg-white border-2 border-black p-4 mb-6 max-w-xl text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-pixelify-sans text-sm text-gray-800">
            <span className="font-bold">Study:</span> Is the new keypad layout (B) faster to type on than the old layout (A)?
            <br /><span className="font-pixelify-sans text-xs text-gray-500">IV = keypad layout · DV = typing time (seconds)</span>
          </p>
        </div>

        {step === 0 && (
          <div className="w-full max-w-xl space-y-3">
            <p className="font-press-start-2p text-[10px] text-[#a16207] mb-1">Step 1 — choose a design</p>
            <Option onClick={() => chooseDesign("between")} title="Between-subjects" sub="Group 1 tries layout A, Group 2 tries layout B. No one sees both." />
            <Option onClick={() => chooseDesign("within")} title="Within-subjects" sub="Everyone tries both layouts. Fewer participants needed." />
          </div>
        )}

        {step === 1 && (
          <div className="w-full max-w-xl space-y-3">
            <p className="font-press-start-2p text-[10px] text-[#a16207] mb-1">Step 2 — control order effects</p>
            <Option onClick={() => chooseOrder("counter")} title="Counter-balance" sub="Half do A→B, half do B→A, so practice/fatigue cancel out." />
            <Option onClick={() => chooseOrder("none")} title="Everyone does A then B" sub="Simple — same order for all participants." />
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-xl space-y-3">
            {/* Between-subjects skips the order-control step, so this is Step 2
                for them and Step 3 for within-subjects — number it accordingly
                to avoid a confusing "Step 1 → Step 3" jump. */}
            {design === "between" && (
              <p className="font-pixelify-sans text-xs text-gray-500 italic">
                (Order control is skipped — in a between-subjects design no one sees both layouts, so there are no order effects to control.)
              </p>
            )}
            <p className="font-press-start-2p text-[10px] text-[#a16207] mb-1">
              {design === "between" ? "Step 2" : "Step 3"} — assign participants
            </p>
            <Option onClick={() => chooseAssign("random")} title="Random assignment, matched groups" sub="Balance age, experience, and demographics across conditions." />
            <Option onClick={() => chooseAssign("convenience")} title="Convenience sample" sub="Recruit friends, family, and whoever scans a QR code online." />
          </div>
        )}

        {step === 3 && (
          <div className="w-full max-w-xl flex flex-col items-center gap-4">
            <div className={`w-full border-2 p-5 font-pixelify-sans text-sm leading-relaxed ${verdict.ok ? "bg-green-50 border-green-600 text-green-900" : "bg-red-50 border-red-500 text-red-900"}`}>
              <p className="font-press-start-2p text-xs mb-2">{verdict.ok ? "✓ " : "✗ "}{verdict.title}</p>
              {verdict.body}
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="bg-white border-2 border-black text-black font-press-start-2p text-[10px] py-2 px-6 hover:bg-gray-100 shadow-[2px_2px_0px_0px_#000]">
                Try another design
              </button>
              <button onClick={() => setPhase("debrief")} className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-6 hover:bg-[#fde047] shadow-[3px_3px_0px_0px_#000]">
                Take Assessment →
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
      <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
      <GameDebrief gameId="experiment-design-understanding" />
    </div>
  )
}
