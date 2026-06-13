"use client"
import dynamic from "next/dynamic"
const ProblemSolvingAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <ProblemSolvingAssessment /> }
