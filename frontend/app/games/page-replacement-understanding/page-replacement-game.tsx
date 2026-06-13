"use client"

import { useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function PageReplacementGame() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [hoveredAlgorithm, setHoveredAlgorithm] = useState<string | null>(null)

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  const algorithms = [
    { id: "fifo", name: "FIFO", number: 1 },
    { id: "optimal", name: "Optimal", number: 2 },
    { id: "lru", name: "LRU", number: 3 },
  ]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game7_homepage_bg-lGX2wyQGnXNghtkwbxH5SNNEaojINP.webp"
        alt="Page Replacement Game Background"
        fill
        priority
        className="object-cover"
      />

      {/* Central Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-[#002b3c] bg-opacity-80 w-full max-w-2xl p-8">
          <h1 className="font-pixelify-sans text-[#4cf190] text-4xl md:text-5xl text-center mb-6">Page Replacement</h1>

          <p className="font-pixelify-sans text-white text-lg md:text-xl text-center mb-10">
            Learn how page replacement algorithms manage memory by deciding which pages to keep in and swap out of
            memory.
          </p>

          <div className="flex flex-col items-center mb-8">
            <p className="font-pixelify-sans text-white text-xl">↓ LETS PLAY ↓</p>
          </div>

          <div className="flex flex-col items-center space-y-3">
            {algorithms.map((algorithm) => (
              <Link href={`/${algorithm.id}`} key={algorithm.id} className="text-center">
                <div
                  className="font-pixelify-sans text-xl cursor-pointer"
                  onMouseEnter={() => setHoveredAlgorithm(algorithm.id)}
                  onMouseLeave={() => setHoveredAlgorithm(null)}
                  style={{
                    color: hoveredAlgorithm === algorithm.id ? "#ffff00" : "#ffffff",
                  }}
                >
                  {algorithm.number}. {algorithm.name}
                </div>
              </Link>
            ))}
          </div>

          {/* Sound button */}
          <div className="absolute bottom-4 left-4">
            <button
              onClick={toggleSound}
              className="p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              {isSoundOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
