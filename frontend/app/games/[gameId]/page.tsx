"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import GameLayout from "@/components/game-layout"
import dynamic from "next/dynamic"
import { useUserStore } from "@/lib/store"
import { useForceScrollbar } from "@/lib/use-force-scrollbar"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"

// Modern Game Wrappers
import GestaltAssessmentWrapper from "./gestalt-assessment-wrapper"
import CPUSchedulingUnderstandingWrapper from "./cpu-scheduling-understanding-wrapper"
import CPUSchedulingAssessmentWrapper from "./cpu-scheduling-assessment-wrapper"
import PageReplacementUnderstandingWrapper from "./page-replacement-understanding-wrapper"
import PageReplacementAssessmentWrapper from "./page-replacement-assessment-wrapper"
import HicksLawUnderstandingWrapper from "./hicks-law-understanding-wrapper"
import HicksLawAssessmentWrapper from "./hicks-law-assessment-wrapper"
import MemoryUnderstandingWrapper from "./memory-understanding-wrapper"
import MemoryAssessmentWrapper from "./memory-assessment-wrapper"

// Load fonts
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

// Dynamically import the game wrappers with no SSR
const FittsLawGameWrapper = dynamic(() => import("./fitts-law-game-wrapper"), { ssr: false })
const FittsLawAssessmentWrapper = dynamic(() => import("./fitts-law-assessment-wrapper"), { ssr: false })
const GestaltUnderstandingWrapper = dynamic(() => import("./gestalt-understanding-wrapper"), { ssr: false })

