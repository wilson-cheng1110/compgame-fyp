"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import { useDrag, useDrop } from "react-dnd"

const GRID_SIZE = 4
const SIDE_GRID_SIZE = { rows: 4, cols: 2 }

type GridState = (string | null)[][]

const ItemTypes = {
  BLOCK: "block",
}

const ProximityGame = () => {
  const [centerGrid, setCenterGrid] = useState<GridState>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill("block")),
  )
  const [leftGrid, setLeftGrid] = useState<GridState>(
    Array(SIDE_GRID_SIZE.rows)
      .fill(null)
      .map(() => Array(SIDE_GRID_SIZE.cols).fill(null)),
  )
  const [rightGrid, setRightGrid] = useState<GridState>(
    Array(SIDE_GRID_SIZE.rows)
      .fill(null)
      .map(() => Array(SIDE_GRID_SIZE.cols).fill(null)),
  )
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isSoundOn, setIsSoundOn] = useState(true)

  useEffect(() => {
    // Load sound effects (reused from similarity-game.tsx)
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
    window.incorrectSound = undefined
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

  const handleReset = () => {
    setCenterGrid(
      Array(GRID_SIZE)
        .fill(null)
        .map(() => Array(GRID_SIZE).fill("block")),
    )
    setLeftGrid(
      Array(SIDE_GRID_SIZE.rows)
        .fill(null)
        .map(() => Array(SIDE_GRID_SIZE.cols).fill(null)),
    )
    setRightGrid(
      Array(SIDE_GRID_SIZE.rows)
        .fill(null)
        .map(() => Array(SIDE_GRID_SIZE.cols).fill(null)),
    )
    setIsCorrect(null)
    setShowExplanation(false)
    playSound("click")
  }

  const handleSubmit = () => {
    const isCorrect = checkSolution()
    setIsCorrect(isCorrect)
    playSound(isCorrect ? "correct" : "incorrect")

    if (isCorrect) {
      setTimeout(() => {
        setShowExplanation(true)
      }, 1000)
    }
  }

  const checkSolution = () => {
    // Check if all blocks are moved to the side grids
    const allBlocksMoved = centerGrid.every((row) => row.every((cell) => cell === null))
    const sideGridsFilled =
      leftGrid.every((row) => row.every((cell) => cell === "block")) &&
      rightGrid.every((row) => row.every((cell) => cell === "block"))

    return allBlocksMoved && sideGridsFilled
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

  const Block = ({
    row,
    col,
    grid,
    setGrid,
  }: { row: number; col: number; grid: GridState; setGrid: React.Dispatch<React.SetStateAction<GridState>> }) => {
    const [{ isDragging }, drag] = useDrag({
      type: ItemTypes.BLOCK,
      item: { row, col, grid, setGrid },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    })

    return (
      <div
        ref={drag}
        style={{
          opacity: isDragging ? 0.5 : 1,
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          border: "1px solid black",
        }}
      />
    )
  }

  const GridSquare = ({
    row,
    col,
    grid,
    setGrid,
  }: { row: number; col: number; grid: GridState; setGrid: React.Dispatch<React.SetStateAction<GridState>> }) => {
    const [{ isOver }, drop] = useDrop({
      accept: ItemTypes.BLOCK,
      drop: (item: any) => {
        const { row: draggedRow, col: draggedCol, grid: draggedGrid, setGrid: draggedSetGrid } = item

        if (grid[row][col] === null) {
          const newGrid = [...grid]
          newGrid[row][col] = "block"
          setGrid(newGrid)

          const newDraggedGrid = [...draggedGrid]
          newDraggedGrid[draggedRow][draggedCol] = null
          draggedSetGrid(newDraggedGrid)
        }
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    })

    return (
      <div
        ref={drop}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: isOver ? "lightgreen" : "#003344",
        }}
      >
        {grid[row][col] === "block" && <Block row={row} col={col} grid={grid} setGrid={setGrid} />}
      </div>
    )
  }

  const renderGrid = (grid: GridState, setGrid: React.Dispatch<React.SetStateAction<GridState>>) => {
    return (
      <div
        className="grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid[0].length}, 1fr)`,
          width: "100%",
          height: "100%",
        }}
      >
        {grid.map((rowArray, row) =>
          rowArray.map((cell, col) => (
            <GridSquare key={`${row}-${col}`} row={row} col={col} grid={grid} setGrid={setGrid} />
          )),
        )}
      </div>
    )
  }

  const gameContent = (
    <DndProvider backend={HTML5Backend}>
      <div className="flex justify-between items-center w-full max-w-4xl mx-auto">
        {/* Left grid */}
        <div className="w-1/4 border-2 border-white h-[400px]">{renderGrid(leftGrid, setLeftGrid)}</div>

        {/* Center grid */}
        <div className="w-1/2 border-2 border-white h-[400px]">{renderGrid(centerGrid, setCenterGrid)}</div>

        {/* Right grid */}
        <div className="w-1/4 border-2 border-white h-[400px]">{renderGrid(rightGrid, setRightGrid)}</div>
      </div>

      <div className="flex justify-center mt-8 space-x-4">
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
    </DndProvider>
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
              <p className="text-[#00FF7F] font-mono text-xl mb-4">&quot;Proximity&quot;</p>
              <p className="text-[#00FF7F] font-mono text-lg mb-4">group by distance</p>
              <p className="text-[#00FF7F] font-mono text-lg">-&gt; there are 2 groups in total</p>
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
            <p className="text-[#00FF7F] font-mono text-lg md:text-xl mb-6">Please drag all blocks to the sides</p>
            {controlButtons}
          </div>
        </div>
      </div>
      <div className="w-full md:w-3/5 p-2 md:p-4 mt-4 md:mt-0">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col items-center justify-center">
            <h2 className="text-white font-mono text-xl md:text-2xl mb-8 text-center">
              Use the mouse to click and drag the block to the desired area, then release the mouse.
            </h2>
            {gameContent}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProximityGame
