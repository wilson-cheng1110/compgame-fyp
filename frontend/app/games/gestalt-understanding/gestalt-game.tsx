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
                    <Link href={principle.link} className="block">
                      {/* These five ARE the game's menu, and they were five lines of text whose
                          only clue was a hover colour -- nothing said "press me" while the mouse
                          was still. Same pixel register as the CTA below, now with an edge. */}
                      <span
                        data-testid="principle-button"
                        className={`block w-64 md:w-80 text-center font-mono text-xl md:text-2xl px-5 py-3 border-2 cursor-pointer transition-colors duration-200 shadow-[3px_3px_0px_0px_#000] ${
                          hoveredItem === principle.id
                            ? "bg-[#FFE100] border-[#a16207] text-black"
                            : "bg-[#00507a] border-[#00BFFF] text-white"
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
