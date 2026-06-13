"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"
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

export default function PageReplacementAssessmentWrapper() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const { refreshBadges } = useBadges()
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
      console.log("Badge achievement detected")

      // Create badge name with star rating
      const badgeName = stars === 5 ? "Page Replacement Expert (★★★★★)" : "Page Replacement Expert (★★★★☆)"

      try {
        // Get existing users data
        const existingUsers = Cookies.get("users")
        if (existingUsers) {
          const users = JSON.parse(existingUsers)
          if (users[user.email]) {
            // Get user's badges
            const userBadges = users[user.email].badges || []

            // Check if user already has a Page Replacement assessment badge
            const existingBadgeIndex = userBadges.findIndex(
              (badge: any) => badge.gameId === "page-replacement-assessment",
            )

            if (existingBadgeIndex >= 0) {
              // User already has a badge for this assessment
              const existingBadge = userBadges[existingBadgeIndex]

              // Only update if new achievement has more stars
              if (stars > existingBadge.level) {
                console.log("Upgrading badge from", existingBadge.level, "stars to", stars, "stars")

                // Update the existing badge
                userBadges[existingBadgeIndex] = {
                  gameId: "page-replacement-assessment",
                  name: badgeName,
                  level: stars,
                  earnedAt: new Date().toISOString(),
                }

                // Save updated badges
                users[user.email].badges = userBadges
                Cookies.set("users", JSON.stringify(users), { expires: 365 })

                // Update the user cookie
                Cookies.set("user", JSON.stringify(user), { expires: 7 })

                console.log("Badge upgraded successfully")
                setTimeout(refreshBadges, 500)
              } else {
                console.log("User already has same or higher level badge")
              }
            } else {
              // User doesn't have this badge yet, add it
              userBadges.push({
                gameId: "page-replacement-assessment",
                name: badgeName,
                level: stars,
                earnedAt: new Date().toISOString(),
              })

              // Save updated badges
              users[user.email].badges = userBadges
              Cookies.set("users", JSON.stringify(users), { expires: 365 })

              // Update the user cookie
              Cookies.set("user", JSON.stringify(user), { expires: 7 })

              console.log("New badge added successfully")
              setTimeout(refreshBadges, 500)
            }

            // Force a refresh of badges
            setTimeout(refreshBadges, 1000)
          }
        }
      } catch (error) {
        console.error("Error updating badge:", error)
      }
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
        src="/games/page-replacement-assessment/app"
        className="w-full h-full border-0"
        title="Page Replacement Assessment"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
