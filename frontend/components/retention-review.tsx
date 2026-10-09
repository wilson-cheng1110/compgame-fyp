"use client"

import { TOPICS } from "@/lib/topic-definitions"

// "Topics to review before the exam" — the payoff that makes the end-of-study battery
// worth answering honestly (2026-10-09): looking answers up only hides the topics a
// student actually needs to revise. Reads the student's OWN Form C scores (retention
// `_status`); shown on the battery's finish card and on the dashboard afterwards.

const REVIEW_BELOW = 67 // fewer than 4 of 6 recalled

export default function RetentionReview({
  scores,
}: {
  scores: { topic_id: string; score: number }[]
}) {
  if (!scores.length) return null
  const rows = [...scores]
    .sort((a, b) => a.score - b.score)
    .map((s) => ({ ...s, def: TOPICS.find((t) => t.id === s.topic_id) }))
  const toReview = rows.filter((r) => r.score < REVIEW_BELOW)

  return (
    <div className="mt-3" data-testid="retention-review">
      <p style={{ fontWeight: 600 }}>
        {toReview.length
          ? `Worth reviewing before the exam: ${toReview.length} topic${toReview.length === 1 ? "" : "s"}`
          : "You still remember every topic well."}
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.topic_id} className="flex items-baseline gap-3" data-testid="retention-review-row">
            <span>{r.def?.icon ?? "•"}</span>
            <span className="flex-1">{r.def?.title ?? r.topic_id}</span>
            <span className="u-num">{Math.round(r.score)}%</span>
            <span className={r.score < REVIEW_BELOW ? "u-chip u-chip-late" : "u-chip u-chip-open"}>
              {r.score < REVIEW_BELOW ? "Review" : "Remembered"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
