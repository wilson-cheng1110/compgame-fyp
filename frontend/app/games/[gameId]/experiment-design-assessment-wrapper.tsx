"use client"
import dynamic from "next/dynamic"
const ExperimentDesignAssessment = dynamic(() => import("../experiment-design-assessment/page"), { ssr: false })
export default function ExperimentDesignAssessmentWrapper() { return <ExperimentDesignAssessment /> }
