"use client"
import dynamic from "next/dynamic"

const MemoryUnderstanding = dynamic(() => import("./game-client"), { ssr: false })

export default function Page() {
  return <MemoryUnderstanding />
}
