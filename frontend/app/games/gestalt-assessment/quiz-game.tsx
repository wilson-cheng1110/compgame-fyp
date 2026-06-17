"use client"

import { useState, useEffect, type ReactElement } from "react"
import { ChevronLeft, ChevronRight, Home } from "lucide-react"
import Link from "next/link"

const PRINCIPLES = ["similarity", "proximity", "continuity", "symmetry", "closure"]

type Principle = (typeof PRINCIPLES)[number]

interface Question {
  id: number
  answer: Principle
  caption: string
  render: () => ReactElement
}

// ── Inline SVG Illustrations ─────────────────────────────────────────────────
// All drawn from COMP3423 lecture slide concepts (Visual 1, slides 44-65)

const QUESTIONS: Question[] = [
  {
    id: 1,
    answer: "similarity",
    caption: "Why do most people see vertical columns here, not horizontal rows?",
    render: () => (
      <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="200" height="140" fill="white" />
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => {
            const x = 16 + c * 26; const y = 22 + r * 28
            return c % 2 === 0
              ? <rect key={`${r}-${c}`} x={x - 8} y={y - 8} width={16} height={16} fill="#1a1a1a" />
              : <circle key={`${r}-${c}`} cx={x} cy={y} r={8} fill="#1a1a1a" />
          })
        )}
      </svg>
    ),
  },
  {
    id: 2,
    answer: "proximity",
    caption: "Why do you perceive two groups rather than twelve separate dots?",
    render: () => (
      <svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="220" height="110" fill="white" />
        {Array.from({ length: 3 }, (_, r) =>
          Array.from({ length: 3 }, (_, c) => (
            <circle key={`L${r}-${c}`} cx={22 + c * 18} cy={28 + r * 22} r={7} fill="#1a1a1a" />
          ))
        )}
        {Array.from({ length: 3 }, (_, r) =>
          Array.from({ length: 3 }, (_, c) => (
            <circle key={`R${r}-${c}`} cx={130 + c * 18} cy={28 + r * 22} r={7} fill="#1a1a1a" />
          ))
        )}
      </svg>
    ),
  },
  {
    id: 3,
    answer: "closure",
    caption: "What shape does your brain 'complete' even though lines are broken?",
    render: () => (
      <svg viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="200" height="190" fill="white" />
        <line x1="100" y1="25" x2="175" y2="155" stroke="#1a1a1a" strokeWidth="5" strokeDasharray="16 10" strokeLinecap="round" />
        <line x1="175" y1="155" x2="25" y2="155" stroke="#1a1a1a" strokeWidth="5" strokeDasharray="16 10" strokeLinecap="round" />
        <line x1="25" y1="155" x2="100" y2="25" stroke="#1a1a1a" strokeWidth="5" strokeDasharray="16 10" strokeLinecap="round" />
        <text x="100" y="182" textAnchor="middle" fontSize="11" fill="#666">Gaps are filled in mentally</text>
      </svg>
    ),
  },
  {
    id: 4,
    answer: "continuity",
    caption: "Do you see an X, or two lines that each flow smoothly through the crossing?",
    render: () => (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="200" height="200" fill="white" />
        <line x1="25" y1="25" x2="175" y2="175" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
        <line x1="175" y1="25" x2="25" y2="175" stroke="#555" strokeWidth="5" strokeLinecap="round" strokeDasharray="0" />
        <text x="100" y="195" textAnchor="middle" fontSize="11" fill="#666">Lines follow the smoothest path</text>
      </svg>
    ),
  },
  {
    id: 5,
    answer: "symmetry",
    caption: "How many objects do you see — the black shapes, or the white gaps between them?",
    render: () => (
      <svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="220" height="180" fill="white" />
        {/* Left symmetric shape */}
        <ellipse cx={68} cy={45} rx={22} ry={24} fill="#1a1a1a" />
        <rect x={52} y={65} width={32} height={12} rx={3} fill="#1a1a1a" />
        <rect x={48} y={74} width={40} height={55} rx={5} fill="#1a1a1a" />
        <rect x={44} y={126} width={48} height={11} rx={2} fill="#1a1a1a" />
        {/* Right shape (mirror) */}
        <ellipse cx={152} cy={45} rx={22} ry={24} fill="#1a1a1a" />
        <rect x={136} y={65} width={32} height={12} rx={3} fill="#1a1a1a" />
        <rect x={132} y={74} width={40} height={55} rx={5} fill="#1a1a1a" />
        <rect x={128} y={126} width={48} height={11} rx={2} fill="#1a1a1a" />
        <text x="110" y="158" textAnchor="middle" fontSize="11" fill="#666">Symmetrical images grouped collectively</text>
      </svg>
    ),
  },
  {
    id: 6,
    answer: "similarity",
    caption: "Color creates grouping here. Which principle is at work?",
    render: () => (
      <svg viewBox="0 0 220 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="220" height="100" fill="white" />
        {Array.from({ length: 3 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={22 + c * 35} cy={22 + r * 26} r={10} fill={c % 2 === 0 ? "#c1121f" : "#4361ee"} />
          ))
        )}
        <text x="110" y="93" textAnchor="middle" fontSize="11" fill="#666">Same color = grouped together</text>
      </svg>
    ),
  },
  {
    id: 7,
    answer: "proximity",
    caption: "Why do you know which label belongs to which input field?",
    render: () => (
      <svg viewBox="0 0 240 145" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="240" height="145" fill="white" />
        <text x="18" y="22" fontSize="12" fill="#333" fontFamily="sans-serif">Name</text>
        <rect x="18" y="27" width="95" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.5" />
        <text x="18" y="64" fontSize="12" fill="#333" fontFamily="sans-serif">Email</text>
        <rect x="18" y="69" width="95" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.5" />
        <text x="130" y="22" fontSize="12" fill="#333" fontFamily="sans-serif">Age</text>
        <rect x="130" y="27" width="75" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.5" />
        <text x="130" y="64" fontSize="12" fill="#333" fontFamily="sans-serif">City</text>
        <rect x="130" y="69" width="75" height="18" rx="2" fill="none" stroke="#aaa" strokeWidth="1.5" />
        <text x="120" y="135" textAnchor="middle" fontSize="10" fill="#666">Labels are closer to their own field</text>
      </svg>
    ),
  },
  {
    id: 8,
    answer: "closure",
    caption: "You perceive a complete circle — but is it really there?",
    render: () => (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="200" height="200" fill="white" />
        <circle cx="100" cy="96" r="66" fill="none" stroke="#1a1a1a" strokeWidth="7" strokeDasharray="24 13" strokeLinecap="round" />
        <text x="100" y="183" textAnchor="middle" fontSize="11" fill="#666">Brain ignores gaps and completes the shape</text>
      </svg>
    ),
  },
  {
    id: 9,
    answer: "continuity",
    caption: "What does your eye naturally do with this arrangement of dots?",
    render: () => {
      const dots = Array.from({ length: 13 }, (_, i) => ({
        x: 15 + i * 15,
        y: 88 + Math.sin(i * 0.65) * 52,
      }))
      return (
        <svg viewBox="0 0 210 180" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect width="210" height="180" fill="white" />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={6} fill="#1a1a1a" />
          ))}
          <text x="105" y="170" textAnchor="middle" fontSize="11" fill="#666">Eye follows the smoothest curve</text>
        </svg>
      )
    },
  },
  {
    id: 10,
    answer: "closure",
    caption: "The IBM logo uses horizontal stripes. What principle makes you still read the letters?",
    render: () => (
      <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="240" height="130" fill="white" />
        {/* Simplified IBM-style striped letters */}
        {/* I */}
        {[18, 30, 42, 54, 66, 78, 90].map((y) => (
          <rect key={`I${y}`} x={20} y={y} width={28} height={6} rx={1} fill="#2563eb" />
        ))}
        {/* B */}
        {[18, 30, 42, 54, 66, 78, 90].map((y) => (
          <rect key={`B${y}`} x={62} y={y} width={36} height={6} rx={1} fill="#2563eb" />
        ))}
        {/* M */}
        {[18, 30, 42, 54, 66, 78, 90].map((y) => (
          <rect key={`M${y}`} x={112} y={y} width={46} height={6} rx={1} fill="#2563eb" />
        ))}
        <text x="120" y="118" textAnchor="middle" fontSize="11" fill="#666">Gaps are closed — you read "IBM"</text>
      </svg>
    ),
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuizGame() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""))
  const [timeLeft, setTimeLeft] = useState(10 * 60)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)

  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isSubmitted) {
      handleSubmit()
    }
  }, [timeLeft, isSubmitted])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`
  }

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers]
    newAnswers[currentQuestion] = answer
    setUserAnswers(newAnswers)

    // Brief feedback flash
    const isCorrect = answer === QUESTIONS[currentQuestion].answer
    setFeedback(isCorrect ? "correct" : "wrong")
    setTimeout(() => {
      setFeedback(null)
      if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion((q) => q + 1)
      }
    }, 500)
  }

  const handleSubmit = () => {
    if (isSubmitted) return
    setIsSubmitted(true)
    const score = userAnswers.reduce(
      (total, answer, i) => (answer === QUESTIONS[i].answer ? total + 1 : total),
      0,
    )
    window.location.href = `/games/gestalt-assessment/app/results?score=${score}`
  }

  const q = QUESTIONS[currentQuestion]

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black p-2 md:p-4">
      {/* Left Panel — illustration */}
      <div className="w-full md:w-3/5 p-1 md:p-2 mb-2 md:mb-0">
        <div className="border-4 border-teal rounded-none h-full">
          <div className="bg-darkBlue h-full flex flex-col relative">
            {/* Navigation & timer */}
            <div className="flex justify-between items-center bg-black border-b-4 border-teal">
              <button
                onClick={() => setCurrentQuestion((q) => Math.max(0, q - 1))}
                disabled={currentQuestion === 0}
                className={`bg-blue-600 p-4 w-16 h-16 flex items-center justify-center ${currentQuestion === 0 ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-700"}`}
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>

              <span className="font-press-start-2p text-neonGreen text-xl md:text-2xl tracking-widest">
                {formatTime(timeLeft)}
              </span>

              <button
                onClick={() => setCurrentQuestion((q) => Math.min(QUESTIONS.length - 1, q + 1))}
                disabled={currentQuestion === QUESTIONS.length - 1}
                className={`bg-blue-600 p-4 w-16 h-16 flex items-center justify-center ${currentQuestion === QUESTIONS.length - 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-700"}`}
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            </div>

            {/* Illustration */}
            <div
              className={`flex-grow flex flex-col items-center justify-center p-4 md:p-8 transition-colors duration-300 ${
                feedback === "correct" ? "bg-green-900/30" : feedback === "wrong" ? "bg-red-900/30" : ""
              }`}
            >
              <div className="bg-white w-full max-w-sm aspect-square flex items-center justify-center rounded-lg shadow-inner overflow-hidden p-2">
                {q.render()}
              </div>
              <p className="mt-4 text-center font-pixelify-sans text-sm text-gray-300 max-w-xs">
                {q.caption}
              </p>
            </div>

            {/* Bottom bar */}
            <div className="bg-teal p-4 flex justify-end items-center">
              <button
                onClick={handleSubmit}
                className="bg-blue-600 border-2 border-blue-800 text-white font-pixelify-sans text-lg py-2 px-6 hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — answers */}
      <div className="w-full md:w-2/5 p-1 md:p-2">
        <div className="border-4 border-teal rounded-none h-full">
          <div className="bg-darkBlue h-full p-4 md:p-6 flex flex-col">
            <div className="font-press-start-2p text-white text-lg md:text-xl mb-4 text-center">
              {currentQuestion + 1} / {QUESTIONS.length}
            </div>

            <p className="font-pixelify-sans text-white text-base md:text-lg mb-6">
              Which Gestalt principle does this image demonstrate?
            </p>

            <div className="space-y-3 mb-auto">
              {PRINCIPLES.map((principle) => {
                const isSelected = userAnswers[currentQuestion] === principle
                return (
                  <button
                    key={principle}
                    className={`w-full font-pixelify-sans text-base md:text-lg py-2 px-4 transition-colors duration-150 capitalize ${
                      isSelected
                        ? "bg-yellow-300 text-black border-4 border-teal"
                        : "bg-white text-darkBlue hover:bg-yellow-200 hover:text-black"
                    }`}
                    onClick={() => handleAnswerSelect(principle)}
                  >
                    {principle}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => setShowTips(!showTips)}
                className="bg-blue-600 text-white font-pixelify-sans text-sm py-1 px-3 hover:bg-blue-700"
              >
                TIPS
              </button>
              <Link href="/games/gestalt-assessment/app">
                <div className="bg-blue-600 p-2 hover:bg-blue-700 cursor-pointer">
                  <Home className="h-5 w-5 text-white" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tips modal */}
      {showTips && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-darkBlue border-4 border-teal p-5 max-w-sm max-h-[85vh] overflow-auto">
            <h2 className="text-neonGreen font-pixelify-sans text-xl mb-4">Gestalt Principles</h2>
            {[
              ["Similarity", "Items that share visual features (shape, color, size) are perceived as a group."],
              ["Proximity", "Objects near each other tend to be grouped together."],
              ["Continuity", "Lines and curves are seen as following the smoothest possible path."],
              ["Symmetry", "Symmetrical images are perceived collectively, even across distance."],
              ["Closure", "We tend to ignore gaps and complete shapes — the brain fills in missing parts."],
            ].map(([name, desc]) => (
              <div key={name} className="mb-4">
                <h3 className="text-neonGreen font-pixelify-sans text-base mb-1">{name}</h3>
                <p className="text-white font-pixelify-sans text-sm">{desc}</p>
              </div>
            ))}
            <button
              onClick={() => setShowTips(false)}
              className="mt-2 bg-blue-600 text-white font-pixelify-sans text-sm py-1 px-4 hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
