"use client"
import dynamic from "next/dynamic"
const WebersLawAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <WebersLawAssessment /> }
