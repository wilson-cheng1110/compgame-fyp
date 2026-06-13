"use client"
import dynamic from "next/dynamic"
const WebersLawAssessment = dynamic(() => import("../webers-law-assessment/page"), { ssr: false })
export default function WebersLawAssessmentWrapper() { return <WebersLawAssessment /> }
