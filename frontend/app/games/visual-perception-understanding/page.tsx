"use client"
import dynamic from "next/dynamic"
const VisualPerceptionUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <VisualPerceptionUnderstanding /> }
