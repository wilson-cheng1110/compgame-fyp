import type { ReactNode } from "react"

// One note style for both consoles, replacing the ad-hoc inline-bordered blocks. The
// tone carries the colour; the glyph carries it a second way (state is never hue alone
// in this design system — see shell.css).
const TONE = {
  ok: { color: "var(--state-done)", glyph: "✓" },
  warn: { color: "var(--state-late)", glyph: "▲" },
  alarm: { color: "var(--state-late)", glyph: "▲" },
  info: { color: "var(--ink-faint)", glyph: "›" },
} as const

export function Banner({
  tone = "info",
  children,
  testid,
  glyph = true,
}: {
  tone?: keyof typeof TONE
  children: ReactNode
  testid?: string
  glyph?: boolean
}) {
  const t = TONE[tone]
  return (
    <div
      className="u-card"
      data-testid={testid}
      style={{
        padding: "0.85rem 1rem",
        borderLeft: `3px solid ${t.color}`,
        display: "flex",
        gap: "0.6rem",
        alignItems: "flex-start",
      }}
    >
      {glyph && (
        <span aria-hidden style={{ color: t.color, fontWeight: 600, lineHeight: 1.5 }}>
          {t.glyph}
        </span>
      )}
      <div style={{ color: tone === "info" ? undefined : t.color, minWidth: 0 }}>{children}</div>
    </div>
  )
}
