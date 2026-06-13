"use client"
import dynamic from "next/dynamic"
const LanguageAssessment = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <LanguageAssessment /> }
