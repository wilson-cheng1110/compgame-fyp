"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, RotateCcw } from "lucide-react"
import GameCanvas from "./components/game-canvas"
import Timer from "./components/timer"
import TimeRecord from "./components/time-record"
import CustomButton from "../../../components/CustomButton"
import ResponsiveContainer from "../../../components/ResponsiveContainer"
import type { Fish } from "./types"
import { playCongratsSound, initAudioContext } from "../../../utils/sound"
import SoundToggle from "../../../components/SoundToggle"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

export default function DistanceGame() {
  const router = useRouter()
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

  const initialFishPositions: Fish[] = [
    {
      id: "A",
      x: 946,
      y: 395,
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/m1_fishA-ZyygJWyVWA0xx0mCZaz9H41sndP8UX.png",
      caught: false,
    },
    {
      id: "B",
      x: 412,
      y: 636,
      image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/m1_fishB-l43dbk1nrv2zDOg5dCtR9TXIKsGdVu.png",
      caught: false,
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
    [caughtFish.length, fishes.length, initialFishPositions],
  )

  // Navigate to the game menu page instead of dashboard
  const navigateToGameMenu = () => {
    router.push("/games/fitts-law-understanding/app")
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
            Since the distance between A is smaller than B, it will take less time.
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
          </>
        )}
      </main>
    </ResponsiveContainer>
  )
}
