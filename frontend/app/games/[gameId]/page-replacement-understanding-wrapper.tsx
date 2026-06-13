"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { Volume2, VolumeX } from "lucide-react"
import { pixelifySans, pressStart2P } from "../../games/page-replacement-understanding/app/fonts"

// Dynamically import the PageReplacementGame component with SSR disabled
const PageReplacementGame = dynamic(() => import("../../games/page-replacement-understanding/page-replacement-game"), {
  ssr: false,
})

export default function PageReplacementUnderstandingWrapper() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [hoveredAlgorithm, setHoveredAlgorithm] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio context and background music
  useEffect(() => {
    // Create AudioContext
    if (typeof window !== "undefined" && !audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContext()
    }

    // Initialize background music
    if (!backgroundMusicRef.current) {
      backgroundMusicRef.current = new Audio(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-Rl9qXJUOOgGVT8UK5G7J4WQPuMSKnx.mp3",
      )
      backgroundMusicRef.current.loop = true

      if (isSoundOn) {
        backgroundMusicRef.current.play().catch((err) => {
          console.error("Error playing background music:", err)
        })
      }
    }

    return () => {
      // Clean up audio when component unmounts
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause()
        backgroundMusicRef.current = null
      }
    }
  }, [])

  // Toggle sound
  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)

    if (backgroundMusicRef.current) {
      if (isSoundOn) {
        backgroundMusicRef.current.pause()
      } else {
        backgroundMusicRef.current.play().catch((err) => {
          console.error("Error playing background music:", err)
        })
      }
    }
  }

  // Update background music when sound state changes
  useEffect(() => {
    if (backgroundMusicRef.current) {
      if (isSoundOn) {
        backgroundMusicRef.current.play().catch((err) => {
          console.error("Error playing background music:", err)
        })
      } else {
        backgroundMusicRef.current.pause()
      }
    }
  }, [isSoundOn])

  const algorithms = [
    { id: "fifo", name: "FIFO", number: 1 },
    { id: "optimal", name: "Optimal", number: 2 },
    { id: "lru", name: "LRU", number: 3 },
  ]

  return (
    <div className={`relative h-screen w-full overflow-hidden ${pixelifySans.variable} ${pressStart2P.variable}`}>
      {/* Game Title */}
      <div className="absolute top-0 left-0 right-0 p-4 text-center">
        <h1 className="text-4xl font-bold text-white">Page Replacement - Learning</h1>
      </div>

      {/* Tip */}
      <div className="absolute top-20 left-0 right-0 mx-auto w-full max-w-4xl p-4 bg-blue-100 rounded-md">
        <p className="text-blue-800">
          Tip: Click the Fullscreen button <span className="inline-block">⤢</span> in the bottom right corner for the
          best gaming experience!
        </p>
      </div>

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
              <Link
                href={`/games/page-replacement-understanding/app/${algorithm.id}`}
                key={algorithm.id}
                className="text-center"
              >
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
        </div>
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

      {/* Fullscreen button */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => {
            const elem = document.documentElement
            if (elem.requestFullscreen) {
              elem.requestFullscreen()
            }
          }}
          className="p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <span className="text-white text-xl">⤢</span>
        </button>
      </div>
    </div>
  )
}
