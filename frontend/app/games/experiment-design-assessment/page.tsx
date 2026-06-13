"use client"
import dynamic from "next/dynamic"
const ExperimentDesignAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <ExperimentDesignAssessment /> }
