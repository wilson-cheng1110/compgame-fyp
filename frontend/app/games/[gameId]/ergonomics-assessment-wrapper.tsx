"use client"
import dynamic from "next/dynamic"
const ErgonomicsAssessment = dynamic(() => import("../ergonomics-assessment/page"), { ssr: false })
export default function ErgonomicsAssessmentWrapper() { return <ErgonomicsAssessment /> }
