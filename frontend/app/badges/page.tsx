"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"

const pixelifySans = Pixelify_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixelify-sans",
})

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start-2p",
})

// Avatar URLs mapping
const avatarUrls = {
  1: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
  2: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
}

export default function BadgesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const { badges, refreshBadges } = useBadges()

  // Check if user is logged in
  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userCookie)
    setUser(userData)

    // Refresh badges when component mounts
    refreshBadges()

    // Check for dark mode preference
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router, refreshBadges])

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

  const handleSignOut = () => {
    Cookies.remove("user")
    router.push("/")
  }

  // Direct navigation to dashboard using window.location
  const goToDashboard = () => {
    // Refresh badges before navigation
    refreshBadges()

    // Use window.location for direct navigation
    window.location.href = "/dashboard"
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get avatar URL based on user's avatarId
  const getAvatarUrl = (avatarId: number) => {
    return avatarUrls[avatarId as keyof typeof avatarUrls] || "/placeholder.svg?height=80&width=80"
  }

  // Function to truncate email
  const truncateEmail = (email: string) => {
    if (email.length > 20) {
      return email.substring(0, 20) + "..."
    }
    return email
  }

  // Function to navigate to badges page
  const goToBadgesPage = () => {
    window.location.href = "/badges"
  }

  return (
    <main
      className={`min-h-screen ${darkMode ? "bg-[#020617] text-white" : "bg-white text-black"} ${pixelifySans.variable} ${pressStart2P.variable}`}
    >
      {/* Header */}
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={goToDashboard}>
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png"
              alt="COMPGame Logo"
              width={40}
              height={40}
              className="mr-3"
            />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </div>

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
                    className="w-5 h-5 text-black"
                  >
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-black"
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
              className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans text-base font-bold hover:bg-[#fde047] transition-colors text-black shadow-[3px_3px_0px_0px_#000]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto py-8 px-8 md:px-16">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Content - Badges List */}
          <div className="w-full md:w-3/4">
            {/* Badges Title */}
            <div className="border-b border-gray-300 mb-6">
              <div className="inline-block px-8 py-2 border-2 border-black border-b-0 bg-[#f8f6ee] dark:bg-[#1e293b]">
                <h2 className="font-press-start-2p text-xl text-black dark:text-white">Badges</h2>
              </div>
            </div>

            {/* Badges Table */}
            <div
              className={`border-2 border-black overflow-hidden ${darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"}`}
            >
              {/* Table Header */}
              <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-300">
                <div className="font-press-start-2p text-sm">Name</div>
                <div className="font-press-start-2p text-sm">Date</div>
              </div>

              {/* Table Content */}
              <div className="p-4">
                {badges.length === 0 ? (
                  <div className="text-center py-8 font-pixelify-sans">
                    You haven't earned any badges yet. Play games to earn badges!
                  </div>
                ) : (
                  badges.map((badge, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4 mb-4">
                      <div className={`p-3 border border-black ${darkMode ? "bg-[#111827]" : "bg-white"}`}>
                        <span className="font-pixelify-sans">{badge.name}</span>
                      </div>
                      <div className={`p-3 border border-black ${darkMode ? "bg-[#111827]" : "bg-white"}`}>
                        <span className="font-pixelify-sans">{formatDate(badge.earnedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - User Profile */}
          <div className="w-full md:w-1/4">
            <div className={`p-6 border-2 border-black ${darkMode ? "bg-[#1e293b]" : "bg-[#f8f6ee]"}`}>
              {/* User Profile */}
              <div className="flex flex-col items-center mb-4">
                <Image
                  src={getAvatarUrl(user.avatarId || 1)}
                  alt="User avatar"
                  width={80}
                  height={80}
                  className="object-contain mb-3"
                />
                <h3 className="font-press-start-2p text-xl mb-2">{user.username}</h3>
                <div className="flex items-center">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/star-badge-ElQ2fTsFXwtpnafufaIYFyMOtBYW3l.png"
                    alt="Star badge"
                    width={32}
                    height={32}
                    className="object-contain mr-2"
                  />
                  <span className="font-press-start-2p text-base">{badges.length} Badges</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
