"use client"
import dynamic from "next/dynamic"
const StroopUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <StroopUnderstanding /> }
