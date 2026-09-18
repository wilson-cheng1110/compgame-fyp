"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import GameDebrief from "@/components/game-debrief"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"

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

export default function FittsLawDebrief() {
  const router = useRouter()
  // #08 psychophysics capture: fitts is the one game whose debrief lives on a
  // separate route from the game itself, so the per-fish catch-time records
  // (written to localStorage by app/game/distance + app/game/size on their own
  // completion) have to be read back HERE. Gated on `ready` rather than passed
  // straight through as `undefined` then updated: GameDebrief records once, on
  // its OWN mount effect (empty deps) -- if it mounted before this read
  // finished and only got `result` via a later re-render, that mount effect
  // would already have fired with `result` still undefined. Delaying
  // GameDebrief's mount by one tick until the localStorage read is done avoids
  // that race entirely.
  const [result, setResult] = useState<{ game: string; distance: unknown; size: unknown } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!Cookies.get("user")) {
      router.replace("/login")
    }
  }, [router])

  useEffect(() => {
    try {
      const distance = JSON.parse(localStorage.getItem("fitts-understanding-distance-records") ?? "null")
      const size = JSON.parse(localStorage.getItem("fitts-understanding-size-records") ?? "null")
      setResult({ game: "fitts", distance: distance ?? {}, size: size ?? {} })
    } catch {
      /* localStorage unavailable / not JSON — leave result unset, still record completion */
    } finally {
      setReady(true)
    }
  }, [])

  return (
    <div className={`min-h-screen bg-[#f9fafb] text-black ${pixelifySans.variable} ${pressStart2P.variable}`}>
      <div className="flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
        {ready && <GameDebrief gameId="fitts-law-understanding" result={result ?? undefined} />}
      </div>
    </div>
  )
}
