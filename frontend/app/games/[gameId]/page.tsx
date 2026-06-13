"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import GameLayout from "@/components/game-layout"
import dynamic from "next/dynamic"
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
import StroopUnderstandingWrapper from "./stroop-understanding-wrapper"
import StroopAssessmentWrapper from "./stroop-assessment-wrapper"
import WebersLawUnderstandingWrapper from "./webers-law-understanding-wrapper"
import WebersLawAssessmentWrapper from "./webers-law-assessment-wrapper"
import NormanUnderstandingWrapper from "./norman-understanding-wrapper"
import NormanAssessmentWrapper from "./norman-assessment-wrapper"
import MentalModelUnderstandingWrapper from "./mental-model-understanding-wrapper"
import MentalModelAssessmentWrapper from "./mental-model-assessment-wrapper"
import ProblemSolvingUnderstandingWrapper from "./problem-solving-understanding-wrapper"
import ProblemSolvingAssessmentWrapper from "./problem-solving-assessment-wrapper"
import VisualPerceptionUnderstandingWrapper from "./visual-perception-understanding-wrapper"
import VisualPerceptionAssessmentWrapper from "./visual-perception-assessment-wrapper"
import LanguageUnderstandingWrapper from "./language-understanding-wrapper"
import LanguageAssessmentWrapper from "./language-assessment-wrapper"
import ErgonomicsUnderstandingWrapper from "./ergonomics-understanding-wrapper"
import ErgonomicsAssessmentWrapper from "./ergonomics-assessment-wrapper"
import ExperimentDesignUnderstandingWrapper from "./experiment-design-understanding-wrapper"
import ExperimentDesignAssessmentWrapper from "./experiment-design-assessment-wrapper"

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

  {
    id: "stroop-understanding",
    title: "Consistency — Learning",
    description: "Experience how consistent vs inconsistent stimulus-response mappings affect reaction time",
    controls: [{ type: "mouse", description: "Click to respond to the traffic light signals" }],
  },
  {
    id: "stroop-assessment",
    title: "Consistency — Assessment",
    description: "Name the colour, not the word — and answer quiz questions on UI consistency",
    controls: [{ type: "mouse", description: "Click the correct colour and select quiz answers" }],
  },
  {
    id: "webers-law-understanding",
    title: "Weber's Law — Learning",
    description: "Discover your personal just-noticeable-difference threshold across size, brightness and count",
    controls: [{ type: "mouse", description: "Drag the slider until you notice a change" }],
  },
  {
    id: "webers-law-assessment",
    title: "Weber's Law — Assessment",
    description: "Spot the odd shape in a timed detection game with shrinking JND thresholds",
    controls: [{ type: "mouse", description: "Click the shape that differs from the rest" }],
  },
  {
    id: "norman-understanding",
    title: "Norman's Action Cycle — Learning",
    description: "Walk through the 7 stages of action and learn where UIs create gulfs",
    controls: [{ type: "mouse", description: "Click to progress through the scenario" }],
  },
  {
    id: "norman-assessment",
    title: "Norman's Action Cycle — Assessment",
    description: "Identify which stage broke down in real UI failure scenarios",
    controls: [{ type: "mouse", description: "Select the broken stage and gulf type" }],
  },
  {
    id: "mental-model-understanding",
    title: "Mental Models & Affordances — Learning",
    description: "Discover how affordances shape user expectations and where designs mislead",
    controls: [{ type: "mouse", description: "Drag elements and click to explore examples" }],
  },
  {
    id: "mental-model-assessment",
    title: "Mental Models & Affordances — Assessment",
    description: "Rank UI elements by affordance clarity and answer scenario questions",
    controls: [{ type: "mouse", description: "Drag to sort and click to select answers" }],
  },
  {
    id: "problem-solving-understanding",
    title: "Problem Solving — Learning",
    description: "Solve a means-end-analysis puzzle and watch your search through the problem space",
    controls: [{ type: "mouse", description: "Click operators to move toward the goal state" }],
  },
  {
    id: "problem-solving-assessment",
    title: "Problem Solving — Assessment",
    description: "Identify problem-solving strategies and problem representations in scenarios",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
  {
    id: "visual-perception-understanding",
    title: "Visual Perception — Learning",
    description: "Experience colour blindness, after-images and depth cues first-hand",
    controls: [{ type: "mouse", description: "Click and toggle to explore perceptual demos" }],
  },
  {
    id: "visual-perception-assessment",
    title: "Visual Perception — Assessment",
    description: "Test your knowledge of the visual system, colour vision and reading mechanics",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
  {
    id: "language-understanding",
    title: "Language & Ambiguity — Learning",
    description: "Disambiguate sentences across syntax, semantics and pragmatics",
    controls: [{ type: "mouse", description: "Pick interpretations of ambiguous sentences" }],
  },
  {
    id: "language-assessment",
    title: "Language & Ambiguity — Assessment",
    description: "Classify ambiguities and resolve coreference in conversational UI scenarios",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
  {
    id: "ergonomics-understanding",
    title: "Ergonomics & I/O — Learning",
    description: "Spot ergonomic hazards and explore haptic resolution across the body",
    controls: [{ type: "mouse", description: "Click hazards and body regions to explore" }],
  },
  {
    id: "ergonomics-assessment",
    title: "Ergonomics & I/O — Assessment",
    description: "Test your knowledge of physical ergonomics, RSI and I/O devices",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
  {
    id: "experiment-design-understanding",
    title: "HCI Experiment Design — Learning",
    description: "Build an experiment — choose IV/DV, design type, and control confounds",
    controls: [{ type: "mouse", description: "Click to assemble and run a study" }],
  },
  {
    id: "experiment-design-assessment",
    title: "HCI Experiment Design — Assessment",
    description: "Spot confounds and order effects, and choose the right design and controls",
    controls: [{ type: "mouse", description: "Click to select answers" }],
  },
]

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
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
          {game.id === "stroop-understanding" && <StroopUnderstandingWrapper />}
          {game.id === "stroop-assessment" && <StroopAssessmentWrapper />}
          {game.id === "webers-law-understanding" && <WebersLawUnderstandingWrapper />}
          {game.id === "webers-law-assessment" && <WebersLawAssessmentWrapper />}
          {game.id === "norman-understanding" && <NormanUnderstandingWrapper />}
          {game.id === "norman-assessment" && <NormanAssessmentWrapper />}
          {game.id === "mental-model-understanding" && <MentalModelUnderstandingWrapper />}
          {game.id === "mental-model-assessment" && <MentalModelAssessmentWrapper />}
          {game.id === "problem-solving-understanding" && <ProblemSolvingUnderstandingWrapper />}
          {game.id === "problem-solving-assessment" && <ProblemSolvingAssessmentWrapper />}
          {game.id === "visual-perception-understanding" && <VisualPerceptionUnderstandingWrapper />}
          {game.id === "visual-perception-assessment" && <VisualPerceptionAssessmentWrapper />}
          {game.id === "language-understanding" && <LanguageUnderstandingWrapper />}
          {game.id === "language-assessment" && <LanguageAssessmentWrapper />}
          {game.id === "ergonomics-understanding" && <ErgonomicsUnderstandingWrapper />}
          {game.id === "ergonomics-assessment" && <ErgonomicsAssessmentWrapper />}
          {game.id === "experiment-design-understanding" && <ExperimentDesignUnderstandingWrapper />}
          {game.id === "experiment-design-assessment" && <ExperimentDesignAssessmentWrapper />}
        </>
      </GameLayout>
    </div>
  )
}