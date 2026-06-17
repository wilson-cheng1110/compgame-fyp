"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Norman's Action Cycle Assessment
// 5 scenario questions: given a UI failure, identify which stage broke down + which gulf

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "A user wants to delete a file on a new app. They see icons for share, copy, and info, but no delete icon. Which stage breaks down, and which gulf?",
    options: [
      "Stage 3 (Specify Action) — Gulf of Execution",
      "Stage 5 (Perceive State) — Gulf of Evaluation",
      "Stage 7 (Evaluate Outcome) — Gulf of Evaluation",
      "Stage 1 (Form a Goal) — Gulf of Execution",
    ],
    answer: 0,
    explanation: "The user can't specify an action because delete isn't visible. This is Stage 3 failure — a Gulf of Execution (can't figure out HOW to do it).",
  },
  {
    q: "A user submits a contact form. The page goes blank. 30 seconds later, nothing has changed. Which stage fails?",
    options: [
      "Stage 4 (Perform) — Gulf of Execution",
      "Stage 5 (Perceive State) — Gulf of Evaluation",
      "Stage 2 (Plan) — Gulf of Execution",
      "Stage 1 (Form a Goal) — Gulf of Evaluation",
    ],
    answer: 1,
    explanation: "The action was performed (Stage 4 complete), but the system provided no perceivable feedback. Stage 5 (Perceive State) fails — classic Gulf of Evaluation.",
  },
  {
    q: "After uploading a file, a message says 'Operation completed'. The user doesn't know if the file was saved or deleted. Which stage fails?",
    options: [
      "Stage 6 (Interpret State) — Gulf of Evaluation",
      "Stage 3 (Specify Action) — Gulf of Execution",
      "Stage 4 (Perform) — Gulf of Execution",
      "Stage 2 (Plan) — Gulf of Execution",
    ],
    answer: 0,
    explanation: "The feedback was perceivable (Stage 5 OK) but ambiguous — the user cannot interpret what 'Operation completed' means. Stage 6 fails, creating a Gulf of Evaluation.",
  },
  {
    q: "A new user opens Photoshop to crop an image. They cannot figure out which tool does cropping from the 40+ icons shown. Which stage fails?",
    options: [
      "Stage 7 (Evaluate Outcome) — Gulf of Evaluation",
      "Stage 3 (Specify Action) — Gulf of Execution",
      "Stage 5 (Perceive State) — Gulf of Evaluation",
      "Stage 1 (Form a Goal) — Gulf of Execution",
    ],
    answer: 1,
    explanation: "Goal and plan are clear (crop image), but the user cannot translate that plan into a specific action — too many unlabelled icons. Stage 3 fails — Gulf of Execution.",
  },
  {
    q: "After clicking 'Send' on an email, the user sees the same compose window with no change. They wonder if the email was sent. Which stage fails?",
    options: [
      "Stage 4 (Perform) — Gulf of Execution",
      "Stage 7 (Evaluate Outcome) — Gulf of Evaluation",
      "Stage 2 (Plan) — Gulf of Execution",
      "Stage 6 (Interpret State) — Gulf of Evaluation",
    ],
    answer: 1,
    explanation: "Perform succeeded (the click registered and email sent). But the compose window remaining open means the user cannot evaluate whether the outcome matched their goal (email sent). Stage 7 fails — Gulf of Evaluation.",
  },
]

export default function NormanAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)

  const handleSelect = useCallback((i: number) => {
    if (selectedOption !== null) return
    setSelectedOption(i)
    setShowExplanation(true)
  }, [selectedOption])

  const nextQ = useCallback(() => {
    const newAnswers = [...quizAnswers, selectedOption ?? -1]
    setQuizAnswers(newAnswers)
    setSelectedOption(null)
    setShowExplanation(false)
    if (quizIdx + 1 >= QUESTIONS.length) {
      const correct = newAnswers.filter((a, i) => a === QUESTIONS[i].answer).length
      setScore(Math.round((correct / QUESTIONS.length) * 100))
      setPhase("results")
    } else {
      setQuizIdx((i) => i + 1)
    }
  }, [quizAnswers, selectedOption, quizIdx])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-xl text-black mb-3">Norman's Action Cycle</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">Which stage broke down?</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          5 scenarios — each describes a UI failure. Identify which of Norman's 7 stages broke down and which gulf it represents.
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
    const q = QUESTIONS[quizIdx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-12 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4">
          Scenario {quizIdx + 1} / {QUESTIONS.length}
        </p>
        <div className="bg-[#fefce8] border-2 border-[#a16207] p-4 w-full max-w-xl mb-4 font-pixelify-sans text-sm text-gray-800 leading-relaxed">
          {q.q}
        </div>
        <div className="w-full max-w-xl space-y-3 mb-4">
          {q.options.map((opt, i) => {
            let cls = "bg-white border-black hover:bg-[#f8f6ee] hover:shadow-[2px_2px_0px_0px_#000]"
            if (selectedOption !== null) {
              if (i === q.answer) cls = "bg-green-100 border-green-600 text-green-800"
              else if (i === selectedOption) cls = "bg-red-100 border-red-500 text-red-800"
              else cls = "bg-white border-gray-300 opacity-60"
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selectedOption !== null}
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
        {selectedOption !== null && (
          <button
            onClick={nextQ}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {quizIdx + 1 >= QUESTIONS.length ? "See Results →" : "Next →"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
      <GameDebrief gameId="norman-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
