"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import { Volume2, VolumeX, Home } from "lucide-react"
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
      className={`flex items-center justify-center p-3 bg-[#0066CC] rounded-md hover:bg-[#0055AA] transition-colors ${className}`}
      aria-label={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? <VolumeX className="h-8 w-8 text-white" /> : <Volume2 className="h-8 w-8 text-white" />}
    </button>
  )
}

// Main game component
export default function GestaltUnderstandingWrapper() {
  const musicInitialized = useState(false)[0]
  const router = useRouter()
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)

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

  // Instead of using an iframe, let's directly render the game UI
  const principles = [
    { id: 1, name: "Similarity", link: "/games/gestalt-understanding/app/similarity" },
    { id: 2, name: "Proximity", link: "/games/gestalt-understanding/app/proximity" },
    { id: 3, name: "Continuity", link: "/games/gestalt-understanding/app/continuity" },
    { id: 4, name: "Symmetry", link: "/games/gestalt-understanding/app/symmetry" },
    { id: 5, name: "Closure", link: "/games/gestalt-understanding/app/closure" },
  ]

  return (
    <div className={`${pressStart2P.variable} ${pixelifySans.variable} h-full w-full`}>
      <div className="flex flex-col md:flex-row h-full w-full bg-black p-4">
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

              {/* Control buttons */}
              <div className="absolute bottom-6 left-6 right-6 flex justify-between">
                <SoundToggle />
                <Link href="/games/gestalt-understanding">
                  <div className="bg-[#0066CC] p-2 rounded-md hover:bg-[#0055AA] transition-colors duration-200">
                    <Home className="h-8 w-8 text-white" />
                  </div>
                </Link>
              </div>
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
    </div>
  )
}
