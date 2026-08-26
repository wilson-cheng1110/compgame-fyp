"use client"

import { useEffect, useState } from "react"

/**
 * True once something has been "loading" for too long.
 *
 * WHY. Several pages render `Loading…` until a fetch resolves and have no other exit.
 * If that fetch never resolves — a dropped tunnel, a restarted API, a client bundle
 * that never arrived — the student sits on `Loading…` indefinitely, with nothing to
 * click and nothing to report beyond "it doesn't work".
 *
 * That is exactly what happened on 2026-08-27: a partial build meant the topic unit
 * never hydrated, and the page waited forever without a single error anywhere. The
 * build was the cause that time, but the SILENCE is a defect of its own — the same
 * dead end appears any time the network drops mid-load, which will happen often across
 * 300 students on home connections.
 *
 * So: after `ms`, say so and offer a way out. A visible failure a student can retry or
 * report beats an invisible one every time.
 *
 * 12 s by default. The API's own p50 is ~4 s under load and a cold start is ~30 s, so
 * this is long enough not to cry wolf on a slow-but-working request, and short enough
 * that nobody sits there wondering.
 */
export function useSlowLoad(stillLoading: boolean, ms = 12000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!stillLoading) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(timer)
  }, [stillLoading, ms])

  return slow
}
