"use client"
import dynamic from "next/dynamic"
const ErgonomicsUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <ErgonomicsUnderstanding /> }
