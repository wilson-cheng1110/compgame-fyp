"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"
import dynamic from "next/dynamic"

// Dynamically import the game component with no SSR
const FittsLawGame = dynamic(() => import("../page"), { ssr: false })

export default function Page() {
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

  const handleBadgeAchieved = (achieved: boolean) => {
    if (achieved && user) {
      console.log("Badge achievement detected")

      // Use the addBadge function from context
      const success = addBadge(
        "fitts-law-assessment",
        "Fitts' Law Expert",
        3, // Medium difficulty level
      )

      if (success) {
        console.log("Badge added successfully")
        // Force a refresh of badges
        setTimeout(refreshBadges, 500)
      }

      // addBadge (via badge-context) already handles persistence; no duplicate write needed
    }
  }

  if (!isClient || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return <FittsLawGame onBadgeAchieved={handleBadgeAchieved} />
}
