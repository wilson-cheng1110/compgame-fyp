"use client"

import { useState, useEffect, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Visual Perception — Understanding
// Phase 1: Learn — the eye is not a camera
// Phase 2: Four interactive demos (colour blindness, after-image, depth cues, reading saccades)
// Phase 3: Debrief

type Phase = "learn" | "demos" | "debrief"

export default function VisualPerceptionUnderstanding() {
  const [phase, setPhase] = useState<Phase>("learn")
  const [demo, setDemo] = useState(0)

  // colour-blindness demo state
  const [cbSim, setCbSim] = useState(false)
  const [cbRedundant, setCbRedundant] = useState(false)

  // after-image demo state
  const [staring, setStaring] = useState(false)
  const [afterImage, setAfterImage] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // reading demo state
  const READING = "Reading does not glide smoothly across a line of text".split(" ")
  const [fixation, setFixation] = useState(-1)

  useEffect(() => {
    if (!staring) return
    setCountdown(5)
    setAfterImage(false)
    const tick = setInterval(() => setCountdown((c) => c - 1), 1000)
    const done = setTimeout(() => {
      setStaring(false)
      setAfterImage(true)
      clearInterval(tick)
    }, 5000)
    return () => { clearInterval(tick); clearTimeout(done) }
  }, [staring])

  const playReading = useCallback(() => {
    setFixation(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      if (i >= READING.length) { clearInterval(id); setFixation(-1) }
      else setFixation(i)
    }, 450)
  }, [READING.length])

  const DEMOS = ["Colour vision", "After-images", "Depth cues", "Reading"]

  // ── Learn ──────────────────────────────────────────────────────────────────
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-2xl text-black mb-2">Visual Perception</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-8 leading-relaxed">
          The eye is <span className="font-bold text-black">not a camera</span>. The brain actively constructs what you
          see — filling gaps, inventing after-images, and inferring depth from cues. Design has to work <em>with</em>{" "}
          these quirks, not against them.
        </p>
        <div className="w-full max-w-2xl grid md:grid-cols-2 gap-4 mb-8 font-pixelify-sans text-sm text-gray-700">
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Rods vs Cones</p>
            Rods see in low light and detect motion at the periphery; cones see colour and fine detail at the centre (fovea).
          </div>
          <div className="border-2 border-black bg-white p-4">
            <p className="font-press-start-2p text-[#a16207] text-[10px] mb-2">Colour deficiency</p>
            ~8% of males and ~1% of females cannot reliably tell red from green — so colour must never be the only cue.
          </div>
        </div>
        <button
          onClick={() => setPhase("demos")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Explore the demos →
        </button>
      </div>
    )
  }

  // ── Demos ──────────────────────────────────────────────────────────────────
  if (phase === "demos") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-8 p-6">
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {DEMOS.map((d, i) => (
            <button
              key={d}
              onClick={() => setDemo(i)}
              className={`font-press-start-2p text-[9px] py-2 px-3 border-2 border-black transition ${i === demo ? "bg-[#facc15]" : "bg-white hover:bg-[#f8f6ee]"}`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="w-full max-w-2xl bg-white border-2 border-black p-6 mb-6 shadow-[4px_4px_0px_0px_#a16207] min-h-[280px] flex flex-col items-center">
          {/* Demo 0: Colour vision */}
          {demo === 0 && (
            <>
              <h3 className="font-press-start-2p text-sm text-[#a16207] mb-4">Status dots — colour only?</h3>
              <div className="flex gap-10 mb-5">
                {[
                  { ok: true, colour: cbSim ? "#9a9a4a" : "#22c55e", icon: "✓" },
                  { ok: false, colour: cbSim ? "#9a8a4a" : "#ef4444", icon: "✗" },
                ].map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center font-press-start-2p text-white text-lg"
                      style={{ backgroundColor: d.colour }}
                    >
                      {cbRedundant ? d.icon : ""}
                    </div>
                    <span className="font-pixelify-sans text-xs text-gray-500">{d.ok ? "OK" : "Error"}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mb-3">
                <button onClick={() => setCbSim((v) => !v)} className={`font-pixelify-sans text-sm py-2 px-4 border-2 border-black ${cbSim ? "bg-[#facc15]" : "bg-white"}`}>
                  {cbSim ? "✓ " : ""}Simulate red-green blindness
                </button>
                <button onClick={() => setCbRedundant((v) => !v)} className={`font-pixelify-sans text-sm py-2 px-4 border-2 border-black ${cbRedundant ? "bg-[#facc15]" : "bg-white"}`}>
                  {cbRedundant ? "✓ " : ""}Add icon (redundant cue)
                </button>
              </div>
              <p className="font-pixelify-sans text-sm text-gray-700 text-center max-w-md leading-relaxed">
                {cbSim && !cbRedundant
                  ? "With red-green deficiency the two dots look almost identical — meaning is lost. Turn on the icon."
                  : cbRedundant
                  ? "With a redundant ✓/✗ icon, the meaning survives even when colour can't be distinguished. This is the fix."
                  : "These look obvious to you. Now simulate colour blindness to see why colour alone is risky."}
              </p>
            </>
          )}

          {/* Demo 1: After-image */}
          {demo === 1 && (
            <>
              <h3 className="font-press-start-2p text-sm text-[#a16207] mb-4">After-images</h3>
              <div className="w-40 h-40 border-2 border-black flex items-center justify-center mb-4" style={{ backgroundColor: staring ? "#06b6d4" : afterImage ? "#ffffff" : "#f3f4f6" }}>
                {staring ? <span className="text-black text-3xl font-bold">+</span> : afterImage ? <span className="text-gray-400 text-xs font-pixelify-sans px-2 text-center">Keep looking at the cross spot — a faint reddish square appears</span> : null}
              </div>
              {!staring && (
                <button onClick={() => setStaring(true)} className="font-pixelify-sans text-sm py-2 px-6 border-2 border-black bg-[#facc15] hover:bg-[#fde047]">
                  {afterImage ? "Try again" : "Stare at the + for 5s"}
                </button>
              )}
              {staring && <p className="font-press-start-2p text-xs text-[#0099db]">{countdown}s — keep staring…</p>}
              <p className="font-pixelify-sans text-sm text-gray-700 text-center max-w-md mt-4 leading-relaxed">
                Cones fatigue. After staring at cyan, the opposing (red) channel rebounds and you perceive colour that
                isn&apos;t there — proof the visual system processes contrast and opponency, not raw light.
              </p>
            </>
          )}

          {/* Demo 2: Depth cues */}
          {demo === 2 && (
            <>
              <h3 className="font-press-start-2p text-sm text-[#a16207] mb-4">Depth from 2D cues</h3>
              <div className="relative w-64 h-40 mb-4">
                <div className="absolute left-2 top-10 w-28 h-28 rounded-full bg-[#0099db] border-2 border-black" />
                <div className="absolute left-24 top-4 w-20 h-20 rounded-full bg-[#facc15] border-2 border-black" />
                <div className="absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#a855f7] border-2 border-black" />
              </div>
              <p className="font-pixelify-sans text-sm text-gray-700 text-center max-w-md leading-relaxed">
                On a flat screen you still see depth: the yellow circle looks <strong>nearer</strong> because it{" "}
                <strong>occludes</strong> the blue one, and the small purple circle looks <strong>far</strong> from{" "}
                <strong>relative size</strong>. Occlusion, relative size, and motion parallax are monocular depth cues.
              </p>
            </>
          )}

          {/* Demo 3: Reading */}
          {demo === 3 && (
            <>
              <h3 className="font-press-start-2p text-sm text-[#a16207] mb-4">Reading = jumps, not a glide</h3>
              <p className="text-lg font-pixelify-sans mb-5 max-w-md text-center leading-relaxed">
                {READING.map((w, i) => (
                  <span key={i} className={`px-0.5 ${i === fixation ? "bg-[#facc15] rounded" : ""}`}>{w} </span>
                ))}
              </p>
              <button onClick={playReading} className="font-pixelify-sans text-sm py-2 px-6 border-2 border-black bg-[#facc15] hover:bg-[#fde047] mb-4">
                Animate the eye
              </button>
              <p className="font-pixelify-sans text-sm text-gray-700 text-center max-w-md leading-relaxed">
                The eye <strong>saccades</strong> (jumps) between <strong>fixations</strong> (pauses), extracting meaning
                only while paused. That&apos;s why marquee/scrolling text — which removes the reader&apos;s control of
                fixations — hurts comprehension.
              </p>
            </>
          )}
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
      <GameDebrief gameId="visual-perception-understanding" />
    </div>
  )
}
