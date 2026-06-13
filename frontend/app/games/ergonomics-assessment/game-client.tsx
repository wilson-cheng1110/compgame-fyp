"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Ergonomics & I/O Devices — Assessment
// 6 MCQ: ergonomics definition, posture hazards, RSI, haptic feedback types, two-point threshold.

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "In ergonomics, what does 'the system' refer to?",
    options: [
      "The human and the machine in interaction, together",
      "Only the computer hardware",
      "Only the software interface",
      "Only the human operator",
    ],
    answer: 0,
    explanation: "Ergonomics treats performance as a property of the whole human-machine system — you fit the technology to the human, not the other way round.",
  },
  {
    q: "An office worker develops numbness and tingling on the thumb side of the hand after months of typing. What is the most likely disorder?",
    options: [
      "Carpal Tunnel Syndrome (median nerve compression)",
      "Tennis elbow",
      "Plantar fasciitis",
      "Sciatica",
    ],
    answer: 0,
    explanation: "Carpal tunnel syndrome is compression of the median nerve at the wrist, causing numbness/tingling on the thumb side — a classic repetitive-strain musculoskeletal disorder.",
  },
  {
    q: "Per the ergonomics guidance, working with the neck or back bent forward beyond which angle (for >2 hrs/day) risks injury?",
    options: ["About 30°", "About 5°", "About 60°", "About 90°"],
    answer: 0,
    explanation: "Sustained neck/back flexion beyond ~30° for more than two hours a day causes strain — the head alone weighs 10–12 lb.",
  },
  {
    q: "A VR glove designer wants users to feel fine texture detail. Where should the densest haptic actuators go, and why?",
    options: [
      "Fingertips — the two-point threshold is smallest there (highest resolution)",
      "Forearm — it has the most surface area",
      "Back — it is least sensitive so feedback is safer",
      "It does not matter; all skin resolves touch equally",
    ],
    answer: 0,
    explanation: "Haptic resolution (two-point threshold) is finest on the fingertips and coarsest on the back/calf. Detailed feedback belongs where spatial resolution is highest.",
  },
  {
    q: "Which of these is NOT one of the haptic (tactile) feedback types covered?",
    options: ["Olfactory feedback", "Force feedback", "Textural feedback", "Thermal feedback"],
    answer: 0,
    explanation: "Haptic feedback splits into force, textural (vibro-/electro-tactile, ultrasound), and thermal. Olfactory (smell) is not a haptic channel.",
  },
  {
    q: "An app on a smartwatch tries to convey detailed spatial patterns by buzzing two nearby points on the wrist. Why does this often fail?",
    options: [
      "The wrist/forearm has a large two-point threshold, so the two buzzes merge into one sensation",
      "Smartwatches cannot vibrate",
      "Vibration is not a form of haptic feedback",
      "The buzzes are too strong to feel",
    ],
    answer: 0,
    explanation: "On the forearm two touches must be ~35 mm apart to feel distinct. Closely spaced cues blur together — fine spatial haptics belong on the fingertips, not the wrist.",
  },
]

export default function ErgonomicsAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)

  const handleSelect = useCallback((i: number) => {
    if (selected !== null) return
    setSelected(i)
    setShowExplanation(true)
  }, [selected])

  const next = useCallback(() => {
    const newAnswers = [...answers, selected ?? -1]
    setAnswers(newAnswers)
    setSelected(null)
    setShowExplanation(false)
    if (idx + 1 >= QUESTIONS.length) {
      const correct = newAnswers.filter((a, i) => a === QUESTIONS[i].answer).length
      setScore(Math.round((correct / QUESTIONS.length) * 100))
      setPhase("results")
    } else {
      setIdx((i) => i + 1)
    }
  }, [answers, selected, idx])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-xl text-black mb-3">Ergonomics &amp; I/O Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">{QUESTIONS.length} questions</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Test your knowledge of physical ergonomics, repetitive-strain injury, haptic feedback, and the two-point threshold.
        </p>
        <button
          onClick={() => setPhase("quiz")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start
        </button>
      </div>
    )
  }

  if (phase === "quiz") {
    const q = QUESTIONS[idx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-12 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4">Question {idx + 1} / {QUESTIONS.length}</p>
        <p className="font-pixelify-sans text-black text-base font-bold max-w-xl text-center mb-6 leading-relaxed">{q.q}</p>
        <div className="w-full max-w-xl space-y-3 mb-4">
          {q.options.map((opt, i) => {
            let cls = "bg-white border-black hover:bg-[#f8f6ee] hover:shadow-[2px_2px_0px_0px_#000]"
            if (selected !== null) {
              if (i === q.answer) cls = "bg-green-100 border-green-600 text-green-800"
              else if (i === selected) cls = "bg-red-100 border-red-500 text-red-800"
              else cls = "bg-white border-gray-300 opacity-60"
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`w-full text-left border-2 p-3 font-pixelify-sans text-sm transition ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
        {showExplanation && (
          <div className="w-full max-w-xl bg-[#dbeafe] border-2 border-[#0099db] p-4 font-pixelify-sans text-sm text-gray-800 leading-relaxed mb-4">
            <span className="font-press-start-2p text-[#005a81] text-[9px]">Explanation: </span>
            {q.explanation}
          </div>
        )}
        {selected !== null && (
          <button
            onClick={next}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {idx + 1 >= QUESTIONS.length ? "See Results →" : "Next →"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
      <GameDebrief gameId="ergonomics-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
