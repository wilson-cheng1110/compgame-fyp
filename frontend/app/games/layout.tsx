import type { ReactNode } from "react"
import Link from "next/link"

// Shared chrome for every game route. The bare React games render as
// full-screen canvases with no header, so without this there is no way back
// to the dashboard except the browser back button ("cant exit from game").
// A small fixed corner button gives every game a consistent escape hatch.
export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Link
        href="/dashboard"
        aria-label="Exit to dashboard"
        className="fixed top-3 left-3 z-50 flex items-center gap-1 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[9px] px-3 py-2 shadow-[3px_3px_0px_0px_#000] hover:bg-[#fde047] transition-colors"
      >
        ← Exit
      </Link>
      {children}
    </>
  )
}
