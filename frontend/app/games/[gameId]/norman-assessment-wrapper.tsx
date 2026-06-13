"use client"
import dynamic from "next/dynamic"
const NormanAssessment = dynamic(() => import("../norman-assessment/page"), { ssr: false })
export default function NormanAssessmentWrapper() { return <NormanAssessment /> }
