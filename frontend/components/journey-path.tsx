import Link from "next/link"
import type { JourneyTopic } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"

// The thirteen topics as one run rather than a list of thirteen things.
//
// It reuses `.u-rail` — the same graphic the unit uses for its eight steps and the
// badges page uses for level. All three encode the same idea, a position in a
// bounded sequence, so they get the same graphic instead of a third invented one.
// State colour comes from the shell's own tokens inline, which is how the unit
// already draws its "late" line; nothing new goes into shell.css.
//
// Thirteen `flex: 1` segments fit whatever width they are given, so this is
// responsive without a media query.

function colourFor(t: JourneyTopic, currentId?: string): string {
  if (t.complete) return "var(--state-done)"
  if (t.topic_id === currentId) return "var(--ink)"
  if (t.state === "late") return "var(--state-late)"
  if (t.state === "open") return "var(--state-open)"
  return "var(--rule-strong)"
}

const title = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id

export default function JourneyPath({
  topics,
  currentId,
  showNext = false,
}: {
  topics: JourneyTopic[]
  currentId?: string
  showNext?: boolean
}) {
  if (!topics.length) return null
  const ordered = [...topics].sort((a, b) => a.order - b.order)
  const done = ordered.filter((t) => t.complete).length
  const next = ordered.find((t) => !t.complete && (t.state === "open" || t.state === "late"))

  return (
    <div data-testid="journey-path">
      <div className="u-rail">
        {ordered.map((t) => (
          <div
            key={t.topic_id}
            className="u-rail-seg"
            style={{ background: colourFor(t, currentId), height: 6 }}
            title={`${title(t.topic_id)} — ${t.complete ? "done" : t.state}`}
          />
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-4 mt-2 flex-wrap">
        {/* COUNT DOWN, NOT UP. "9 of 13 done" grows all semester and reads as a debt
            you are behind on; "4 topics left" shrinks and reads as survivable. Same
            number, opposite feeling, and by November the feeling is the whole point. */}
        <p className="u-faint u-num" data-testid="journey-count">
          {ordered.length - done === 0
            ? "All topics done"
            : `${ordered.length - done} topic${ordered.length - done === 1 ? "" : "s"} left`}
        </p>
        {showNext && next && (
          <p className="u-faint">
            Next:{" "}
            <Link href={`/topics/${next.topic_id}`} className="hover:underline">
              {title(next.topic_id)}
            </Link>
            {next.state === "late" ? " · overdue, still open" : ""}
          </p>
        )}
      </div>
    </div>
  )
}
