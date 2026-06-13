"use client"
import dynamic from "next/dynamic"
const MentalModelAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <MentalModelAssessment /> }
