"use client"
import dynamic from "next/dynamic"

const FittsLawAssessment = dynamic(() => import("./game-client"), { ssr: false })

export default function Page() {
  return <FittsLawAssessment />
}
