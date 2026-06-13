"use client"
import dynamic from "next/dynamic"
const MentalModelUnderstanding = dynamic(() => import("../mental-model-understanding/page"), { ssr: false })
export default function MentalModelUnderstandingWrapper() { return <MentalModelUnderstanding /> }
