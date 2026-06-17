// Fire-and-forget research-event logger.
//
// The live app stays cookie-driven; this is a parallel sink so the flip-learning
// PAPER can aggregate events across participants (cookies are per-browser and
// lost on clear, which is fine for the demo but useless for the study).
//
// Design rules:
// - Never block or throw into the UI. If the backend is down, the app is
//   unaffected — data collection is best-effort.
// - participant_id is the SID (the natural per-participant key for a class
//   study). To anonymise later, hash it here in one place.

const RESEARCH_API = "http://localhost:8080/api/research/event"

export interface ResearchEventInput {
  event_type: string // e.g. "understanding_complete" | "assessment_complete"
  topic_id?: string
  mode?: "understanding" | "assessment"
  score?: number
  played_understanding_first?: boolean
  duration_ms?: number
  meta?: Record<string, unknown>
}

function getParticipantId(): string | null {
  if (typeof document === "undefined") return null
  try {
    const match = document.cookie.split("; ").find((c) => c.startsWith("user="))
    if (!match) return null
    const user = JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")))
    return user?.sid ?? null
  } catch {
    return null
  }
}

export function logResearchEvent(input: ResearchEventInput): void {
  const participant_id = getParticipantId()
  if (!participant_id) return // not logged in — nothing to attribute

  const body = {
    participant_id,
    client_ts: new Date().toISOString(),
    ...input,
  }

  // Fire-and-forget. keepalive lets it survive a tab-close mid-navigation.
  try {
    fetch(RESEARCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* backend down / offline — ignore, app is unaffected */
    })
  } catch {
    /* never let logging break the app */
  }
}
