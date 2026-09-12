import type { ReactNode } from "react"

// A consistent wrapper for the section + arm-balance tables: the glass card, the
// horizontal scroll a wide table needs on a phone, and a shared header treatment.
// Callers pass the <thead>/<tbody>/<tfoot> so column shapes and testids stay theirs.
export function DataTable({
  caption,
  testid,
  minWidth = 480,
  children,
}: {
  caption?: string
  testid?: string
  minWidth?: number
  children: ReactNode
}) {
  return (
    <div className="u-card" style={{ padding: 0, overflowX: "auto" }}>
      <table
        className="w-full text-left"
        data-testid={testid}
        style={{ borderCollapse: "collapse", minWidth }}
      >
        {caption && (
          <caption
            className="u-faint"
            style={{ captionSide: "top", textAlign: "left", padding: "0.6rem 0.85rem" }}
          >
            {caption}
          </caption>
        )}
        {children}
      </table>
    </div>
  )
}

// The header row styling, so every DataTable's head reads the same. Spread onto a <tr>.
export const THEAD_ROW_STYLE = {
  background: "var(--paper-sunken)",
  borderBottom: "1px solid var(--rule)",
} as const

// A body row: hairline separator, subtle hover. Spread onto a <tr>.
export const TROW_STYLE = { borderTop: "1px solid var(--rule)" } as const
