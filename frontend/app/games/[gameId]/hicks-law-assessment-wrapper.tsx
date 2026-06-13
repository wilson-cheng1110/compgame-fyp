"use client"
import dynamic from "next/dynamic"
const HicksLawAssessment = dynamic(() => import("../hicks-law-assessment/page"), { ssr: false })
export default function HicksLawAssessmentWrapper() {
  return <HicksLawAssessment />
}
