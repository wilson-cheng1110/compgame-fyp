"use client"
import dynamic from "next/dynamic"
const StroopUnderstanding = dynamic(() => import("../stroop-understanding/page"), { ssr: false })
export default function StroopUnderstandingWrapper() { return <StroopUnderstanding /> }
