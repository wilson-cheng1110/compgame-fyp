"use client"
import dynamic from "next/dynamic"
const StroopAssessment = dynamic(() => import("../stroop-assessment/page"), { ssr: false })
export default function StroopAssessmentWrapper() { return <StroopAssessment /> }
