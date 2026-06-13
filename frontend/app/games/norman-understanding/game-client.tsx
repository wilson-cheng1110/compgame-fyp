"use client"

import { useState } from "react"
import GameDebrief from "@/components/game-debrief"

// Norman's Action Cycle Understanding
// Phase 1: Intro — 7 stages
// Phase 2: Interactive scenario walkthrough (printing a document)
// Phase 3: Gulfs explained with bad UI examples
// Debrief

type Phase = "intro" | "scenario" | "gulfs" | "debrief"

const STAGES = [
  { num: 1, name: "Form a Goal",        side: "intention", desc: "Decide WHAT you want to achieve." },
  { num: 2, name: "Plan",               side: "intention", desc: "Decide on a sequence of actions to reach the goal." },
  { num: 3, name: "Specify Action",     side: "intention", desc: "Choose a specific action from the options available." },
  { num: 4, name: "Perform Action",     side: "execution", desc: "Execute the action — click, type, speak." },
  { num: 5, name: "Perceive State",     side: "evaluation", desc: "Observe the new state of the world (system feedback)." },
  { num: 6, name: "Interpret State",    side: "evaluation", desc: "Make sense of what you perceive — does it match expectations?" },
  { num: 7, name: "Evaluate Outcome",  side: "evaluation", desc: "Compare the new state with your original goal." },
]

// Scenario: printing a document
type ScenarioStep = {
  stage: number
  stageLabel: string
  situation: string
  options: string[]
  correct: number
  feedback: string
}

const SCENARIO: ScenarioStep[] = [
  {
    stage: 1,
    stageLabel: "Stage 1 — Form a Goal",
    situation: "You have just written an important report. What is your goal?",
    options: ["Open another document", "Print this report on paper", "Save the file to USB"],
    correct: 1,
    feedback: "Correct — you've formed a clear goal: get a physical copy of the report.",
  },
  {
    stage: 2,
    stageLabel: "Stage 2 — Plan",
    situation: "You want to print. What sequence of steps do you plan?",
    options: [
      "Click File → Print → choose printer → confirm",
      "Drag the file into the Trash",
      "Open a browser and search for the document",
    ],
    correct: 0,
    feedback: "Good plan. You mapped a mental sequence: File menu → Print dialog → printer selection → confirm.",
  },
  {
    stage: 3,
    stageLabel: "Stage 3 — Specify Action",
    situation: "You're in the File menu. Which option do you choose?",
    options: ["Save As", "Print…", "Share"],
    correct: 1,
    feedback: "You specified the exact action: 'Print…'. This narrowed your plan to a single executable command.",
  },
  {
    stage: 4,
    stageLabel: "Stage 4 — Perform Action",
    situation: "You clicked Print… but the dialog opened behind the document window. What do you do?",
    options: [
      "Click the Print dialog in the taskbar to bring it forward, then confirm",
      "Close the app and restart",
      "Assume nothing happened and click Print… again",
    ],
    correct: 0,
    feedback: "Correct. You executed by finding and using the Print dialog. Clicking Print… again would create duplicate jobs.",
  },
  {
    stage: 5,
    stageLabel: "Stage 5 — Perceive State",
    situation: "A small printer icon appeared in the system tray and disappeared after 2 seconds. What do you perceive?",
    options: [
      "The printer icon means the print job was sent",
      "Nothing — I didn't notice anything change",
      "The app crashed",
    ],
    correct: 0,
    feedback: "Perceiving the feedback (printer icon) means the system did communicate its state — but briefly. Poor feedback design.",
  },
  {
    stage: 6,
    stageLabel: "Stage 6 — Interpret State",
    situation: "The icon appeared but you're not sure if the job was sent or queued. What does this mean for the system?",
    options: [
      "The system's feedback was clear and sufficient",
      "The feedback was ambiguous — unclear whether the print was sent or failed",
      "This is normal and expected in all OS environments",
    ],
    correct: 1,
    feedback: "You've identified a Gulf of Evaluation: the system's feedback didn't clearly communicate whether the goal was achieved.",
  },
  {
    stage: 7,
    stageLabel: "Stage 7 — Evaluate Outcome",
    situation: "You go to the printer. No paper came out. How do you evaluate the outcome?",
    options: [
      "Goal achieved — the paper is probably still printing",
      "Goal NOT achieved — the outcome doesn't match my original goal (printed report)",
      "This is fine — I should wait longer",
    ],
    correct: 1,
    feedback: "Correct evaluation. The action cycle is complete and failed — now you restart the cycle with a new plan (check print queue, try again).",
  },
]

