"use client"
import dynamic from "next/dynamic"
const LanguageUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <LanguageUnderstanding /> }
