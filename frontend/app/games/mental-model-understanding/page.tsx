"use client"
import dynamic from "next/dynamic"
const MentalModelUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <MentalModelUnderstanding /> }
