"use client"
import dynamic from "next/dynamic"
const WebersLawUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <WebersLawUnderstanding /> }
