"use client"

import { useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function PageReplacementGame() {
  const [isSoundOn, setIsSoundOn] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const toggleSound = () => {
    setIsSoundOn(!isSoundOn)
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game7_homepage_bg-YMenCT1Kf9mz5ZJdpAk29jxahbj2Nd.webp"
        alt="Page Replacement Game Background"
        fill
        priority
        className="object-cover"
      />

      {/* Central Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-[#002b3c] bg-opacity-80 backdrop-blur-sm w-full max-w-2xl p-8 rounded-lg">
          <h1 className="font-pixelify-sans text-[#4cf190] text-4xl md:text-5xl text-center mb-6">Page Replacement</h1>

          <p className="font-pixelify-sans text-white text-lg md:text-xl text-center mb-10">
            Put your knowledge of page replacement algorithms to the test by solving memory management problems.
          </p>

          <div className="flex flex-col items-center mb-8">
            {/* Use Link component instead of router.push for more reliable navigation */}
            <Link href="/games/page-replacement-assessment/app/game">
              <button
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="font-press-start-2p text-xl transition-colors duration-300"
                style={{ color: isHovered ? "#ffff00" : "#ffffff" }}
              >
                Check it out
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Sound button - positioned at the bottom left of the screen */}
      <div className="fixed bottom-4 left-4 z-20">
        <button
          onClick={toggleSound}
          className="p-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          {isSoundOn ? <Volume2 className="h-6 w-6 text-white" /> : <VolumeX className="h-6 w-6 text-white" />}
        </button>
      </div>
    </div>
  )
}
