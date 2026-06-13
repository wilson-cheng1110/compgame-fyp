"use client"
import dynamic from "next/dynamic"
const ExperimentDesignUnderstanding = dynamic(() => import("../experiment-design-understanding/page"), { ssr: false })
export default function ExperimentDesignUnderstandingWrapper() { return <ExperimentDesignUnderstanding /> }
