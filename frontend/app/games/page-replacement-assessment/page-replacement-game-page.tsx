"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Volume2, VolumeX, Check, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// Define the correct answers for each algorithm
const correctAnswers = {
  fifo: [
    ["0", "0", "0", "2", "2", "2", "2", "2", "1", "1", "1", "1"],
    ["-", "1", "1", "1", "4", "4", "4", "4", "4", "3", "3", "3"],
    ["-", "-", "3", "3", "3", "0", "0", "0", "0", "0", "0", "0"],
  ],
  optimal: [
    ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
    ["-", "1", "1", "1", "4", "4", "4", "4", "1", "1", "1", "1"],
    ["-", "-", "3", "2", "2", "2", "2", "2", "2", "3", "3", "3"],
  ],
  lru: [
    ["0", "0", "0", "2", "2", "2", "2", "2", "2", "3", "3", "3"],
    ["-", "1", "1", "1", "4", "4", "4", "4", "4", "4", "4", "0"],
    ["-", "-", "3", "3", "3", "0", "0", "0", "1", "1", "1", "4"],
  ],
}

export default function PageReplacementGamePage() {
  // State for game mechanics
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [showTips, setShowTips] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30 * 60) // 30 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  // Reference string
  const referenceString = [0, 1, 3, 2, 4, 0, 2, 4, 1, 3, 1, 0]

  // State for user answers
  const [fifoAnswers, setFifoAnswers] = useState<string[][]>([
    Array(12).fill(""),
    ["-", ...Array(11).fill("")],
    ["-", "-", ...Array(10).fill("")],
  ])

  const [optimalAnswers, setOptimalAnswers] = useState<string[][]>([
    Array(12).fill(""),
    ["-", ...Array(11).fill("")],
    ["-", "-", ...Array(10).fill("")],
  ])

  const [lruAnswers, setLruAnswers] = useState<string[][]>([
    Array(12).fill(""),
    ["-", ...Array(11).fill("")],
    ["-", "-", ...Array(10).fill("")],
  ])

  // Audio references
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const failureAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements with the provided sound files
  useEffect(() => {
    successAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-2anS1LvOOg5gTNQVF45Yf4EJ2YGYai.mp3",
    )
    failureAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wrong-Hcickm3TRPRcCru6lvw74rbyypl6G4.mp3",
    )
  }, [])

  // Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    if (isTimerRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      // Time's up - auto submit
      handleSubmit()
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isTimerRunning, timeLeft])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")} : ${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Handle input change for FIFO
  const handleFifoChange = (frameIndex: number, colIndex: number, value: string) => {
    if (hasSubmitted) return

    // Only allow numbers
    if (!/^[0-9]*$/.test(value) && value !== "") return

    const newAnswers = [...fifoAnswers]
    newAnswers[frameIndex][colIndex] = value
    setFifoAnswers(newAnswers)
  }

  // Handle input change for Optimal
  const handleOptimalChange = (frameIndex: number, colIndex: number, value: string) => {
    if (hasSubmitted) return

    // Only allow numbers
    if (!/^[0-9]*$/.test(value) && value !== "") return

    const newAnswers = [...optimalAnswers]
    newAnswers[frameIndex][colIndex] = value
    setOptimalAnswers(newAnswers)
  }

  // Handle input change for LRU
  const handleLruChange = (frameIndex: number, colIndex: number, value: string) => {
    if (hasSubmitted) return

    // Only allow numbers
    if (!/^[0-9]*$/.test(value) && value !== "") return

    const newAnswers = [...lruAnswers]
    newAnswers[frameIndex][colIndex] = value
    setLruAnswers(newAnswers)
  }

  // Calculate score
  const calculateScore = () => {
    let totalScore = 0

    // Check FIFO answers
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 12; j++) {
        // Skip the pre-filled "-" cells
        if ((i === 1 && j === 0) || (i === 2 && (j === 0 || j === 1))) {
          continue
        }

        // Only count if user input matches correct answer and is not empty
        if (fifoAnswers[i][j] !== "" && fifoAnswers[i][j] === correctAnswers.fifo[i][j]) {
          totalScore++
        }
      }
    }

    // Check Optimal answers
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 12; j++) {
        // Skip the pre-filled "-" cells
        if ((i === 1 && j === 0) || (i === 2 && (j === 0 || j === 1))) {
          continue
        }

        // Only count if user input matches correct answer and is not empty
        if (optimalAnswers[i][j] !== "" && optimalAnswers[i][j] === correctAnswers.optimal[i][j]) {
          totalScore++
        }
      }
    }

    // Check LRU answers
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 12; j++) {
        // Skip the pre-filled "-" cells
        if ((i === 1 && j === 0) || (i === 2 && (j === 0 || j === 1))) {
          continue
        }

        // Only count if user input matches correct answer and is not empty
        if (lruAnswers[i][j] !== "" && lruAnswers[i][j] === correctAnswers.lru[i][j]) {
          totalScore++
        }
      }
    }

    return totalScore
  }

  // Clear the game (during gameplay)
  const clearGame = () => {
    setFifoAnswers([Array(12).fill(""), ["-", ...Array(11).fill("")], ["-", "-", ...Array(10).fill("")]])

    setOptimalAnswers([Array(12).fill(""), ["-", ...Array(11).fill("")], ["-", "-", ...Array(10).fill("")]])

    setLruAnswers([Array(12).fill(""), ["-", ...Array(11).fill("")], ["-", "-", ...Array(10).fill("")]])
  }

  // Restart the game (after submission)
  const restartGame = () => {
    clearGame()
    setTimeLeft(30 * 60) // Reset timer to 30 minutes
    setIsTimerRunning(true) // Start the timer again
    setScore(null)
    setHasSubmitted(false)
  }

  // Handle submit
  const handleSubmit = () => {
    if (hasSubmitted) return

    setIsTimerRunning(false)
    const finalScore = calculateScore()
    setScore(finalScore)
    setHasSubmitted(true)

    // Send badge achievement message to parent window
    try {
      if (finalScore >= 99) {
        // 5-star badge
        window.parent.postMessage({ type: "badgeAchieved", stars: 5 }, "*")
      } else if (finalScore >= 80) {
        // 4-star badge
        window.parent.postMessage({ type: "badgeAchieved", stars: 4 }, "*")
      }
    } catch (error) {
      console.error("Error sending badge achievement message:", error)
    }

    // Play appropriate sound based on badge achievement
    if (isSoundOn) {
      try {
        if (finalScore >= 80) {
          // User gets a badge (4-star or 5-star)
          if (successAudioRef.current) {
            // Reset the audio to ensure it plays from the beginning
            successAudioRef.current.currentTime = 0
            successAudioRef.current.volume = 1.0

            // Play the success sound
            const playPromise = successAudioRef.current.play()

            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.error("Error playing success sound:", error)
              })
            }
          }
        } else {
          // No badge
          if (failureAudioRef.current) {
            failureAudioRef.current.currentTime = 0
            failureAudioRef.current.play().catch((err) => console.error("Error playing failure sound:", err))
          }
        }
      } catch (error) {
        console.error("Error with sound playback:", error)
      }
    }
  }

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  // Common button style class
  const buttonClass = "p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200 text-white"

  return (
    <div className="relative h-screen w-full overflow-auto">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game7_game_bg-Xb8ZDb8IZSFqrbjJNcR5fLQ70Ytbo2.webp"
          alt="Page Replacement Game Background - Pixel Art Road"
          fill
          priority
          className="object-cover"
        />
      </div>

      {/* Game Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="bg-[#a3e4e0] bg-opacity-90 w-full max-w-5xl p-4">
          {/* Timer */}
          <div className="bg-black p-2 mb-4 text-center">
            <h2 className="font-press-start-2p text-[#4cf190] text-2xl">{formatTime(timeLeft)}</h2>
          </div>

          {/* Tips and Score Section */}
          <div className="bg-[#0a3a8d] p-4 mb-4">
            <div className="flex items-start">
              <button
                onClick={() => setShowTips(!showTips)}
                className="bg-[#30c3dc] text-white px-4 py-1 font-press-start-2p text-sm"
              >
                TIPS
              </button>
            </div>

            {showTips && (
              <div className="mt-2 p-2 bg-black bg-opacity-50 text-white font-pixelify-sans">
                <p>FIFO: Replace the oldest page in memory first.</p>
                <p>Optimal: Replace the page not needed for the longest time ahead.</p>
                <p>LRU: Replace the page least recently used.</p>
              </div>
            )}

            {hasSubmitted && score !== null && (
              <div className="mt-2 bg-black p-2">
                <p className={`font-pixelify-sans ${score >= 80 ? "text-[#4cf190]" : "text-red-500"}`}>
                  Score: {score}/99
                </p>
                {score === 99 ? (
                  <p className="font-pixelify-sans text-[#4cf190]">You get a Five star badge!</p>
                ) : score >= 80 ? (
                  <div>
                    <p className="font-pixelify-sans text-[#4cf190]">You get a Four star badge!</p>
                    <p className="font-pixelify-sans text-[#4cf190]">Let's try again to get the five-star badge!</p>
                  </div>
                ) : (
                  <p className="font-pixelify-sans text-red-500">Let's try again to get the badge!</p>
                )}
              </div>
            )}
          </div>

          {/* FIFO Table */}
          <div className="mb-4 flex">
            <div className="w-16 bg-[#0a3a8d] flex items-center justify-center">
              <span className="font-press-start-2p text-white transform -rotate-90 text-lg">FIFO</span>
            </div>
            <div className="flex-1">
              {/* Reference String */}
              <div className="flex">
                <div className="w-16 bg-[#30c3dc] flex items-center justify-center">
                  <span className="font-press-start-2p text-white"></span>
                </div>
                {referenceString.map((num, index) => (
                  <div key={index} className="flex-1 bg-[#30c3dc] border border-gray-400 p-2 text-center">
                    <span className="font-press-start-2p text-white">{num}</span>
                  </div>
                ))}
              </div>

              {/* Frame 1 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F1</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      <input
                        type="text"
                        value={fifoAnswers[0][index]}
                        onChange={(e) => handleFifoChange(0, index, e.target.value)}
                        className="w-full bg-transparent text-center font-press-start-2p text-black"
                        maxLength={1}
                        disabled={hasSubmitted}
                      />
                    </div>
                  ))}
              </div>

              {/* Frame 2 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F2</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={fifoAnswers[1][index]}
                          onChange={(e) => handleFifoChange(1, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>

              {/* Frame 3 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F3</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 || index === 1 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={fifoAnswers[2][index]}
                          onChange={(e) => handleFifoChange(2, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Optimal Table */}
          <div className="mb-4 flex">
            <div className="w-16 bg-[#0a3a8d] flex items-center justify-center">
              <span className="font-press-start-2p text-white transform -rotate-90 text-lg">Optimal</span>
            </div>
            <div className="flex-1">
              {/* Reference String */}
              <div className="flex">
                <div className="w-16 bg-[#30c3dc] flex items-center justify-center">
                  <span className="font-press-start-2p text-white"></span>
                </div>
                {referenceString.map((num, index) => (
                  <div key={index} className="flex-1 bg-[#30c3dc] border border-gray-400 p-2 text-center">
                    <span className="font-press-start-2p text-white">{num}</span>
                  </div>
                ))}
              </div>

              {/* Frame 1 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F1</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      <input
                        type="text"
                        value={optimalAnswers[0][index]}
                        onChange={(e) => handleOptimalChange(0, index, e.target.value)}
                        className="w-full bg-transparent text-center font-press-start-2p text-black"
                        maxLength={1}
                        disabled={hasSubmitted}
                      />
                    </div>
                  ))}
              </div>

              {/* Frame 2 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F2</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={optimalAnswers[1][index]}
                          onChange={(e) => handleOptimalChange(1, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>

              {/* Frame 3 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F3</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 || index === 1 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={optimalAnswers[2][index]}
                          onChange={(e) => handleOptimalChange(2, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* LRU Table */}
          <div className="mb-4 flex">
            <div className="w-16 bg-[#0a3a8d] flex items-center justify-center">
              <span className="font-press-start-2p text-white transform -rotate-90 text-lg">LRU</span>
            </div>
            <div className="flex-1">
              {/* Reference String */}
              <div className="flex">
                <div className="w-16 bg-[#30c3dc] flex items-center justify-center">
                  <span className="font-press-start-2p text-white"></span>
                </div>
                {referenceString.map((num, index) => (
                  <div key={index} className="flex-1 bg-[#30c3dc] border border-gray-400 p-2 text-center">
                    <span className="font-press-start-2p text-white">{num}</span>
                  </div>
                ))}
              </div>

              {/* Frame 1 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F1</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      <input
                        type="text"
                        value={lruAnswers[0][index]}
                        onChange={(e) => handleLruChange(0, index, e.target.value)}
                        className="w-full bg-transparent text-center font-press-start-2p text-black"
                        maxLength={1}
                        disabled={hasSubmitted}
                      />
                    </div>
                  ))}
              </div>

              {/* Frame 2 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F2</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={lruAnswers[1][index]}
                          onChange={(e) => handleLruChange(1, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>

              {/* Frame 3 */}
              <div className="flex">
                <div className="w-16 bg-gray-400 flex items-center justify-center">
                  <span className="font-press-start-2p text-[#f0c048]">F3</span>
                </div>
                {Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <div key={index} className="flex-1 bg-gray-400 border border-gray-500 p-2 text-center">
                      {index === 0 || index === 1 ? (
                        <span className="font-press-start-2p text-black">-</span>
                      ) : (
                        <input
                          type="text"
                          value={lruAnswers[2][index]}
                          onChange={(e) => handleLruChange(2, index, e.target.value)}
                          className="w-full bg-transparent text-center font-press-start-2p text-black"
                          maxLength={1}
                          disabled={hasSubmitted}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Back button */}
          <div className="absolute top-4 left-4">
            <Link href="/games/page-replacement-assessment/app">
              <button className={`flex items-center font-pixelify-sans ${buttonClass}`}>
                <ArrowLeft className="mr-1" /> Back
              </button>
            </Link>
          </div>

          {/* Clear/Restart button */}
          <div className="absolute top-4 right-4">
            {hasSubmitted ? (
              <button onClick={restartGame} className={`flex items-center font-pixelify-sans ${buttonClass}`}>
                <RefreshCw className="mr-1" /> Restart
              </button>
            ) : (
              <button onClick={clearGame} className={`flex items-center font-pixelify-sans ${buttonClass}`}>
                <Trash2 className="mr-1" /> Clear
              </button>
            )}
          </div>

          {/* Submit button */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={handleSubmit}
              disabled={hasSubmitted}
              className={`flex items-center font-pixelify-sans ${buttonClass} ${hasSubmitted ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Check className="mr-1" /> Submit
            </button>
          </div>
        </div>
      </div>

      {/* Sound button */}
      <div className="fixed bottom-4 left-4 z-20">
        <button onClick={toggleSound} className={buttonClass}>
          {isSoundOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
        </button>
      </div>
    </div>
  )
}
