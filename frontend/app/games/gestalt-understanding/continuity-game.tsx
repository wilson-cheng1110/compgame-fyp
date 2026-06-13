"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const ContinuityGame = () => {
  const [answer, setAnswer] = useState<string>("")
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [isSoundOn, setIsSoundOn] = useState(true)

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (/^\d*$/.test(value)) {
      setAnswer(value)
    }
  }

  const handleSubmit = () => {
    const isCorrect = answer === "2"
    setIsCorrect(isCorrect)
    playSound(isCorrect ? "correct" : "incorrect")

    if (isCorrect) {
      setTimeout(() => {
        setShowExplanation(true)
      }, 1000)
    }
  }

  const handleReset = () => {
    setAnswer("")
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
      <h2 className="text-white font-mono text-xl md:text-2xl mb-8 text-center">How many lines are there here?</h2>
      <div className="mb-8">
        <Image
          src={
            showExplanation
              ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/continuity_ans-gVSG8axDGdYnQCbBAHIWlkkQKzh5P5.png"
              : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/continuity_question-nttf4ITHVSy22wiaxNVfVIp79v83e1.png"
          }
          alt={showExplanation ? "Continuity answer" : "Continuity question"}
          width={300}
          height={300}
        />
      </div>
      <div className="flex items-center mb-8">
        <label htmlFor="answer" className="text-white font-mono mr-4">
          Ans:
        </label>
        <input
          type="text"
          id="answer"
          value={answer}
          onChange={handleInputChange}
          className="bg-white text-black font-mono p-2 w-20 text-center"
        />
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
              <p className="text-[#00FF7F] font-mono text-xl mb-4">&quot;Continuity&quot;</p>
              <p className="text-[#00FF7F] font-mono text-lg mb-4">group by flow of lines</p>
              <p className="text-[#00FF7F] font-mono text-lg">-&gt; there are 2 lines in total</p>
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
              Please fill in the answer in the text box.
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

export default ContinuityGame
