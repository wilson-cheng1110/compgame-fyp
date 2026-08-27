"use client"

import { Suspense, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"

// A game can be entered two ways, and everything that offers a way OUT of one has
// to know which:
//
//   free play      /games/<id>                  -> the dashboard is the way back
//   inside a unit  /games/<id>?unit=<topicId>   -> the UNIT is the way back
//
// The second case is not cosmetic. The unit's order is
//
//     ... pre-check -> ACTIVITY -> post-check -> ASSESSMENT ...
//
// and that order is what keeps the pre->post gain -- the primary DV -- clean. A
// button INSIDE the activity that jumps straight to the assessment lets a student
// take a scored round BETWEEN the two checks, through a door the unit does not know
// exists. So under ?unit= the jump is withdrawn and replaced by the way back; in
// free play nothing changes.
//
// `useSearchParams` opts its subtree out of static prerendering, so it needs a
// Suspense boundary above it or `next build` fails outright ("useSearchParams()
// should be wrapped in a suspense boundary"). Keeping that boundary around the SMALL
// PIECE that needs it -- rather than the page -- is why the games still prerender.
// On the client `useSearchParams` never actually suspends, so the fallback is a
// build-time artefact and the student never sees a flash of the wrong label.

export function useUnitId(): string | null {
  const params = useSearchParams()
  return params?.get("unit") ?? null
}

function Reader({ children }: { children: (unit: string | null) => ReactNode }) {
  const unit = useUnitId()
  return <>{children(unit)}</>
}

/** Render-prop: hands its child the launching topic id, or null in free play. */
export default function UnitAware({
  children,
  fallback = null,
}: {
  children: (unit: string | null) => ReactNode
  fallback?: ReactNode
}) {
  return (
    <Suspense fallback={fallback}>
      <Reader>{children}</Reader>
    </Suspense>
  )
}
