"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"
import dynamic from "next/dynamic"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"

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

// Dynamically import the game component with no SSR
const GestaltGame = dynamic(() => import("../gestalt-assessment/gestalt-game"), { ssr: false })

export default function GestaltAssessmentWrapper() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const { refreshBadges, addBadge } = useBadges()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }

    try {
      const userData = JSON.parse(userCookie)
      setUser(userData)

      // Refresh badges when component mounts
      refreshBadges()
    } catch (error) {
      console.error("Error parsing user cookie:", error)
      router.push("/login")
    }
  }, [router, refreshBadges])

  const handleBadgeAchieved = (achieved: boolean, stars = 4) => {
    if (achieved && user) {
      const badgeName = stars === 5 ? "Gestalt Principles Expert (★★★★★)" : "Gestalt Principles Expert (★★★★☆)"
      addBadge("gestalt-assessment", badgeName, stars)
      setTimeout(refreshBadges, 500)
    }
  }

  useEffect(() => {
    // Listen for messages from the game iframe about badge achievements
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "badgeAchieved") {
        handleBadgeAchieved(true, event.data.stars || 4)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [user])

  if (!isClient || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div
      className={`${pressStart2P.variable} ${pixelifySans.variable} h-screen w-screen flex items-center justify-center bg-[#000000]`}
    >
      <iframe
        src="/games/gestalt-assessment/app"
        className="w-full h-full border-0"
        title="Gestalt Principles Assessment"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
