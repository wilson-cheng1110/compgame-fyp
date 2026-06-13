"use client"

import { Suspense } from "react"
import ResultsScreen from "../../results-screen"

export default function ResultsPage() {
  return (
    <main className="h-screen w-full">
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading results...</div>}>
        <ResultsScreen />
      </Suspense>
    </main>
  )
}
