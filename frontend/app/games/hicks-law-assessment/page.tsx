"use client"
import dynamic from "next/dynamic"

const HicksLawAssessment = dynamic(() => import("./game-client"), { ssr: false })

export default function Page() {
  return <HicksLawAssessment />
}
