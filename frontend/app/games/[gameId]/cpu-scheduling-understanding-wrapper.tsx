"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import { Volume2, VolumeX } from "lucide-react"
import Link from "next/link"

// Load Press Start 2P font
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

// Load Pixelify Sans font
const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

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

  try {
    // Store the play promise
    backgroundMusic.playPromise = backgroundMusic.play()

    // Handle the promise properly
    if (backgroundMusic.playPromise !== undefined) {
      backgroundMusic.playPromise
        .then(() => {
          // Playback started successfully
          backgroundMusic.playPromise = null
        })
        .catch((error) => {
          // Handle the error
          console.error("Failed to play background music:", error)
          backgroundMusic.playPromise = null
        })
    }
  } catch (err) {
    console.error("Failed to play background music:", err)
    backgroundMusic.playPromise = null
  }
}

function pauseBackgroundMusic() {
  if (!backgroundMusic) return

  try {
    // If there's a pending play operation, wait for it to complete or fail before pausing
    if (backgroundMusic.playPromise) {
      backgroundMusic.playPromise
        .then(() => {
          backgroundMusic.pause()
          backgroundMusic.playPromise = null
        })
        .catch(() => {
          // If play failed, we can still try to pause
          backgroundMusic.pause()
          backgroundMusic.playPromise = null
        })
    } else {
      // No pending play operation, safe to pause
      backgroundMusic.pause()
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
      className={`flex items-center justify-center p-3 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors ${className}`}
      aria-label={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? <VolumeX className="h-8 w-8 text-white" /> : <Volume2 className="h-8 w-8 text-white" />}
    </button>
  )
}

// Main game component
export default function CPUSchedulingUnderstandingWrapper() {
  const musicInitialized = useState(false)[0]
  const router = useRouter()
  const [hoveredAlgorithm, setHoveredAlgorithm] = useState<string | null>(null)

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

  const algorithms = [
    { id: "fcfs", name: "FCFS", number: 1 },
    { id: "sjf", name: "SJF", number: 2 },
    { id: "srt", name: "SRT", number: 3 },
    { id: "rr", name: "RR", number: 4 },
  ]

  return (
    <div className={`${pressStart2P.variable} ${pixelifySans.variable} h-full w-full`}>
      <div className="relative h-screen w-full overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage_bg-NlSfV13Ap8a9cjnYKq49ByF3TWdPve.webp"
            alt="CPU Scheduling Game Background"
            className="w-full h-full object-cover"
          />
        </div>

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
                <Link
                  href={`/games/cpu-scheduling-understanding/app/${algorithm.id}`}
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

            {/* Sound button */}
            <div className="absolute bottom-4 left-4">
              <SoundToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
