"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { useEarlyRecord } from "@/lib/use-early-record"

// Problem Solving — Assessment
// 6 MCQ on problem space, means-end analysis, working backwards, analogical reasoning,
// and problem representation. Intro → quiz → results → GameDebrief.

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "In the water-jug puzzle, you repeatedly choose the action that most reduces the difference between the current water amount and the 4-litre goal. Which strategy is this?",
    options: ["Means-end analysis", "Working backwards", "Analogical reasoning", "Trial and error"],
    answer: 0,
    explanation: "Means-end analysis selects, at each state, the operator that most reduces the gap between the current state and the goal state.",
  },
  {
    q: "A user wants notifications OFF. They start from that goal and reason 'which screen would let me turn them off?', stepping backward to the right menu. Which strategy is this?",
    options: ["Means-end analysis", "Working backwards", "Hill climbing", "Brute-force search"],
    answer: 1,
    explanation: "Working backwards starts from a well-defined goal state and reasons toward the current state — effective when the goal is clear but the forward path is ambiguous.",
  },
  {
    q: "A developer solves a new caching bug by recalling how they fixed a similar bug in another project and mapping that solution across. Which strategy is this?",
    options: ["Analogical reasoning", "Means-end analysis", "Working backwards", "Random restart"],
    answer: 0,
    explanation: "Analogical reasoning transfers the structure of a previously solved problem onto a new but structurally similar one.",
  },
  {
    q: "Which three components define a 'problem space'?",
    options: [
      "Initial state, goal state, and operators",
      "Hypothesis, variable, and result",
      "Input, process, and output",
      "Affordance, signifier, and feedback",
    ],
    answer: 0,
    explanation: "A problem space consists of the initial state, the goal state, and the set of operators (legal moves) that transform one state into another.",
  },
  {
    q: "Why does representing the water-jug problem as 'litres remaining in each jug' make it easier than just listing physical actions?",
    options: [
      "It is shorter to write down",
      "A good representation exposes useful sub-goals and shrinks the search space",
      "It avoids the need for any operators",
      "It guarantees the fewest possible moves automatically",
    ],
    answer: 1,
    explanation: "Problem representation determines which operators and sub-goals are visible. A representation that surfaces the '2-litre remainder' sub-goal prunes the search dramatically.",
  },
  {
    q: "Which statement about problem representation is correct?",
    options: [
      "The way a problem is internally represented does not affect how hard it is to solve",
      "Changing the representation can turn an intractable problem into an easy one",
      "Only the external problem statement matters, not the solver's mental model",
      "Representation only matters for visual problems",
    ],
    answer: 1,
    explanation: "Classic HCI/cognition result: re-representing a problem (e.g., the mutilated-chessboard problem) can make a previously hard search trivial. Representation shapes the search space.",
  },
]

export default function ProblemSolvingAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
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
    if (idx + 1 >= QUESTIONS.length) {
      const finalAnswers = [...answers, i]
      const correct = finalAnswers.filter((a, j) => a === QUESTIONS[j].answer).length
      recordEarly("problem-solving-assessment", Math.round((correct / QUESTIONS.length) * 100))
    }
  }, [selected, idx, answers, recordEarly])

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
        <h1 className="font-press-start-2p text-xl text-black mb-3">Problem Solving Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">{QUESTIONS.length} questions</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Identify the problem-solving strategy and the role of problem representation in each scenario.
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
      <GameDebrief gameId="problem-solving-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
