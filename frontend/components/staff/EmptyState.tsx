import type { ReactNode } from "react"

// A real empty state: a bold line saying what's absent and a faint line saying what to
// do about it — instead of a blank region or a bare sentence.
export function EmptyState({
  title,
  children,
  testid,
}: {
  title: string
  children?: ReactNode
  testid?: string
}) {
  return (
    <div className="u-card" data-testid={testid} style={{ padding: "1.25rem 1.35rem" }}>
      <p style={{ fontWeight: 600 }}>{title}</p>
      {children && <p className="u-faint mt-1.5">{children}</p>}
    </div>
  )
}
