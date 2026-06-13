"use client"

import { useState } from "react"

interface FailureScreenProps {
  onRestart: () => void
}

export default function FailureScreen({ onRestart }: FailureScreenProps) {
  const [showTips, setShowTips] = useState(false)

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1
          className="text-2xl md:text-3xl lg:text-4xl mb-4"
          style={{
            color: "#E35126",
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold",
          }}
        >
          SORRY, YOU JUST MADE SOME MISTAKES.
        </h1>
        <p
          className="text-xl md:text-2xl lg:text-3xl mb-8"
          style={{
            color: "#E35126",
            fontFamily: "Arial, sans-serif",
          }}
        >
          YOU CAN CHALLENGE AGAIN
        </p>
        <button
          onClick={onRestart}
          className="px-6 py-3 text-lg md:text-xl font-bold bg-[#E35126] text-white rounded-lg hover:bg-[#fd5252] transition-colors duration-200"
        >
          RESTART
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 mt-4">
        <button
          onClick={() => setShowTips(!showTips)}
          className="px-6 py-3 text-lg md:text-xl font-bold bg-[#E35126] text-white rounded-lg hover:bg-[#fd5252] transition-colors duration-200"
        >
          TIPS
        </button>
        {showTips && (
          <div
            className="bg-[#E35126] text-white px-6 py-4 rounded-lg text-lg md:text-xl max-w-md"
            style={{
              fontFamily: "Arial, sans-serif",
            }}
          >
            TIPS: CLICK THE CIRCLE WITH THE SHORTEST DISTANCE
          </div>
        )}
      </div>
    </div>
  )
}
