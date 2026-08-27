import { TOPICS } from "@/lib/topic-definitions"
import type { JourneyTopic } from "@/lib/api"

// Badges are DERIVED, not stored.
//
// They used to live in the `user` cookie, written by the assessment games. Two
// consequences, both visible on the dashboard at once: a student who finished a
// topic through the unit earned nothing, because the unit never called addBadge;
// and a student who cleared their cache lost the lot, while the consent page
// promises "your progress follows you between devices".
//
// `topic_api.journey()` already computes `complete` per topic from the sink, and
// now returns `completed_at` with it. That is the truth, it survives a cache
// clear, and it is the same number the "Done" chip is drawn from -- so the two
// can no longer disagree, which is what they were doing.
//
// THE BADGE IS EARNED AT THE POST-CHECK; THE LEVEL CARRIES WHAT THEY DID.
// (Wilson, 2026-08-27.) A student who submits both checks has given us the primary
// DV and keeps the badge whatever else they skip -- nobody is stranded by a game
// that failed to record. What they actually did shows up as level, not as a gate:
//
//   1  both checks in
//   2  + the activity was observed in the sink (not merely claimed)
//   3  + the assessment was played
//   4  + scored 60%+      5  + scored 80%+
//
// So the level is honest about effort without ever costing them the badge.

export interface Badge {
  gameId: string
  name: string
  level: number
  earnedAt: string
}

export const MAX_LEVEL = 5

export function levelFor(t: JourneyTopic): number {
  let level = 1
  if (t.game_done) level += 1
  if (t.assess_done) level += 1
  const s = t.assess_score
  if (typeof s === "number" && s >= 60) level += 1
  if (typeof s === "number" && s >= 80) level += 1
  return Math.min(level, MAX_LEVEL)
}

export function badgesFromJourney(journey: JourneyTopic[]): Badge[] {
  return journey
    .filter((t) => t.complete)
    .map((t) => ({
      gameId: t.topic_id,
      name: TOPICS.find((d) => d.id === t.topic_id)?.title ?? t.topic_id,
      level: levelFor(t),
      // A topic can be complete without a timestamp if the sink predates
      // `completed_at`; fall back rather than render "Invalid Date".
      earnedAt: t.completed_at ?? "",
    }))
}

export function completedCount(journey: JourneyTopic[]): number {
  return journey.filter((t) => t.complete).length
}
