"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import GameLayout from "@/components/game-layout"
import dynamic from "next/dynamic"
import { useForceScrollbar } from "@/lib/use-force-scrollbar"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"

// These three games have no top-level static page.tsx — they route through
// [gameId] and embed their sub-page structure via the wrapper.
// All other games have static app/games/<id>/page.tsx that shadow [gameId].
const FittsLawGameWrapper = dynamic(() => import("./fitts-law-game-wrapper"), { ssr: false })
const GestaltUnderstandingWrapper = dynamic(() => import("./gestalt-understanding-wrapper"), { ssr: false })
const GestaltAssessmentWrapper = dynamic(() => import("./gestalt-assessment-wrapper"), { ssr: false })

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

const GAMES = [
  {
    id: "fitts-law-understanding",
    title: "Fitts' Law - Learning",
    description: "Learn about Fitts' Law and target acquisition",
    controls: [
      { type: "mouse", description: "Click to select game mode and targets" },
      { type: "other", description: "Follow on-screen instructions" },
    ],
  },
  {
    id: "gestalt-understanding",
    title: "Gestalt Principles - Learning",
    description: "Learn about Gestalt principles of visual perception",
    controls: [
      { type: "mouse", description: "Click to interact with examples" },
      { type: "keyboard", description: "Arrow keys to navigate" },
    ],
  },
  {
    id: "gestalt-assessment",
    title: "Gestalt Principles - Assessment",
    description: "Test your knowledge of Gestalt principles",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
]

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  useForceScrollbar()
  const [game, setGame] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const user = Cookies.get("user")
    if (!user) {
      router.replace("/login")
      return
    }

    setAuthChecked(true)

    const gameId = params.gameId as string
    const foundGame = GAMES.find((g) => g.id === gameId)

    if (foundGame) {
      setGame(foundGame)
    } else {
      router.push("/dashboard")
    }
  }, [params, router])

  if (!authChecked || !game) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className={`${pixelifySans.variable} ${pressStart2P.variable}`}>
      <GameLayout title={game.title} controls={game.controls} className="min-h-screen">
        <>
          {game.id === "fitts-law-understanding" && <FittsLawGameWrapper />}
          {game.id === "gestalt-understanding" && <GestaltUnderstandingWrapper />}
          {game.id === "gestalt-assessment" && <GestaltAssessmentWrapper />}
        </>
      </GameLayout>
    </div>
  )
}
