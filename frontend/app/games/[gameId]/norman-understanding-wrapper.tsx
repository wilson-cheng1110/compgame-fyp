"use client"
import dynamic from "next/dynamic"
const NormanUnderstanding = dynamic(() => import("../norman-understanding/page"), { ssr: false })
export default function NormanUnderstandingWrapper() { return <NormanUnderstanding /> }
