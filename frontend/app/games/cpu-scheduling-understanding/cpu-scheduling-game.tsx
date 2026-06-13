"use client"

import { useState, useEffect, useRef } from "react"
import { Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function CPUSchedulingGame() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [hoveredAlgorithm, setHoveredAlgorithm] = useState<string | null>(null)
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null)

  // Initialize and handle background music
  useEffect(() => {
    // Create the audio element for background music
    backgroundMusicRef.current = new Audio(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-zvy9gfmeEvj0XLWnWF3zCCyUsNoo85.mp3",
    )

    // Set properties
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.loop = true
      backgroundMusicRef.current.volume = 0.5

      // Play music if sound is on
      if (isSoundOn) {
        backgroundMusicRef.current.play().catch((err) => console.error("Error playing background music:", err))
      }
    }

    // Cleanup function to stop music when component unmounts
    return () => {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause()
        backgroundMusicRef.current.currentTime = 0
      }
    }
  }, []) // Empty dependency array means this runs once on mount

  // Handle sound toggle
  useEffect(() => {
    if (backgroundMusicRef.current) {
      if (isSoundOn) {
        backgroundMusicRef.current.play().catch((err) => console.error("Error playing background music:", err))
      } else {
        backgroundMusicRef.current.pause()
      }
    }
  }, [isSoundOn])

  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  const algorithms = [
    { id: "fcfs", name: "FCFS", number: 1 },
    { id: "sjf", name: "SJF", number: 2 },
    { id: "srt", name: "SRT", number: 3 },
    { id: "rr", name: "RR", number: 4 },
  ]

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage_bg-NlSfV13Ap8a9cjnYKq49ByF3TWdPve.webp"
        alt="CPU Scheduling Game Background"
        fill
        priority
        className="object-cover"
      />

      {/* Central Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="border-4 border-[#441dbf] rounded-lg bg-[#002b3c] w-full max-w-2xl p-8">
          <h1 className="font-pixelify-sans text-[#4cf190] text-4xl md:text-5xl text-center mb-6">CPU Scheduling</h1>

          <p className="font-pixelify-sans text-white text-lg md:text-xl text-center mb-10">
            Discover how different CPU scheduling algorithms prioritize tasks to optimize system performance.
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
