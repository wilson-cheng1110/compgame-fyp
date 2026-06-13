"use client"
import dynamic from "next/dynamic"
const ProblemSolvingUnderstanding = dynamic(() => import("../problem-solving-understanding/page"), { ssr: false })
export default function ProblemSolvingUnderstandingWrapper() { return <ProblemSolvingUnderstanding /> }
