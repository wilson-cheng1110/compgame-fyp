import type { ReactNode } from "react"

// A titled section: an eyebrow heading, an optional one-line description, an optional
// right-aligned action slot (Refresh, a link), then the body. Replaces the repeated
// `<p className="u-eyebrow">…</p><p className="u-faint">…</p>` preamble scattered down
// both consoles, so every section has the same rhythm.
export function Panel({
  title,
  desc,
  right,
  children,
  testid,
  className,
  tone = "default",
}: {
  title?: string
  desc?: ReactNode
  right?: ReactNode
  children: ReactNode
  testid?: string
  className?: string
  // "sensitive" gives the section a bordered card with a warm left rule — for the
  // export and erase-a-participant zones, which are not read-only.
  tone?: "default" | "sensitive"
}) {
  const body =
    tone === "sensitive" ? (
      <div
        className="u-card"
        style={{ padding: "1.1rem 1.2rem", borderLeft: "3px solid var(--state-late)" }}
      >
        {children}
      </div>
    ) : (
      children
    )
  return (
    <section className={`mt-10 ${className ?? ""}`} data-testid={testid}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {title && <p className="u-eyebrow">{title}</p>}
            {desc && (
              <p className="u-faint mt-1" style={{ maxWidth: "62ch" }}>
                {desc}
              </p>
            )}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      <div className={title || right ? "mt-3" : ""}>{body}</div>
    </section>
  )
}
