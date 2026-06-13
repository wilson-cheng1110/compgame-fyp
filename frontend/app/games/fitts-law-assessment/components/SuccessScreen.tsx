"use client"

import GameDebrief from "@/components/game-debrief"

interface SuccessScreenProps {
  onRestart: () => void
  badgeAchieved?: boolean
}

export default function SuccessScreen({ onRestart, badgeAchieved = true }: SuccessScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-6 px-4 overflow-y-auto w-full max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-2 text-[#E35126]" style={{ fontFamily: "Arial, sans-serif" }}>
        MISSION COMPLETED!
      </h1>
      {badgeAchieved && (
        <p className="text-base text-[#E35126] mb-4" style={{ fontFamily: "Arial, sans-serif" }}>
          You earned the "Fitts' Law Expert" badge
        </p>
      )}
      <button
        onClick={onRestart}
        className="mb-6 px-6 py-2 text-base font-bold bg-[#E35126] text-white rounded-lg hover:bg-[#fd5252] transition-colors"
      >
        Play Again
      </button>
      <GameDebrief gameId="fitts-law-assessment" />
    </div>
  )
}
