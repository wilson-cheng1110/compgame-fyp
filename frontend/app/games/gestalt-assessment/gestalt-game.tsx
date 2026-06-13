"use client"

import { useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import Link from "next/link"

export default function GestaltGame() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black p-2 md:p-4">
      {/* Left Panel (Larger) */}
      <div className="w-full md:w-3/5 p-1 md:p-2 mb-2 md:mb-0">
        <div className="border-4 border-teal rounded-lg h-full">
          <div className="bg-darkBlue h-full p-3 md:p-6 rounded-md flex flex-col items-center justify-center relative">
            <Link href="/games/gestalt-assessment/app/quiz">
              <h2
                className={`font-pixelify-sans text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-wider text-center cursor-pointer transition-colors duration-200 ${isHovered ? "text-yellow-300" : "text-white"}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                LETS PLAY
              </h2>
            </Link>

            {/* Sound button */}
            <div className="absolute bottom-3 md:bottom-6 left-3 md:left-6">
              <button onClick={toggleSound} className="p-1 md:p-2 hover:opacity-80 transition-opacity duration-200">
                {isSoundOn ? (
                  <Volume2 className="h-6 w-6 md:h-8 md:w-8 text-white" />
                ) : (
                  <VolumeX className="h-6 w-6 md:h-8 md:w-8 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel (Smaller) */}
      <div className="w-full md:w-2/5 p-1 md:p-2">
        <div className="border-4 border-teal rounded-lg h-full">
          <div className="bg-darkBlue h-full p-3 md:p-6 rounded-md flex flex-col">
            <h1 className="text-neonGreen font-mono text-xl md:text-2xl lg:text-4xl mb-4 md:mb-8 font-bold tracking-wider">
              Gestalt Principles
            </h1>

            <p className="text-neonGreen font-mono text-sm md:text-base lg:text-xl mb-3 md:mb-6">
              Demonstrate your knowledge of Gestalt principles by solving visual puzzles and answering 10 questions
              based on these design guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
