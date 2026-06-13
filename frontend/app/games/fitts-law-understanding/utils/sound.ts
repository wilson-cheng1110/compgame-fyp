// Sound utility for playing game sound effects
import { create } from "zustand"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

// Sound state management
interface SoundState {
  isMuted: boolean
  isInitialized: boolean
  toggleMute: () => void
  setInitialized: (value: boolean) => void
}

export const useSoundStore = create<SoundState>((set) => ({
  isMuted: false,
  isInitialized: false,
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setInitialized: (value: boolean) => set({ isInitialized: value }),
}))

// Create audio context for better browser compatibility
let audioContext: AudioContext | null = null

// Audio elements cache
const audioElements: Record<string, HTMLAudioElement> = {}

// Background music element
let backgroundMusic: HTMLAudioElement | null = null

// Rolling sound element
let rollingSound: HTMLAudioElement | null = null

// Initialize audio context (call this on user interaction)
export function initAudioContext() {
  if (audioContext || !isClient) return true

  try {
    // Create audio context
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    useSoundStore.getState().setInitialized(true)
    console.log("Audio context initialized successfully")
    return true
  } catch (err) {
    console.error("Failed to initialize audio context:", err)
    return false
  }
}

// Load and cache a sound
function loadSound(key: string, url: string): HTMLAudioElement {
  if (!isClient) {
    throw new Error("Cannot load sound on server side")
  }

  if (audioElements[key]) return audioElements[key]

  try {
    // Create audio element
    const audio = new Audio(url)
    audio.preload = "auto"

    // Cache the audio element
    audioElements[key] = audio
    console.log(`Sound ${key} loaded successfully`)

    return audio
  } catch (err) {
    console.error(`Failed to load sound ${key}:`, err)
    throw err
  }
}

// Play a sound
export function playSound(key: string, url: string) {
  if (!isClient) return

  const { isMuted, isInitialized } = useSoundStore.getState()

  if (isMuted) return

  if (!isInitialized) {
    const initialized = initAudioContext()
    if (!initialized) return
  }

  try {
    // Get or create audio element
    let audio = audioElements[key]
    if (!audio) {
      audio = loadSound(key, url)
    }

    // Reset and play
    audio.currentTime = 0
    audio.volume = 0.5 // 50% volume

    // Play the sound
    const playPromise = audio.play()

    // Handle play promise (required for modern browsers)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error(`Failed to play sound ${key}:`, error)
      })
    }

    console.log(`Playing sound ${key}`)
  } catch (err) {
    console.error(`Failed to play sound ${key}:`, err)
  }
}

// Play catch sound
export function playCatchSound() {
  if (!isClient) return

  const { isMuted } = useSoundStore.getState()
  if (isMuted) return

  // Create a synthesized catch sound
  const audio = new Audio()
  audio.volume = 0.5

  // Create oscillator for catch sound
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.start()
  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5)
  oscillator.stop(audioContext.currentTime + 0.5)

  console.log("Playing catch sound")
}

// Play congratulations sound
export function playCongratsSound() {
  const { isMuted } = useSoundStore.getState()
  if (isMuted) return

  console.log("Playing congratulations sound")
  playSound(
    "congrats",
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/congratulations-pPML7PZuxEx4j6lrXAsbqrG1RapvjN.mp3",
  )
}

// Play rolling sound
export function playRollingSound() {
  const { isMuted } = useSoundStore.getState()
  if (isMuted) return

  if (rollingSound) {
    stopRollingSound()
  }

  try {
    // Use the loadSound function to ensure proper caching
    rollingSound = loadSound(
      "rolling",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/rolling-aZXbfR9ZmPRHLbFG27NNo8G4TN40ND.mp3",
    )
    rollingSound.volume = 0.4
    rollingSound.loop = true

    const playPromise = rollingSound.play()

    // Handle play promise (required for modern browsers)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error("Failed to play rolling sound:", error)
      })
    }

    console.log("Playing rolling sound")
  } catch (err) {
    console.error("Failed to play rolling sound:", err)
  }
}

// Stop rolling sound
export function stopRollingSound() {
  if (!rollingSound) return

  try {
    rollingSound.pause()
    rollingSound.currentTime = 0
    console.log("Stopped rolling sound")
  } catch (err) {
    console.error("Failed to stop rolling sound:", err)
  }
}

// Background music functions
export function initBackgroundMusic(url: string) {
  if (backgroundMusic) return backgroundMusic

  try {
    backgroundMusic = new Audio(url)
    backgroundMusic.loop = true
    backgroundMusic.volume = 0.3 // Lower volume for background music
    backgroundMusic.preload = "auto"

    // Update background music mute state when global mute changes
    const unsubscribe = useSoundStore.subscribe((state) => {
      if (backgroundMusic) {
        backgroundMusic.muted = state.isMuted
      }
    })

    console.log("Background music initialized")
    return backgroundMusic
  } catch (err) {
    console.error("Failed to initialize background music:", err)
    return null
  }
}

export function playBackgroundMusic() {
  if (!backgroundMusic) return

  const { isMuted } = useSoundStore.getState()
  backgroundMusic.muted = isMuted

  try {
    const playPromise = backgroundMusic.play()

    // Handle play promise (required for modern browsers)
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error("Failed to play background music:", error)
      })
    }

    console.log("Playing background music")
  } catch (err) {
    console.error("Failed to play background music:", err)
  }
}

export function pauseBackgroundMusic() {
  if (!backgroundMusic) return

  try {
    backgroundMusic.pause()
    console.log("Paused background music")
  } catch (err) {
    console.error("Failed to pause background music:", err)
  }
}

export function stopBackgroundMusic() {
  if (!backgroundMusic) return

  try {
    backgroundMusic.pause()
    backgroundMusic.currentTime = 0
    console.log("Stopped background music")
  } catch (err) {
    console.error("Failed to stop background music:", err)
  }
}
