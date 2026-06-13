"use client"

import { useState, useEffect } from "react"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const ClosureGame = () => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isSoundOn, setIsSoundOn] = useState(true)

  const answers = ["rabbit", "elephant", "lion", "pig"]

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

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer === null) {
      setSelectedAnswer(answer)
    }
  }

  const handleSubmit = () => {
    if (selectedAnswer !== null) {
      const correct = selectedAnswer === "rabbit"
      setIsCorrect(correct)
      playSound(correct ? "correct" : "incorrect")

      if (correct) {
        setTimeout(() => {
          setShowExplanation(true)
        }, 1000)
      }
    }
  }

  const handleReset = () => {
    setSelectedAnswer(null)
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
        What animal do you see in the picture?
      </h2>
      <div className="mb-8">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/closure_question-4WOmE9I0gzEbR8DYFeAz7OMOeWNf6H.png"
          alt="Closure question"
          width={300}
          height={300}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {answers.map((answer) => (
          <button
            key={answer}
            className={`w-40 h-12 font-mono text-lg rounded-md transition-colors duration-200
              ${selectedAnswer === answer ? "bg-[#FFE100] text-black" : "bg-white text-black hover:bg-[#FFE100]"}`}
            onClick={() => handleAnswerSelect(answer)}
            disabled={selectedAnswer !== null}
          >
            {answer}
          </button>
        ))}
      </div>
      <div className="flex space-x-4">
        <button
          className="bg-[#0066CC] text-white font-mono py-2 px-6 rounded"
          onClick={handleSubmit}
          disabled={selectedAnswer === null}
        >
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
              <p className="text-[#00FF7F] font-mono text-xl mb-4">&quot;Closure&quot;</p>
              <p className="text-[#00FF7F] font-mono text-lg mb-4">perceive shapes that are not completely there</p>
              <p className="text-[#00FF7F] font-mono text-lg">
                -&gt; Although it is represented by lines, we know it is a rabbit
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

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black p-4">
      <div className="w-full md:w-2/5 p-2 md:p-4">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col relative">
            <h1 className="text-[#00FF7F] font-mono text-2xl md:text-4xl mb-8 font-bold tracking-wider">
              Instructions
            </h1>
            <p className="text-[#00FF7F] font-mono text-lg md:text-xl mb-6">Please click the correct answer</p>
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

export default ClosureGame
