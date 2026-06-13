"use client"
import dynamic from "next/dynamic"
const MentalModelAssessment = dynamic(() => import("../mental-model-assessment/page"), { ssr: false })
export default function MentalModelAssessmentWrapper() { return <MentalModelAssessment /> }
