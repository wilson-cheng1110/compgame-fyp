"use client"

import { useState, useEffect } from "react"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"

const COLORS = ["#FFFF00", "#00FF00", "#00FFFF", "#FF00FF"]
const GRID_SIZE = 4

type GridState = (string | null)[][]

export default function SimilarityGame() {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [grid, setGrid] = useState<GridState>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null)),
  )
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isSoundOn, setIsSoundOn] = useState(true)

  useEffect(() => {
    // Load sound effects
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

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    playSound("click")
  }

  const handleCellClick = (row: number, col: number) => {
    if (selectedColor) {
      const newGrid = [...grid]
      newGrid[row][col] = selectedColor
      setGrid(newGrid)
      playSound("click")
    }
  }

  const handleReset = () => {
    setGrid(
      Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill(null)),
    )
    setSelectedColor(null)
    setIsCorrect(null)
    setShowExplanation(false)
    playSound("click")
  }

  const handleSubmit = () => {
    // Check if each column has the same color
    const isCorrect =
      grid.every((_, colIndex) => {
        const columnColor = grid[0][colIndex]
        return columnColor !== null && grid.every((row) => row[colIndex] === columnColor)
      }) &&
      // Check if all columns have different colors
      new Set(grid[0]).size === GRID_SIZE

    setIsCorrect(isCorrect)
    playSound(isCorrect ? "correct" : "incorrect")

    if (isCorrect) {
      setTimeout(() => {
        setShowExplanation(true)
      }, 1000)
    }
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
      <div className="flex justify-center space-x-4 mb-8">
        {COLORS.map((color, index) => (
          <button
            key={index}
            className={`w-12 h-12 ${selectedColor === color ? "ring-4 ring-white" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorSelect(color)}
          />
        ))}
      </div>

      <div className="border-4 border-white p-2 mb-8 w-[400px] h-[400px]">
        <div className="grid grid-cols-4 gap-[2px] w-full h-full bg-white">
          {Array(GRID_SIZE)
            .fill(null)
            .map((_, row) =>
              Array(GRID_SIZE)
                .fill(null)
                .map((_, col) => (
                  <button
                    key={`${row}-${col}`}
                    className="w-full h-full"
                    style={{ backgroundColor: grid[row][col] || "#003344" }}
                    onClick={() => handleCellClick(row, col)}
                  />
                )),
            )}
        </div>
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
              <p className="text-[#00FF7F] font-mono text-xl mb-4">&quot;Similarity&quot;</p>
              <p className="text-[#00FF7F] font-mono text-lg mb-4">group by colour / shape</p>
              <p className="text-[#00FF7F] font-mono text-lg">-&gt; there are 4 groups in total</p>
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
              Please fill in the colours of the blocks below so that the same column has the same colour and different
              columns have different colours
            </p>
            {controlButtons}
          </div>
        </div>
      </div>
      <div className="w-full md:w-3/5 p-2 md:p-4 mt-4 md:mt-0">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col items-center justify-center">
            <h2 className="text-white font-mono text-xl md:text-2xl mb-8 text-center">
              Click on the colour, then click on the square, and the square will change colour.
            </h2>
            {gameContent}
          </div>
        </div>
      </div>
    </div>
  )
}
