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
// Level is 1 for now. Stage 3 of the repair plan puts the assessment game into
// the unit, and the score it produces is what raises the level.

export interface Badge {
  gameId: string
  name: string
  level: number
  earnedAt: string
}

export const MAX_LEVEL = 5

export function badgesFromJourney(journey: JourneyTopic[]): Badge[] {
  return journey
    .filter((t) => t.complete)
    .map((t) => ({
      gameId: t.topic_id,
      name: TOPICS.find((d) => d.id === t.topic_id)?.title ?? t.topic_id,
      level: 1,
      // A topic can be complete without a timestamp if the sink predates
      // `completed_at`; fall back rather than render "Invalid Date".
      earnedAt: t.completed_at ?? "",
    }))
}

export function completedCount(journey: JourneyTopic[]): number {
  return journey.filter((t) => t.complete).length
}
