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

/** Where this activity sits in the unit, when the unit said so.
 *
 *  The unit shows "Step 3 of 7" the whole way through and then hands the student to
 *  a full-screen game that shows nothing at all -- no topic, no step, no progress.
 *  Measured 2026-08-30: across all 26 game routes the ONLY shared chrome was a single
 *  corner Exit link, and it was styled in the game's own pixel register, so even the
 *  one piece of app furniture read as part of the game. A student crosses that border
 *  twice per twelve-minute unit and has nothing telling them they are still inside it.
 *
 *  The unit appends these; free play has no unit and therefore no step, which is
 *  correct -- there is no sequence to be at position 3 of.
 */
export function useUnitStep(): { step: number | null; of: number | null } {
  const params = useSearchParams()
  const n = (k: string) => {
    const v = Number(params?.get(k))
    return Number.isFinite(v) && v > 0 ? v : null
  }
  return { step: n("step"), of: n("of") }
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
