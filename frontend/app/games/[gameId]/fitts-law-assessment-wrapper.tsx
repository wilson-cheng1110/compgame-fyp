"use client"

import { useEffect } from "react"

export default function FittsLawAssessmentWrapper() {
  useEffect(() => {
    // Redirect to the standalone game
    window.location.href = "/games/fitts-law-assessment"
  }, [])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#fdefc1]">
      <p className="text-xl">Redirecting to Fitts' Law Assessment...</p>
    </div>
  )
}
