"use client"

import type React from "react"

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

export default function RRAlgorithm() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [timeQuantum] = useState(2) // Fixed time quantum for RR
  const [processes, setProcesses] = useState<Process[]>([
    {
      id: "p1",
      name: "P1",
      arrival: 0,
      burst: 5,
      remainingTime: 5,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RR_U_P1-ayO9NstN7M7T1kxyXReLSdQ8HfFD5o.png",
    },
    {
      id: "p2",
      name: "P2",
      arrival: 1,
      burst: 4,
      remainingTime: 4,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RR_U_P2-HrYUwUSpyQ6eJ16jPrmpnTGYOEHGOA.png",
    },
    {
      id: "p3",
      name: "P3",
      arrival: 2,
      burst: 2,
      remainingTime: 2,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RR_U_P3-waSgHd6yFzHusz5jPXYILKtsioF5oj.png",
    },
    {
      id: "p4",
      name: "P4",
      arrival: 4,
      burst: 1,
      remainingTime: 1,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RR_U_P4-jVPCd3M6G80KK69yhhkYfyXj5n87Q6.png",
    },
  ])

  // Initial state setup
  const [readyQueue, setReadyQueue] = useState<string[]>(["p1", "p2", "p3", "p4"])
  const [runningProcess, setRunningProcess] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [prompt, setPrompt] = useState("Drag the next process according to Round Robin scheduling.")
  const [draggedProcess, setDraggedProcess] = useState<string | null>(null)
  const [ganttReadyQueue, setGanttReadyQueue] = useState<string[]>([])
  const [ganttRunningProcess, setGanttRunningProcess] = useState<string | null>(null)
  const [processesRun, setProcessesRun] = useState<string[]>([])
  const [ganttChart, setGanttChart] = useState<{ id: string; start: number; end: number }[]>([])
  const [gameStep, setGameStep] = useState(0)
  const [p1RunCount, setP1RunCount] = useState(0)
  const [p2RunCount, setP2RunCount] = useState(0)
  const [gameCompleted, setGameCompleted] = useState(false)

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
    congratulationsAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/success-3f9eTgCkzTnG4Bx45QYK3xM0sISD8F.mp3",
    ) // success.mp3 for congratulations
  }, [])


  // Calculate metrics when game is completed
  useEffect(() => {
    if (gameStep === 7 && !gameCompleted) {
      calculateMetrics()
      setGameCompleted(true)
      setPrompt("Congratulation!")

      if (isSoundOn) {
        // Play the congratulations sound instead of the success sound
        if (congratulationsAudioRef.current) {
          congratulationsAudioRef.current
            .play()
            .catch((err) => console.error("Error playing congratulations sound:", err))
        }
      }
    }
  }, [gameStep, gameCompleted, isSoundOn])

  // Calculate all metrics for processes
  const calculateMetrics = () => {
    const updatedProcesses = [...processes]
    let totalTurnaround = 0
    let totalWaiting = 0
    let totalResponse = 0

    // Set completion times based on Gantt chart
    updatedProcesses.forEach((process) => {
      // Find the last occurrence of this process in the Gantt chart
      const processGanttEntries = ganttChart.filter((entry) => entry.id === process.id)
      if (processGanttEntries.length > 0) {
        const lastEntry = processGanttEntries[processGanttEntries.length - 1]
        process.completion = lastEntry.end

        // Find the first occurrence for response time
        const firstEntry = processGanttEntries[0]
        process.firstResponse = firstEntry.start

        // Calculate turnaround, waiting, and response times
        process.turnaround = process.completion - process.arrival
        process.waiting = process.turnaround - process.burst
        process.response = process.firstResponse - process.arrival

        // Add to totals
        totalTurnaround += process.turnaround
        totalWaiting += process.waiting
        totalResponse += process.response
      }
    })

    setProcesses(updatedProcesses)
  }

  // Handle process drag start
  const handleDragStart = (processId: string) => {
    setDraggedProcess(processId)
  }

  // Handle dropping process into running area
  const handleDropInRunning = (e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedProcess) return
    if (runningProcess) return // Don't allow dropping if there's already a process running
    if (gameCompleted) return // Don't allow dropping if game is completed

    // Game step 0: Only P1 can be dragged to running at time 0
    if (gameStep === 0) {
      if (draggedProcess !== "p1") {
        setPrompt("Incorrect! Only P1 can run at time 0 because it's the only process that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P1 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p1")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p1")
      setGanttRunningProcess("p1")

      // Update Gantt Chart Ready Queue to show P1, P2, P3, P1
      setGanttReadyQueue(["p1", "p2", "p3", "p1"])

      setPrompt("Correct! P1 is now running for its time quantum (2 units).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([{ id: "p1", start: 0, end: 2 }])

      // Automatically move P1 back to Ready after 2 seconds (simulating time quantum)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p1Index = updatedProcesses.findIndex((p) => p.id === "p1")
        if (p1Index !== -1) {
          updatedProcesses[p1Index].remainingTime -= timeQuantum
          setProcesses(updatedProcesses)
        }

        // Move P1 back to ready queue and mark it as run
        setRunningProcess(null)
        setReadyQueue([...newReadyQueue, "p1"])
        setProcessesRun([...processesRun, "p1"])
        setCurrentTime(2) // Update current time to 2
        setP1RunCount(1) // P1 has run once

        setPrompt("P1 has used its time quantum and returned to the ready queue. Now P2 should run next.")
        setGameStep(1) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Game step 1: Only P2 can be dragged to running at time 2
    else if (gameStep === 1) {
      if (draggedProcess !== "p2") {
        setPrompt("Incorrect! P2 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P2 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p2")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p2")

      // Update Gantt Chart Ready Queue to show P1, P2, P3, P1, P4, P2
      setGanttReadyQueue(["p1", "p2", "p3", "p1", "p4", "p2"])

      setPrompt("Correct! P2 is now running for its time quantum (2 units).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p2", start: 2, end: 4 }])

      // Automatically move P2 back to Ready after 2 seconds (simulating time quantum)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p2Index = updatedProcesses.findIndex((p) => p.id === "p2")
        if (p2Index !== -1) {
          updatedProcesses[p2Index].remainingTime -= timeQuantum
          setProcesses(updatedProcesses)
        }

        // At time 4, P4 arrives, so add it to the ready queue
        // Also, P2 still has remaining time, so add it back to the tail of the ready queue
        setRunningProcess(null)

        // Make sure P4 is in the ready queue (it might already be there from initial setup)
        let updatedReadyQueue = [...newReadyQueue]
        if (!updatedReadyQueue.includes("p4")) {
          updatedReadyQueue = [...updatedReadyQueue, "p4"]
        }

        // Add P2 to the tail of the ready queue
        updatedReadyQueue = [...updatedReadyQueue, "p2"]

        setReadyQueue(updatedReadyQueue)
        setProcessesRun([...processesRun, "p2"])
        setCurrentTime(4) // Update current time to 4
        setP2RunCount(1) // P2 has run once

        setPrompt(
          "P2 has used its time quantum and returned to the ready queue. P4 has arrived at time 4. Now P3 should run next.",
        )
        setGameStep(2) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Game step 2: Only P3 can be dragged to running at time 4
    else if (gameStep === 2) {
      if (draggedProcess !== "p3") {
        setPrompt("Incorrect! P3 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P3 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p3")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p3")

      setPrompt("Correct! P3 is now running for its time quantum (2 units).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p3", start: 4, end: 6 }])

      // Automatically move P3 to Finished after 2 seconds (simulating time quantum)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p3Index = updatedProcesses.findIndex((p) => p.id === "p3")
        if (p3Index !== -1) {
          updatedProcesses[p3Index].remainingTime -= timeQuantum
          setProcesses(updatedProcesses)
        }

        // P3 is completed (remainingTime = 0), so move it to Finished instead of back to Ready
        setRunningProcess(null)
        setProcessesRun([...processesRun, "p3"])
        setCurrentTime(6) // Update current time to 6

        setPrompt("P3 has completed execution and moved to the Finish box. Now P1 should run next.")
        setGameStep(3) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Game step 3: Only P1 can be dragged to running at time 6
    else if (gameStep === 3) {
      if (draggedProcess !== "p1") {
        setPrompt("Incorrect! P1 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P1 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p1")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p1")

      // Update Gantt Chart Ready Queue to show P1, P2, P3, P1, P4, P2, P1
      setGanttReadyQueue(["p1", "p2", "p3", "p1", "p4", "p2", "p1"])

      setPrompt("Correct! P1 is now running for its time quantum (2 units).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p1", start: 6, end: 8 }])

      // Automatically move P1 back to Ready after 2 seconds (simulating time quantum)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p1Index = updatedProcesses.findIndex((p) => p.id === "p1")
        if (p1Index !== -1) {
          updatedProcesses[p1Index].remainingTime -= timeQuantum
          setProcesses(updatedProcesses)
        }

        // Check if P1 still has remaining time
        const p1 = updatedProcesses[p1Index]

        if (p1.remainingTime > 0) {
          // P1 still has remaining time, so add it back to the tail of the ready queue
          setRunningProcess(null)
          setReadyQueue([...newReadyQueue, "p1"])
          setProcessesRun([...processesRun, "p1"])
        } else {
          // P1 is completed, so don't add it back to the ready queue
          setRunningProcess(null)
          setProcessesRun([...processesRun, "p1"])
        }

        setCurrentTime(8) // Update current time to 8
        setP1RunCount(2) // P1 has run twice

        setPrompt("P1 has used its time quantum and returned to the ready queue. Now P4 should run next.")
        setGameStep(4) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Game step 4: Only P4 can be dragged to running at time 8
    else if (gameStep === 4) {
      if (draggedProcess !== "p4") {
        setPrompt("Incorrect! P4 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P4 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p4")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p4")

      setPrompt("Correct! P4 is now running for 1 time unit (its burst time).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p4", start: 8, end: 9 }])

      // Automatically move P4 to Finished after 1 second (its burst time)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p4Index = updatedProcesses.findIndex((p) => p.id === "p4")
        if (p4Index !== -1) {
          updatedProcesses[p4Index].remainingTime -= 1 // P4 only has 1 time unit
          setProcesses(updatedProcesses)
        }

        // P4 is completed (remainingTime = 0), so move it to Finished
        setRunningProcess(null)
        setProcessesRun([...processesRun, "p4"])
        setCurrentTime(9) // Update current time to 9

        setPrompt("P4 has completed execution and moved to the Finish box. Now P2 should run next.")
        setGameStep(5) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Game step 5: Only P2 can be dragged to running at time 9
    else if (gameStep === 5) {
      if (draggedProcess !== "p2") {
        setPrompt("Incorrect! P2 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P2 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p2")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p2")

      setPrompt("Correct! P2 is now running for its time quantum (2 units).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p2", start: 9, end: 11 }])

      // Automatically move P2 back to Ready after 2 seconds (simulating time quantum)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p2Index = updatedProcesses.findIndex((p) => p.id === "p2")
        if (p2Index !== -1) {
          updatedProcesses[p2Index].remainingTime -= timeQuantum
          setProcesses(updatedProcesses)
        }

        // Check if P2 still has remaining time
        const p2 = updatedProcesses[p2Index]

        if (p2.remainingTime > 0) {
          // P2 still has remaining time, so add it back to the tail of the ready queue
          setRunningProcess(null)
          setReadyQueue([...newReadyQueue, "p2"])
          setProcessesRun([...processesRun, "p2"])
        } else {
          // P2 is completed, so don't add it back to the ready queue
          setRunningProcess(null)
          setProcessesRun([...processesRun, "p2"])
        }

        setCurrentTime(11) // Update current time to 11
        setP2RunCount(2) // P2 has run twice

        setPrompt("P2 has used its time quantum and returned to the ready queue. Now P1 should run next.")
        setGameStep(6) // Move to next step
      }, 3000) // 3 seconds to give visual feedback
    }
    // Add game step 6 implementation after the game step 5 code block
    // Game step 6: Only P1 can be dragged to running at time 11
    else if (gameStep === 6) {
      if (draggedProcess !== "p1") {
        setPrompt("Incorrect! P1 should run next because it's the first process in the ready queue that has arrived.")
        if (isSoundOn && failureAudioRef.current) {
          failureAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
        }
        return
      }

      // Move P1 to running
      const newReadyQueue = readyQueue.filter((id) => id !== "p1")
      setReadyQueue(newReadyQueue)
      setRunningProcess("p1")

      setPrompt("Correct! P1 is now running for its remaining time (1 unit).")

      if (isSoundOn && successAudioRef.current) {
        successAudioRef.current.play().catch((err) => console.error("Error playing sound:", err))
      }

      // Add to Gantt chart
      setGanttChart([...ganttChart, { id: "p1", start: 11, end: 12 }])

      // Automatically move P1 to Finished after 1 second (its remaining time)
      setTimeout(() => {
        // Update the process remaining time
        const updatedProcesses = [...processes]
        const p1Index = updatedProcesses.findIndex((p) => p.id === "p1")
        if (p1Index !== -1) {
          updatedProcesses[p1Index].remainingTime -= 1 // P1 only has 1 time unit left
          setProcesses(updatedProcesses)
        }

        // P1 is completed (remainingTime = 0), so move it to Finished
        setRunningProcess(null)
        setProcessesRun([...processesRun, "p1"])
        setCurrentTime(12) // Update current time to 12
        setP1RunCount(3) // P1 has run three times

        setPrompt("P1 has completed execution and moved to the Finish box. All processes have completed execution!")
        setGameStep(7) // Move to next step (game completed)
      }, 3000) // 3 seconds to give visual feedback
    }
  }

  // Add 1 second idle time
  const addIdleTime = () => {
    // Prevent adding idle time if there's a running process or game is completed
    if (runningProcess || gameCompleted) return

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

    // Check if any new processes arrive at the new time
    const newArrivingProcesses = processes.filter((p) => p.arrival === newTime && p.remainingTime > 0)

    if (newArrivingProcesses.length > 0) {
      setPrompt(`Added 1 second idle time. New process(es) arrived at time ${newTime}.`)
    }
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
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
    setCurrentTime(0)
    setGanttChart([])
    setGanttReadyQueue([])
    setGanttRunningProcess(null)
    setProcessesRun([])
    setPrompt("Drag the next process according to Round Robin scheduling.")
    setGameStep(0)
    setP1RunCount(0)
    setP2RunCount(0)
    setGameCompleted(false)
  }

  // Calculate average metrics
  const calculateAverageMetrics = () => {
    const totalResponse = processes.reduce((sum, p) => sum + (p.response || 0), 0)
    const totalTurnaround = processes.reduce((sum, p) => sum + (p.turnaround || 0), 0)

    const avgResponse = totalResponse / processes.length
    const avgTurnaround = totalTurnaround / processes.length

    return { avgResponse, avgTurnaround }
  }

  // Common button style class
  const buttonClass = "p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200 text-white"

  // Get average metrics
  const { avgResponse, avgTurnaround } = calculateAverageMetrics()

  return (
    <div className="relative h-screen w-full overflow-auto">
      {/* Background Image - Fixed position */}
      <div className="fixed inset-0 z-0">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RR_U_bg-srwibhFvHwq48lXc0JpuLwcguzvBxd.webp"
          alt="CPU Scheduling Game Background - Computer Lab"
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
                Round Robin (RR)
                <br />
                [Preemptive]
              </h1>
              <p className="font-pixelify-sans text-white text-sm md:text-base">
                Each process gets a fixed time slice (quantum: q). After using its time slice, a process moves to the
                back of the queue if it is not yet completed. Arrange the processes in the correct execution order based
                on Round Robin scheduling.
              </p>
            </div>

            <div className="col-span-3 bg-[#002b3c] border-2 border-[#441dbf] p-4 rounded-none">
              <div className="bg-black p-2 mb-4 rounded-none">
                <h2 className="font-pixelify-sans text-[#4cf190] text-lg">Prompt:</h2>
                <p
                  className={`font-pixelify-sans text-sm md:text-base text-white ${gameCompleted ? "text-[#4cf190] font-bold" : ""}`}
                >
                  {prompt}
                </p>
              </div>

              {/* Process Table with consistent column widths */}
              <div className="w-full">
                <table className="w-full text-white mb-4">
                  <thead>
                    <tr className="font-pixelify-sans text-[#4cf190]">
                      <th className="text-left p-2">Given: q = {timeQuantum}</th>
                      <th className="text-left p-2"></th>
                      <th className="text-left p-2"></th>
                      {gameCompleted && (
                        <>
                          <th className="text-left p-2"></th>
                          <th className="text-left p-2"></th>
                          <th className="text-left p-2"></th>
                          <th className="text-left p-2"></th>
                        </>
                      )}
                    </tr>
                    <tr className="font-pixelify-sans text-[#4cf190]">
                      <th className="text-left p-2 w-1/7">Process</th>
                      <th className="text-left p-2 w-1/7">Burst</th>
                      <th className="text-left p-2 w-1/7">Arrival</th>
                      {gameCompleted && (
                        <>
                          <th className="text-left p-2 w-1/7">Completion</th>
                          <th className="text-left p-2 w-1/7">TAT</th>
                          <th className="text-left p-2 w-1/7">Waiting</th>
                          <th className="text-left p-2 w-1/7">Response</th>
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
                        {gameCompleted && (
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
            {/* Left Column: Running Box */}
            <div
              className="col-span-1 bg-black border-2 border-[#441dbf] p-4 h-[307px] rounded-none relative"
              onDragOver={handleDragOver}
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
                      A: {processes.find((p) => p.id === runningProcess)?.arrival}
                      <br />
                      B: {processes.find((p) => p.id === runningProcess)?.remainingTime}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Ready and Finished Boxes */}
            <div className="col-span-2 grid grid-rows-2 gap-4">
              {/* Ready Box */}
              <div className="bg-black border-2 border-[#441dbf] p-4 rounded-none relative h-[150px]">
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
                        className="relative w-24 h-36 transition-all duration-200 hover:scale-150 hover:z-10 cursor-move"
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
                          A: {process.arrival}
                          <br />
                          B: {process.remainingTime}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Finished Box */}
              <div className="bg-black border-2 border-[#441dbf] p-4 rounded-none relative h-[142px]">
                <div className="absolute top-0 left-0 bottom-0 w-10 bg-green-500 flex items-center justify-center">
                  <span className="font-pixelify-sans text-white text-sm transform -rotate-90">Finish</span>
                </div>
                <div className="ml-10 h-full flex items-center space-x-4">
                  {processes
                    .filter((p) => p.remainingTime <= 0)
                    .map((process) => (
                      <div
                        key={process.id}
                        className="relative w-24 h-36 transition-all duration-200 hover:scale-150 hover:z-10"
                      >
                        <Image
                          src={process.imageUrl || "/placeholder.svg"}
                          alt={`Process ${process.name}`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Gantt Chart */}
          <div className="bg-black border-2 border-[#441dbf] p-4 mb-4 rounded-none relative">
            {/* Ready Queue in Gantt Chart */}
            <div className="mb-4">
              <div className="flex items-center">
                <span className="font-pixelify-sans text-[#4cf190] text-sm mr-2">Ready</span>
                <div className="flex">
                  {ganttReadyQueue.map((processId, index) => {
                    const process = processes.find((p) => p.id === processId)
                    if (!process) return null

                    // Apply 50% opacity to the FIRST P1 in the Ready Queue only after it has run
                    const isFirstP1 = processId === "p1" && index === ganttReadyQueue.indexOf("p1") && p1RunCount >= 1

                    // Apply 50% opacity to the SECOND P1 in the Ready Queue only after it has run twice
                    const isSecondP1 =
                      processId === "p1" &&
                      index === ganttReadyQueue.indexOf("p1", ganttReadyQueue.indexOf("p1") + 1) &&
                      p1RunCount >= 2

                    // Apply 50% opacity to the THIRD P1 in the Ready Queue only after it has run three times
                    const isThirdP1 =
                      processId === "p1" &&
                      index ===
                        ganttReadyQueue.indexOf(
                          "p1",
                          ganttReadyQueue.indexOf("p1", ganttReadyQueue.indexOf("p1") + 1) + 1,
                        ) &&
                      p1RunCount >= 3

                    // Apply 50% opacity to the FIRST P2 in the Ready Queue (the one that has already run)
                    const isFirstP2 = processId === "p2" && index === ganttReadyQueue.indexOf("p2") && p2RunCount >= 1

                    // Apply 50% opacity to the SECOND P2 in the Ready Queue only after it has run twice
                    const isSecondP2 =
                      processId === "p2" &&
                      index === ganttReadyQueue.indexOf("p2", ganttReadyQueue.indexOf("p2") + 1) &&
                      p2RunCount >= 2

                    // Apply 50% opacity to the FIRST P3 in the Ready Queue (the one that has already run)
                    const isFirstP3 = processId === "p3" && index === ganttReadyQueue.indexOf("p3") && gameStep >= 3

                    // Apply 50% opacity to the P4 in the Ready Queue after it has run
                    const isP4Run = processId === "p4" && gameStep >= 5

                    return (
                      <div
                        key={`${processId}-${index}`}
                        className={`h-10 w-16 flex items-center justify-center text-white font-bold border border-gray-700 ${
                          isFirstP1 || isSecondP1 || isThirdP1 || isFirstP2 || isSecondP2 || isFirstP3 || isP4Run
                            ? "opacity-50"
                            : ""
                        }`}
                        style={{
                          backgroundColor:
                            process.id === "p1"
                              ? "#3b82f6"
                              : process.id === "p2"
                                ? "#10b981"
                                : process.id === "p3"
                                  ? "#ef4444"
                                  : "#f59e0b",
                        }}
                      >
                        <span className="font-press-start-2p text-xs">{process.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Running Process in Gantt Chart with time markers */}
            <div className="mb-4">
              <div className="flex items-center">
                <span className="font-pixelify-sans text-[#4cf190] text-sm mr-2">Running</span>
                <div className="flex">
                  {ganttChart.map((item, index) => {
                    const process = processes.find((p) => p.id === item.id)
                    const width = (item.end - item.start) * 40 // Scale for visualization

                    return (
                      <div key={index} className="relative">
                        <div
                          className="h-10 flex items-center justify-center text-white font-bold border border-gray-700"
                          style={{
                            width: `${width}px`,
                            minWidth: `${width}px`,
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
                          <span className="font-press-start-2p text-xs">
                            {item.id === "idle" ? "IDLE" : process?.name}
                          </span>
                        </div>
                        {/* Time markers */}
                        {index === 0 || ganttChart[index - 1].end !== item.start ? (
                          <span className="font-press-start-2p text-xs text-white absolute left-0 bottom-[-20px]">
                            {item.start}
                          </span>
                        ) : null}
                        <span className="font-press-start-2p text-xs text-white absolute right-0 bottom-[-20px]">
                          {item.end}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
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
                    <span className="font-press-start-2p text-xs">{avgResponse.toFixed(2)}</span>
                  </p>
                  <p>
                    Average TAT = Total TAT / number of processes ={" "}
                    <span className="font-press-start-2p text-xs">{avgTurnaround.toFixed(2)}</span>
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
