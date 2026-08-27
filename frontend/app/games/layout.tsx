"use client"

import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { useUnitId } from "@/lib/unit-link"

// Shared chrome for every game route. The bare React games render as
// full-screen canvases with no header, so without this there is no way back
// to the dashboard except the browser back button ("cant exit from game").
// A small fixed corner button gives every game a consistent escape hatch.
// The unit says "come back here when you've finished it" and, until now, provided
// nothing that did. This Exit always went to /dashboard, so the only way back into a
// half-finished unit was to find it in the list again. When the unit launches a game
// it appends ?unit=<topicId>; Exit honours that and returns there.
function ExitLink() {
  const unit = useUnitId()
  const href = unit ? `/topics/${unit}` : "/dashboard"
  return (
    <Link
      href={href}
      aria-label={unit ? "Back to the topic" : "Exit to dashboard"}
      data-testid="game-exit"
      className="fixed top-3 left-3 z-[100] flex items-center gap-1 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[9px] px-3 py-2 shadow-[3px_3px_0px_0px_#000] hover:bg-[#fde047] transition-colors"
    >
      {unit ? "← Back to topic" : "← Exit"}
    </Link>
  )
}

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <ExitLink />
      </Suspense>
      {children}
    </>
  )
}
