"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"

// Mental Models & Affordances Assessment
// Phase 1: Intro
// Phase 2: 5 MCQ on affordances, signifiers, mental model matching
// Phase 3: Affordance ranking (drag-sort 4 buttons best→worst clarity) — simplified to click-to-order
// Phase 4: Results → GameDebrief

type Phase = "intro" | "quiz" | "rank" | "results"

const QUESTIONS = [
  {
    q: "A designer makes every interactive element look like a flat coloured rectangle with no shadow or border. What HCI concept is being neglected?",
    options: [
      "Signifiers — without visual cues, users can't perceive the affordance",
      "Fitts' Law — the elements are too small",
      "Miller's Law — too many elements on screen",
      "Hick's Law — too many choices confuse the user",
    ],
    answer: 0,
    explanation: "Affordances only help users if they are communicated visually. Flat design without signifiers (shadows, borders, labels) leaves users guessing what's interactive.",
  },
  {
    q: "An e-commerce app replaces the shopping cart icon with a briefcase icon. Users struggle to find where to buy. What is the most likely cause?",
    options: [
      "The briefcase icon violates users' mental model — they expect a cart icon for purchasing",
      "The icon is too small per Fitts' Law",
      "The app layout doesn't follow Gestalt proximity",
      "The colour scheme reduces contrast",
    ],
    answer: 0,
    explanation: "Users have a strong mental model that 'bag/cart' = buying. A briefcase conflicts with that model, requiring users to relearn the mapping — increasing errors and abandonment.",
  },
  {
    q: "What is the key difference between an affordance and a signifier?",
    options: [
      "An affordance is the actual possible action; a signifier is the visible cue that communicates it",
      "An affordance is visible; a signifier is invisible",
      "They are synonyms — both refer to visual design cues",
      "A signifier is the action; an affordance is the label",
    ],
    answer: 0,
    explanation: "Norman's distinction: affordance = what CAN be done (the property). Signifier = what COMMUNICATES that it can be done (the cue). A glass door affords pushing AND pulling; the push/pull label is the signifier.",
  },
  {
    q: "A mobile app introduces a completely new gesture (two-finger twist to undo). What does HCI research predict about initial performance?",
    options: [
      "Users will be faster because the gesture is more ergonomic",
      "Higher error rate and slower initial task completion because it conflicts with existing mental models",
      "No change — users adapt to new gestures immediately",
      "Users will prefer it within 10 seconds",
    ],
    answer: 1,
    explanation: "Any interaction that conflicts with established mental models (Ctrl+Z = undo, swipe-back = navigate back) forces users to suppress automatic responses and build new ones. Initial error rates are high.",
  },
  {
    q: "Why do most apps still use a floppy disk icon for 'Save' when no one uses floppy disks?",
    options: [
      "It is the most visually distinctive shape for a button",
      "Because floppy disks are culturally iconic",
      "Because it matches users' mental model — the icon has become a universal signifier regardless of its physical referent",
      "Because no better icon shape exists",
    ],
    answer: 2,
    explanation: "Signifiers gain meaning through convention, not physical resemblance. The floppy disk is now a pure signifier for 'save' — its original referent is irrelevant. Changing it would violate users' mental models.",
  },
]

// Rank these 4 buttons best→worst affordance clarity
const RANK_ITEMS = [
  { id: "a", label: "Raised button — yellow, border, shadow, text label 'Submit'", rank: 1 },
  { id: "b", label: "Flat blue underlined text 'Submit'", rank: 2 },
  { id: "c", label: "Flat grey rectangle — no border, no label, no hover", rank: 4 },
  { id: "d", label: "Grey rectangle — subtle border, no shadow, text label 'Submit'", rank: 3 },
]

const CORRECT_ORDER = ["a", "b", "d", "c"]

