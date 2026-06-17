"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { shuffleQuestions } from "@/lib/quiz-utils"
import { useEarlyRecord } from "@/lib/use-early-record"

// HCI Experiment Design — Assessment
// 6 MCQ: IV/DV, H0/HA, between vs within, confounds, order effects, counter-balancing.

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "You test whether a new keyboard layout is faster, using the SAME 10 people on both layouts. What design is this and what is the main threat?",
    options: [
      "Within-subjects; order effects (practice/fatigue)",
      "Between-subjects; sampling bias",
      "Within-subjects; no threats at all",
      "Between-subjects; order effects",
    ],
    answer: 0,
    explanation: "Same people in all conditions = within-subjects. Its characteristic threat is order effects: whichever layout comes first benefits from novelty or suffers fatigue.",
  },
  {
    q: "Which technique controls order effects in a within-subjects experiment?",
    options: [
      "Counter-balancing (e.g., half do A→B, half do B→A)",
      "Increasing the font size",
      "Using a larger screen",
      "Removing the dependent variable",
    ],
    answer: 0,
    explanation: "Counter-balancing varies the order across participants so practice and fatigue distribute evenly across conditions rather than confounding one.",
  },
  {
    q: "A study compares an AR app vs a paper manual. The AR group is recruited from a robotics club; the paper group from a history class. Why is the result invalid?",
    options: [
      "It is confounded — technical aptitude co-varies with the condition",
      "It used too many participants",
      "AR and paper cannot be compared at all",
      "The DV was measured in seconds",
    ],
    answer: 0,
    explanation: "Group composition (tech-savvy vs not) tracks the condition, so any difference could be due to the people, not the interface — a confound from poor group matching.",
  },
  {
    q: "What do H₀ and Hₐ stand for, respectively?",
    options: [
      "The null hypothesis (no effect) and the alternative hypothesis (an effect)",
      "Two independent variables",
      "High and low confidence",
      "Hardware and algorithm baselines",
    ],
    answer: 0,
    explanation: "H₀ predicts no statistically significant difference; Hₐ predicts there is one. Experiments gather evidence to reject H₀.",
  },
  {
    q: "Which is an advantage of a BETWEEN-subjects design over a within-subjects design?",
    options: [
      "It avoids order effects because no participant sees more than one condition",
      "It always needs fewer participants",
      "It has lower variance between people",
      "It removes the need for a control condition",
    ],
    answer: 0,
    explanation: "Because each person experiences only one condition, between-subjects designs have no order effects — at the cost of higher between-person variance and needing more participants.",
  },
  {
    q: "An experimenter posts a survey QR code on social media and lets anyone fill it in from anywhere. Which validity problem is this most likely to introduce?",
    options: [
      "Uncontrolled confounds from convenience sampling (unknown who/how it was completed)",
      "Order effects",
      "A counter-balancing error",
      "An overly precise dependent variable",
    ],
    answer: 0,
    explanation: "Convenience sampling online means uncontrolled factors (environment, who actually answered, distractions) co-vary with responses — a notorious source of confounds.",
  },
]

export default function ExperimentDesignAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [questions] = useState(() => shuffleQuestions(QUESTIONS))
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)
  const recordEarly = useEarlyRecord()

  const handleSelect = useCallback((i: number) => {
    if (selected !== null) return
    setSelected(i)
    setShowExplanation(true)
    // Last question answered → record now so leaving before "See Results" still counts.
    if (idx + 1 >= questions.length) {
      const finalAnswers = [...answers, i]
      const correct = finalAnswers.filter((a, j) => a === questions[j].answer).length
      recordEarly("experiment-design-assessment", Math.round((correct / QUESTIONS.length) * 100))
    }
  }, [selected, idx, answers, questions, recordEarly])

  const next = useCallback(() => {
    const newAnswers = [...answers, selected ?? -1]
    setAnswers(newAnswers)
    setSelected(null)
    setShowExplanation(false)
    if (idx + 1 >= questions.length) {
      const correct = newAnswers.filter((a, i) => a === questions[i].answer).length
      setScore(Math.round((correct / QUESTIONS.length) * 100))
      setPhase("results")
    } else {
      setIdx((i) => i + 1)
    }
  }, [answers, selected, idx])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-lg text-black mb-3">Experiment Design Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">{QUESTIONS.length} questions</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Spot confounds and order effects, and choose the right design and controls for HCI studies.
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
    const q = questions[idx]
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
      <GameDebrief gameId="experiment-design-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
