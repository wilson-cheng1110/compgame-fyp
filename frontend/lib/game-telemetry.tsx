"use client"

// Game-route behavioural telemetry -- reuses the SAME ItemTracker as the MC
// checks/probes (lib/telemetry.ts) unchanged, attached for the lifetime of a
// /games/* route visit instead of a single item. Board card #09 "Game vs
// No-Game Behavior": games were not instrumented at all; checks/probes were.
//
// One global tracker per game visit. Its snapshot rides the existing
// game-completion event (see progress-context.tsx markGameComplete), which
// fires while the student is still on the game route (via GameDebrief), so
// the tracker is still live at that moment.
//
// OFF BY DEFAULT, SAME AS EVERYWHERE ELSE: the enabled flag comes from the
// server's journey response (`telemetry_enabled`), never a client default. It
// is fetched at most once per session (cached in a module var + sessionStorage)
// and a fetch failure is treated as OFF. The backend also strips telemetry
// while its own flag is off (research_api.py), so this is belt-and-braces, not
// the only gate.

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { topics } from "@/lib/api"
import { ItemTracker, watchVisibility, type ItemTelemetry } from "@/lib/telemetry"

const SESSION_KEY = "telemetry_enabled"
const POINTER_THROTTLE_MS = 50

let activeTracker: ItemTracker | null = null
let cachedEnabled: boolean | null = null
let inFlight: Promise<boolean> | null = null

/** The current game tracker's snapshot, or null when there is none (flag off,
 *  or not currently on a game route). Callers pass this straight through --
 *  nothing is fabricated when collection is off or absent. */
export function gameTelemetrySnapshot(): ItemTelemetry | null {
  return activeTracker?.snapshot() ?? null
}

async function resolveEnabled(): Promise<boolean> {
  if (cachedEnabled !== null) return cachedEnabled

  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored === "1" || stored === "0") {
      cachedEnabled = stored === "1"
      return cachedEnabled
    }
  } catch {
    /* sessionStorage unavailable (private mode) -- fall through to a fresh
       fetch; never treat that as "enabled". */
  }

  if (!inFlight) {
    inFlight = topics
      .journey()
      .then((res) => (res.ok && res.data ? !!res.data.telemetry_enabled : false))
      .catch(() => false)
  }

  const enabled = await inFlight
  cachedEnabled = enabled
  try {
    sessionStorage.setItem(SESSION_KEY, enabled ? "1" : "0")
  } catch {
    /* best-effort cache only */
  }
  return enabled
}

/** Mount ONCE, globally (frontend/app/layout.tsx). Renders nothing. */
export function GameTelemetry() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    let detach: () => void = () => {}
    const onGameRoute = !!pathname && pathname.startsWith("/games/")

    if (onGameRoute) {
      resolveEnabled().then((enabled) => {
        if (cancelled || !enabled) return

        const tracker = new ItemTracker(true)
        activeTracker = tracker

        let lastMoveAt = 0
        const onPointerMove = (e: PointerEvent) => {
          const now = Date.now()
          if (now - lastMoveAt < POINTER_THROTTLE_MS) return
          lastMoveAt = now
          tracker.onPointerMove(e.clientX, e.clientY)
        }
        const onKey = (e: KeyboardEvent) => tracker.onKey(e.key)
        const onPaste = () => tracker.onPaste()
        const onSelectionChange = () => tracker.onSelectionChange()

        document.addEventListener("pointermove", onPointerMove)
        document.addEventListener("keydown", onKey)
        document.addEventListener("paste", onPaste)
        document.addEventListener("selectionchange", onSelectionChange)
        const unwatchVisibility = watchVisibility(() => (activeTracker ? [activeTracker] : []))

        detach = () => {
          document.removeEventListener("pointermove", onPointerMove)
          document.removeEventListener("keydown", onKey)
          document.removeEventListener("paste", onPaste)
          document.removeEventListener("selectionchange", onSelectionChange)
          unwatchVisibility()
        }
      })
    }

    // Leaving the game route (pathname change) or unmount: detach whatever was
    // attached and drop the tracker so a completion event recorded after this
    // point (e.g. from a different route) never picks up a stale snapshot.
    return () => {
      cancelled = true
      detach()
      activeTracker = null
    }
  }, [pathname])

  return null
}
