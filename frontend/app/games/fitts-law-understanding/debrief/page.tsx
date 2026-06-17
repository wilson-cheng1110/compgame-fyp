"use client"

import { useEffect } from "react"
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

  useEffect(() => {
    if (!Cookies.get("user")) {
      router.replace("/login")
    }
  }, [router])

  return (
    <div className={`min-h-screen bg-[#f8f6ee] text-black ${pixelifySans.variable} ${pressStart2P.variable}`}>
      <div className="flex flex-col items-center justify-start pt-10 p-6">
        <h2 className="font-press-start-2p text-xl text-black mb-6">Understanding Complete</h2>
        <GameDebrief gameId="fitts-law-understanding" />
      </div>
    </div>
  )
}
