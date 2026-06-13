"use client"
import dynamic from "next/dynamic"
const NormanAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <NormanAssessment /> }
