"use client"
import dynamic from "next/dynamic"
const MemoryUnderstanding = dynamic(() => import("../memory-understanding/page"), { ssr: false })
export default function MemoryUnderstandingWrapper() {
  return <MemoryUnderstanding />
}
