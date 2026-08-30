// How long the activity actually took.
//
// `understanding_complete` carried a NULL `duration_ms` on every one of its rows, so
// completion was binary: twenty seconds and eight minutes were the same datum. For a
// flip-learning claim they are not the same treatment -- one is a dose the other is a
// visit -- and "did they play it" cannot answer "how much of it did they get".
//
// sessionStorage, not a React ref or a context:
//   * it survives a reload MID-GAME, which a ref does not, and students reload;
//   * it is per TAB, so two tabs on two games do not overwrite each other;
//   * it dies with the tab, so a stale start can never leak into next week.
//
// KEYED BY GAME. A single "current game" slot would be wrong the moment a student
// opens the assessment in a second tab while the activity is still open.
//
// The number is WALL CLOCK and this is deliberate. Idle time is in it -- a student
// who leaves the tab open over lunch will record an hour. Filtering that is an
// analysis decision (trim, or take the median) and not one to bake into collection,
// because the alternative is a visibility-tracking heuristic that is itself a source
// of error nobody can audit later. `measures.py` documents the caveat.

const key = (gameId: string) => `compgame:t0:${gameId}`

export function startGameClock(gameId: string): void {
  if (typeof window === "undefined" || !gameId) return
  try {
    // Only if absent: re-entering the route (or a re-render) must not restart the
    // clock, or every reload would reset the dose to zero.
    if (!window.sessionStorage.getItem(key(gameId))) {
      window.sessionStorage.setItem(key(gameId), String(Date.now()))
    }
  } catch {
    /* private mode: no timing rather than a crash */
  }
}

/** Milliseconds since the student entered this game, or undefined if unknown. */
export function readGameClock(gameId: string): number | undefined {
  if (typeof window === "undefined" || !gameId) return undefined
  try {
    const t0 = Number(window.sessionStorage.getItem(key(gameId)))
    if (!Number.isFinite(t0) || t0 <= 0) return undefined
    const ms = Date.now() - t0
    return ms >= 0 ? ms : undefined
  } catch {
    return undefined
  }
}

export function clearGameClock(gameId: string): void {
  if (typeof window === "undefined" || !gameId) return
  try {
    window.sessionStorage.removeItem(key(gameId))
  } catch {
    /* ignore */
  }
}
