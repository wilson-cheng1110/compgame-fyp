"use client"
import dynamic from "next/dynamic"
const NormanUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <NormanUnderstanding /> }
