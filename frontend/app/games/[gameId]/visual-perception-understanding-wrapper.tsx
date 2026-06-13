"use client"
import dynamic from "next/dynamic"
const VisualPerceptionUnderstanding = dynamic(() => import("../visual-perception-understanding/page"), { ssr: false })
export default function VisualPerceptionUnderstandingWrapper() { return <VisualPerceptionUnderstanding /> }
