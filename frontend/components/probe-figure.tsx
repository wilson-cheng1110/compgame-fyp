import type { ReactElement } from "react"

// The stimulus a probe stem refers to.
//
// The Gestalt probe asks "Look at the layout below. Why do you read it as three
// groups rather than nine separate items — and what would you change to make it
// four groups?" and nothing was drawn. Students were answering about a layout
// they had never seen, and grade.py's rubric scores `mechanism` on exactly that:
// "says WHAT ABOUT THE LAYOUT drives it" (docs/grading-rubric.md).
//
// One topic needs a figure, so this is a lookup with one entry rather than a
// figure system. If a second probe ever needs one, add it here; if a fifth does,
// that is the point to move the stimulus into the item bank itself.

const DOT = 14
const GAP_IN = 8      // spacing inside a group
const GAP_BETWEEN = 46 // spacing between groups -- the whole point of the item

function ProximityNine() {
  return (
    <svg
      viewBox="0 0 260 60"
      width="100%"
      style={{ maxWidth: 300, height: "auto", display: "block" }}
      role="img"
      aria-label="Nine squares arranged as three groups of three: the squares within a group sit close together, and the groups are separated by a wider gap."
    >
      {[0, 1, 2].map((g) =>
        [0, 1, 2].map((i) => (
          <rect
            key={`${g}-${i}`}
            x={8 + g * (3 * DOT + 2 * GAP_IN + GAP_BETWEEN - DOT) + i * (DOT + GAP_IN)}
            y={23}
            width={DOT}
            height={DOT}
            rx={2}
            fill="var(--ink)"
          />
        )),
      )}
    </svg>
  )
}

const FIGURES: Record<string, () => ReactElement> = {
  gestalt: ProximityNine,
}

export function hasProbeFigure(topicId: string): boolean {
  return topicId in FIGURES
}

export default function ProbeFigure({ topicId }: { topicId: string }) {
  const Figure = FIGURES[topicId]
  if (!Figure) return null
  return (
    <div
      className="u-card-quiet mt-4 mb-1 p-6 flex justify-center"
      data-testid="probe-figure"
      style={{ background: "var(--surface-2, var(--panel, #F2F4F5))" }}
    >
      <Figure />
    </div>
  )
}
