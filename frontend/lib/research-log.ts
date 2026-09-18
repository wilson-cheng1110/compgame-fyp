// Fire-and-forget research-event logger.
//
// This is the sink the PAPER aggregates across participants (cookies are
// per-browser and lost on clear — fine for a demo, useless for a study).
//
// Design rules:
// - Never block or throw into the UI. If the backend is down, the app is
//   unaffected — data collection is best-effort.
// - IDENTITY IS NOT SENT. The server reads the SID from the HttpOnly session
//   cookie and overwrites anything a client claims. Until 2026-08-16 this file
//   read `user.sid` out of a JS-readable cookie and posted it as
//   `participant_id`, which meant any student could write events attributed to a
//   classmate. That is now impossible: the field is gone from here and ignored
//   there.
// - The URL is NOT hardcoded. It was `http://localhost:8080`, which is exactly
//   why nothing worked off the server machine (stage2-deployment-plan §A1). It
//   now comes from the same NEXT_PUBLIC_API_BASE as every other call.
// - `credentials: "include"` is mandatory: without it the session cookie doesn't
//   travel and every event is rejected as unauthenticated.

import { API_BASE } from "@/lib/api"
import type { ItemTelemetry } from "@/lib/telemetry"

const RESEARCH_API = `${API_BASE}/api/research/event`

export interface ResearchEventInput {
  event_type: string // e.g. "understanding_complete" | "assessment_complete"
  topic_id?: string
  mode?: "understanding" | "assessment"
  score?: number
  played_understanding_first?: boolean
  duration_ms?: number
  meta?: Record<string, unknown>
  // Board card #09 -- game-route behavioural telemetry (lib/game-telemetry.tsx),
  // forwarded as-is. Off by default: the caller only ever passes a value when
  // the flag was on, and the backend strips it again while ITS flag is off
  // (belt-and-braces, research_api.py).
  telemetry?: ItemTelemetry
  // Board card #08 -- per-trial psychophysics data built by the game-client
  // (progress-context.tsx markGameComplete's `result` param). Shape is
  // game-specific (see each game-client.tsx), forwarded as-is via the spread
  // below. Same off-by-default gating as `telemetry`: only sent when the
  // caller has a value, stripped server-side while TELEMETRY_ENABLED is off.
  game_result?: unknown
}

export function logResearchEvent(input: ResearchEventInput): void {
  const body = {
    client_ts: new Date().toISOString(),
    ...input,
  }

  // Fire-and-forget. keepalive lets it survive a tab-close mid-navigation.
  // A 401 here means no session — nothing to attribute, and nothing to do about
  // it from the UI, so it's swallowed like any other transport failure.
  try {
    fetch(RESEARCH_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* backend down / offline / not signed in — ignore, app is unaffected */
    })
  } catch {
    /* never let logging break the app */
  }
}
