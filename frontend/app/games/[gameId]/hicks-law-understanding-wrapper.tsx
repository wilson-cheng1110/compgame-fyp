"use client"
import dynamic from "next/dynamic"
const HicksLawUnderstanding = dynamic(() => import("../hicks-law-understanding/page"), { ssr: false })
export default function HicksLawUnderstandingWrapper() {
  return <HicksLawUnderstanding />
}
