"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, RotateCcw, BookOpen, ArrowRight } from "lucide-react"
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
  const [distanceDone, setDistanceDone] = useState(false)
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
      // #08 psychophysics capture: persist this sub-game's per-fish catch times
      // ({ fishId -> catch time in ms }) so the debrief route (a separate page)
      // can read both sub-games' records back out. Same localStorage pattern as
      // the "-done" flags above; does not touch the recording/scoring flow.
      localStorage.setItem("fitts-understanding-size-records", JSON.stringify(records))
      const otherDone = localStorage.getItem("fitts-understanding-distance-done") === "1"
      setDistanceDone(otherDone)
      if (otherDone && localStorage.getItem("fitts-understanding-recorded") !== "1") {
        markGameComplete("fitts-law-understanding")
        localStorage.setItem("fitts-understanding-recorded", "1")
      }
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [showCompletion, markGameComplete, records])

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
      image: "/images/games/fitts-fish-a.png",
      caught: false,
      size: FISH_SIZE_A,
    },
    {
      id: "B",
      x: centerX - FISH_SIZE_B / 2, // Adjust position to center the fish
      y: centerY - FISH_SIZE_B / 2,
      image: "/images/games/fitts-size-fish-b.png",
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

  // Carry the unit context (?unit=/step/of) forward through every internal hop of
  // this sub-canvas. Deliberate mid-study procedure change (preserve unit context
  // to reduce fitts post-check drop-off / differential attrition by arm): a student
  // who launched this activity from a topic unit must be returned to the unit's
  // post-check (via the unit-aware debrief), not stranded on the dashboard. The
  // search string is empty in free play, so that path is unchanged.
  const withUnit = (path: string) => `${path}${isClient ? window.location.search : ""}`

  const navigateToGameMenu = () => {
    router.push(withUnit("/games/fitts-law-understanding/app"))
  }

  const navigateToDebrief = () => {
    router.push(withUnit("/games/fitts-law-understanding/debrief"))
  }

  const navigateToDistance = () => {
    router.push(withUnit("/games/fitts-law-understanding/app/game/distance"))
  }

  return (
    <ResponsiveContainer>
      <main
        className="relative overflow-hidden"
        style={{
          backgroundImage: `url('/images/games/fitts-background.png')`,
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
              {distanceDone ? "BOTH DONE — REVIEW:" : "1 OF 2 — ONE TO GO:"}
            </div>
            {/* Guided forward path. Until BOTH sub-games are done the primary button
                sends the student to the other one; once both are done it goes to the
                debrief (which records the activity). Preserves the both-games
                requirement while removing the co-equal HOME button that let a student
                who finished one game leave with nothing recorded -> the topic unit's
                activity_not_recorded escape (measured: fitts was the top escaper). */}
            <CustomButton
              onClick={distanceDone ? navigateToDebrief : navigateToDistance}
              icon={distanceDone ? BookOpen : ArrowRight}
              text={distanceDone ? "DEBRIEF" : "NEXT: DISTANCE"}
              style={{
                position: "absolute",
                left: "1232px",
                top: "34px",
                width: "260px",
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
                width: "260px",
                height: "50px",
              }}
            />
            <CustomButton
              onClick={navigateToGameMenu}
              icon={Home}
              text="HOME"
              style={{
                position: "absolute",
                left: "1232px",
                top: "190px",
                width: "260px",
                height: "50px",
              }}
            />
          </>
        )}
      </main>
    </ResponsiveContainer>
  )
}
