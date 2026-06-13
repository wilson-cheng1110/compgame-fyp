"use client"
import dynamic from "next/dynamic"
const ErgonomicsUnderstanding = dynamic(() => import("../ergonomics-understanding/page"), { ssr: false })
export default function ErgonomicsUnderstandingWrapper() { return <ErgonomicsUnderstanding /> }
