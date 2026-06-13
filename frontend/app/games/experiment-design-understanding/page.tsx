"use client"
import dynamic from "next/dynamic"
const ExperimentDesignUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <ExperimentDesignUnderstanding /> }
