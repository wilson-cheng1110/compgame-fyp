"use client"

import { useCallback, useRef } from "react"
import { useProgress } from "@/lib/progress-context"

/**
 * Records completion the instant it's known — e.g. when the final question is
 * answered — rather than only when the debrief screen mounts. A student who
 * reads the last explanation but navigates away without clicking "See Results"
 * still gets their score saved (and mirrored to the research sink).
 *
 * GameDebrief also records on mount; markGameComplete is idempotent
 * (completed stays true, timestamp is preserved, score is overwritten with the
 * same value), so calling both is safe. The internal guard prevents this hook
 * from firing more than once per game instance.
 */
export function useEarlyRecord() {
  const { markGameComplete } = useProgress()
  const fired = useRef(false)

  return useCallback(
    (gameId: string, score?: number) => {
      if (fired.current) return
      fired.current = true
      markGameComplete(gameId, score)
    },
    [markGameComplete],
  )
}
