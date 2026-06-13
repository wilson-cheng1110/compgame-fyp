"use client"

import { useState, useCallback, useEffect } from "react"
import type { Circle, GameState } from "./types"
import GameCanvas from "./components/GameCanvas"
import SuccessScreen from "./components/SuccessScreen"
import FailureScreen from "./components/FailureScreen"

interface FittsLawGameProps {
  onBadgeAchieved?: (achieved: boolean) => void
}

const NUM_CIRCLES = 6
const MIN_CIRCLE_SIZE = 40
const MAX_CIRCLE_SIZE = 110
const COLORS = ["#fd5252", "#3abe66", "#007ade", "#8120f8", "#d7d00a", "#e35126"]

// ID = log₂(A/W + 0.5)  — Shannon reformulation from course slides
function computeID(distance: number, size: number): number {
  const ratio = distance / size + 0.5
  return ratio > 0 ? Math.log2(ratio) : 0
}

export default function FittsLawGame({ onBadgeAchieved }: FittsLawGameProps) {
  const [gameState, setGameState] = useState<GameState>("waiting")
  const [circles, setCircles] = useState<Circle[]>([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const generateCircles = useCallback(() => {
    if (typeof window === "undefined") return []

    const newCircles: Circle[] = []
    const usedPositions: { x: number; y: number }[] = []

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const gameAreaWidth = viewportWidth * 0.8
    const gameAreaHeight = viewportHeight * 0.55
    const gameAreaLeft = (viewportWidth - gameAreaWidth) / 2
    const gameAreaTop = viewportHeight * 0.22

    const startButtonX = viewportWidth / 2
    const startButtonY = viewportHeight * 0.84

    for (let i = 0; i < NUM_CIRCLES; i++) {
      let x: number, y: number, overlapping: boolean

      do {
        overlapping = false
        x = gameAreaLeft + Math.random() * gameAreaWidth
        y = gameAreaTop + Math.random() * gameAreaHeight

        for (const pos of usedPositions) {
          const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2))
          if (dist < MAX_CIRCLE_SIZE * 1.5) {
            overlapping = true
            break
          }
        }
      } while (overlapping)

      usedPositions.push({ x, y })

      // Ensure circles are a reasonable size on all screen widths
      const sizeScale = Math.max(0.85, Math.min(viewportWidth, viewportHeight) / 1000)
      const size = (Math.random() * (MAX_CIRCLE_SIZE - MIN_CIRCLE_SIZE) + MIN_CIRCLE_SIZE) * sizeScale

      const dx = x - startButtonX
      const dy = y - startButtonY
      // distance to edge of circle (A = amplitude)
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy) - size / 2)

      newCircles.push({
        id: i,
        x,
        y,
        size,
        color: COLORS[i % COLORS.length],
        distance,
        indexOfDifficulty: computeID(distance, size),
        clicked: false,
      })
    }

    // Sort easiest (lowest ID) first — this is the correct click order
    return newCircles.sort((a, b) => a.indexOfDifficulty - b.indexOfDifficulty)
  }, [])

  const startGame = useCallback(() => {
    if (gameState === "waiting") {
      setCircles(generateCircles())
      setGameState("playing")
    }
  }, [gameState, generateCircles])

  const handleCircleClick = useCallback(
    (clickedId: number) => {
      if (gameState !== "playing") return

      setCircles((prev) => {
        const unclicked = prev.filter((c) => !c.clicked)
        // The expected next circle is the one with the lowest ID among unclicked
        const expected = unclicked.reduce((min, c) =>
          c.indexOfDifficulty < min.indexOfDifficulty ? c : min
        )

        if (expected.id !== clickedId) {
          // Wrong order
          setGameState("failure")
          return prev
        }

        const updated = prev.map((c) => (c.id === clickedId ? { ...c, clicked: true } : c))

        if (updated.every((c) => c.clicked)) {
          setGameState("success")
          onBadgeAchieved?.(true)
        }

        return updated
      })
    },
    [gameState, onBadgeAchieved],
  )

  const handleRestart = useCallback(() => {
    setGameState("waiting")
    setCircles([])
  }, [])

  if (!isMounted) {
    return <div className="game-container">Loading...</div>
  }

  return (
    <div className="game-container">
      <div className="game-content">
        <div className="w-full text-center mb-4">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl text-[#E35126]"
            style={{ fontFamily: "monospace", fontWeight: "bold", letterSpacing: "-2px" }}
          >
            <span className="inline-block mr-4">Fitts&apos;</span>
            <span className="inline-block">Law</span>
          </h1>
        </div>

        {gameState === "success" && <SuccessScreen onRestart={handleRestart} badgeAchieved={true} />}
        {gameState === "failure" && <FailureScreen onRestart={handleRestart} />}

        {(gameState === "waiting" || gameState === "playing") && (
          <GameCanvas
            circles={circles}
            onCircleClick={handleCircleClick}
            onStartClick={startGame}
            gameState={gameState}
          />
        )}
      </div>
    </div>
  )
}
