import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

// The shared staff-console header: the wordmark that links home, a role chip, and an
// optional slot for extra actions (the researcher⇄admin cross-link). One header for both
// consoles so they read as one product. The wordmark is "HCI Playground" (the app's
// user-facing name; the internal code/repo name stays COMPGame).
export function StaffHeader({
  chip,
  children,
  wide,
}: {
  chip: string
  children?: ReactNode
  // Widen the nav's inner container to match a wider page body (the researcher
  // dashboard uses max-w-7xl). Default keeps the max-w-5xl the teacher panel uses.
  wide?: boolean
}) {
  return (
    <header className="u-nav">
      <div
        className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-5xl"} px-5 h-14 flex items-center justify-between`}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <Image src="/images/logo.png" alt="" width={26} height={26} priority />
          {/* Hidden on narrow screens so the right-hand actions never overlap it. */}
          <span className="hidden sm:inline" style={{ fontWeight: 600, letterSpacing: "-.01em" }}>HCI Playground</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {children}
          <span className="u-chip u-chip-open">{chip}</span>
        </div>
      </div>
    </header>
  )
}
