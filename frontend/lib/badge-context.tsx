"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import Cookies from "js-cookie"
import { getUsers, setUsers } from "@/lib/user-store"
import { getTopicFromGameId, getDefaultTopicProgress } from "@/lib/topic-definitions"
import type { AllTopicProgress } from "@/lib/topic-definitions"

// Add this check to prevent server-side rendering issues with window
const isClient = typeof window !== "undefined"

interface Badge {
  gameId: string
  name: string
  level: number
  earnedAt: string
}

interface BadgeContextType {
  badges: Badge[]
  refreshBadges: () => void
  addBadge: (gameId: string, name: string, level: number) => boolean
  badgeCount: number
}

const BadgeContext = createContext<BadgeContextType>({
  badges: [],
  refreshBadges: () => {},
  addBadge: () => false,
  badgeCount: 0,
})

export const useBadges = () => useContext(BadgeContext)

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [badges, setBadges] = useState<Badge[]>([])
  const [badgeCount, setBadgeCount] = useState(0)

  const refreshBadges = useCallback(() => {
    try {
      const userCookie = Cookies.get("user")
      if (!userCookie) return

      const userData = JSON.parse(userCookie)
      const users = getUsers()
      if (users[userData.sid] && users[userData.sid].badges) {
        const userBadges = users[userData.sid].badges || []
        setBadges(userBadges)
        setBadgeCount(userBadges.length)
        console.log("Badges refreshed:", userBadges.length)
        console.log("Badge details:", userBadges.map((b: { name: string }) => b.name).join(", "))
      }
    } catch (error) {
      console.error("Error refreshing badges:", error)
    }
  }, [])

  const addBadge = useCallback(
    (gameId: string, name: string, level: number) => {
      try {
        const userCookie = Cookies.get("user")
        if (!userCookie) return false

        const userData = JSON.parse(userCookie)
        const users = getUsers()

        // Also update topic progress whenever a badge is awarded
        const updateTopicProgress = (usersObj: any) => {
          const parsed = getTopicFromGameId(gameId)
          if (!parsed) return
          const { topicId, mode } = parsed
          const existing: AllTopicProgress = usersObj[userData.sid]?.topicProgress ?? {}
          const current = existing[topicId] ?? getDefaultTopicProgress()
          const now = new Date().toISOString()
          if (mode === "understanding") {
            existing[topicId] = { ...current, understandingCompleted: true, understandingCompletedAt: current.understandingCompletedAt ?? now }
          } else {
            existing[topicId] = { ...current, assessmentCompleted: true, assessmentCompletedAt: current.assessmentCompletedAt ?? now, playedUnderstandingFirst: current.understandingCompleted }
          }
          usersObj[userData.sid].topicProgress = existing
        }

        if (users[userData.sid]) {
          {
            // Get user's badges
            const userBadges = users[userData.sid].badges || []

            // Check if badge already exists
            const existingBadgeIndex = userBadges.findIndex((badge: Badge) => badge.gameId === gameId)

            if (existingBadgeIndex >= 0) {
              // Badge exists - only update if new level is higher
              const existingBadge = userBadges[existingBadgeIndex]

              if (level > existingBadge.level) {
                // Update the existing badge with higher level
                userBadges[existingBadgeIndex] = {
                  gameId,
                  name,
                  level,
                  earnedAt: new Date().toISOString(),
                }

                // Update users data + topic progress
                users[userData.sid].badges = userBadges
                updateTopicProgress(users)
                setUsers(users)

                // Update local state
                setBadges(prev => [...prev.filter((b) => b.gameId !== gameId), userBadges[existingBadgeIndex]])
                setBadgeCount(userBadges.length)

                console.log("Badge upgraded successfully:", gameId)
                return true
              } else {
                console.log("User already has same or higher level badge")
                return false
              }
            } else {
              // Badge doesn't exist - add new badge
              const newBadge = {
                gameId,
                name,
                level,
                earnedAt: new Date().toISOString(),
              }

              userBadges.push(newBadge)

              // Update users data + topic progress
              users[userData.sid].badges = userBadges
              updateTopicProgress(users)
              setUsers(users)

              // Update local state
              setBadges(prev => [...prev, newBadge])
              setBadgeCount(userBadges.length)

              console.log("Badge added successfully:", gameId)
              return true
            }
          }
        }
        return false
      } catch (error) {
        console.error("Error adding badge:", error)
        return false
      }
    },
    // No deps: addBadge reads cookies fresh and uses functional setBadges(prev=>…),
    // so it never closes over `badges`. Keeping the array empty gives addBadge a
    // stable identity, so consumers that capture it in a mount-only effect
    // (e.g. GameDebrief) never hold a stale reference.
    [],
  )

  // Initial load of badges
  useEffect(() => {
    refreshBadges()

    if (!isClient) return

    // Set up an interval to refresh badges periodically
    const interval = setInterval(refreshBadges, 5000)

    // Set up event listeners for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "users" || e.key === "user") {
        refreshBadges()
      }
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [refreshBadges])

  return (
    <BadgeContext.Provider value={{ badges, refreshBadges, addBadge, badgeCount }}>{children}</BadgeContext.Provider>
  )
}
