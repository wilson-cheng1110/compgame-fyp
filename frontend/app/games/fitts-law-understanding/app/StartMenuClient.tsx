"use client"

import { useRouter } from "next/navigation"
import ResponsiveContainer from "../components/ResponsiveContainer"
import { useEffect, useRef } from "react"
import { initAudioContext, initBackgroundMusic, playBackgroundMusic, pauseBackgroundMusic } from "../utils/sound"
import SoundToggle from "../components/SoundToggle"

export default function StartMenuClient() {
  const router = useRouter()
  const musicInitialized = useRef(false)

  // Initialize sounds on component mount
  useEffect(() => {
    // Initialize on user interaction to comply with browser autoplay policies
    const handleUserInteraction = () => {
      initAudioContext()

      // Initialize and play background music
      if (!musicInitialized.current) {
        const bgMusic = initBackgroundMusic(
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game1_homepage-u6zpr4NXI8gulA5VNTZkmkAktmGdBd.mp3",
        )
        if (bgMusic) {
          playBackgroundMusic()
          musicInitialized.current = true
        }
      }

      // Remove event listeners after initialization
      document.removeEventListener("click", handleUserInteraction)
      document.removeEventListener("keydown", handleUserInteraction)
      document.removeEventListener("touchstart", handleUserInteraction)
    }

    document.addEventListener("click", handleUserInteraction)
    document.addEventListener("keydown", handleUserInteraction)
    document.addEventListener("touchstart", handleUserInteraction)

    return () => {
      document.removeEventListener("click", handleUserInteraction)
      document.removeEventListener("keydown", handleUserInteraction)
      document.removeEventListener("touchstart", handleUserInteraction)

      // Pause background music when component unmounts
      pauseBackgroundMusic()
    }
  }, [])

  // Function to handle navigation - fixed to use absolute paths
  const handleNavigate = (path: string) => {
    window.location.href = `/games/fitts-law-understanding/app/game/${path}`
  }

  return (
    <ResponsiveContainer>
      <main
        id="fitts-law-main"
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          width: "1920px",
          height: "1080px",
          backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/menuBackground-OOsGT1dpBltNIZ3bE0WSk7nbcyM3ir.png')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Sound toggle button */}
        <div className="absolute left-8 bottom-8 z-10">
          <SoundToggle />
        </div>

        {/* Wave background layers */}
        <div className="absolute inset-0 opacity-30">
          <svg width="1920" height="1080" className="absolute">
            <defs>
              <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: "#01B7CF", stopOpacity: 0.7 }} />
                <stop offset="50%" style={{ stopColor: "#01B7CF", stopOpacity: 0.8 }} />
                <stop offset="100%" style={{ stopColor: "#01B7CF", stopOpacity: 0.7 }} />
              </linearGradient>
            </defs>
            {[...Array(6)].map((_, i) => (
              <path
                key={i}
                d="M-100 50 Q210 20, 520 50 T1140 50 T1760 50 T2380 50 V200 H-100 Z"
                fill="url(#wave-gradient)"
                opacity="0.3"
                transform={`translate(0, ${i * 200})`}
              >
                <animate
                  attributeName="d"
                  dur="5s"
                  repeatCount="indefinite"
                  values="
                  M-100 50 Q210 20, 520 50 T1140 50 T1760 50 T2380 50 V200 H-100 Z;
                  M-100 50 Q210 80, 520 50 T1140 50 T1760 50 T2380 50 V200 H-100 Z;
                  M-100 50 Q210 20, 520 50 T1140 50 T1760 50 T2380 50 V200 H-100 Z
                "
                />
              </path>
            ))}
          </svg>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-12">
          <h1 className="text-[60px] text-[#062F5E] font-press-start" style={{ marginTop: "-100px" }}>
            Fitts&apos; Law
          </h1>

          <div
            className="bg-[#03607F] border-[10px] border-white flex flex-col items-center justify-center"
            style={{
              width: "1189px",
              height: "477px",
            }}
          >
            <p className="text-[30px] text-white text-center max-w-[800px] mb-16 font-quantico">
              This game will help you understand how target size and distance affect the time to complete a task.
            </p>

            <div className="flex flex-col gap-8">
              <button
                onClick={() => handleNavigate("distance")}
                className="w-[800px] h-[65px] bg-[#093847] border-[5px] border-white hover:border-[#FFF28C] flex items-center justify-center text-white hover:text-[#FFF28C] text-[30px] transition-colors duration-300 font-quantico"
              >
                same size different distance
              </button>

              <button
                onClick={() => handleNavigate("size")}
                className="w-[800px] h-[65px] bg-[#093847] border-[5px] border-white hover:border-[#FFF28C] flex items-center justify-center text-white hover:text-[#FFF28C] text-[30px] transition-colors duration-300 font-quantico"
              >
                same distance different size
              </button>
            </div>
          </div>
        </div>
      </main>
    </ResponsiveContainer>
  )
}
