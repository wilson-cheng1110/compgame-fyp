"use client"
import dynamic from "next/dynamic"
const ProblemSolvingUnderstanding = dynamic(() => import("./game-client"), { ssr: false })
export default function Page() { return <ProblemSolvingUnderstanding /> }
