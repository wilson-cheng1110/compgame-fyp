"use client"
import dynamic from "next/dynamic"

const MemoryAssessment = dynamic(() => import("./game-client"), { ssr: false })

export default function Page() {
  return <MemoryAssessment />
}
