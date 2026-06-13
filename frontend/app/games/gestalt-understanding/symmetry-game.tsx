"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const SymmetryGame = () => {
  const [line, setLine] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDotHovered, setIsDotHovered] = useState({ top: false, bottom: false })
  const [isLineDrawn, setIsLineDrawn] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isSoundOn, setIsSoundOn] = useState(true)

  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    // Load sound effects (reused from previous games)
    const clickSound = new Audio("/click.mp3")
    const correctSound = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-a3rGcNs8ZZg7gYzA0faB7NS1qBeFN5.mp3",
    )
    const incorrectSound = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wrong-JlwHB0C2WUOcanUglt21NBfb8LGS7Q.mp3",
    )

    // Preload sounds
    clickSound.load()
    correctSound.load()
    incorrectSound.load()

    // Attach sounds to window for global access
    window.clickSound = clickSound
    window.correctSound = correctSound
    window.incorrectSound = incorrectSound

    return () => {
      // Cleanup
      window.clickSound = undefined
      window.correctSound = undefined
      window.incorrectSound = undefined
    }
  }, [])

  const playSound = (sound: "click" | "correct" | "incorrect") => {
    if (isSoundOn) {
      const audio = window[`${sound}Sound`] as HTMLAudioElement
      if (audio) {
        audio.currentTime = 0
        audio.play()
      }
    }
  }

  const snapToNearestDot = (x: number, y: number): { x: number; y: number } => {
    const topDotDistance = Math.sqrt(Math.pow(x - 150, 2) + Math.pow(y - 10, 2))
    const bottomDotDistance = Math.sqrt(Math.pow(x - 150, 2) + Math.pow(y - 290, 2))

    if (topDotDistance < bottomDotDistance) {
      return { x: 150, y: 10 }
    } else {
      return { x: 150, y: 290 }
    }
  }

  const handlePointerDown = (e: React.PointerEvent, dot: "top" | "bottom") => {
    if (isLineDrawn) return
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const snappedPoint = snapToNearestDot(x, y)
      setLine({ x1: snappedPoint.x, y1: snappedPoint.y, x2: x, y2: y })
      setIsDrawing(true)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || isLineDrawn) return
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setLine((prev) => ({ ...prev, x2: x, y2: y }))
    }
  }

  const handlePointerUp = () => {
    if (isLineDrawn) return
    setIsDrawing(false)
    const svg = svgRef.current
    if (svg) {
      const endPoint = snapToNearestDot(line.x2, line.y2)
      if ((line.y1 === 10 && endPoint.y === 290) || (line.y1 === 290 && endPoint.y === 10)) {
        setLine((prev) => ({ ...prev, x2: endPoint.x, y2: endPoint.y }))
        setIsLineDrawn(true)
      } else {
        setLine({ x1: 0, y1: 0, x2: 0, y2: 0 })
      }
    }
  }

  const isPointInsideCircle = (point: { x: number; y: number }, rect: DOMRect) => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distance = Math.sqrt((point.x - centerX) ** 2 + (point.y - centerY) ** 2)
    return distance <= rect.width / 2
  }

  const handleSubmit = () => {
    const isCorrect = isLineDrawn
    setIsCorrect(isCorrect)
    playSound(isCorrect ? "correct" : "incorrect")

    if (isCorrect) {
      setTimeout(() => {
        setShowExplanation(true)
      }, 1000)
    }
  }

  const handleReset = () => {
    setLine({ x1: 0, y1: 0, x2: 0, y2: 0 })
    setIsLineDrawn(false)
    setIsCorrect(null)
    setShowExplanation(false)
    playSound("click")
  }

  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  const controlButtons = (
    <div className="absolute bottom-6 left-6 right-6 flex justify-between">
      <button
        onClick={toggleSound}
        className="bg-[#0066CC] p-2 rounded-md hover:bg-[#0055AA] transition-colors duration-200"
      >
        {isSoundOn ? <Volume2 className="h-8 w-8 text-white" /> : <VolumeX className="h-8 w-8 text-white" />}
      </button>
      <Link href="/games/gestalt-understanding">
        <div className="bg-[#0066CC] p-2 rounded-md hover:bg-[#0055AA] transition-colors duration-200">
          <Home className="h-8 w-8 text-white" />
        </div>
      </Link>
    </div>
  )

  const gameContent = (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <h2 className="text-white font-mono text-xl md:text-2xl mb-8 text-center">
        Long press the dot to draw a straight line.
      </h2>
      <div className="relative mb-8 w-[300px] h-[300px]">
        <div className="absolute inset-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/symmetry_question-yxBRNCnS2YenKLzPeRwaKjm6DAUeaC.png"
            alt="Starbucks logo"
            width={300}
            height={300}
            className="pointer-events-none" // Prevent image from blocking interactions
          />
        </div>
        <svg
          ref={svgRef}
          width="300"
          height="300"
          className="absolute top-0 left-0 z-10" // Add z-index to ensure SVG is on top
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {(isDrawing || isLineDrawn) && (
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="yellow" strokeWidth="2" />
          )}
          <circle
            id="topDot"
            cx="150"
            cy="10" // Adjust to prevent cutoff
            r="10"
            fill="yellow"
            stroke={isDotHovered.top ? "white" : "none"}
            strokeWidth="2"
            onPointerEnter={() => setIsDotHovered((prev) => ({ ...prev, top: true }))}
            onPointerLeave={() => setIsDotHovered((prev) => ({ ...prev, top: false }))}
            onPointerDown={(e) => handlePointerDown(e, "top")}
            style={{ cursor: "pointer" }} // Add cursor pointer
          />
          <circle
            id="bottomDot"
            cx="150"
            cy="290" // Adjust to prevent cutoff
            r="10"
            fill="yellow"
            stroke={isDotHovered.bottom ? "white" : "none"}
            strokeWidth="2"
            onPointerEnter={() => setIsDotHovered((prev) => ({ ...prev, bottom: true }))}
            onPointerLeave={() => setIsDotHovered((prev) => ({ ...prev, bottom: false }))}
            onPointerDown={(e) => handlePointerDown(e, "bottom")}
            style={{ cursor: "pointer" }} // Add cursor pointer
          />
        </svg>
      </div>
      <div className="flex space-x-4">
        <button className="bg-[#0066CC] text-white font-mono py-2 px-6 rounded" onClick={handleSubmit}>
          Submit
        </button>
        <button className="bg-[#CC6600] text-white font-mono py-2 px-6 rounded" onClick={handleReset}>
          Reset
        </button>
      </div>
      {isCorrect !== null && (
        <p className={`mt-4 font-mono text-xl ${isCorrect ? "text-[#00FF7F]" : "text-red-500"}`}>
          {isCorrect ? "Correct!" : "Incorrect. Try again!"}
        </p>
      )}
    </div>
  )

  if (showExplanation) {
    return (
      <div className="flex flex-col md:flex-row h-screen w-full bg-black p-4">
        <div className="w-full md:w-2/5 p-2 md:p-4">
          <div className="border-4 border-[#00BFFF] rounded-lg h-full">
            <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col relative">
              <h1 className="text-[#00FF7F] font-mono text-2xl md:text-4xl mb-8 font-bold tracking-wider">
                Explanations
              </h1>
              <p className="text-[#00FF7F] font-mono text-xl mb-4">&quot;Symmetry&quot;</p>
              <p className="text-[#00FF7F] font-mono text-lg mb-4">can find the line of symmetry</p>
              <p className="text-[#00FF7F] font-mono text-lg">-&gt; there are 1 symmetry line in total</p>
              {controlButtons}
            </div>
          </div>
        </div>
        <div className="w-full md:w-3/5 p-2 md:p-4 mt-4 md:mt-0">
          <div className="border-4 border-[#00BFFF] rounded-lg h-full">
            <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col items-center justify-center">
              {gameContent}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black p-4">
      <div className="w-full md:w-2/5 p-2 md:p-4">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col relative">
            <h1 className="text-[#00FF7F] font-mono text-2xl md:text-4xl mb-8 font-bold tracking-wider">
              Instructions
            </h1>
            <p className="text-[#00FF7F] font-mono text-lg md:text-xl mb-6">
              Please draw a line between the two yellow dots to show the line of symmetry
            </p>
            {controlButtons}
          </div>
        </div>
      </div>
      <div className="w-full md:w-3/5 p-2 md:p-4 mt-4 md:mt-0">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col items-center justify-center">
            {gameContent}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SymmetryGame
