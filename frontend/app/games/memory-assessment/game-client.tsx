"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { useEarlyRecord } from "@/lib/use-early-record"

// ── Miller's Law: STM = 7 ± 2 chunks
// Phase 1: digit-span game (experience the limit)
// Phase 2: 5 conceptual questions about chunking / STM / UI design
// Debrief: show what they just experienced + exam tips

type Phase = "intro" | "span-show" | "span-recall" | "span-result" | "quiz" | "results"

const SPAN_ROUNDS = [3, 5, 7, 9, 11]

const QUIZ_QUESTIONS = [
  {
    q: "A credit card number '4111 1111 1111 1111' is displayed as 4 groups of 4. Which principle does this exploit?",
    options: ["Chunking", "Closure", "Fitts' Law", "Sensory memory"],
    answer: 0,
    explanation: "Chunking groups 16 digits into 4 units of 4, reducing the STM load from 16 to 4 items — well within Miller's 7±2 limit.",
  },
  {
    q: "According to Miller's Law, approximately how many items can short-term memory hold at once?",
    options: ["3 ± 1", "7 ± 2", "12 ± 3", "20 ± 5"],
    answer: 1,
    explanation: "Miller (1956) found STM capacity is 7 ± 2 chunks. A 'chunk' can be any meaningful unit — a digit, a word, or even a phrase.",
  },
  {
    q: "Which UI design best respects working memory limits?",
    options: [
      "A settings page with 20 ungrouped options",
      "A settings page with 5 grouped categories, each with 3–4 options",
      "A settings page with 7 options in alphabetical order",
      "A settings page with no categories at all",
    ],
    answer: 1,
    explanation: "Grouping into categories creates chunks. Each category is one chunk to process, not its individual items — reducing cognitive load.",
  },
  {
    q: "What is the difference between short-term memory (STM) and long-term memory (LTM) in HCI design?",
    options: [
      "STM holds 7±2 items briefly; LTM stores knowledge permanently",
      "STM is faster than LTM for retrieval",
      "LTM is limited to 7±2 items",
      "STM and LTM have the same capacity",
    ],
    answer: 0,
    explanation: "STM (working memory) is capacity-limited (7±2) and time-limited (~20 s). LTM is theoretically unlimited. Good UI avoids requiring users to hold too much in STM.",
  },
  {
    q: "A navigation breadcrumb shows: Home > Products > Electronics > Computers > Laptops. Why might this cause cognitive load?",
    options: [
      "5 items — exceeds Miller's 7±2 limit",
      "5 items — within Miller's 7±2 limit, but deep nesting adds chunking overhead",
      "Breadcrumbs don't use STM at all",
      "Colours are not used",
    ],
    answer: 1,
    explanation: "5 items is within the 7±2 limit, but each level represents a decision point the user must mentally track. Deep hierarchies impose a chunking overhead even when individual levels are few.",
  },
]

