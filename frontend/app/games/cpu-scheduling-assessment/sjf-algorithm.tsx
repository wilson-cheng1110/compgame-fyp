"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Volume2, VolumeX, Trash2, Clock, Info, Check, RefreshCw } from "lucide-react"
import Image from "next/image"

// Define process types
interface Process {
  id: string
  name: string
  arrival: number
  burst: number
  completion?: number
  turnaround?: number
  waiting?: number
  response?: number
  imageUrl: string
}

// Define error types for feedback
type ErrorType = {
  numerical: boolean
  ganttChart: boolean
}

export default function SJFAlgorithm() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [processes, setProcesses] = useState<Process[]>([
    {
      id: "p1",
      name: "P1",
      arrival: 0,
      burst: 3,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SJF_A_P1-z5rpDkc9MHiGm0ADfWtdvaLQ8o0o7f.png",
    },
    {
      id: "p2",
      name: "P2",
      arrival: 0,
      burst: 4,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SJF_A_P2-M7NJHT9qCYk2BvJ5xkNhPlolulSs3R.png",
    },
    {
      id: "p3",
      name: "P3",
      arrival: 0,
      burst: 5,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SJF_A_P3-UNQwQOycwY7srHhnzLx9AQCjTGEVV1.png",
    },
    {
      id: "p4",
      name: "P4",
      arrival: 0,
      burst: 1,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SJF_A_P4-p6vwNec8DDVf5fkVOcIN7gJa21JRdn.png",
    },
  ])
  const [readyQueue, setReadyQueue] = useState<string[]>(["p1", "p2", "p3", "p4"])
  const [runningProcess, setRunningProcess] = useState<string | null>(null)
  const [finishedProcesses, setFinishedProcesses] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [ganttChart, setGanttChart] = useState<{ id: string; start: number; end: number }[]>([])
  const [draggedProcess, setDraggedProcess] = useState<string | null>(null)
  const [showTips, setShowTips] = useState(false) // Set to false to hide tips by default
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [userAnswers, setUserAnswers] = useState({
    p1: { completion: "", turnaround: "", waiting: "", response: "" },
    p2: { completion: "", turnaround: "", waiting: "", response: "" },
    p3: { completion: "", turnaround: "", waiting: "", response: "" },
    p4: { completion: "", turnaround: "", waiting: "", response: "" },
    avgResponse: "",
    avgTAT: "",
  })
  const [score, setScore] = useState<number | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType>({ numerical: false, ganttChart: false })

  // Correct answers based on the provided images
  const correctAnswers = {
    p1: { completion: "4", turnaround: "4", waiting: "1", response: "1" },
    p2: { completion: "8", turnaround: "8", waiting: "4", response: "4" },
    p3: { completion: "13", turnaround: "13", waiting: "8", response: "8" },
    p4: { completion: "1", turnaround: "1", waiting: "0", response: "0" },
    avgResponse: "3.25",
    avgTAT: "6.5",
  }

  // Correct Gantt Chart for SJF
  const correctGanttChart = [
    { id: "p4", start: 0, end: 1 },
    { id: "p1", start: 1, end: 4 },
    { id: "p2", start: 4, end: 8 },
    { id: "p3", start: 8, end: 13 },
  ]

  // Update the audio references
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const failureAudioRef = useRef<HTMLAudioElement | null>(null)
  const congratulationsAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements with the provided sound files
  useEffect(() => {
    successAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-2anS1LvOOg5gTNQVF45Yf4EJ2YGYai.mp3",
    )
    failureAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wrong-Hcickm3TRPRcCru6lvw74rbyypl6G4.mp3",
    )
    // Use the success sound for congratulations (same as correct answer sound)
    congratulationsAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-2anS1LvOOg5gTNQVF45Yf4EJ2YGYai.mp3",
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

  // Handle process drag start
  const handleDragStart = (processId: string) => {
    if (hasSubmitted) return
    setDraggedProcess(processId)
  }

  // Handle dropping process into running area
  const handleDropInRunning = () => {
    if (hasSubmitted) return
    if (!draggedProcess || runningProcess) return

    const processIndex = readyQueue.indexOf(draggedProcess)
    if (processIndex === -1) return

    // Move process to running
    const newReadyQueue = [...readyQueue]
    newReadyQueue.splice(processIndex, 1)
    setReadyQueue(newReadyQueue)
    setRunningProcess(draggedProcess)
    setDraggedProcess(null)

    // Add to Gantt chart
    const process = processes.find((p) => p.id === draggedProcess)
    if (process) {
      const startTime = Math.max(currentTime, process.arrival)
      const endTime = startTime + process.burst
      setGanttChart([...ganttChart, { id: draggedProcess, start: startTime, end: endTime }])

      // Schedule process completion
      setTimeout(() => {
        setRunningProcess(null)
        setFinishedProcesses([...finishedProcesses, draggedProcess])
        setCurrentTime(endTime)
      }, 2000) // 2 second delay to simulate process execution
    }
  }

  // Add 1 second idle time
  const addIdleTime = () => {
    if (hasSubmitted) return
    if (runningProcess) return

    const newTime = currentTime + 1
    setCurrentTime(newTime)

    // Add idle time to Gantt chart
    if (ganttChart.length > 0) {
      const lastGantt = ganttChart[ganttChart.length - 1]
      // Only add to Gantt if there's a gap (not continuous idle time)
      if (lastGantt.end === currentTime) {
        setGanttChart([...ganttChart, { id: "idle", start: currentTime, end: newTime }])
      }
    } else {
      // First entry in Gantt chart
      setGanttChart([{ id: "idle", start: currentTime, end: newTime }])
    }
  }

  // Handle input change for user answers
  const handleInputChange = (
    processId: string,
    field: "completion" | "turnaround" | "waiting" | "response",
    value: string,
  ) => {
    if (hasSubmitted) return

    // Only allow numbers and decimals
    if (!/^[0-9]*\.?[0-9]*$/.test(value) && value !== "") return

    setUserAnswers((prev) => {
      if (processId === "avg") {
        if (field === "response") {
          return { ...prev, avgResponse: value }
        } else if (field === "turnaround") {
          return { ...prev, avgTAT: value }
        }
        return prev
      }

      return {
        ...prev,
        [processId]: {
          ...prev[processId as keyof typeof prev],
          [field]: value,
        },
      }
    })
  }

  // Check if Gantt Chart is correct
  const isGanttChartCorrect = () => {
    // Filter out idle times from user's Gantt chart
    const userGantt = ganttChart.filter((item) => item.id !== "idle")

    // If lengths don't match, it's wrong
    if (userGantt.length !== correctGanttChart.length) {
      return false
    }

    // Check each entry
    for (let i = 0; i < correctGanttChart.length; i++) {
      if (
        userGantt[i].id !== correctGanttChart[i].id ||
        userGantt[i].start !== correctGanttChart[i].start ||
        userGantt[i].end !== correctGanttChart[i].end
      ) {
        return false
      }
    }

    return true
  }

  // Calculate score
  const calculateScore = () => {
    let points = 0
    let numericalError = false

    // Check process answers
    ;["p1", "p2", "p3", "p4"].forEach((pid) => {
      const process = pid as keyof typeof userAnswers
      const userAns = userAnswers[process]
      const correctAns = correctAnswers[process]

      if (userAns.completion === correctAns.completion) points++
      else numericalError = true

      if (userAns.turnaround === correctAns.turnaround) points++
      else numericalError = true

      if (userAns.waiting === correctAns.waiting) points++
      else numericalError = true

      if (userAns.response === correctAns.response) points++
      else numericalError = true
    })

    // Check average answers
    if (userAnswers.avgResponse === correctAnswers.avgResponse) points++
    else numericalError = true

    if (userAnswers.avgTAT === correctAnswers.avgTAT) points++
    else numericalError = true

    // Check Gantt Chart
    const ganttChartCorrect = isGanttChartCorrect()
    if (ganttChartCorrect) points++

    // Set error types for feedback
    setErrorType({
      numerical: numericalError,
      ganttChart: !ganttChartCorrect,
    })

    return points
  }

  // Handle submit
  const handleSubmit = () => {
    if (hasSubmitted) return

    setIsTimerRunning(false)
    const finalScore = calculateScore()
    setScore(finalScore)
    setHasSubmitted(true)

    // Play appropriate sound based on badge achievement
    if (isSoundOn) {
      try {
        if (finalScore >= 19) {
          // User gets a 5-star badge
          window.parent.postMessage(
            {
              type: "badgeAchieved",
              algorithm: "SJF",
              stars: 5,
            },
            "*",
          )

          if (congratulationsAudioRef.current) {
            congratulationsAudioRef.current.currentTime = 0
            congratulationsAudioRef.current.volume = 1.0
            congratulationsAudioRef.current
              .play()
              .catch((err) => console.error("Error playing congratulations sound:", err))
          }
        } else if (finalScore >= 16) {
          // User gets a 4-star badge
          window.parent.postMessage(
            {
              type: "badgeAchieved",
              algorithm: "SJF",
              stars: 4,
            },
            "*",
          )

          if (congratulationsAudioRef.current) {
            congratulationsAudioRef.current.currentTime = 0
            congratulationsAudioRef.current.volume = 1.0
            congratulationsAudioRef.current
              .play()
              .catch((err) => console.error("Error playing congratulations sound:", err))
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

  // Clear the game (during gameplay)
  const clearGame = () => {
    setReadyQueue(["p1", "p2", "p3", "p4"])
    setRunningProcess(null)
    setFinishedProcesses([])
    setCurrentTime(0)
    setGanttChart([])
    setUserAnswers({
      p1: { completion: "", turnaround: "", waiting: "", response: "" },
      p2: { completion: "", turnaround: "", waiting: "", response: "" },
      p3: { completion: "", turnaround: "", waiting: "", response: "" },
      p4: { completion: "", turnaround: "", waiting: "", response: "" },
      avgResponse: "",
      avgTAT: "",
    })
    // Don't reset the timer or submission state
  }

  // Restart the game (after submission)
  const restartGame = () => {
    clearGame()
    setTimeLeft(15 * 60) // Reset timer to 15 minutes
    setIsTimerRunning(true) // Start the timer again
    setScore(null)
    setHasSubmitted(false)
    setErrorType({ numerical: false, ganttChart: false })
  }

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  // Get error message based on error types
  const getErrorMessage = () => {
    let message = ""
    if (errorType.numerical && errorType.ganttChart) {
      message = "Both your numerical answers and Gantt Chart are incorrect."
    } else if (errorType.numerical) {
      message = "Your numerical answers are incorrect."
    } else if (errorType.ganttChart) {
      message = "Your Gantt Chart is incorrect."
    }

    return message
  }

  // Common button style class
  const buttonClass = "p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200 text-white"

  return (
    <div className="relative h-screen w-full overflow-auto">
      {/* Background Image - Fixed position */}
      <div className="fixed inset-0 z-0">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SJF_U_bg-KKMjcXOerjp97KyRbjyCo0j7mQAU3t.webp"
          alt="CPU Scheduling Game Background - Auto Repair Shop"
          fill
          priority
          className="object-cover"
        />
      </div>

      {/* Game Container - Centered with min-height and min-width to maintain proportions */}
      <div className="relative z-10 min-h-[800px] flex items-start justify-center p-4">
        <div className="border-4 border-[#441dbf] rounded-none bg-[#002b3c] w-full max-w-5xl p-4 min-w-[1000px]">
          {/* Title and Timer */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="col-span-1 bg-[#441dbf] p-4 rounded-none">
              <h1 className="font-pixelify-sans text-[#4cf190] text-xl md:text-2xl mb-2">
                Shortest Job First (SJF)
                <br />
                [Non-Preemptive]
              </h1>

              {/* Tips section - hidden by default */}
              <div className="mb-4">
                <button
                  onClick={() => setShowTips(!showTips)}
                  className="font-pixelify-sans text-white text-lg bg-blue-600 px-3 py-1 rounded-md flex items-center justify-center w-full mb-2"
                >
                  TIPS <Info className="ml-2 h-4 w-4" />
                </button>

                {showTips && (
                  <p className="font-pixelify-sans text-white text-sm md:text-base">
                    Choose the process with the shortest burst time first. If two processes have the same burst time,
                    follow their arrival order. Arrange the processes in the correct execution sequence based on SJF
                    scheduling.
                  </p>
                )}
              </div>

              {/* Score display after submission */}
              {hasSubmitted && score !== null && (
                <div className="mt-4 bg-black bg-opacity-70 p-3 rounded-md">
                  <p className={`font-pixelify-sans text-lg ${score >= 16 ? "text-green-500" : "text-red-500"}`}>
                    Score: {score}/19
                  </p>

                  {/* Error message based on what was wrong */}
                  {score < 19 && getErrorMessage() && (
                    <p className={`font-pixelify-sans text-sm mt-2 ${score >= 16 ? "text-green-500" : "text-red-500"}`}>
                      {getErrorMessage()}
                    </p>
                  )}

                  {score >= 19 ? (
                    <p className="font-pixelify-sans text-green-500 text-lg">You get a Five star badge!</p>
                  ) : score >= 16 ? (
                    <div>
                      <p className="font-pixelify-sans text-green-500 text-lg">You get a Four star badge!</p>
                      <p className="font-pixelify-sans text-green-500 text-lg">
                        Let's try again to get the five-star badge!
                      </p>
                    </div>
                  ) : (
                    <p className="font-pixelify-sans text-red-500 text-lg">Let's try again to get the badge!</p>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-3 bg-[#002b3c] border-2 border-[#441dbf] p-4 rounded-none">
              {/* Timer */}
              <div className="bg-black p-2 mb-4 rounded-none">
                <h2 className="font-pixelify-sans text-[#4cf190] text-center text-2xl">{formatTime(timeLeft)}</h2>
              </div>

              {/* Process Table with consistent column widths */}
              <div className="w-full">
                <table className="w-full text-white mb-4">
                  <thead>
                    <tr className="font-pixelify-sans text-[#4cf190]">
                      <th className="text-left p-2 w-1/7">Process</th>
                      <th className="text-left p-2 w-1/7">Burst</th>
                      <th className="text-left p-2 w-1/7">Arrival</th>
                      <th className="text-left p-2 w-1/7">Completion</th>
                      <th className="text-left p-2 w-1/7">TAT</th>
                      <th className="text-left p-2 w-1/7">Waiting</th>
                      <th className="text-left p-2 w-1/7">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((process) => (
                      <tr key={process.id} className="font-pixelify-sans">
                        <td className="p-2 w-1/7">
                          <span className="font-press-start-2p text-xs">{process.name}</span>
                        </td>
                        <td className="p-2 w-1/7">
                          <span className="font-press-start-2p text-xs">{process.burst}</span>
                        </td>
                        <td className="p-2 w-1/7">
                          <span className="font-press-start-2p text-xs">{process.arrival}</span>
                        </td>
                        <td className="p-2 w-1/7">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className="w-full bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                            value={userAnswers[process.id as keyof typeof userAnswers].completion}
                            onChange={(e) => handleInputChange(process.id, "completion", e.target.value)}
                            disabled={hasSubmitted}
                          />
                        </td>
                        <td className="p-2 w-1/7">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className="w-full bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                            value={userAnswers[process.id as keyof typeof userAnswers].turnaround}
                            onChange={(e) => handleInputChange(process.id, "turnaround", e.target.value)}
                            disabled={hasSubmitted}
                          />
                        </td>
                        <td className="p-2 w-1/7">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className="w-full bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                            value={userAnswers[process.id as keyof typeof userAnswers].waiting}
                            onChange={(e) => handleInputChange(process.id, "waiting", e.target.value)}
                            disabled={hasSubmitted}
                          />
                        </td>
                        <td className="p-2 w-1/7">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className="w-full bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                            value={userAnswers[process.id as keyof typeof userAnswers].response}
                            onChange={(e) => handleInputChange(process.id, "response", e.target.value)}
                            disabled={hasSubmitted}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Process Boxes */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Running Box - Now extends to match the bottom of the Finish box */}
            <div
              className={`col-span-1 bg-black border-2 border-[#441dbf] p-4 h-[307px] rounded-none relative ${hasSubmitted ? "pointer-events-none" : ""}`}
              onDragOver={(e) => {
                if (!hasSubmitted) e.preventDefault()
              }}
              onDrop={handleDropInRunning}
            >
              <div className="absolute top-0 left-0 bottom-0 w-10 bg-blue-500 flex items-center justify-center">
                <span className="font-pixelify-sans text-white text-sm transform -rotate-90">Running</span>
              </div>
              <div className="ml-10 h-full flex items-center justify-center">
                {runningProcess && (
                  <div className="relative w-24 h-36 transition-all duration-200 hover:scale-125 hover:z-10">
                    <Image
                      src={processes.find((p) => p.id === runningProcess)?.imageUrl || ""}
                      alt={`Process ${runningProcess}`}
                      fill
                      className="object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Ready and Finished Boxes */}
            <div className="col-span-2 grid grid-rows-2 gap-4">
              {/* Ready Box - Increased height */}
              <div
                className={`bg-black border-2 border-[#441dbf] p-4 rounded-none relative h-[150px] ${hasSubmitted ? "pointer-events-none" : ""}`}
              >
                <div className="absolute top-0 left-0 bottom-0 w-10 bg-orange-500 flex items-center justify-center">
                  <span className="font-pixelify-sans text-white text-sm transform -rotate-90">Ready</span>
                </div>
                <div className="ml-10 h-full flex items-center space-x-4">
                  {readyQueue.map((processId) => {
                    const process = processes.find((p) => p.id === processId)
                    if (!process) return null

                    return (
                      <div
                        key={processId}
                        className={`relative w-24 h-36 transition-all duration-200 hover:scale-150 hover:z-10 ${hasSubmitted ? "" : "cursor-move"}`}
                        draggable={!hasSubmitted}
                        onDragStart={() => handleDragStart(processId)}
                      >
                        <Image
                          src={process.imageUrl || "/placeholder.svg"}
                          alt={`Process ${process.name}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Finished Box - Kept at 142px */}
              <div className="bg-black border-2 border-[#441dbf] p-4 rounded-none relative h-[142px]">
                <div className="absolute top-0 left-0 bottom-0 w-10 bg-green-500 flex items-center justify-center">
                  <span className="font-pixelify-sans text-white text-sm transform -rotate-90">Finish</span>
                </div>
                <div className="ml-10 h-full flex items-center space-x-4">
                  {finishedProcesses.map((processId) => {
                    const process = processes.find((p) => p.id === processId)
                    if (!process) return null

                    return (
                      <div
                        key={processId}
                        className="relative w-24 h-36 transition-all duration-200 hover:scale-150 hover:z-10"
                      >
                        <Image
                          src={process.imageUrl || "/placeholder.svg"}
                          alt={`Process ${process.name}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Gantt Chart */}
          <div className="bg-black border-2 border-[#441dbf] p-4 mb-4 rounded-none relative">
            <div className="flex h-12 items-end">
              {ganttChart.map((item, index) => {
                const process = processes.find((p) => p.id === item.id)
                const width = (item.end - item.start) * 40 // Scale for visualization

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center"
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  >
                    <div
                      className={`h-8 w-full flex items-center justify-center text-white font-bold`}
                      style={{
                        backgroundColor:
                          item.id === "idle"
                            ? "#6b7280" // gray for idle time
                            : process?.id === "p1"
                              ? "#3b82f6"
                              : process?.id === "p2"
                                ? "#10b981"
                                : process?.id === "p3"
                                  ? "#ef4444"
                                  : "#f59e0b", // p4 color
                      }}
                    >
                      {item.id === "idle" ? (
                        "IDLE"
                      ) : (
                        <span className="font-press-start-2p text-xs">{process?.name}</span>
                      )}
                    </div>
                    <div className="flex w-full justify-between text-white text-xs">
                      {/* Only show start time if it's different from the previous block's end time */}
                      {index === 0 || ganttChart[index - 1].end !== item.start ? (
                        <span className="font-press-start-2p text-xs">{item.start}</span>
                      ) : (
                        <span className="opacity-0 font-press-start-2p text-xs">{item.start}</span> // Keep the element for spacing but make it invisible
                      )}
                      <span className="font-press-start-2p text-xs">{item.end}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add Idle Time Button */}
            <button
              onClick={addIdleTime}
              disabled={runningProcess !== null || hasSubmitted}
              className={`absolute top-2 right-2 ${buttonClass} ${runningProcess !== null || hasSubmitted ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Clock className="w-4 h-4 mr-1 inline" /> Add 1s Idle
            </button>

            {/* Current Time Display */}
            <div className="absolute bottom-2 right-2 text-white font-pixelify-sans text-sm">
              Current Time: <span className="font-press-start-2p text-xs">{currentTime}</span>
            </div>
          </div>

          {/* Calculations - Removed formulas as requested */}
          <div className="bg-black border-2 border-[#441dbf] p-4 rounded-none">
            <div className="font-pixelify-sans text-[#4cf190] text-sm space-y-2">
              {/* Removed the formula explanations */}

              <div className="flex items-center">
                <p className="mr-2">Average response time = </p>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="w-20 bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                  value={userAnswers.avgResponse}
                  onChange={(e) => handleInputChange("avg", "response", e.target.value)}
                  disabled={hasSubmitted}
                />
              </div>

              <div className="flex items-center">
                <p className="mr-2">Average TAT = </p>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  className="w-20 bg-[#002b3c] border border-[#441dbf] p-1 text-white font-press-start-2p text-xs"
                  value={userAnswers.avgTAT}
                  onChange={(e) => handleInputChange("avg", "turnaround", e.target.value)}
                  disabled={hasSubmitted}
                />
              </div>
            </div>
          </div>

          {/* Back button with blue background */}
          <div className="absolute top-4 left-4">
            <button
              onClick={() => {
                // Send message to parent window to navigate back
                window.parent.postMessage({ type: "navigate", path: "/games/cpu-scheduling-assessment" }, "*")
              }}
              className={`flex items-center font-pixelify-sans ${buttonClass}`}
            >
              <ArrowLeft className="mr-1" /> Back
            </button>
          </div>

          {/* Clear/Restart button with blue background */}
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

          {/* Sound button */}
          <div className="absolute bottom-4 left-4">
            <button onClick={toggleSound} className={buttonClass}>
              {isSoundOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
