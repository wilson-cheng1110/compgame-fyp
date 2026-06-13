"use client"

import { useState } from "react"
import { Home, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"

export default function GestaltGame() {
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)
  const [isSoundOn, setIsSoundOn] = useState(true)

  const principles = [
    { id: 1, name: "Similarity", link: "/similarity" },
    { id: 2, name: "Proximity", link: "/proximity" },
    { id: 3, name: "Continuity", link: "/continuity" },
    { id: 4, name: "Symmetry", link: "/symmetry" },
    { id: 5, name: "Closure", link: "/closure" },
  ]

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
      <Link href="/">
        <div className="bg-[#0066CC] p-2 rounded-md hover:bg-[#0055AA] transition-colors duration-200">
          <Home className="h-8 w-8 text-white" />
        </div>
      </Link>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black p-4">
      {/* Left Panel */}
      <div className="w-full md:w-2/5 p-2 md:p-4">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col relative">
            <h1 className="text-[#00FF7F] font-mono text-2xl md:text-4xl mb-8 font-bold tracking-wider">
              Gestalt Principles
            </h1>

            <p className="text-[#00FF7F] font-mono text-lg md:text-xl mb-6">
              This game helps you learn how humans perceive and organize visual elements into patterns.
            </p>

            <p className="text-[#00FF7F] font-mono text-lg md:text-xl">
              Let&apos;s explore how Gestalt principles guide intuitive design.
            </p>

            {controlButtons}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-3/5 p-2 md:p-4 mt-4 md:mt-0">
        <div className="border-4 border-[#00BFFF] rounded-lg h-full">
          <div className="bg-[#003344] h-full p-6 rounded-md flex flex-col">
            <h2 className="text-white font-mono text-3xl md:text-5xl mb-12 font-bold tracking-wider text-center">
              LETS PLAY
            </h2>

            <div className="flex-grow flex flex-col justify-center items-center">
              <ul className="space-y-4 md:space-y-6">
                {principles.map((principle) => (
                  <li key={principle.id}>
                    <Link href={principle.link}>
                      <span
                        className={`font-mono text-xl md:text-2xl cursor-pointer transition-colors duration-200 ${
                          hoveredItem === principle.id ? "text-[#FFE100]" : "text-white"
                        }`}
                        onMouseEnter={() => setHoveredItem(principle.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {principle.id}. {principle.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
