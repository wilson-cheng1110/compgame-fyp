"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"
import { useProgress } from "@/lib/progress-context"
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
const GestaltGame = dynamic(() => import("../gestalt-assessment/gestalt-game"), { ssr: false })

export default function GestaltAssessmentWrapper() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const { refreshBadges, addBadge } = useBadges()
  const { markGameComplete } = useProgress()
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

  // REMOVED 2026-08-30: a window "message" listener that accepted
  // {type:"gestaltComplete", score, stars} from ANY origin and, on that alone,
  // recorded the assessment complete and awarded a five-star badge.
  //
  // It had no producer. `results-screen.tsx` records completion directly through
  // the shared contexts, and its own comment says it replaced this exact
  // postMessage path for being fragile and wildcard-targeted -- so nothing in the
  // app had sent those messages for some time. What remained was a listener only
  // an outside document, or a console one-liner, would ever reach.
  //
  // It matters more from today: the topic unit now WAITS for the assessment to
  // record before it will move on, so "anything that can fake a completion" stops
  // being a cosmetic badge problem and becomes a way past the step. The iframe
  // below is same-origin and shares this origin's storage, which is why deleting
  // the listener costs nothing.
  //
  // The limit, stated plainly: this closes the CROSS-DOCUMENT hole. It cannot stop
  // a student with devtools on their own machine -- no client can, and CLAUDE.md
  // already treats client state as never a security boundary. Every game reports
  // its own completion, and that trust is a property of the design; it belongs in
  // the paper's limitations rather than in a comment pretending otherwise.

  if (!isClient || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div
      className={`${pressStart2P.variable} ${pixelifySans.variable} h-screen w-screen flex items-center justify-center bg-[#000000]`}
    >
      <iframe
        src="/games/gestalt-assessment/app"
        className="w-full h-full border-0"
        title="Gestalt Principles Assessment"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
