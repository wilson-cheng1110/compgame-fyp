"use client"
import dynamic from "next/dynamic"
const StroopAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <StroopAssessment /> }
