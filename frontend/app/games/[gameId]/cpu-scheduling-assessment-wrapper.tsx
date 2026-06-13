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
const CPUSchedulingGame = dynamic(() => import("../cpu-scheduling-assessment/cpu-scheduling-game"), { ssr: false })

export default function CPUSchedulingAssessmentWrapper() {
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

  // Update the handleBadgeAchieved function to include algorithm type
  const handleBadgeAchieved = (achieved: boolean, algorithm = "General", stars = 4) => {
    if (achieved && user) {
      console.log(`Badge achievement detected for ${algorithm}`)

      // Create badge name with algorithm type and star rating
      const badgeName =
        stars === 5 ? `CPU Scheduling (${algorithm}) Expert (★★★★★)` : `CPU Scheduling (${algorithm}) Expert (★★★★☆)`

      // Create a unique gameId for each algorithm
      const gameId = `cpu-scheduling-assessment-${algorithm.toLowerCase()}`

      try {
        // Get existing users data
        const existingUsers = Cookies.get("users")
        if (existingUsers) {
          const users = JSON.parse(existingUsers)
          if (users[user.email]) {
            // Get user's badges
            const userBadges = users[user.email].badges || []

            // Check if user already has a badge for this specific algorithm
            const existingBadgeIndex = userBadges.findIndex((badge: any) => badge.gameId === gameId)

            if (existingBadgeIndex >= 0) {
              // User already has a badge for this algorithm
              const existingBadge = userBadges[existingBadgeIndex]

              // Only update if new achievement has more stars
              if (stars > existingBadge.level) {
                console.log(`Upgrading ${algorithm} badge from`, existingBadge.level, "stars to", stars, "stars")

                // Update the existing badge
                userBadges[existingBadgeIndex] = {
                  gameId: gameId,
                  name: badgeName,
                  level: stars,
                  earnedAt: new Date().toISOString(),
                }

                // Save updated badges
                users[user.email].badges = userBadges
                Cookies.set("users", JSON.stringify(users), { expires: 365 })

                // Update the user cookie
                Cookies.set("user", JSON.stringify(user), { expires: 7 })

                console.log(`${algorithm} badge upgraded successfully`)
                setTimeout(refreshBadges, 500)
              } else {
                console.log(`User already has same or higher level badge`)
              }
            } else {
              // User doesn't have this badge yet, add it
              userBadges.push({
                gameId: gameId,
                name: badgeName,
                level: stars,
                earnedAt: new Date().toISOString(),
              })

              // Save updated badges
              users[user.email].badges = userBadges
              Cookies.set("users", JSON.stringify(users), { expires: 365 })

              // Update the user cookie
              Cookies.set("user", JSON.stringify(user), { expires: 7 })

              console.log(`New ${algorithm} badge added successfully`)
              setTimeout(refreshBadges, 500)
            }

            // Force a refresh of badges
            setTimeout(refreshBadges, 1000)
          }
        }
      } catch (error) {
        console.error(`Error updating ${algorithm} badge:`, error)
      }
    }
  }

  // Separate useEffect for handling messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "badgeAchieved") {
        const algorithm = event.data.algorithm || "General"
        const stars = event.data.stars || 4
        handleBadgeAchieved(true, algorithm, stars)
      }

      // Handle navigation requests from the iframe
      if (event.data && event.data.type === "navigate") {
        if (event.data.path) {
          console.log("Navigation request received:", event.data.path)
          router.push(event.data.path)
        }
      }
    }

    window.addEventListener("message", handleMessage)

    // Clean up the event listener when the component unmounts
    return () => window.removeEventListener("message", handleMessage)
  }, [user, router])

  if (!isClient || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div
      className={`${pressStart2P.variable} ${pixelifySans.variable} h-screen w-screen flex items-center justify-center bg-[#000000]`}
    >
      <iframe
        src="/games/cpu-scheduling-assessment/app"
        className="w-full h-full border-0"
        title="CPU Scheduling Assessment"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
