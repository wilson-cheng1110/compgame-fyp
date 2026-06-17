"use client"

import { useState, useCallback } from "react"
import GameDebrief from "@/components/game-debrief"
import { shuffleQuestions } from "@/lib/quiz-utils"

// Visual Perception — Assessment
// 6 MCQ: rods/cones, colour blindness, after-images, depth cues, saccades/fixations.

type Phase = "intro" | "quiz" | "results"

const QUESTIONS = [
  {
    q: "Which receptors are responsible for colour and fine detail, and where are they concentrated?",
    options: [
      "Cones, concentrated at the fovea (centre of vision)",
      "Rods, concentrated at the fovea",
      "Cones, concentrated at the periphery",
      "Rods, spread evenly across the retina",
    ],
    answer: 0,
    explanation: "Cones handle colour and acuity and are densest at the fovea. Rods dominate the periphery and handle low-light and motion.",
  },
  {
    q: "Roughly what fraction of males have a red-green colour-vision deficiency?",
    options: ["About 8%", "About 0.1%", "About 25%", "About 50%"],
    answer: 0,
    explanation: "~8% of males and ~1% of females have red-green colour deficiency — the reason colour must never be the sole carrier of meaning in a UI.",
  },
  {
    q: "A dashboard distinguishes 'OK' and 'Error' states using only red and green dots. What is the minimal accessible fix that keeps the colours?",
    options: [
      "Add a redundant non-colour cue such as a ✓/✗ icon or text label",
      "Make both dots larger",
      "Increase the screen brightness",
      "Use a darker shade of red",
    ],
    answer: 0,
    explanation: "Redundant coding: pair the colour with a shape, icon, or label so the meaning survives for users who can't distinguish the hues.",
  },
  {
    q: "After staring at a cyan square then looking at white, you briefly see a reddish square. What does this demonstrate?",
    options: [
      "The visual system uses opponent processing and cone fatigue, not raw light capture",
      "The monitor is faulty",
      "Rods are overexposed",
      "The image was secretly red all along",
    ],
    answer: 0,
    explanation: "After-images arise from fatigued cones and opponent-colour channels — evidence that perception is constructed from contrast/opponency, not a faithful recording.",
  },
  {
    q: "On a flat screen, a smaller circle is perceived as farther away. Which depth cue is this?",
    options: ["Relative size", "Binocular disparity", "Stereopsis", "Accommodation"],
    answer: 0,
    explanation: "Relative size is a monocular depth cue: among similar objects, the smaller one is judged farther. Occlusion and motion parallax are other monocular cues.",
  },
  {
    q: "Why does fast scrolling marquee text increase reading errors, given how the eye reads?",
    options: [
      "Reading happens in saccades and fixations; comprehension occurs during fixations, which marquee text prevents",
      "Marquee text uses the wrong font",
      "The eye reads continuously and marquee text is simply too dim",
      "Rods cannot process moving text",
    ],
    answer: 0,
    explanation: "The eye jumps (saccades) and pauses (fixations), extracting meaning only during fixations. Marquee text removes the reader's control over fixation points, hurting comprehension.",
  },
]

export default function VisualPerceptionAssessment() {
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
        <h1 className="font-press-start-2p text-xl text-black mb-3">Visual Perception Assessment</h1>
        <div className="bg-white border-2 border-black p-4 mb-4 text-center shadow-[4px_4px_0px_0px_#a16207]">
          <p className="font-press-start-2p text-[#a16207] text-[10px]">{QUESTIONS.length} questions</p>
        </div>
        <p className="font-pixelify-sans text-gray-600 text-center max-w-md mb-8 leading-relaxed">
          Test your understanding of the visual system, colour vision, after-images, depth cues, and reading mechanics.
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
      <GameDebrief gameId="visual-perception-assessment" score={score} totalQuestions={QUESTIONS.length} />
    </div>
  )
}
