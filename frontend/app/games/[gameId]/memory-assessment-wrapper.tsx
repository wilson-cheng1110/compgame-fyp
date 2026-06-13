"use client"
import dynamic from "next/dynamic"
const MemoryAssessment = dynamic(() => import("../memory-assessment/page"), { ssr: false })
export default function MemoryAssessmentWrapper() {
  return <MemoryAssessment />
}
