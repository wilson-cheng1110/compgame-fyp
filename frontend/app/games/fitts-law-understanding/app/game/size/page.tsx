"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, RotateCcw, BookOpen } from "lucide-react"
import GameCanvas from "./components/game-canvas"
import Timer from "./components/timer"
import TimeRecord from "./components/time-record"
import CustomButton from "../../../components/CustomButton"
import ResponsiveContainer from "../../../components/ResponsiveContainer"
import type { Fish } from "./types"
import { playCongratsSound, initAudioContext } from "../../../utils/sound"
import SoundToggle from "../../../components/SoundToggle"
import { useProgress } from "@/lib/progress-context"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

export default function SizeGame() {
  const router = useRouter()
  const { markGameComplete } = useProgress()
  const [gameState, setGameState] = useState<"playing" | "finished">("playing")
  const [timer, setTimer] = useState<number>(0)
  const [records, setRecords] = useState<{ [key: string]: number }>({})
  const [caughtFish, setCaughtFish] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Initialize sounds on component mount
  useEffect(() => {
    initAudioContext()
  }, [])

  // Record understanding-module progress once BOTH Fitts sub-games (distance +
  // size) have been completed. Each sub-game is a separate full-page route, so
  // we coordinate via localStorage flags. This drives the flip-learning
  // playedUnderstandingFirst metric and the topic unlock.
  useEffect(() => {
    if (!showCompletion) return
    try {
      localStorage.setItem("fitts-understanding-size-done", "1")
      if (
        localStorage.getItem("fitts-understanding-distance-done") === "1" &&
        localStorage.getItem("fitts-understanding-recorded") !== "1"
      ) {
        markGameComplete("fitts-law-understanding")
        localStorage.setItem("fitts-understanding-recorded", "1")
      }
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [showCompletion, markGameComplete])

  // Constants for fish sizes
  const FISH_SIZE_A = 100 // Increased from 60
  const FISH_SIZE_B = 300 // Increased from 150

  // Calculate positions based on center point (701, 567)
  const centerX = 701
  const centerY = 567

  const initialFishPositions: Fish[] = [
    {
      id: "A",
      x: centerX - FISH_SIZE_A / 2, // Adjust position to center the fish
      y: centerY - FISH_SIZE_A / 2,
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/m2_fish%20A-jDTR4bi3sM8oukdSj2GsBoXnb802jZ.png",
      caught: false,
      size: FISH_SIZE_A,
    },
    {
      id: "B",
      x: centerX - FISH_SIZE_B / 2, // Adjust position to center the fish
      y: centerY - FISH_SIZE_B / 2,
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/m2_fish%20B-dUYD7D1WCZg7uJD3rIDE5uGMtFD4Cj.png",
      caught: false,
      size: FISH_SIZE_B,
    },
  ]

  const [fishes, setFishes] = useState<Fish[]>(initialFishPositions)

  const resetGame = useCallback(() => {
    setGameState("playing")
    setCaughtFish([])
    setFishes(initialFishPositions)
    setCurrentTime(0)
    setShowExplanation(false)
    setShowCompletion(false)
    setRecords({})
    setResetKey((prev) => prev + 1)
  }, [])

  const handleRestart = useCallback(() => {
    resetGame()
  }, [resetGame])

  const handleFishCatch = useCallback(
    (fishId: string, catchTime: number) => {
      setRecords((prev) => ({
        ...prev,
        [fishId]: catchTime,
      }))

      setCaughtFish((prev) => [...prev, fishId])
      setFishes((prev) => prev.map((fish) => (fish.id === fishId ? { ...fish, caught: true } : fish)))

      const newCaughtFishCount = caughtFish.length + 1
      if (newCaughtFishCount === fishes.length) {
        setGameState("finished")
        setTimeout(() => {
          setShowExplanation(true)
          setFishes(initialFishPositions)
          setTimeout(() => {
            setShowCompletion(true)
            // Play congratulations sound when mission completed message appears
            playCongratsSound()
          }, 2000)
        }, 2000)
      }
    },
    [caughtFish.length, fishes.length],
  )

  const navigateToGameMenu = () => {
    router.push("/games/fitts-law-understanding/app")
  }

  const navigateToDebrief = () => {
    router.push("/games/fitts-law-understanding/debrief")
  }

  return (
    <ResponsiveContainer>
      <main
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/U_FL_Background-EkMpY1LirpRo7b2lrQtc3xw8hsirvD.png')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          width: "1920px",
          height: "1080px",
        }}
      >
        {/* Sound toggle button */}
        <div className="absolute left-8 bottom-8 z-10">
          <SoundToggle />
        </div>

        <Timer time={currentTime} />
        <TimeRecord records={records} />

        <GameCanvas
          key={resetKey}
          fishes={fishes}
          onFishCatch={handleFishCatch}
          fishhookUrl={`${isClient ? window.location.origin : ""}/images/fishhook.png`}
          onTimeUpdate={setCurrentTime}
          gameState={gameState}
          showExplanation={showExplanation}
        />

        {showExplanation && (
          <div
            className="absolute bottom-0 left-0 right-0 font-quantico"
            style={{
              height: "238px",
              width: "1920px",
              color: "#5D303A",
              fontSize: "40px",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Since the size of A is smaller than B, it will take more time.
          </div>
        )}

        {showCompletion && (
          <>
            <div
              className="absolute font-quantico"
              style={{
                color: "#FFFFFF",
                fontSize: "30px",
                left: "58px",
                top: "64px",
              }}
            >
              MISSION COMPLETED !!!
            </div>
            <div
              className="absolute font-quantico"
              style={{
                left: "920px",
                top: "30px",
                color: "#FFFFFF",
                fontSize: "30px",
              }}
            >
              PLEASE SELECT:
            </div>
            <CustomButton
              onClick={navigateToGameMenu}
              icon={Home}
              text="HOME"
              style={{
                position: "absolute",
                left: "1232px",
                top: "34px",
                width: "200px",
                height: "50px",
              }}
            />
            <CustomButton
              onClick={handleRestart}
              icon={RotateCcw}
              text="RESTART"
              style={{
                position: "absolute",
                left: "1232px",
                top: "112px",
                width: "200px",
                height: "50px",
              }}
            />
            <CustomButton
              onClick={navigateToDebrief}
              icon={BookOpen}
              text="DEBRIEF"
              style={{
                position: "absolute",
                left: "1232px",
                top: "190px",
                width: "200px",
                height: "50px",
              }}
            />
          </>
        )}
      </main>
    </ResponsiveContainer>
  )
}
