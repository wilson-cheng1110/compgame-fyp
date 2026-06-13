"use client"
import dynamic from "next/dynamic"
const ProblemSolvingAssessment = dynamic(() => import("../problem-solving-assessment/page"), { ssr: false })
export default function ProblemSolvingAssessmentWrapper() { return <ProblemSolvingAssessment /> }