// Merged Games Data (Modern + Legacy)
const GAMES = [
  /* --- Modern React Games --- */
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
    id: "fitts-law-assessment",
    title: "Fitts' Law - Assessment",
    description: "Test your understanding of Fitts' Law",
    controls: [
      { type: "mouse", description: "Click on targets" },
      { type: "keyboard", description: "Arrow keys to navigate" },
    ],
  },
  {
    id: "cpu-scheduling-understanding",
    title: "CPU Scheduling - Learning",
    description: "Learn about CPU scheduling algorithms",
    controls: [{ type: "mouse", description: "Drag processes to schedule" }],
  },
  {
    id: "cpu-scheduling-assessment",
    title: "CPU Scheduling - Assessment",
    description: "Test your knowledge of CPU scheduling",
    controls: [
      { type: "mouse", description: "Drag processes to schedule" },
      { type: "keyboard", description: "Number keys to set priority" },
    ],
  },
  {
    id: "page-replacement-understanding",
    title: "Page Replacement - Learning",
    description: "Learn about memory allocation strategies",
    controls: [
      { type: "mouse", description: "Click to allocate memory blocks" },
      { type: "keyboard", description: "Enter values for block sizes" },
    ],
  },
  {
    id: "page-replacement-assessment",
    title: "Page Replacement - Assessment",
    description: "Test your knowledge of page replacement algorithms",
    controls: [
      { type: "mouse", description: "Click to allocate memory blocks" },
      { type: "keyboard", description: "Enter values for block sizes" },
    ],
  },
  {
    id: "hicks-law-understanding",
    title: "Hick's Law - Learning",
    description: "Learn how the number of choices affects decision time",
    controls: [{ type: "mouse", description: "Use the interactive slider and compare UIs" }],
  },
  {
    id: "hicks-law-assessment",
    title: "Hick's Law - Assessment",
    description: "Measure your own reaction time across different numbers of choices",
    controls: [{ type: "mouse", description: "Click the highlighted button as fast as you can" }],
  },
  {
    id: "memory-understanding",
    title: "Miller's Law - Learning",
    description: "Explore working memory limits and chunking strategies",
    controls: [{ type: "mouse", description: "Toggle between raw and chunked representations" }],
  },
  {
    id: "memory-assessment",
    title: "Miller's Law - Assessment",
    description: "Test your digit span and knowledge of STM in UI design",
    controls: [
      { type: "keyboard", description: "Type recalled digits" },
      { type: "mouse", description: "Select quiz answers" },
    ],
  },

  /* --- Legacy HTML Labs --- */
  {
    id: "lab1",
    title: "Lab 1: Fitts' Law Experiment",
    description: "Traditional Fitts' Law study focusing on target acquisition speed.",
    controls: [{ type: "mouse", description: "Click the appearing circles immediately" }],
    isLegacy: true,
  },
  {
    id: "lab2",
    title: "Lab 2: Hick's Law Experiment",
    description: "Testing reaction time based on the number of choices.",
    controls: [{ type: "mouse", description: "Find the given country in the list" }],
    isLegacy: true,
  },
  {
    id: "lab3con",
    title: "Lab 3: Consistent Mapping",
    description: "Reaction test with consistent color-to-action mapping.",
    controls: [{ type: "mouse", description: "Click Start for Go, Brake for Stop" }],
    isLegacy: true,
  },
  {
    id: "lab3incon",
    title: "Lab 3: Inconsistent Mapping",
    description: "Reaction test with conflicting color-to-action mapping.",
    controls: [{ type: "mouse", description: "Click Start for Red, Brake for Green" }],
    isLegacy: true,
  },
  {
    id: "lab4",
    title: "Lab 4: Common Region",
    description: "HCI experiment on how boundaries affect grouping perception.",
    controls: [{ type: "mouse", description: "Select how many groups you see" }],
    isLegacy: true,
  },
  {
    id: "lab5",
    title: "Lab 5: Weber's Law",
    description: "Detecting the threshold of change in visual stimuli.",
    controls: [{ type: "mouse", description: "Click the shape that is changing" }],
    isLegacy: true,
  },
]

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUserStore() // Pull SID from the updated store
  useForceScrollbar()
  const [game, setGame] = useState<any>(null)

  useEffect(() => {
    const gameId = params.gameId as string
    const foundGame = GAMES.find((g) => g.id === gameId)

    if (foundGame) {
      setGame(foundGame)
    } else {
      router.push("/dashboard")
    }
  }, [params, router])

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className={`${pixelifySans.variable} ${pressStart2P.variable}`}>
      <GameLayout title={game.title} controls={game.controls} className="min-h-screen">
        {game.isLegacy ? (
          /* Wrap the legacy HTML files in an iframe for the retro layout */
          <div className="w-full h-full bg-white flex items-center justify-center relative">
            <iframe
              src={`/legacy-labs/${game.id}.html?sid=${user?.sid || "0000"}&name=${user?.username || "Guest"}`}
              className="w-full h-full border-0 shadow-inner"
              style={{ minHeight: "500px" }}
              title={game.title}
            />
          </div>
        ) : (
          /* Original Next.js Component Rendering */
          <>
            {game.id === "fitts-law-understanding" && <FittsLawGameWrapper />}
            {game.id === "fitts-law-assessment" && <FittsLawAssessmentWrapper />}
            {game.id === "gestalt-understanding" && <GestaltUnderstandingWrapper />}
            {game.id === "gestalt-assessment" && <GestaltAssessmentWrapper />}
            {game.id === "cpu-scheduling-understanding" && <CPUSchedulingUnderstandingWrapper />}
            {game.id === "cpu-scheduling-assessment" && <CPUSchedulingAssessmentWrapper />}
            {game.id === "page-replacement-understanding" && <PageReplacementUnderstandingWrapper />}
            {game.id === "page-replacement-assessment" && <PageReplacementAssessmentWrapper />}
            {game.id === "hicks-law-understanding" && <HicksLawUnderstandingWrapper />}
            {game.id === "hicks-law-assessment" && <HicksLawAssessmentWrapper />}
            {game.id === "memory-understanding" && <MemoryUnderstandingWrapper />}
            {game.id === "memory-assessment" && <MemoryAssessmentWrapper />}
          </>
        )}
      </GameLayout>
    </div>
  )
}