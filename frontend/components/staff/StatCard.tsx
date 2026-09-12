import type { ReactNode } from "react"

// One stat, framed. Generalises the old inline `Metric` in researcher/page.tsx so the
// admin counts, the sink overview, the manipulation-check figures and the questionnaire
// tallies all render the same way instead of three different ways.
//
//   label   the eyebrow above the number
//   value   the number (big, tabular u-num)
//   sub     the DENOMINATOR — a count with no denominator is not a reading
//   alarm   paint it amber: the one figure that means "look now"
//   accent  paint it teal: a headline health number that is fine
//
// Presentational only; rendered inside `.shell`, so the tokens resolve.
export function StatCard({
  label,
  value,
  sub,
  alarm,
  accent,
  testid,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  alarm?: boolean
  accent?: boolean
  testid?: string
}) {
  const valueColor = alarm ? "var(--state-late)" : accent ? "var(--accent)" : "var(--ink)"
  return (
    <div
      className="u-card"
      data-testid={testid}
      style={{
        padding: "0.95rem 1.1rem",
        minWidth: 0,
        borderColor: alarm ? "var(--state-late)" : undefined,
      }}
    >
      <p className="u-eyebrow" style={alarm ? { color: "var(--state-late)" } : undefined}>
        {label}
      </p>
      <p
        className="u-num"
        style={{
          fontSize: "1.85rem",
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          marginTop: "0.3rem",
          color: valueColor,
        }}
      >
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="u-faint" style={{ marginTop: "0.2rem" }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// A responsive grid of StatCards. `cols` is the widest breakpoint's column count.
export function StatGrid({
  children,
  testid,
  cols = 4,
}: {
  children: ReactNode
  testid?: string
  cols?: 3 | 4 | 5 | 6
}) {
  const lg = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[cols]
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${lg} gap-3`} data-testid={testid}>
      {children}
    </div>
  )
}
