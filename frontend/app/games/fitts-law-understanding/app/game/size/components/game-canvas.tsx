"use client"

import { useEffect, useRef, useState } from "react"
import type { Fish } from "../types"
import { useScale } from "../../../../components/ResponsiveContainer"
import { playCatchSound, initAudioContext, playRollingSound, stopRollingSound } from "../../../../utils/sound"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

interface GameCanvasProps {
  fishes: Fish[]
  onFishCatch: (fishId: string, time: number) => void
  fishhookUrl: string
  onTimeUpdate: (time: number) => void
  gameState: "playing" | "finished"
  showExplanation: boolean
}

export default function GameCanvas({
  fishes,
  onFishCatch,
  fishhookUrl,
  onTimeUpdate,
  gameState,
  showExplanation,
}: GameCanvasProps) {
  const [isExtending, setIsExtending] = useState(false)
  const [isRetracting, setIsRetracting] = useState(false)
  const [currentAngle, setCurrentAngle] = useState(65)
  const [lineLength, setLineLength] = useState(100)
  const [fixedAngle, setFixedAngle] = useState<number | null>(null)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const timerRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const swingDirectionRef = useRef<1 | -1>(-1)
  const { scale } = useScale()

  // Constants
  const SWING_SPEED = 2
  const EXTENSION_SPEED = 5
  const RETRACTION_SPEED = 0.5
  const SLOW_RETRACTION_SPEED = 0.2
  const MIN_ANGLE = -65
  const MAX_ANGLE = 65
  const BASE_LINE_LENGTH = 100
  const MAX_LINE_LENGTH = 1000 // Increased from 800 to reach the new position
  const ROD_START_X = 745
  const ROD_START_Y = 82
  const HOOK_SIZE = 40
  const CATCH_DISTANCE_A = 50 // Half of fish A size
  const CATCH_DISTANCE_B = 150 // Half of fish B size

  // Initialize sounds on component mount
  useEffect(() => {
    initAudioContext()
  }, [])

  useEffect(() => {
    const animate = () => {
      if (!isExtending && !isRetracting && fixedAngle === null && gameState === "playing" && !showExplanation) {
        setCurrentAngle((prevAngle) => {
          let newAngle = prevAngle + SWING_SPEED * swingDirectionRef.current
          if (newAngle <= MIN_ANGLE) {
            newAngle = MIN_ANGLE
            swingDirectionRef.current = 1
          } else if (newAngle >= MAX_ANGLE) {
            newAngle = MAX_ANGLE
            swingDirectionRef.current = -1
          }
          return newAngle
        })
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isExtending, isRetracting, fixedAngle, gameState, showExplanation])

  useEffect(() => {
    resetGame()
  }, [])

  useEffect(() => {
    if (gameState === "playing") {
      resetGame()
    }
  }, [gameState])

  const resetGame = () => {
    setIsExtending(false)
    setIsRetracting(false)
    setCurrentAngle(65)
    setLineLength(BASE_LINE_LENGTH)
    setFixedAngle(null)
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
    timerRef.current = 0
    onTimeUpdate(0)
    swingDirectionRef.current = -1
  }

  useEffect(() => {
    if (showExplanation) {
      setFixedAngle(currentAngle)
    } else {
      setFixedAngle(null)
    }
  }, [showExplanation, currentAngle])

  const startTimer = () => {
    timerRef.current = 0
    onTimeUpdate(0)
    timerIntervalRef.current = setInterval(() => {
      timerRef.current += 1
      onTimeUpdate(timerRef.current)
    }, 100)
  }

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
  }

  const handleClick = () => {
    if (isExtending || isRetracting || fixedAngle !== null || gameState === "finished" || showExplanation) return

    // Initialize audio context on first interaction (needed for mobile browsers)
    initAudioContext()

    setFixedAngle(currentAngle)
    setIsExtending(true)
    // Play rolling sound when extending
    playRollingSound()
    startTimer()

    let currentLength = BASE_LINE_LENGTH
    const extendLine = () => {
      if (currentLength < MAX_LINE_LENGTH) {
        currentLength += EXTENSION_SPEED
        setLineLength(currentLength)

        // Get the hook element
        const hookElement = document.querySelector(".hook-hitbox") as HTMLElement
        if (hookElement) {
          // Get the game area's position and dimensions
          const gameAreaRect = gameAreaRef.current?.getBoundingClientRect()
          if (!gameAreaRect) return

          // Get the hook's position relative to the game area
          const hookRect = hookElement.getBoundingClientRect()

          // Calculate the hook's center position in the original coordinate system
          const hookCenterX = (hookRect.left - gameAreaRect.left) / scale + hookRect.width / 2
          const hookCenterY = (hookRect.top - gameAreaRect.top) / scale + hookRect.height / 2

          for (const fish of fishes) {
            if (!fish.caught) {
              const fishCenterX = fish.x + fish.size / 2
              const fishCenterY = fish.y + fish.size / 2
              const catchDistance = fish.id === "A" ? CATCH_DISTANCE_A : CATCH_DISTANCE_B
              const distance = Math.sqrt(
                Math.pow(hookCenterX - fishCenterX, 2) + Math.pow(hookCenterY - fishCenterY, 2),
              )

              if (distance < catchDistance) {
                stopTimer()
                // Stop rolling sound
                stopRollingSound()
                // Play catch sound
                playCatchSound()
                onFishCatch(fish.id, timerRef.current)
                setIsExtending(false)
                retractLine(true)
                return
              }
            }
          }

          // Check if hook is out of bounds
          if (hookCenterX < 0 || hookCenterX > 1524 || hookCenterY < 0 || hookCenterY > 854) {
            stopTimer()
            // Stop rolling sound
            stopRollingSound()
            setIsExtending(false)
            retractLine(false)
            return
          }
        }

        animationRef.current = requestAnimationFrame(extendLine)
      } else {
        stopTimer()
        // Stop rolling sound
        stopRollingSound()
        retractLine(false)
      }
    }

    requestAnimationFrame(extendLine)
  }

  const retractLine = (withFish: boolean) => {
    setIsRetracting(true)
    setIsExtending(false)

    let currentLength = lineLength
    let slowRetractionDistance = withFish ? 500 : 0

    const retract = () => {
      if (currentLength > BASE_LINE_LENGTH) {
        const speed = slowRetractionDistance > 0 ? SLOW_RETRACTION_SPEED : RETRACTION_SPEED
        const step = Math.min(speed, currentLength - BASE_LINE_LENGTH)
        currentLength -= step
        slowRetractionDistance = Math.max(0, slowRetractionDistance - step)
        setLineLength(currentLength)
        animationRef.current = requestAnimationFrame(retract)
      } else {
        setIsRetracting(false)
        setLineLength(BASE_LINE_LENGTH)

        // Stop rolling sound when retraction is complete
        stopRollingSound()

        if (!showExplanation) {
          setFixedAngle(null)
          setCurrentAngle((prevAngle) => {
            const newAngle = prevAngle + SWING_SPEED * swingDirectionRef.current
            if (newAngle <= MIN_ANGLE || newAngle >= MAX_ANGLE) {
              swingDirectionRef.current *= -1
            }
            return newAngle
          })
        }
      }
    }
    requestAnimationFrame(retract)
  }

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      // Make sure to stop rolling sound when component unmounts
      stopRollingSound()
    }
  }, [])

  return (
    <div ref={gameAreaRef} className="relative" style={{ width: "1524px", height: "854px" }} onClick={handleClick}>
      <div
        style={{
          position: "absolute",
          top: `${ROD_START_Y}px`,
          left: `${ROD_START_X}px`,
          width: "6px",
          height: `${lineLength}px`,
          backgroundColor: "#DFC276",
          transformOrigin: "top",
          transform: `rotate(${fixedAngle ?? currentAngle}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: "-20px",
            left: "-17px",
            width: "40px",
            height: "40px",
            backgroundImage: `url('${fishhookUrl}')`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        <div
          className="hook-hitbox"
          style={{
            position: "absolute",
            bottom: "-5px",
            left: "-5px",
            width: "10px",
            height: "10px",
          }}
        />
      </div>

      {/* Render fish B first so it appears behind fish A */}
      {fishes
        .sort((a, b) => (a.id === "B" ? -1 : 1)) // Ensure fish B is rendered first
        .map(
          (fish) =>
            !fish.caught && (
              <div
                key={fish.id}
                className="absolute"
                style={{
                  left: fish.x,
                  top: fish.y,
                  width: `${fish.size}px`,
                  height: `${fish.size}px`,
                  backgroundImage: `url('${fish.image}')`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              />
            ),
        )}
    </div>
  )
}
