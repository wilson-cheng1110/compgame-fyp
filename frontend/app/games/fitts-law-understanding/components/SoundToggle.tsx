"use client"

import { Volume2, VolumeX } from "lucide-react"
import { useEffect } from "react"
import { useSoundStore, initAudioContext } from "../utils/sound"

interface SoundToggleProps {
  className?: string
}

export default function SoundToggle({ className = "" }: SoundToggleProps) {
  const { isMuted, toggleMute, isInitialized } = useSoundStore()

  // Initialize audio context on first render
  useEffect(() => {
    // Try to initialize audio context on component mount
    if (!isInitialized) {
      const handleUserInteraction = () => {
        initAudioContext()
        // Remove event listeners after initialization
        document.removeEventListener("click", handleUserInteraction, true)
        document.removeEventListener("keydown", handleUserInteraction, true)
        document.removeEventListener("touchstart", handleUserInteraction, true)
      }

      // Add event listeners to initialize on user interaction
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
    // Initialize audio context if not already initialized
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
