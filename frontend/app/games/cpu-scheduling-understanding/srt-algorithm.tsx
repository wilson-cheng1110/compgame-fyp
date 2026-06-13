"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Volume2, VolumeX, RefreshCw, Clock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// Define process types
interface Process {
  id: string
  name: string
  arrival: number
  burst: number
  remainingTime: number
  completion?: number
  turnaround?: number
  waiting?: number
  response?: number
  firstResponse?: number
  imageUrl: string
}

export default function SRTAlgorithm() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [processes, setProcesses] = useState<Process[]>([
    {
      id: "p1",
      name: "P1",
      arrival: 0,
      burst: 5,
      remainingTime: 5,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SRT_U_P1-ZOnn5J8HRAJbrfkLJT2GYbFdeIEAP4.png",
    },
    {
      id: "p2",
      name: "P2",
      arrival: 1,
      burst: 3,
      remainingTime: 3,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SRT_U_P2-poY6V101d3dl3rwxIiEsGfV0mMlUFS.png",
    },
    {
      id: "p3",
      name: "P3",
      arrival: 2,
      burst: 4,
      remainingTime: 4,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SRT_U_P3-2xAVADKHk83sQxcWD41BZSoPI4V6PR.png",
    },
    {
      id: "p4",
      name: "P4",
      arrival: 4,
      burst: 1,
      remainingTime: 1,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SRT_U_P4-0B1TQ04Sfa622Q8byFOYp3cEEn8dXl.png",
    },
  ])
  const [readyQueue, setReadyQueue] = useState<string[]>(["p1", "p2", "p3", "p4"])
  const [runningProcess, setRunningProcess] = useState<string | null>(null)
  const [finishedProcesses, setFinishedProcesses] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [ganttChart, setGanttChart] = useState<{ id: string; start: number; end: number }[]>([])
  const [prompt, setPrompt] = useState("")
  const [gameCompleted, setGameCompleted] = useState(false)
  const [draggedProcess, setDraggedProcess] = useState<string | null>(null)

  // Update the audio references to include the congratulations sound
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const failureAudioRef = useRef<HTMLAudioElement | null>(null)
  const congratulationsAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements with the provided sound files
  useEffect(() => {
    successAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-2anS1LvOOg5gTNQVF45Yf4EJ2YGYai.mp3",
    ) // correct.mp3
    failureAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wrong-Hcickm3TRPRcCru6lvw74rbyypl6G4.mp3",
    ) // wrong.mp3
    congratulationsAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/success-3f9eTgCkzTnG4Bx45QYK3xM0sISD8F.mp3",
    ) // success.mp3 for congratulations
  }, [])


  // Calculate metrics when game is completed
  useEffect(() => {
    if (finishedProcesses.length === processes.length && !gameCompleted) {
      calculateMetrics()
      setGameCompleted(true)
      setPrompt("Congratulations!") // Set permanent congratulations message

      if (isSoundOn && congratulationsAudioRef.current) {
        congratulationsAudioRef.current
          .play()
          .catch((err) => console.error("Error playing congratulations sound:", err))
      }
    }
  }, [finishedProcesses, processes.length, gameCompleted, isSoundOn])

  // Calculate all metrics for processes
  const calculateMetrics = () => {
    const updatedProcesses = [...processes]
    let totalTurnaround = 0
    let totalWaiting = 0
    let totalResponse = 0

    // Calculate individual process metrics
    updatedProcesses.forEach((process) => {
      const processGantt = ganttChart.filter((g) => g.id === process.id)
      if (processGantt.length > 0) {
        const completion = processGantt[processGantt.length - 1].end
        const turnaround = completion - process.arrival
        const waiting = turnaround - process.burst
        const response = process.firstResponse !== undefined ? process.firstResponse - process.arrival : 0

        process.completion = completion
        process.turnaround = turnaround
        process.waiting = waiting
        process.response = response

        totalTurnaround += turnaround
        totalWaiting += waiting
        totalResponse += response
      }
    })

    setProcesses(updatedProcesses)
  }

  // Handle process drag start
  const handleDragStart = (processId: string) => {
    // Prevent drag if game is completed
    if (gameCompleted) return
    setDraggedProcess(processId)
  }

  // Handle dropping process into running area
  const handleDropInRunning = () => {
    // Prevent drop if game is completed
    if (gameCompleted) return
    if (!draggedProcess) return

    // If there's already a running process, don't allow a new process to be dropped
    if (runningProcess) {
      setPrompt("There's already a process running. Wait for it to complete or be preempted.")
      if (isSoundOn && failureAudioRef.current) {
        failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }
      return
    }

    const processIndex = readyQueue.indexOf(draggedProcess)
    if (processIndex === -1) return

    // Get the dragged process
    const draggedProcessObj = processes.find((p) => p.id === draggedProcess)
    if (!draggedProcessObj) return

    // Check if the process has arrived
    if (draggedProcessObj.arrival > currentTime) {
      setPrompt("Incorrect! This process hasn't arrived yet at the current time.")
      if (isSoundOn && failureAudioRef.current) {
        failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }
      return
    }

    // Check if this is the correct process to run next (SRT order)
    const availableProcesses = readyQueue.filter((pid) => {
      const process = processes.find((p) => p.id === pid)
      return process && process.arrival <= currentTime
    })

    if (availableProcesses.length === 0) {
      // No processes available at current time
      setPrompt("No processes are available at the current time.")
      if (isSoundOn && failureAudioRef.current) {
        failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }
      return
    }

    // Sort available processes by remaining time (SRT)
    availableProcesses.sort((a, b) => {
      const processA = processes.find((p) => p.id === a)
      const processB = processes.find((p) => p.id === b)

      // First compare by remaining time
      const remainingTimeDiff = (processA?.remainingTime || 0) - (processB?.remainingTime || 0)

      // If remaining times are equal, sort by process name (ascending)
      if (remainingTimeDiff === 0) {
        return (processA?.name || "").localeCompare(processB?.name || "")
      }

      return remainingTimeDiff
    })

    if (draggedProcess !== availableProcesses[0]) {
      setPrompt(
        "Incorrect! SRT selects the process with the shortest remaining time. If times are equal, choose the process with the lowest ID (P1 > P2 > P3 > P4). Try again!",
      )
      if (isSoundOn && failureAudioRef.current) {
        failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }
      return
    }

    // Process is correct, move it to running
    const newReadyQueue = [...readyQueue]
    newReadyQueue.splice(processIndex, 1)
    setReadyQueue(newReadyQueue)

    setRunningProcess(draggedProcess)
    setDraggedProcess(null)
    setPrompt("")

    // Play success sound for correct action
    if (isSoundOn && successAudioRef.current) {
      successAudioRef.current.play().catch((err) => console.error("Error playing success sound:", err))
    }

    // Add to Gantt chart
    const process = processes.find((p) => p.id === draggedProcess)
    if (process) {
      // Update first response time if this is the first time the process is running
      const updatedProcesses = [...processes]
      const processIndex = updatedProcesses.findIndex((p) => p.id === draggedProcess)

      if (processIndex !== -1 && updatedProcesses[processIndex].firstResponse === undefined) {
        updatedProcesses[processIndex].firstResponse = currentTime
        setProcesses(updatedProcesses)
      }

      // Add to Gantt chart
      const startTime = currentTime
      const endTime = startTime + 1 // In SRT, we process for 1 time unit at a time
      setGanttChart([...ganttChart, { id: draggedProcess, start: startTime, end: endTime }])

      // Update remaining time
      const updatedProcesses2 = [...updatedProcesses]
      const processIndex2 = updatedProcesses2.findIndex((p) => p.id === draggedProcess)

      if (processIndex2 !== -1) {
        updatedProcesses2[processIndex2].remainingTime -= 1
        setProcesses(updatedProcesses2)
      }

      // Schedule process completion or next time step
      setTimeout(() => {
        // Check if the process is completed
        if (updatedProcesses2[processIndex2].remainingTime <= 0) {
          setRunningProcess(null)
          setFinishedProcesses([...finishedProcesses, draggedProcess])
        } else {
          // Process is not completed, return it to the ready queue
          setRunningProcess(null)
          setReadyQueue([...newReadyQueue, draggedProcess])

          // Check if preemption should occur at the next time step
          const nextTime = currentTime + 1
          const newArrivingProcesses = processes.filter(
            (p) => p.arrival === nextTime && !finishedProcesses.includes(p.id) && p.id !== draggedProcess,
          )

          // Check if any of the new arriving processes have shorter remaining time
          const shouldPreempt = newArrivingProcesses.some(
            (p) => p.remainingTime < updatedProcesses2[processIndex2].remainingTime,
          )

          if (shouldPreempt) {
            setPrompt(
              "A new process with shorter remaining time has arrived. Choose the process with the shortest remaining time.",
            )
          } else {
            // Check if any process in the ready queue now has shorter remaining time
            const readyQueueProcesses = processes.filter(
              (p) =>
                newReadyQueue.includes(p.id) &&
                p.arrival <= nextTime &&
                p.remainingTime < updatedProcesses2[processIndex2].remainingTime,
            )

            if (readyQueueProcesses.length > 0) {
              setPrompt(
                "A process in the ready queue now has shorter remaining time. Choose the process with the shortest remaining time.",
              )
            }
          }
        }

        setCurrentTime(currentTime + 1)
      }, 2000) // 2 second delay to simulate process execution
    }
  }

  // Add 1 second idle time
  const addIdleTime = () => {
    // Prevent adding idle time if game is completed or there's a running process
    if (gameCompleted || runningProcess) return

    // Check if there are any processes available to run at the current time
    const availableProcesses = readyQueue.filter((pid) => {
      const process = processes.find((p) => p.id === pid)
      return process && process.arrival <= currentTime
    })

    // If there are processes available, adding idle time is incorrect
    if (availableProcesses.length > 0) {
      setPrompt("Incorrect! There are processes available to run. No need for idle time.")
      if (isSoundOn && failureAudioRef.current) {
        failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }
      return
    }

    // If we get here, adding idle time is correct
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

    setPrompt(`Added 1 second idle time. Current time: ${newTime}`)

    // Play success sound for correct idle time addition
    if (isSoundOn && successAudioRef.current) {
      successAudioRef.current.play().catch((err) => console.error("Error playing success sound:", err))
    }

    // Check if any new processes arrive at the new time
    const newArrivingProcesses = processes.filter((p) => p.arrival === newTime && !finishedProcesses.includes(p.id))

    if (newArrivingProcesses.length > 0) {
      setPrompt(`Added 1 second idle time. New process(es) arrived at time ${newTime}.`)
    }
  }

  // Restart the game
  const restartGame = () => {
    // Reset all processes to their initial state
    const resetProcesses = processes.map((process) => ({
      ...process,
      remainingTime: process.burst,
      completion: undefined,
      turnaround: undefined,
      waiting: undefined,
      response: undefined,
      firstResponse: undefined,
    }))

    setProcesses(resetProcesses)
    setReadyQueue(["p1", "p2", "p3", "p4"])
    setRunningProcess(null)
    setFinishedProcesses([])
    setCurrentTime(0)
    setGanttChart([])
    setPrompt("")
    setGameCompleted(false)
  }

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  // Common button style class
  const buttonClass = "p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200 text-white"

  return (
    <div className="relative h-screen w-full overflow-auto">
      {/* Background Image - Fixed position */}
      <div className="fixed inset-0 z-0">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SRT_U_bg-J1oupoi0hlXSqNllz8ItZJPjcUOmzT.webp"
          alt="CPU Scheduling Game Background - Hospital Room"
          fill
          priority
          className="object-cover"
        />
      </div>

      {/* Game Container - Centered with min-height and min-width to maintain proportions */}
      <div className="relative z-10 min-h-[800px] flex items-start justify-center p-4">
        <div className="border-4 border-[#441dbf] rounded-none bg-[#002b3c] w-full max-w-5xl p-4 min-w-[1000px]">
          {/* Title and Instructions */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="col-span-1 bg-[#441dbf] p-4 rounded-none">
              <h1 className="font-pixelify-sans text-[#4cf190] text-xl md:text-2xl mb-2">
                Shortest Remaining Time (SRT)
                <br />
                [Preemptive]
              </h1>
              <p className="font-pixelify-sans text-white text-sm md:text-base">
                At each time step, select the process with the shortest remaining burst time. If a new process arrives
                with a shorter burst time, preempt the current process. Adjust the execution order dynamically to follow
                SRT rules.
              </p>
            </div>

            <div className="col-span-3 bg-[#002b3c] border-2 border-[#441dbf] p-4 rounded-none">
              <div className="bg-black p-2 mb-4 rounded-none">
                <h2 className="font-pixelify-sans text-[#4cf190] text-lg">Prompt:</h2>
                <p
                  className={`font-pixelify-sans text-sm md:text-base ${gameCompleted ? "text-[#4cf190] font-bold text-lg" : "text-white"}`}
                >
                  {prompt ||
                    "Drag the process with the shortest remaining time. If times are equal, choose the process with the lowest ID (P1 > P2 > P3 > P4)."}
                </p>
              </div>

              {/* Process Table with consistent column widths */}
              <div className="w-full">
                <table className="w-full text-white mb-4">
                  <thead>
                    <tr className="font-pixelify-sans text-[#4cf190]">
                      <th className="text-left p-2 w-1/7">Process</th>
                      <th className="text-left p-2 w-1/7">Burst</th>
                      <th className="text-left p-2 w-1/7">Arrival</th>
                      {gameCompleted ? (
                        <>
                          <th className="text-left p-2 w-1/7">Completion</th>
                          <th className="text-left p-2 w-1/7">TAT</th>
                          <th className="text-left p-2 w-1/7">Waiting</th>
                          <th className="text-left p-2 w-1/7">Response</th>
                        </>
                      ) : (
                        // Placeholder empty columns to maintain layout
                        <>
                          <th className="text-left p-2 w-1/7 opacity-0">Completion</th>
                          <th className="text-left p-2 w-1/7 opacity-0">TAT</th>
                          <th className="text-left p-2 w-1/7 opacity-0">Waiting</th>
                          <th className="text-left p-2 w-1/7 opacity-0">Response</th>
                        </>
                      )}
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
                        {gameCompleted ? (
                          <>
                            <td className="p-2 w-1/7">
                              <span className="font-press-start-2p text-xs">{process.completion}</span>
                            </td>
                            <td className="p-2 w-1/7">
                              <span className="font-press-start-2p text-xs">{process.turnaround}</span>
                            </td>
                            <td className="p-2 w-1/7">
                              <span className="font-press-start-2p text-xs">{process.waiting}</span>
                            </td>
                            <td className="p-2 w-1/7">
                              <span className="font-press-start-2p text-xs">{process.response}</span>
                            </td>
                          </>
                        ) : (
                          // Placeholder empty cells to maintain layout
                          <>
                            <td className="p-2 w-1/7"></td>
                            <td className="p-2 w-1/7"></td>
                            <td className="p-2 w-1/7"></td>
                            <td className="p-2 w-1/7"></td>
                          </>
                        )}
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
              className={`col-span-1 bg-black border-2 border-[#441dbf] p-4 h-[307px] rounded-none relative ${gameCompleted ? "pointer-events-none" : ""}`}
              onDragOver={(e) => {
                if (!gameCompleted) e.preventDefault()
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
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs text-center">
                      RT: {processes.find((p) => p.id === runningProcess)?.remainingTime}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ready and Finished Boxes */}
            <div className="col-span-2 grid grid-rows-2 gap-4">
              {/* Ready Box - Increased height */}
              <div
                className={`bg-black border-2 border-[#441dbf] p-4 rounded-none relative h-[150px] ${gameCompleted ? "pointer-events-none" : ""}`}
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
                        className={`relative w-24 h-36 transition-all duration-200 hover:scale-150 hover:z-10 ${gameCompleted ? "" : "cursor-move"}`}
                        draggable={!gameCompleted}
                        onDragStart={() => handleDragStart(processId)}
                      >
                        <Image
                          src={process.imageUrl || "/placeholder.svg"}
                          alt={`Process ${process.name}`}
                          fill
                          className="object-contain"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs text-center">
                          RT: {process.remainingTime}
                        </div>
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
                                  : "#f59e0b",
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
              disabled={runningProcess !== null || gameCompleted}
              className={`absolute top-2 right-2 ${buttonClass} ${runningProcess !== null || gameCompleted ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Clock className="w-4 h-4 mr-1 inline" /> Add 1s Idle
            </button>

            {/* Current Time Display */}
            <div className="absolute bottom-2 right-2 text-white font-pixelify-sans text-sm">
              Current Time: <span className="font-press-start-2p text-xs">{currentTime}</span>
            </div>
          </div>

          {/* Calculations */}
          <div className="bg-black border-2 border-[#441dbf] p-4 rounded-none">
            <div className="font-pixelify-sans text-[#4cf190] text-sm space-y-2">
              <p>Turn Around Time (TAT) = Completion Time - Arrival Time</p>
              <p>Waiting Time = TAT - Burst Time</p>
              <p>Response Time = Time to get first response from CPU - Arrival Time</p>
              {gameCompleted && (
                <>
                  <p>
                    Average response time = Total response time / number of processes ={" "}
                    <span className="font-press-start-2p text-xs">
                      {(processes.reduce((sum, p) => sum + (p.response || 0), 0) / processes.length).toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Average TAT = Total TAT / number of processes ={" "}
                    <span className="font-press-start-2p text-xs">
                      {(processes.reduce((sum, p) => sum + (p.turnaround || 0), 0) / processes.length).toFixed(2)}
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Back button with blue background */}
          <div className="absolute top-4 left-4">
            <Link href="/games/cpu-scheduling-understanding">
              <button className={`flex items-center font-pixelify-sans ${buttonClass}`}>
                <ArrowLeft className="mr-1" /> Back
              </button>
            </Link>
          </div>

          {/* Restart button with blue background */}
          <div className="absolute top-4 right-4">
            <button onClick={restartGame} className={`flex items-center font-pixelify-sans ${buttonClass}`}>
              <RefreshCw className="mr-1" /> Restart
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
