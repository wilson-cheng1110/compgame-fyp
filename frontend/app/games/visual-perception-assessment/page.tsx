"use client"
import dynamic from "next/dynamic"
const VisualPerceptionAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <VisualPerceptionAssessment /> }
