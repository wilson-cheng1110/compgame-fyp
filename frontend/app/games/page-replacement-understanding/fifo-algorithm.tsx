"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Volume2, VolumeX, RefreshCw } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// Define car/page types
interface Car {
  id: string
  pageNumber: number
  imageUrl: string
  isPlaced: boolean
  canDrag: boolean
  frameId?: string | null
}

// Define frame types
interface Frame {
  id: string
  label: string
  currentPage: number | null
  currentCar: string | null
}

// Define display cell type for the table
interface DisplayCell {
  value: string
  color: string
  isVisible: boolean
}

export default function FIFOAlgorithm() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [cars, setCars] = useState<Car[]>([
    {
      id: "car1",
      pageNumber: 2,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/car3-nJ4D1FgIROFP7ZxbPXsPLIQad1Yx8C.png", // Red car
      isPlaced: false,
      canDrag: true, // Red car is initially draggable
    },
    {
      id: "car2",
      pageNumber: 3,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/car1-t7BS6t8aBu2oB3DtwhCc7Nk9a8ikXA.png", // Green car
      isPlaced: false,
      canDrag: false,
    },
    {
      id: "car3",
      pageNumber: 4,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/car2-icA2GNZDc9aj13eueGRb5R4aipD6ub.png", // Orange car
      isPlaced: false,
      canDrag: false,
    },
    {
      id: "car4",
      pageNumber: 5,
      imageUrl: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/car4-Mn839HSPMhmQM37hJ1f69nQw4PIjzc.png", // Brown car
      isPlaced: false,
      canDrag: false,
    },
  ])

  const [frames, setFrames] = useState<Frame[]>([
    { id: "frame1", label: "F1", currentPage: null, currentCar: null },
    { id: "frame2", label: "F2", currentPage: null, currentCar: null },
    { id: "frame3", label: "F3", currentPage: null, currentCar: null },
  ])

  // Page reference sequence
  const pageReferences = [1, 2, 3, 4, 1, 2, 5, 1]

  // Table data to match Figma exactly
  // Update the tableData array to match the Figma design exactly
  const [tableData, setTableData] = useState<DisplayCell[][][]>([
    // F1 row
    [
      [{ value: "1*", color: "text-red-600", isVisible: true }],
      [{ value: "1", color: "text-black", isVisible: true }],
      [{ value: "1", color: "text-black", isVisible: true }],
      [{ value: "4*", color: "text-red-600", isVisible: true }],
      [{ value: "4", color: "text-black", isVisible: true }],
      [{ value: "4", color: "text-black", isVisible: true }],
      [{ value: "5*", color: "text-red-600", isVisible: true }],
      [{ value: "5", color: "text-black", isVisible: true }],
      [{ value: "5", color: "text-black", isVisible: false }], // Column 9
      [{ value: "5", color: "text-black", isVisible: false }], // Column 10
      [{ value: "5", color: "text-black", isVisible: false }], // Column 11
      [{ value: "5", color: "text-blue-600", isVisible: false }], // Column 12 - Blue 5
    ],
    // F2 row
    [
      [{ value: "-", color: "text-black", isVisible: true }],
      [{ value: "2*", color: "text-red-600", isVisible: true }],
      [{ value: "2", color: "text-black", isVisible: true }],
      [{ value: "2", color: "text-black", isVisible: true }],
      [{ value: "1*", color: "text-red-600", isVisible: true }],
      [{ value: "1", color: "text-black", isVisible: true }],
      [{ value: "1", color: "text-black", isVisible: true }],
      [{ value: "1", color: "text-blue-600", isVisible: true }],
      [{ value: "1", color: "text-black", isVisible: false }], // Column 9
      [{ value: "3*", color: "text-red-600", isVisible: false }], // Column 10 - Red 3*
      [{ value: "3", color: "text-black", isVisible: false }], // Column 11
      [{ value: "3", color: "text-black", isVisible: false }], // Column 12
    ],
    // F3 row
    [
      [{ value: "-", color: "text-black", isVisible: true }],
      [{ value: "-", color: "text-black", isVisible: true }],
      [{ value: "3*", color: "text-red-600", isVisible: true }],
      [{ value: "3", color: "text-black", isVisible: true }],
      [{ value: "3", color: "text-black", isVisible: true }],
      [{ value: "2*", color: "text-red-600", isVisible: true }],
      [{ value: "2", color: "text-black", isVisible: true }],
      [{ value: "2", color: "text-black", isVisible: true }],
      [{ value: "2", color: "text-blue-600", isVisible: false }], // Column 9 - Blue 2
      [{ value: "2", color: "text-black", isVisible: false }], // Column 10
      [{ value: "4*", color: "text-red-600", isVisible: false }], // Column 11 - Red 4*
      [{ value: "4", color: "text-black", isVisible: false }], // Column 12
    ],
  ])

  const [currentStep, setCurrentStep] = useState(0)
  const [prompt, setPrompt] = useState("Drag the cars to the correct frames according to FIFO rules.")
  const [draggedCar, setDraggedCar] = useState<string | null>(null)
  const [gameCompleted, setGameCompleted] = useState(false)

  // Audio references
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const failureAudioRef = useRef<HTMLAudioElement | null>(null)
  const congratulationsAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements with direct URLs
  useEffect(() => {
    successAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/correct-2anS1LvOOg5gTNQVF45Yf4EJ2YGYai.mp3",
    )
    failureAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wrong-Hcickm3TRPRcCru6lvw74rbyypl6G4.mp3",
    )
    congratulationsAudioRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/success-Rl9qXJUOOgGVT8UK5G7J4WQPuMSKnx.mp3",
    )
  }, [])

  // Handle process drag start
  const handleDragStart = (e: React.DragEvent, carId: string) => {
    const car = cars.find((c) => c.id === carId)
    if (!car || !car.canDrag || gameCompleted) return

    e.dataTransfer.setData("text/plain", carId)
    setDraggedCar(carId)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Function to update the table data when a car is placed
  const updateTableData = (carId: string, frameId: string) => {
    const car = cars.find((c) => c.id === carId)
    if (!car) return

    const newTableData = [...tableData]

    // Show the corresponding values in the table based on which car was placed
    if (carId === "car1") {
      // Red car (page 2) in F3
      // Make the 9th column (index 8) visible for all frames
      newTableData[0][8][0].isVisible = true // Show 5 in F1
      newTableData[1][8][0].isVisible = true // Show 1 in F2
      newTableData[2][8][0].isVisible = true // Show 2 in F3 (blue)
    } else if (carId === "car2") {
      // Green car (page 3) in F2
      // Make the 10th column (index 9) visible
      newTableData[0][9][0].isVisible = true // Show 5 in F1
      newTableData[1][9][0].isVisible = true // Show 3* in F2 (red with asterisk)
      newTableData[2][9][0].isVisible = true // Show 2 in F3
    } else if (carId === "car3") {
      // Orange car (page 4) in F3
      // Make the 11th column (index 10) visible
      newTableData[0][10][0].isVisible = true // Show 5 in F1
      newTableData[1][10][0].isVisible = true // Show 3 in F2
      newTableData[2][10][0].isVisible = true // Show 4* in F3 (red with asterisk)
    } else if (carId === "car4") {
      // Brown car (page 5) in F1
      // Make the 12th column (index 11) visible
      newTableData[0][11][0].isVisible = true // Show 5 in F1 (blue)
      newTableData[1][11][0].isVisible = true // Show 3 in F2
      newTableData[2][11][0].isVisible = true // Show 4 in F3
    }

    setTableData(newTableData)
  }

  // Function to play sound with error handling
  const playSound = (audioRef: React.RefObject<HTMLAudioElement>) => {
    if (isSoundOn && audioRef.current) {
      // Reset the audio to the beginning
      audioRef.current.currentTime = 0

      // Play the sound with error handling
      audioRef.current.play().catch((err) => {
        console.error("Error playing sound:", err)
      })
    }
  }

  // Handle dropping car into frame
  const handleDrop = (e: React.DragEvent, frameId: string) => {
    e.preventDefault()

    const carId = e.dataTransfer.getData("text/plain")
    if (!carId || gameCompleted) return

    const car = cars.find((c) => c.id === carId)
    if (!car || !car.canDrag) return

    // Check if this is the correct frame based on FIFO rules
    // Updated mapping based on the provided correct mapping
    const correctFrameMapping: Record<string, string> = {
      car1: "frame3", // Red car (page 2) goes to F3
      car2: "frame2", // Green car (page 3) goes to F2
      car3: "frame3", // Orange car (page 4) goes to F3
      car4: "frame1", // Brown car (page 5) goes to F1
    }

    if (frameId !== correctFrameMapping[carId]) {
      // Incorrect frame
      setPrompt("Incorrect! Track the arrival order of pages in memory. Replace the oldest page first.")

      // Play failure sound for incorrect placement
      playSound(failureAudioRef)
      return
    }

    // Correct frame - update car and frame states
    const updatedCars = [...cars]
    const carIndex = updatedCars.findIndex((c) => c.id === carId)

    if (carIndex !== -1) {
      updatedCars[carIndex].isPlaced = true
      updatedCars[carIndex].canDrag = false
      updatedCars[carIndex].frameId = frameId
    }

    const updatedFrames = [...frames]
    const frameIndex = updatedFrames.findIndex((frame) => frame.id === frameId)

    if (frameIndex !== -1) {
      updatedFrames[frameIndex].currentPage = car.pageNumber
      updatedFrames[frameIndex].currentCar = carId
    }

    setCars(updatedCars)
    setFrames(updatedFrames)
    setDraggedCar(null)

    // Update the table data to show values in other frames
    updateTableData(carId, frameId)

    // Update prompt
    setPrompt(`Correct! Page ${car.pageNumber} is placed in ${updatedFrames[frameIndex].label}.`)

    // Play success sound for correct placement
    playSound(successAudioRef)

    // Move to next step
    setCurrentStep((prevStep) => prevStep + 1)

    // Check if game is completed
    if (currentStep + 1 >= 4) {
      // We only need to place 4 cars
      setGameCompleted(true)
      setPrompt("Congratulations! You've completed the FIFO page replacement algorithm.")

      // Play congratulations sound for game completion
      playSound(congratulationsAudioRef)

      return
    }

    // Enable the next car
    setTimeout(() => {
      const nextCar = updatedCars.find((c) => !c.isPlaced)
      if (nextCar) {
        const nextCarIndex = updatedCars.findIndex((c) => c.id === nextCar.id)
        updatedCars[nextCarIndex].canDrag = true
        setCars(updatedCars)
      }
    }, 1000)
  }

  // Restart the game
  const restartGame = () => {
    // This will reload the current page, giving the same effect as clicking FIFO on the homepage
    window.location.href = "/fifo"
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
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game7_game_bg-I7Q5WTdFCX77it74PDN33tLWi6MaNa.webp"
          alt="Page Replacement Game Background"
          fill
          priority
          className="object-cover"
        />
      </div>

      {/* Game Container */}
      <div className="relative z-10 min-h-[800px] flex items-start justify-center p-4">
        <div className="bg-[#b4dcd7] w-full max-w-5xl p-8">
          {/* Title and Instructions */}
          <div className="bg-[#0d453b] p-4 mb-4">
            <h1 className="font-pixelify-sans text-[#4cf190] text-xl md:text-2xl mb-2">FIFO (First-In, First-Out)</h1>
            <p className="font-pixelify-sans text-white text-sm md:text-base">
              Use the First-In, First-Out (FIFO) page replacement strategy. When a page fault occurs and memory is full,
              replace the page that was loaded the earliest. Follow the order in which pages entered memory to determine
              which to remove. Click and drag each car into the parking space according to FIFO rules.
            </p>
          </div>

          {/* Prompt Area */}
          <div className="bg-[#002b3c] p-4 mb-4">
            <h2 className="font-pixelify-sans text-[#4cf190] text-lg">Prompt:</h2>
            <p className="font-pixelify-sans text-sm md:text-base text-white">{prompt}</p>
          </div>

          {/* Page Reference Table - Update styling to match Figma exactly */}
          <div className="p-4 mb-4 border-4 border-white rounded-lg">
            {/* Page References Row */}
            <div className="flex mb-2">
              <div className="w-16 h-16 bg-[#e6e6e6] border border-white"></div> {/* Empty cell for frame labels */}
              {/* Page reference numbers */}
              {pageReferences.map((page, index) => (
                <div
                  key={index}
                  className="w-16 h-16 flex items-center justify-center bg-[#e6e6e6] border border-white font-press-start-2p text-[#1a1a1a]"
                >
                  {page}
                </div>
              ))}
              {/* Car area - Updated to have #D7D7D7 background */}
              <div className="flex ml-4">
                {cars.map((car) => (
                  <div
                    key={car.id}
                    className={`w-16 h-16 flex flex-col items-center justify-center bg-[#d7d7d7] border border-white ${!car.isPlaced ? "" : "invisible"}`}
                  >
                    {!car.isPlaced && (
                      <div
                        className={`relative w-12 h-12 ${car.canDrag ? "cursor-move" : ""}`}
                        draggable={car.canDrag}
                        onDragStart={(e) => handleDragStart(e, car.id)}
                      >
                        <Image
                          src={car.imageUrl || "/placeholder.svg"}
                          alt={`Car ${car.pageNumber}`}
                          fill
                          className="object-contain"
                        />
                        <div className="absolute -bottom-4 left-0 right-0 bg-[#444444] text-white text-xs text-center py-1">
                          {car.pageNumber}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Frame Rows */}
            {frames.map((frame, frameIndex) => (
              <div key={frame.id} className="flex mb-2">
                {/* Frame Label */}
                <div className="w-16 h-16 flex items-center justify-center bg-[#90A0AD] border border-white font-pixelify-sans text-[#fed456] font-bold">
                  {frame.label}
                </div>

                {/* Frame Cells - Using the exact data from Figma */}
                {tableData[frameIndex].map(
                  (cellGroup, cellIndex) =>
                    cellGroup[0].isVisible && (
                      <div
                        key={cellIndex}
                        className={`w-16 h-16 flex items-center justify-center bg-[#90A0AD] border border-white font-press-start-2p ${cellGroup[0].color}`}
                      >
                        {cellGroup[0].value}
                      </div>
                    ),
                )}

                {/* Frame Drop Area - Updated to match #90A0AD background */}
                <div
                  className="w-16 h-16 ml-4 border border-white flex items-center justify-center bg-[#90A0AD]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, frame.id)}
                >
                  {frame.currentCar && (
                    <div className="relative w-12 h-12">
                      <Image
                        src={cars.find((c) => c.id === frame.currentCar)?.imageUrl || ""}
                        alt={`Car in ${frame.label}`}
                        fill
                        className="object-contain"
                      />
                      <div className="absolute -bottom-4 left-0 right-0 bg-[#444444] text-white text-xs text-center py-1">
                        {frame.currentPage}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Back button */}
          <div className="absolute top-4 left-4">
            <Link href="/games/page-replacement-understanding">
              <button className={`flex items-center font-pixelify-sans ${buttonClass}`}>
                <ArrowLeft className="mr-1" /> Back
              </button>
            </Link>
          </div>

          {/* Restart button */}
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
