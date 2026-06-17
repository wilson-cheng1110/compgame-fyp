"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { shuffleQuestions } from "@/lib/quiz-utils"

// Language & Ambiguity — Assessment
// 6 MCQ: levels of language, attachment ambiguity, coreference, conversational-UI resolution.

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "'I saw the man with the telescope' has two readings. At which level does this ambiguity live?",
    options: ["Syntactic (structural attachment)", "Phonetic", "Orthographic", "Purely pragmatic"],
    answer: 0,
    explanation: "The prepositional phrase can attach to the verb (saw) or the noun (man) — a structural/syntactic ambiguity, resolved by semantics/pragmatics.",
  },
  {
    q: "Which level of language processing answers 'what did the speaker intend, given the context?'",
    options: ["Pragmatics", "Syntax", "Phonology", "Morphology"],
    answer: 0,
    explanation: "Pragmatics is meaning-in-context: the speaker's intent. Syntax is structure; semantics is literal meaning.",
  },
  {
    q: "A voice assistant hears 'Play the one I liked yesterday.' Resolving what 'the one' refers to is an example of…",
    options: ["Coreference / reference resolution", "Syntactic parsing only", "Phoneme recognition", "Tokenisation"],
    answer: 0,
    explanation: "Coreference resolution links referring expressions ('the one', 'it', 'that') to their actual referents using context — a core NLP challenge for conversational UIs.",
  },
  {
    q: "'The chicken is ready to eat' is grammatically unambiguous but can mean two things. What kind of ambiguity is this?",
    options: ["Semantic / pragmatic", "Syntactic attachment", "Spelling", "Punctuation"],
    answer: 0,
    explanation: "Both readings share the same structure; the meaning flips depending on whether 'chicken' is food or animal — resolved by semantics and context.",
  },
  {
    q: "When a conversational UI has low confidence about an ambiguous command, what is the best design response?",
    options: [
      "Ask a clarifying question rather than guess",
      "Always pick the first interpretation",
      "Ignore the command",
      "Pick a random interpretation to seem decisive",
    ],
    answer: 0,
    explanation: "A clarification dialogue (pragmatic repair) resolves ambiguity safely. Guessing under low confidence risks executing the wrong action.",
  },
  {
    q: "Why is natural-language understanding fundamentally hard for computers, per the lecture?",
    options: [
      "A single common word can carry many senses, producing an enormous space of possible meanings",
      "Computers cannot store text",
      "Grammar rules do not exist for English",
      "Words never have more than one meaning",
    ],
    answer: 0,
    explanation: "Lexical and structural ambiguity combine so that even short sentences have huge numbers of possible interpretations — context is needed to prune them.",
  },
]

export default function LanguageAssessment() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [questions] = useState(() => shuffleQuestions(QUESTIONS))
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
        <h1 className="font-press-start-2p text-xl text-black mb-3">Language &amp; Ambiguity Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">{QUESTIONS.length} questions</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Classify ambiguities by level and reason about how conversational interfaces resolve them.
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
      <GameDebrief gameId="language-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
