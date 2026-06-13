"use client"
import dynamic from "next/dynamic"

const HicksLawUnderstanding = dynamic(() => import("./game-client"), { ssr: false })

export default function Page() {
  return <HicksLawUnderstanding />
}
