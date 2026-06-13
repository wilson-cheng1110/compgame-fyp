"use client"
import dynamic from "next/dynamic"
const LanguageUnderstanding = dynamic(() => import("../language-understanding/page"), { ssr: false })
export default function LanguageUnderstandingWrapper() { return <LanguageUnderstanding /> }
