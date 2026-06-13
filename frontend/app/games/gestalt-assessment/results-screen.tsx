"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function ResultsScreen() {
  const searchParams = useSearchParams()
  const score = Number.parseInt(searchParams.get("score") || "0")

  const hasFiveStarBadge = score === 10
  const hasFourStarBadge = score >= 8 && score < 10
  const hasBadge = hasFiveStarBadge || hasFourStarBadge

  const [showTips, setShowTips] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  const pct = Math.round((score / 10) * 100)

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-black p-2 md:p-4">
      {/* Left Panel — score */}
      <div className="w-full md:w-2/5 p-1 md:p-2 mb-2 md:mb-0">
        <div className="border-4 border-teal rounded-none h-full">
          <div className="bg-darkBlue h-full flex flex-col items-center justify-center p-6">
            {hasBadge && (
              <h1 className="font-pixelify-sans text-neonGreen text-2xl md:text-3xl mb-4 text-center">
                CONGRATULATIONS!
              </h1>
            )}
            <div className={`font-press-start-2p text-2xl md:text-3xl mb-4 ${hasBadge ? "text-neonGreen" : "text-red-400"}`}>
              {score}/10
            </div>
            <div className={`font-pixelify-sans text-base mb-6 text-center ${hasBadge ? "text-neonGreen" : "text-gray-400"}`}>
              {hasFiveStarBadge && "★★★★★ Gestalt Expert"}
              {hasFourStarBadge && "★★★★☆ Almost there!"}
              {!hasBadge && "Keep studying — review the tips →"}
            </div>
            <Link href="/games/gestalt-assessment/app">
              <button className="font-pixelify-sans text-white text-2xl md:text-3xl bg-transparent hover:text-yellow-300 transition-colors mb-4">
                RESTART
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="font-pixelify-sans text-gray-400 text-sm hover:text-white transition-colors">
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel — debrief */}
      <div className="w-full md:w-3/5 p-1 md:p-2 overflow-y-auto">
        <div className="border-4 border-teal rounded-none min-h-full">
          <div className="bg-darkBlue p-4 md:p-6 space-y-4">

            {/* What you just experienced */}
            <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
              <h3 className="text-yellow-400 font-pixelify-sans text-base mb-2">The 5 Gestalt Principles</h3>
              <div className="space-y-1 text-sm text-gray-300 font-pixelify-sans">
                <p><span className="text-white font-bold">Similarity</span> — similar items are grouped together</p>
                <p><span className="text-white font-bold">Proximity</span> — nearby objects appear related</p>
                <p><span className="text-white font-bold">Continuity</span> — lines follow the smoothest path</p>
                <p><span className="text-white font-bold">Symmetry</span> — symmetric shapes are perceived collectively</p>
                <p><span className="text-white font-bold">Closure</span> — the brain completes incomplete shapes</p>
              </div>
            </div>

            {/* Exam tip */}
            <div className="bg-blue-950/60 rounded-lg p-4 border border-blue-800">
              <h3 className="text-blue-300 font-pixelify-sans text-xs uppercase tracking-wider mb-2">Exam Tip</h3>
              <p className="text-gray-300 text-sm font-pixelify-sans leading-relaxed">
                Distinguish <span className="text-white">closure</span> (brain fills gaps — IBM logo, Kanizsa triangle)
                from <span className="text-white">continuity</span> (lines follow smoothest path — crossing diagonals).
                Symmetry groups shapes collectively even at a distance.
              </p>
            </div>

            {/* Sample question */}
            <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700">
              <h3 className="text-gray-300 font-pixelify-sans text-xs uppercase tracking-wider mb-2">Practice Question</h3>
              <p className="text-white text-sm font-pixelify-sans leading-relaxed mb-3">
                The IBM logo uses horizontal stripes that break up letters. Which Gestalt principle allows us to still read "IBM"?
              </p>
              <button onClick={() => setShowAnswer(!showAnswer)} className="text-xs text-blue-400 hover:text-blue-300 underline">
                {showAnswer ? "Hide answer" : "Show answer"}
              </button>
              {showAnswer && (
                <div className="mt-2 bg-gray-900 rounded p-3 text-gray-300 text-xs font-pixelify-sans leading-relaxed">
                  Closure. The brain ignores the horizontal gaps and automatically completes the letter shapes,
                  perceiving the full letters even though they are fragmented.
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Link href="/games/gestalt-assessment/app/quiz" className="flex-1">
                <button className="w-full bg-teal text-darkBlue font-pixelify-sans text-sm py-2 px-3 rounded hover:opacity-90 transition">
                  Retake Quiz
                </button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <button className="w-full bg-gray-700 text-white font-pixelify-sans text-sm py-2 px-3 rounded hover:bg-gray-600 transition">
                  Back to Topics
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
