"use client"
import dynamic from "next/dynamic"
const VisualPerceptionAssessment = dynamic(() => import("../visual-perception-assessment/page"), { ssr: false })
export default function VisualPerceptionAssessmentWrapper() { return <VisualPerceptionAssessment /> }
