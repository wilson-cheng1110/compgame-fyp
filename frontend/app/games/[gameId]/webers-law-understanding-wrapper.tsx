"use client"
import dynamic from "next/dynamic"
const WebersLawUnderstanding = dynamic(() => import("../webers-law-understanding/page"), { ssr: false })
export default function WebersLawUnderstandingWrapper() { return <WebersLawUnderstanding /> }