export default function NormanUnderstanding() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [stepIdx, setStepIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  const step = SCENARIO[stepIdx]

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h1 className="font-press-start-2p text-xl text-black mb-2">Norman's Action Cycle</h1>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-lg mb-6 leading-relaxed">
          Don Norman's model explains how users interact with any system. Every action goes through 7 stages, split across
          the <strong>Execution side</strong> (what you do to the world) and the <strong>Evaluation side</strong> (how you read the world's response).
        </p>

        <div className="w-full max-w-xl bg-white border-2 border-black p-5 mb-6">
          <div className="flex gap-2 items-start">
            {/* Left: intention + execution */}
            <div className="flex-1 space-y-2">
              <p className="font-press-start-2p text-[10px] text-[#a16207] mb-2">EXECUTION</p>
              {STAGES.filter((s) => s.side !== "evaluation").map((s) => (
                <div key={s.num} className="border-2 border-[#a16207] bg-[#fefce8] p-2">
                  <p className="font-press-start-2p text-[8px] text-[#a16207]">{s.num}. {s.name}</p>
                  <p className="font-pixelify-sans text-xs text-gray-600 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
            {/* Right: evaluation */}
            <div className="flex-1 space-y-2">
              <p className="font-press-start-2p text-[10px] text-[#005a81] mb-2">EVALUATION</p>
              {STAGES.filter((s) => s.side === "evaluation").map((s) => (
                <div key={s.num} className="border-2 border-[#0099db] bg-[#dbeafe] p-2">
                  <p className="font-press-start-2p text-[8px] text-[#005a81]">{s.num}. {s.name}</p>
                  <p className="font-pixelify-sans text-xs text-gray-600 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#f8f6ee] border-2 border-black p-4 w-full max-w-xl mb-6 font-pixelify-sans text-sm text-gray-700 space-y-2">
          <p><strong className="text-red-600">Gulf of Execution</strong> — user can't figure out HOW to do something (stages 2–4 break down)</p>
          <p><strong className="text-red-600">Gulf of Evaluation</strong> — user can't tell IF they succeeded (stages 5–7 break down)</p>
        </div>

        <button
          onClick={() => setPhase("scenario")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Walk Through a Scenario →
        </button>
      </div>
    )
  }

  // ── Scenario ───────────────────────────────────────────────────────────────
  if (phase === "scenario") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-1">
          Stage {step.stage} / {SCENARIO.length}
        </p>
        <p className="font-press-start-2p text-[10px] text-[#a16207] mb-4">{step.stageLabel}</p>

        <div className="bg-white border-2 border-black p-4 w-full max-w-xl mb-4 font-pixelify-sans text-sm text-gray-800 leading-relaxed">
          {step.situation}
        </div>

        <div className="w-full max-w-xl space-y-3 mb-4">
          {step.options.map((opt, i) => {
            const isCorrect = i === step.correct
            let cls = "bg-white border-black hover:bg-[#f8f6ee] hover:shadow-[2px_2px_0px_0px_#000]"
            if (selected !== null) {
              if (isCorrect) cls = "bg-green-100 border-green-600 text-green-800"
              else if (i === selected) cls = "bg-red-100 border-red-500 text-red-800"
              else cls = "bg-white border-gray-300 opacity-60"
            }
            return (
              <button
                key={i}
                onClick={() => { if (selected === null) { setSelected(i); setShowFeedback(true) } }}
                disabled={selected !== null}
                className={`w-full text-left border-2 p-3 font-pixelify-sans text-sm transition ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {showFeedback && (
          <div className="w-full max-w-xl bg-[#dbeafe] border-2 border-[#0099db] p-4 font-pixelify-sans text-sm text-gray-800 leading-relaxed mb-4">
            {step.feedback}
          </div>
        )}

        {selected !== null && (
          <button
            onClick={() => {
              setSelected(null)
              setShowFeedback(false)
              if (stepIdx + 1 >= SCENARIO.length) {
                setPhase("gulfs")
              } else {
                setStepIdx((i) => i + 1)
              }
            }}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {stepIdx + 1 >= SCENARIO.length ? "Learn About Gulfs →" : "Next Stage →"}
          </button>
        )}
      </div>
    )
  }

  // ── Gulfs ──────────────────────────────────────────────────────────────────
  if (phase === "gulfs") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] text-black flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-6">The Two Gulfs</h2>
        <div className="w-full max-w-xl space-y-4 mb-8">
          <div className="border-2 border-red-500 bg-red-50 p-5">
            <p className="font-press-start-2p text-red-700 text-[10px] mb-2">Gulf of Execution</p>
            <p className="font-pixelify-sans text-sm text-gray-800 mb-2">
              The user can't figure out how to operate the system. Stages 2–4 break down.
            </p>
            <p className="font-pixelify-sans text-xs text-gray-600 italic">
              Example: a printer with no "print" button — only cryptic icons. User can't specify or perform the action.
            </p>
          </div>
          <div className="border-2 border-orange-500 bg-orange-50 p-5">
            <p className="font-press-start-2p text-orange-700 text-[10px] mb-2">Gulf of Evaluation</p>
            <p className="font-pixelify-sans text-sm text-gray-800 mb-2">
              The user can't tell what happened or whether the goal was achieved. Stages 5–7 break down.
            </p>
            <p className="font-pixelify-sans text-xs text-gray-600 italic">
              Example: form submission with no confirmation message. Did it work? The user has no feedback to evaluate.
            </p>
          </div>
          <div className="border-2 border-black bg-white p-5">
            <p className="font-press-start-2p text-[#005a81] text-[10px] mb-2">Good UI Design</p>
            <p className="font-pixelify-sans text-sm text-gray-800">
              Bridges both gulfs: makes actions discoverable (visible affordances → narrow execution gulf) and provides clear, immediate feedback (status messages, progress bars → narrow evaluation gulf).
            </p>
          </div>
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
      <GameDebrief gameId="norman-understanding" />
    </div>
  )
}
