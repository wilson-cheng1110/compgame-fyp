"use client"

import { useEffect, useState } from "react"
import type { Circle } from "../types"

interface GameCanvasProps {
  circles: Circle[]
  onCircleClick: (id: number) => void
  onStartClick: () => void
  gameState: "waiting" | "playing"
}

export default function GameCanvas({ circles, onCircleClick, onStartClick, gameState }: GameCanvasProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div>Loading game canvas...</div>
  }

  // Highlight the next expected circle (lowest ID among unclicked)
  const unclicked = circles.filter((c) => !c.clicked)
  const nextTargetId =
    unclicked.length > 0
      ? unclicked.reduce((min, c) => (c.indexOfDifficulty < min.indexOfDifficulty ? c : min)).id
      : null

  return (
    <div className="relative flex-1 w-full flex flex-col items-center">
      {gameState === "waiting" && (
        <div className="w-full max-w-2xl mx-auto mb-6">
          <div className="bg-[#E35126] p-4 md:p-6 text-white rounded-lg">
            <h2 className="text-lg md:text-xl mb-3 text-center font-bold" style={{ fontFamily: "Arial, sans-serif" }}>
              Test your understanding of Fitts&apos; Law
            </h2>
            <p className="text-sm md:text-base text-center mb-2" style={{ fontFamily: "Arial, sans-serif" }}>
              Click circles <strong>from easiest to hardest</strong> to reach, using the Index of Difficulty:
            </p>
            <p className="text-center font-bold text-base md:text-lg font-mono bg-white/20 rounded px-3 py-1 inline-block w-full">
              ID = log₂(A/W + 0.5)
            </p>
            <p className="text-xs text-center mt-2 opacity-90" style={{ fontFamily: "Arial, sans-serif" }}>
              A = distance to target &nbsp;·&nbsp; W = target width &nbsp;·&nbsp; Hover a circle to see its ID
            </p>
          </div>
        </div>
      )}

      <div className="relative flex-1 w-full">
        {circles.map((circle) => {
          const isNext = circle.id === nextTargetId && gameState === "playing"
          return (
            <button
              key={circle.id}
              onClick={() => onCircleClick(circle.id)}
              title={`ID = ${circle.indexOfDifficulty.toFixed(2)} bits (A=${Math.round(circle.distance)}px, W=${Math.round(circle.size)}px)`}
              className={`absolute rounded-full transition-all duration-200 ${
                circle.clicked
                  ? "opacity-0 pointer-events-none"
                  : isNext
                  ? "opacity-100 ring-4 ring-white ring-opacity-80 scale-105"
                  : "opacity-100 hover:ring-4 hover:ring-white hover:ring-opacity-50"
              }`}
              style={{
                left: circle.x,
                top: circle.y,
                width: circle.size,
                height: circle.size,
                backgroundColor: circle.color,
                transform: `translate(-50%, -50%) ${isNext ? "scale(1.08)" : "scale(1)"}`,
              }}
              disabled={circle.clicked}
            />
          )
        })}
      </div>

      <div className="w-full flex justify-center py-6">
        <button
          onClick={onStartClick}
          className={`px-6 py-2 md:px-8 md:py-3 text-lg md:text-xl font-bold rounded-lg transition-colors duration-200 ${
            gameState === "waiting"
              ? "bg-[#E35126] hover:bg-[#fd5252] text-white"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          }`}
          style={{ fontFamily: "Arial, sans-serif" }}
          disabled={gameState !== "waiting"}
        >
          Start
        </button>
      </div>
    </div>
  )
}