export default function MemoryAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [spanRound, setSpanRound] = useState(0)
  const [digits, setDigits] = useState<number[]>([])
  const [recall, setRecall] = useState("")
  const [spanResults, setSpanResults] = useState<{ len: number; correct: boolean }[]>([])
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [score, setScore] = useState(0)

  const generateDigits = useCallback((len: number) => {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 10))
  }, [])

  const startSpanRound = useCallback(() => {
    const len = SPAN_ROUNDS[spanRound]
    const d = generateDigits(len)
    setDigits(d)
    setRecall("")
    setPhase("span-show")
    setTimeout(() => {
      setPhase("span-recall")
    }, 2500 + len * 200)
  }, [spanRound, generateDigits])

  const submitRecall = useCallback(() => {
    const typed = recall.replace(/\s/g, "")
    const expected = digits.join("")
    const correct = typed === expected
    const newResults = [...spanResults, { len: digits.length, correct }]
    setSpanResults(newResults)
    setPhase("span-result")
  }, [recall, digits, spanResults])

  const nextSpanRound = useCallback(() => {
    if (spanRound + 1 >= SPAN_ROUNDS.length) {
      setPhase("quiz")
      setQuizIdx(0)
    } else {
      setSpanRound((r) => r + 1)
      setPhase("intro")
    }
  }, [spanRound])

  const recordEarly = useEarlyRecord()

  const handleQuizSelect = useCallback((optionIdx: number) => {
    if (selectedOption !== null) return
    setSelectedOption(optionIdx)
    setShowExplanation(true)
    // Last question answered → record now so leaving before "See Results" still counts.
    if (quizIdx + 1 >= QUIZ_QUESTIONS.length) {
      const finalAnswers = [...quizAnswers, optionIdx]
      const correct = finalAnswers.filter((a, j) => a === QUIZ_QUESTIONS[j].answer).length
      recordEarly("memory-assessment", Math.round((correct / QUIZ_QUESTIONS.length) * 100))
    }
  }, [selectedOption, quizIdx, quizAnswers, recordEarly])

  const nextQuiz = useCallback(() => {
    const newAnswers = [...quizAnswers, selectedOption ?? -1]
    setQuizAnswers(newAnswers)
    setSelectedOption(null)
    setShowExplanation(false)
    if (quizIdx + 1 >= QUIZ_QUESTIONS.length) {
      const correct = newAnswers.filter((a, i) => a === QUIZ_QUESTIONS[i].answer).length
      setScore(Math.round((correct / QUIZ_QUESTIONS.length) * 100))
      setPhase("results")
    } else {
      setQuizIdx((i) => i + 1)
    }
  }, [quizAnswers, selectedOption, quizIdx])

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-2xl text-black mb-3">Miller's Law</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-sm">STM capacity = 7 ± 2 items</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          First, experience the limits of working memory — you'll see a sequence of digits, then type them back.
          Then answer 5 questions about Miller's Law in UI design.
        </p>
        <button
          onClick={startSpanRound}
          className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-sm py-3 px-10 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Start Memory Test
        </button>
      </div>
    )
  }

  // ── Digit span: showing ────────────────────────────────────────────────────
  if (phase === "span-show") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-6">
          Round {spanRound + 1} / {SPAN_ROUNDS.length} — {digits.length} digits
        </p>
        <p className="font-pixelify-sans text-gray-500 text-xs mb-8">Memorise this sequence</p>
        <div className="flex gap-3 flex-wrap justify-center">
          {digits.map((d, i) => (
            <div
              key={i}
              className="w-12 h-14 bg-[#facc15] border-2 border-[#a16207] flex items-center justify-center font-press-start-2p text-2xl text-black shadow-[3px_3px_0px_0px_#000]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="mt-8 w-48 h-2 bg-gray-300 border border-black overflow-hidden">
          <div className="h-full bg-[#0099db]" style={{ animation: `shrink ${2.5 + digits.length * 0.2}s linear forwards` }} />
        </div>
      </div>
    )
  }

  // ── Digit span: recall ─────────────────────────────────────────────────────
  if (phase === "span-recall") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <p className="font-pixelify-sans text-gray-600 mb-2">Type the digits you saw, in order:</p>
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={recall}
          onChange={(e) => setRecall(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitRecall()}
          className="border-2 border-black bg-white px-4 py-3 font-mono text-xl text-black text-center w-64 mb-4 focus:outline-none focus:border-[#0099db]"
          placeholder="e.g. 4 7 2 …"
        />
        <button
          onClick={submitRecall}
          className="bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#007cb2] transition-colors shadow-[3px_3px_0px_0px_#005a81]"
        >
          Submit
        </button>
      </div>
    )
  }

  // ── Digit span: result ─────────────────────────────────────────────────────
  if (phase === "span-result") {
    const last = spanResults[spanResults.length - 1]
    const correct = last?.correct
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <div className={`font-press-start-2p text-5xl mb-4 ${correct ? "text-green-600" : "text-red-600"}`}>
          {correct ? "✓" : "✗"}
        </div>
        <p className={`font-press-start-2p text-lg mb-2 ${correct ? "text-green-700" : "text-red-700"}`}>
          {correct ? "Correct!" : "Missed it"}
        </p>
        <p className="font-pixelify-sans text-gray-600 text-sm mb-1">Sequence was: {digits.join(" ")}</p>
        {!correct && digits.length >= 9 && (
          <div className="bg-[#dbeafe] border-2 border-[#0099db] p-3 mt-3 max-w-xs font-pixelify-sans text-sm text-gray-800 text-center">
            {digits.length} items exceeds most people's 7±2 STM limit. That's Miller's Law in action.
          </div>
        )}
        <button
          onClick={nextSpanRound}
          className="mt-8 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          {spanRound + 1 >= SPAN_ROUNDS.length ? "Take the Quiz →" : `Next Round (${SPAN_ROUNDS[spanRound + 1]} digits)`}
        </button>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (phase === "quiz") {
    const q = QUIZ_QUESTIONS[quizIdx]
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-12 text-black">
        <p className="font-press-start-2p text-gray-500 text-[9px] mb-4 uppercase tracking-wider">
          Question {quizIdx + 1} / {QUIZ_QUESTIONS.length}
        </p>
        <p className="font-pixelify-sans text-black text-base md:text-lg font-bold max-w-xl text-center mb-6 leading-relaxed">
          {q.q}
        </p>
        <div className="w-full max-w-xl space-y-3 mb-4">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.answer
            const isSelected = i === selectedOption
            let cls = "bg-white border-black hover:bg-[#f8f6ee] hover:shadow-[2px_2px_0px_0px_#000]"
            if (selectedOption !== null) {
              if (isCorrect) cls = "bg-green-100 border-green-600 text-green-800"
              else if (isSelected) cls = "bg-red-100 border-red-500 text-red-800"
              else cls = "bg-white border-gray-300 opacity-60"
            }
            return (
              <button
                key={i}
                onClick={() => handleQuizSelect(i)}
                className={`w-full text-left border-2 p-3 font-pixelify-sans text-sm transition ${cls}`}
                disabled={selectedOption !== null}
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
            {quizIdx + 1 >= QUIZ_QUESTIONS.length ? "See Results →" : "Next Question →"}
          </button>
        )}
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (phase === "results") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
        <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
        <GameDebrief
          gameId="memory-assessment"
          score={score}
          totalQuestions={QUIZ_QUESTIONS.length}
        />
      </div>
    )
  }

  return null
}
