"use client"

import { useState, useEffect, type ReactNode } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Maximize2, Minimize2 } from "lucide-react"
import Cookies from "js-cookie"
import { auth } from "@/lib/api"
import PreservedLink from "./preserved-link"

interface GameControl {
  type: "mouse" | "keyboard" | "other"
  description: string
}

interface GameLayoutProps {
  children: ReactNode
  title: string
  controls: GameControl[]
  className?: string
}

export default function GameLayout({ children, title, controls, className }: GameLayoutProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Check if user is logged in
  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userCookie)
    setUser(userData)

    // Check for dark mode preference
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.body.classList.add("dark-mode")
      Cookies.set("darkMode", "true", { expires: 365 })
    } else {
      document.body.classList.remove("dark-mode")
      Cookies.set("darkMode", "false", { expires: 365 })
    }
  }

  const handleSignOut = async () => {
    try { await auth.logout() } catch { /* sign out locally regardless */ }
    Cookies.remove("user")
    router.push("/")
  }

  const toggleFullscreen = () => {
    const gameContainer = document.getElementById("game-container")

    if (!document.fullscreenElement) {
      if (gameContainer?.requestFullscreen) {
        gameContainer.requestFullscreen()
        setIsFullscreen(true)
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <main className={`shell min-h-screen ${className || ""}`}>
      {/* Header */}
      <header className="u-nav">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          <PreservedLink href="/dashboard" className="flex items-center">
            <Image
              src="/images/logo.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </PreservedLink>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                {darkMode ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>

            <button
              onClick={handleSignOut}
              className="u-btn"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto py-8 px-4 md:px-8 pb-16 flex flex-col items-center">
        {/* Game Title */}
        <h1 className="u-h1 mb-6 text-center">{title}</h1>

        {/* Fullscreen Instruction */}
        <div className="w-full max-w-4xl mx-auto mb-4 text-center">
          <p className="u-card-quiet u-stem p-3" style={{ maxWidth: "none" }}>
            <span className="font-bold">Tip:</span> Click the fullscreen button{" "}
            <Maximize2 className="inline-block mx-1" size={16} /> in the bottom right corner for the best gaming
            experience!
          </p>
        </div>

        {/* Game Container */}
        <div className="w-full max-w-4xl mx-auto mb-8 relative">
          <div
            id="game-container"
            className="relative bg-[#1e293b] flex items-center justify-center"
            style={{
              width: "100%",
              // Was height:500px + overflow:hidden, which CLIPPED any game taller
              // than 500px — gestalt-understanding's menu is 919px, so its "✓ I've
              // learned these" completion CTA was physically unreachable by a real
              // mouse, forcing every gestalt student onto the unit's escape hatch
              // (sweep finding H3). Grow to fit the content and let the wheel reach
              // what a small viewport can't show.
              minHeight: "500px",
              maxHeight: "none",
              overflowY: "auto",
              margin: "0 auto",
            }}
          >
            <div className="w-full h-full flex items-center justify-center">{children}</div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="absolute bottom-4 right-4 bg-[#020617] border-2 border-white p-2 text-white hover:bg-[#1e293b] transition-colors z-10"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          </div>

          {/* Game Controls Panel - Ensuring full width */}
          <div
            className="u-card-quiet p-6"
            style={{ width: "100%", maxWidth: "100%" }}
          >
            <h2 className="u-h2 mb-4">Controls</h2>
            <div className="space-y-3">
              {controls.map((control, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-6 h-6 mr-3 flex-shrink-0">
                    {control.type === "mouse" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <rect x="6" y="3" width="12" height="18" rx="6" />
                        <line x1="12" y1="7" x2="12" y2="11" />
                      </svg>
                    ) : control.type === "keyboard" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                        <line x1="6" y1="8" x2="6" y2="8" />
                        <line x1="10" y1="8" x2="10" y2="8" />
                        <line x1="14" y1="8" x2="14" y2="8" />
                        <line x1="18" y1="8" x2="18" y2="8" />
                        <line x1="6" y1="12" x2="6" y2="12" />
                        <line x1="10" y1="12" x2="10" y2="12" />
                        <line x1="14" y1="12" x2="14" y2="12" />
                        <line x1="18" y1="12" x2="18" y2="12" />
                        <line x1="6" y1="16" x2="18" y2="16" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    {control.type === "mouse" && <span className="font-bold">Left Click (Mouse):</span>}
                    {control.type === "keyboard" && <span className="font-bold">Number Input (Keyboard):</span>}
                    {control.type === "other" && <span className="font-bold">Other:</span>} {control.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
