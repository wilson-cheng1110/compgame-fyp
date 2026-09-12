import type { CSSProperties } from "react"

// A shimmering placeholder block (Tailwind's animate-pulse; reduced-motion is honoured
// globally by shell.css). Used for the "checking your access" moment instead of a bare
// "Checking…" line, so the console's shape is there before its data is.
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: "var(--paper-sunken)", borderRadius: "var(--radius-sm)", ...style }}
    />
  )
}

// The whole-console loading placeholder: a title bar and a row of stat tiles.
export function ConsoleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8" aria-hidden>
      <Skeleton style={{ height: 14, width: 90 }} />
      <Skeleton style={{ height: 34, width: 240, marginTop: 12 }} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 92, borderRadius: "var(--radius)" }} />
        ))}
      </div>
      <Skeleton style={{ height: 220, borderRadius: "var(--radius)", marginTop: 28 }} />
    </div>
  )
}
