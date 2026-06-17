"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { shuffleQuestions } from "@/lib/quiz-utils"

// Stroop Assessment
// Phase 1: Intro
// Phase 2: Stroop mini-game — word written in a different colour, click the font colour (10 rounds)
// Phase 3: 5 MCQ on UI consistency
// Phase 4: Results → GameDebrief

type Phase = "intro" | "stroop" | "quiz" | "results"

const COLOR_WORDS = ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE"]
const COLOR_HEX: Record<string, string> = {
  RED: "#ef4444",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  PURPLE: "#a855f7",
}

function makeStroopRound() {
  const word = COLOR_WORDS[Math.floor(Math.random() * COLOR_WORDS.length)]
  let fontColor = word
  while (fontColor === word) {
    fontColor = COLOR_WORDS[Math.floor(Math.random() * COLOR_WORDS.length)]
  }
  return { word, fontColor }
}

const STROOP_ROUNDS = 10

const QUIZ_QUESTIONS = [
  {
    q: "A success notification uses red text on a green background. Which HCI principle does this violate?",
    options: ["Fitts' Law", "Principle of Consistency", "Miller's Law", "Gestalt Proximity"],
    answer: 1,
    explanation: "Red conventionally signals error/danger. Using it for success creates Stroop-like interference — users must override their learned mapping.",
  },
  {
    q: "Ctrl+Z is the universal undo shortcut. An app maps Ctrl+Z to 'zoom in'. What is the likely effect?",
    options: [
      "No effect — shortcuts are arbitrary conventions",
      "Slower task completion and higher error rate from conflicting mental models",
      "Users will adapt within 2 minutes",
      "Faster performance because it's more ergonomic",
    ],
    answer: 1,
    explanation: "Overriding a universal shortcut forces users to suppress their automatic response and apply a new rule — classic stimulus-response incompatibility. Error rates rise significantly.",
  },
  {
    q: "Which of the following best demonstrates the Principle of Consistency in icon design?",
    options: [
      "Using a unique icon shape for every function to help users distinguish them",
      "Using a floppy disk icon for 'Save' to match the universal metaphor users already know",
      "Changing icon styles between screens to keep the UI fresh",
      "Using colour alone to distinguish similar icons",
    ],
    answer: 1,
    explanation: "The floppy disk icon for 'Save' is a skeuomorphic metaphor that has become a universal convention — even users who have never used a floppy disk recognise it instantly.",
  },
  {
    q: "A form uses a green submit button on page 1 and a blue submit button on page 2. What is the main usability risk?",
    options: [
      "Users might not notice the button at all",
      "The colour difference triggers Stroop-like hesitation and reduces trust",
      "The form may not validate correctly",
      "Users prefer blue buttons on average",
    ],
    answer: 1,
    explanation: "Visual inconsistency between functionally identical elements forces users to re-evaluate each time — creating cognitive load and eroding the learned interaction pattern.",
  },
  {
    q: "A traffic-monitoring app inverts the standard heat-map colour scale: blue = high traffic, red = low traffic. What does HCI research predict?",
    options: [
      "No measurable effect after a one-time onboarding",
      "Systematically higher error rates when users read the map under time pressure",
      "Faster learning than the conventional scale",
      "Users will prefer the inverted scale within one session",
    ],
    answer: 1,
    explanation: "Under time pressure, users revert to automatic responses based on learned conventions (red=high-intensity). An inverted scale requires constant, effortful suppression of that response.",
  },
]

export default function StroopAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [stroopRounds, setStroopRounds] = useState(() =>
    Array.from({ length: STROOP_ROUNDS }, makeStroopRound)
  )
  const [stroopIdx, setStroopIdx] = useState(0)
  const [stroopCorrect, setStroopCorrect] = useState(0)
  const [quizQuestions] = useState(() => shuffleQuestions(QUIZ_QUESTIONS))
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)

  const currentRound = stroopRounds[stroopIdx]

  const handleColorClick = useCallback((color: string) => {
    const correct = color === currentRound.fontColor
    if (correct) setStroopCorrect((c) => c + 1)
    const next = stroopIdx + 1
    if (next >= STROOP_ROUNDS) {
      setPhase("quiz")
    } else {
      setStroopIdx(next)
    }
  }, [stroopIdx, currentRound])

  const handleQuizSelect = useCallback((idx: number) => {
    if (selectedOption !== null) return
    setSelectedOption(idx)
    setShowExplanation(true)
  }, [selectedOption])

  const nextQuiz = useCallback(() => {
    const newAnswers = [...quizAnswers, selectedOption ?? -1]
    setQuizAnswers(newAnswers)
    setSelectedOption(null)
    setShowExplanation(false)
    if (quizIdx + 1 >= quizQuestions.length) {
      const quizCorrect = newAnswers.filter((a, i) => a === quizQuestions[i].answer).length
      const total = stroopCorrect + quizCorrect
      const maxTotal = STROOP_ROUNDS + QUIZ_QUESTIONS.length
      setScore(Math.round((total / maxTotal) * 100))
      setPhase("results")
    } else {
      setQuizIdx((i) => i + 1)
    }
  }, [quizAnswers, selectedOption, quizIdx, stroopCorrect])

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-2xl text-black mb-3">Stroop Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-sm">Click the COLOUR — not the word</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Part 1: A colour word appears — click the colour it's written IN (ignore what the word says).
          Part 2: 5 questions about the Principle of Consistency in UI design.
        </p>
        <button
          onClick={() => setPhase("stroop")}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start
        </button>
      </div>
    )
  }

  // ── Stroop game ────────────────────────────────────────────────────────────
  if (phase === "stroop") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-6">
          {stroopIdx + 1} / {STROOP_ROUNDS}
        </p>
        <p
          className="font-press-start-2p text-4xl mb-10"
          style={{ color: COLOR_HEX[currentRound.fontColor] }}
        >
          {currentRound.word}
        </p>
        <p className="font-pixelify-sans text-gray-500 text-sm mb-4">Click the colour this word is written in:</p>
        <div className="flex gap-3 flex-wrap justify-center max-w-xs">
          {COLOR_WORDS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorClick(color)}
              aria-label={`${color} — click if the word above is written in ${color}`}
              className="w-20 h-10 border-2 border-black font-pixelify-sans text-black text-xs font-bold hover:opacity-80 transition shadow-[2px_2px_0px_0px_#000]"
              style={{ backgroundColor: COLOR_HEX[color] }}
            >
              {color}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (phase === "quiz") {
    const q = quizQuestions[quizIdx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-12 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4">
          Question {quizIdx + 1} / {QUIZ_QUESTIONS.length}
        </p>
        <p className="font-pixelify-sans text-black text-base font-bold max-w-xl text-center mb-6 leading-relaxed">
          {q.q}
        </p>
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
                onClick={() => handleQuizSelect(i)}
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
            onClick={nextQuiz}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {quizIdx + 1 >= QUIZ_QUESTIONS.length ? "See Results →" : "Next →"}
          </button>
        )}
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
      <GameDebrief gameId="stroop-assessment" score={score} totalQuestions={STROOP_ROUNDS + QUIZ_QUESTIONS.length} />
    </div>
  )
}
