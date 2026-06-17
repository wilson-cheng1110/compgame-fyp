"use client"

import { useEffect, useRef, useState } from "react"
import type { Fish } from "../types"
import { useScale } from "../../../../components/ResponsiveContainer"
import { playCatchSound, initAudioContext, playRollingSound, stopRollingSound } from "../../../../utils/sound"

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
  const animationRef = useRef<number | undefined>(undefined)
  const timerRef = useRef<number>(0)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const swingDirectionRef = useRef<1 | -1>(-1)
  const prevSwingTimeRef = useRef<number>(0)
  const { scale } = useScale()

  // Per-second rates — frame-rate independent (equivalent to original 2/5/0.5/0.2 per frame at 60 fps)
  const SWING_SPEED_DEG_S = 120
  const EXTENSION_SPEED_PX_S = 300
  const RETRACTION_SPEED_PX_S = 30
  const SLOW_RETRACTION_SPEED_PX_S = 12
  const MIN_ANGLE = -65
  const MAX_ANGLE = 65
  const BASE_LINE_LENGTH = 100
  const MAX_LINE_LENGTH = 800
  const ROD_START_X = 745
  const ROD_START_Y = 82
  const FISH_SIZE = 100
  const CATCH_DISTANCE = 50

  useEffect(() => {
    if (isClient) {
      initAudioContext()
    }
  }, [])

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!isExtending && !isRetracting && fixedAngle === null && gameState === "playing" && !showExplanation) {
        const delta = prevSwingTimeRef.current ? (timestamp - prevSwingTimeRef.current) / 1000 : 0
        prevSwingTimeRef.current = timestamp
        setCurrentAngle((prevAngle) => {
          let newAngle = prevAngle + SWING_SPEED_DEG_S * delta * swingDirectionRef.current
          if (newAngle <= MIN_ANGLE) {
            newAngle = MIN_ANGLE
            swingDirectionRef.current = 1
          } else if (newAngle >= MAX_ANGLE) {
            newAngle = MAX_ANGLE
            swingDirectionRef.current = -1
          }
          return newAngle
        })
      } else {
        prevSwingTimeRef.current = 0
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
    prevSwingTimeRef.current = 0
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

    if (isClient) {
      initAudioContext()
    }

    setFixedAngle(currentAngle)
    setIsExtending(true)
    playRollingSound()
    startTimer()

    let currentLength = BASE_LINE_LENGTH
    let extendPrevTime = 0
    const extendLine = (timestamp: number) => {
      const delta = extendPrevTime ? (timestamp - extendPrevTime) / 1000 : 1 / 60
      extendPrevTime = timestamp
      if (currentLength < MAX_LINE_LENGTH) {
        currentLength = Math.min(currentLength + EXTENSION_SPEED_PX_S * delta, MAX_LINE_LENGTH)
        setLineLength(currentLength)

        const hookElement = document.querySelector(".hook-hitbox") as HTMLElement
        if (hookElement) {
          const gameAreaRect = gameAreaRef.current?.getBoundingClientRect()
          if (!gameAreaRect) return

          const hookRect = hookElement.getBoundingClientRect()
          const hookCenterX = (hookRect.left - gameAreaRect.left) / scale + hookRect.width / 2
          const hookCenterY = (hookRect.top - gameAreaRect.top) / scale + hookRect.height / 2

          for (const fish of fishes) {
            if (!fish.caught) {
              const fishCenterX = fish.x + FISH_SIZE / 2
              const fishCenterY = fish.y + FISH_SIZE / 2
              const distance = Math.sqrt(
                Math.pow(hookCenterX - fishCenterX, 2) + Math.pow(hookCenterY - fishCenterY, 2),
              )

              if (distance < CATCH_DISTANCE) {
                stopTimer()
                stopRollingSound()
                playCatchSound()
                onFishCatch(fish.id, timerRef.current)
                setIsExtending(false)
                retractLine(true)
                return
              }
            }
          }

          if (hookCenterX < 0 || hookCenterX > 1524 || hookCenterY < 0 || hookCenterY > 854) {
            stopTimer()
            stopRollingSound()
            setIsExtending(false)
            retractLine(false)
            return
          }
        }

        animationRef.current = requestAnimationFrame(extendLine)
      } else {
        stopTimer()
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
    let retractPrevTime = 0

    const retract = (timestamp: number) => {
      const delta = retractPrevTime ? (timestamp - retractPrevTime) / 1000 : 1 / 60
      retractPrevTime = timestamp
      if (currentLength > BASE_LINE_LENGTH) {
        const speed = slowRetractionDistance > 0 ? SLOW_RETRACTION_SPEED_PX_S : RETRACTION_SPEED_PX_S
        const step = Math.min(speed * delta, currentLength - BASE_LINE_LENGTH)
        currentLength -= step
        slowRetractionDistance = Math.max(0, slowRetractionDistance - step)
        setLineLength(currentLength)
        animationRef.current = requestAnimationFrame(retract)
      } else {
        setIsRetracting(false)
        setLineLength(BASE_LINE_LENGTH)
        stopRollingSound()

        if (!showExplanation) {
          setFixedAngle(null)
          setCurrentAngle((prevAngle) => {
            const newAngle = prevAngle + (SWING_SPEED_DEG_S / 60) * swingDirectionRef.current
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
            backgroundImage: `url(${fishhookUrl})`,
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

      {fishes.map(
        (fish) =>
          !fish.caught && (
            <div
              key={fish.id}
              className="absolute"
              style={{
                left: fish.x,
                top: fish.y,
                width: `${FISH_SIZE}px`,
                height: `${FISH_SIZE}px`,
                backgroundImage: `url(${fish.image})`,
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
