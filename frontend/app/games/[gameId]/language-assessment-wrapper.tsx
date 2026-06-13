"use client"
import dynamic from "next/dynamic"
const LanguageAssessment = dynamic(() => import("../language-assessment/page"), { ssr: false })
export default function LanguageAssessmentWrapper() { return <LanguageAssessment /> }
