"use client"

import type React from "react"

import { useEffect, useState, createContext } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

// Import the CSS directly to ensure it's loaded
import "../fitts-law-understanding/app/globals.css"

// Load Press Start 2P font
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

// Load Quantico font
const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

// Add this at the top of the file, after the imports
declare global {
  interface HTMLAudioElement {
    playPromise: Promise<void> | null
  }
}

// Create a context to share the scale factor
interface ScaleContextType {
  scale: number
}

const ScaleContext = createContext<ScaleContextType>({ scale: 1 })

// Sound store implementation
import { create } from "zustand"

interface SoundState {
  isMuted: boolean
  isInitialized: boolean
  toggleMute: () => void
  setInitialized: (value: boolean) => void
}

const useSoundStore = create<SoundState>((set) => ({
  isMuted: false,
  isInitialized: false,
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setInitialized: (value: boolean) => set({ isInitialized: value }),
}))

// Sound utility functions
let audioContext: AudioContext | null = null
const audioElements: Record<string, HTMLAudioElement> = {}
let backgroundMusic: HTMLAudioElement | null = null

function initAudioContext() {
  if (audioContext) return true

  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    useSoundStore.getState().setInitialized(true)
    return true
  } catch (err) {
    console.error("Failed to initialize audio context:", err)
    return false
  }
}

function initBackgroundMusic(url: string) {
  if (backgroundMusic) return backgroundMusic

  try {
    backgroundMusic = new Audio(url)
    backgroundMusic.loop = true
    backgroundMusic.volume = 0.3
    backgroundMusic.preload = "auto"
    // Add a property to track the play promise
    backgroundMusic.playPromise = null

    const unsubscribe = useSoundStore.subscribe((state) => {
      if (backgroundMusic) {
        backgroundMusic.muted = state.isMuted
      }
    })

    return backgroundMusic
  } catch (err) {
    console.error("Failed to initialize background music:", err)
    return null
  }
}

function playBackgroundMusic() {
  if (!backgroundMusic) return

  const { isMuted } = useSoundStore.getState()
  backgroundMusic.muted = isMuted

  // Add a flag to track if we're currently trying to play
  if (backgroundMusic.playPromise) {
    return // Don't try to play if we're already in the process
  }

  const bgm = backgroundMusic
  try {
    // Store the play promise
    bgm.playPromise = bgm.play()

    // Handle the promise properly
    if (bgm.playPromise !== undefined) {
      bgm.playPromise
        .then(() => {
          // Playback started successfully
          bgm.playPromise = null
        })
        .catch((error) => {
          // Handle the error
          console.error("Failed to play background music:", error)
          bgm.playPromise = null
        })
    }
  } catch (err) {
    console.error("Failed to play background music:", err)
    bgm.playPromise = null
  }
}

function pauseBackgroundMusic() {
  if (!backgroundMusic) return

  const bgm = backgroundMusic
  try {
    // If there's a pending play operation, wait for it to complete or fail before pausing
    if (bgm.playPromise) {
      bgm.playPromise
        .then(() => {
          bgm.pause()
          bgm.playPromise = null
        })
        .catch(() => {
          // If play failed, we can still try to pause
          bgm.pause()
          bgm.playPromise = null
        })
    } else {
      // No pending play operation, safe to pause
      bgm.pause()
    }
  } catch (err) {
    console.error("Failed to pause background music:", err)
  }
}

// SoundToggle component
function SoundToggle({ className = "" }: { className?: string }) {
  const { isMuted, toggleMute, isInitialized } = useSoundStore()

  useEffect(() => {
    if (!isInitialized) {
      const handleUserInteraction = () => {
        initAudioContext()
        document.removeEventListener("click", handleUserInteraction, true)
        document.removeEventListener("keydown", handleUserInteraction, true)
        document.removeEventListener("touchstart", handleUserInteraction, true)
      }

      document.addEventListener("click", handleUserInteraction, true)
      document.addEventListener("keydown", handleUserInteraction, true)
      document.addEventListener("touchstart", handleUserInteraction, true)

      return () => {
        document.removeEventListener("click", handleUserInteraction, true)
        document.removeEventListener("keydown", handleUserInteraction, true)
        document.removeEventListener("touchstart", handleUserInteraction, true)
      }
    }
  }, [isInitialized])

  const handleToggle = () => {
    if (!isInitialized) {
      initAudioContext()
    }
    toggleMute()
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center justify-center p-3 bg-[#2F5162] rounded-full hover:bg-[#3A6275] transition-colors ${className}`}
      aria-label={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? <VolumeX size={24} className="text-white" /> : <Volume2 size={24} className="text-white" />}
    </button>
  )
}

// ResponsiveContainer component
function ResponsiveContainer({
  children,
  designWidth = 1920,
  designHeight = 1080,
  className = "",
}: {
  children: React.ReactNode
  designWidth?: number
  designHeight?: number
  className?: string
}) {
  const [scale, setScale] = useState(1)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const updateScale = () => {
      if (!isClient) return

      const container = document.getElementById("game-container")
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // Calculate scale based on both width and height constraints
      const scaleX = containerWidth / designWidth
      const scaleY = containerHeight / designHeight

      // Use the smaller scale to ensure the entire game fits
      const newScale = Math.min(scaleX, scaleY)

      setScale(newScale)
    }

    // Initial calculation
    updateScale()

    // Update on resize
    if (isClient) {
      window.addEventListener("resize", updateScale)

      // Create a ResizeObserver to detect changes in the container size
      const resizeObserver = new ResizeObserver(updateScale)
      const container = document.getElementById("game-container")
      if (container) {
        resizeObserver.observe(container)
      }

      return () => {
        window.removeEventListener("resize", updateScale)
        if (container) {
          resizeObserver.unobserve(container)
        }
        resizeObserver.disconnect()
      }
    }
  }, [designWidth, designHeight])

  if (!mounted) {
    return null // Prevent layout shift during hydration
  }

  return (
    <ScaleContext.Provider value={{ scale }}>
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div
          className={`origin-center relative ${className}`}
          style={{
            width: `${designWidth}px`,
            height: `${designHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          {children}
        </div>
      </div>
    </ScaleContext.Provider>
  )
}

// Main game component
export default function FittsLawGameWrapper() {
  const musicInitialized = useState(false)[0]
  const router = useRouter()

  // Initialize sounds on component mount
  useEffect(() => {
    // Initialize on user interaction to comply with browser autoplay policies
    const handleUserInteraction = () => {
      initAudioContext()

      // Initialize and play background music
      if (!musicInitialized) {
        const bgMusic = initBackgroundMusic(
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/game1_homepage-u6zpr4NXI8gulA5VNTZkmkAktmGdBd.mp3",
        )
        if (bgMusic) {
          playBackgroundMusic()
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
  }, [musicInitialized])

  // Function to handle navigation - fixed to use absolute paths
  const handleNavigate = (path: string) => {
    // Use window.location for a full page navigation with the correct path structure
    window.location.href = `/games/fitts-law-understanding/app/game/${path}`
  }

  return (
    <div className={`${pressStart2P.variable} ${pixelifySans.variable}`}>
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
    </div>
  )
}