export default function MentalModelAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [rankOrder, setRankOrder] = useState<string[]>([])
  const [rankSubmitted, setRankSubmitted] = useState(false)
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
      setPhase("rank")
    } else {
      setQuizIdx((i) => i + 1)
    }
  }, [quizAnswers, selectedOption, quizIdx])

  const toggleRankItem = useCallback((id: string) => {
    if (rankSubmitted) return
    setRankOrder((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length < RANK_ITEMS.length) return [...prev, id]
      return prev
    })
  }, [rankSubmitted])

  const submitRank = useCallback(() => {
    const quizCorrect = quizAnswers.filter((a, i) => a === QUESTIONS[i].answer).length
    const rankCorrect = rankOrder.filter((id, i) => id === CORRECT_ORDER[i]).length
    const total = quizCorrect + rankCorrect
    const max = QUESTIONS.length + RANK_ITEMS.length
    setScore(Math.round((total / max) * 100))
    setRankSubmitted(true)
  }, [quizAnswers, rankOrder])

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-center p-6 text-black">
        <h1 className="font-press-start-2p text-xl text-black mb-3">Mental Models &amp; Affordances</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">5 questions + 1 ranking task</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Answer 5 MCQ questions on mental models, affordances, and signifiers. Then rank 4 UI buttons from clearest to most ambiguous affordance.
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
          Question {quizIdx + 1} / {QUESTIONS.length}
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
            {quizIdx + 1 >= QUESTIONS.length ? "Ranking Task →" : "Next →"}
          </button>
        )}
      </div>
    )
  }

  if (phase === "rank") {
    return (
      <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-12 text-black">
        <p className="font-press-start-2p text-[10px] text-black mb-2">Ranking Task</p>
        <p className="font-pixelify-sans text-gray-600 text-sm text-center mb-2 max-w-md">
          Click to rank these 4 button designs from <strong>clearest affordance (1st)</strong> to <strong>most ambiguous (4th)</strong>
        </p>
        {!rankSubmitted && (
          <p className="font-pixelify-sans text-xs text-gray-400 mb-4">
            Click in order: best → second → third → worst
          </p>
        )}

        {/* Items visibly reorder as you rank: ranked ones rise to the top in
            chosen order, unranked sink below. Clicking a ranked item removes it. */}
        <div className="w-full max-w-xl space-y-3 mb-6">
          {[...RANK_ITEMS]
            .sort((a, b) => {
              const ra = rankOrder.indexOf(a.id)
              const rb = rankOrder.indexOf(b.id)
              if (ra === -1 && rb === -1) return 0
              if (ra === -1) return 1
              if (rb === -1) return -1
              return ra - rb
            })
            .map((item) => {
              const rankPos = rankOrder.indexOf(item.id)
              const isRanked = rankPos !== -1
              const isCorrect = rankSubmitted && rankOrder[rankPos] === CORRECT_ORDER[rankPos]
              return (
                <button
                  key={item.id}
                  onClick={() => toggleRankItem(item.id)}
                  disabled={rankSubmitted}
                  className={`w-full text-left border-2 p-3 font-pixelify-sans text-sm transition flex items-center gap-3 ${
                    rankSubmitted
                      ? isCorrect ? "bg-green-100 border-green-600" : "bg-red-100 border-red-500"
                      : isRanked ? "bg-[#facc15] border-[#a16207]" : "bg-white border-black hover:bg-[#f8f6ee]"
                  }`}
                >
                  <span className={`font-press-start-2p text-lg w-8 text-center ${isRanked ? "text-black" : "text-gray-300"}`}>
                    {isRanked ? `#${rankPos + 1}` : "—"}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {isRanked && !rankSubmitted && (
                    <span className="font-pixelify-sans text-xs text-[#a16207]">tap to remove</span>
                  )}
                  {rankSubmitted && (
                    <span className="ml-auto font-press-start-2p text-[9px]">
                      {isCorrect ? "✓" : `→ #${CORRECT_ORDER.indexOf(item.id) + 1}`}
                    </span>
                  )}
                </button>
              )
            })}
        </div>

        {!rankSubmitted ? (
          <button
            onClick={submitRank}
            disabled={rankOrder.length < RANK_ITEMS.length}
            className="bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#007cb2] transition-colors shadow-[3px_3px_0px_0px_#005a81] disabled:opacity-40"
          >
            Submit Ranking
          </button>
        ) : (
          <button
            onClick={() => setPhase("results")}
            className="bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-2 px-8 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            See Results →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f6ee] flex flex-col items-center justify-start p-6 pt-10 text-black overflow-y-auto">
      <h2 className="font-press-start-2p text-xl text-black mb-2">Assessment Complete</h2>
      <GameDebrief
        gameId="mental-model-assessment"
        score={score}
        totalQuestions={QUESTIONS.length + RANK_ITEMS.length}
      />
    </div>
  )
}
