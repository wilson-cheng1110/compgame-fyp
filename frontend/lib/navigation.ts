"use client"

import { useRouter } from "next/navigation"

export function useAppNavigation() {
  const router = useRouter()

  // Navigate to dashboard with consistent scrollbar behavior
  const navigateToDashboard = () => {
    // Use router.push for navigation
    router.push("/dashboard")
  }

  // Navigate to game page with consistent scrollbar behavior
  const navigateToGame = (gameId: string) => {
    router.push(`/games/${gameId}`)
  }

  return {
    navigateToDashboard,
    navigateToGame,
  }
}
