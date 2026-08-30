"use client"

import type { JourneyTopic } from "@/lib/api"

// HOW THIS WORKS -- the orientation half.
//
// The dashboard now GROUPS the topics by lecture, which answers "where is my
// stuff". It does not answer "what is this and how am I meant to use it", and
// those are two different jobs (Wilson, 2026-08-30). A student handed this in week
// one has never seen a pre-check, does not know a topic takes twelve minutes rather
// than an evening, and does not know that missing a window is survivable. None of
// that is guessable from a list of thirteen rows, and every one of those unknowns
// is a reason to put it off.
//
// Four sentences and one picture, and then it gets out of the way: it is open only
// while the student has finished nothing, and collapses to a single line after
// that. No stored "seen" flag -- progress already says whether they are new.
//
// The rail is the same `.u-rail` as the unit, the journey and the badges page, cut
// into one block per lecture. That IS the map: it shows at a glance that thirteen
// topics are really seven arrivals of one to three, which is the single fact that
// makes the schedule feel survivable rather than relentless.

export default function SessionMap({
  topics,
  longUnits = false,
}: {
  topics: JourneyTopic[]
  /** With the battery on a unit roughly doubles. Say so rather than guess. */
  longUnits?: boolean
}) {
  if (!topics.length) return null

  const ordered = [...topics].sort((a, b) => a.order - b.order)
  const done = ordered.filter((t) => t.complete).length

  // Contiguous runs of the same lecture, in release order.
  const blocks: { session: number | null; items: JourneyTopic[] }[] = []
  for (const t of ordered) {
    const sn = t.session ?? null
    const last = blocks[blocks.length - 1]
    if (last && last.session === sn) last.items.push(t)
    else blocks.push({ session: sn, items: [t] })
  }

  const colour = (t: JourneyTopic) =>
    t.complete
      ? "var(--state-done)"
      : t.state === "late"
        ? "var(--state-late)"
        : t.state === "open"
          ? "var(--state-open)"
          : "var(--rule-strong)"

  return (
    <details className="u-group" open={done === 0} data-testid="session-map">
      <summary className="u-group-head">
        <span style={{ fontWeight: 600 }}>How this works</span>
      </summary>

      <div className="u-group-body" style={{ paddingTop: 0 }}>
        <p className="u-faint">
          Your thirteen topics arrive with your lectures — one to three at a time,
          about a week before the class they belong to.
        </p>

        {/* One block per lecture, gapped. The gaps are the point: they are what
            turns a run of thirteen into seven arrivals. */}
        <div className="flex items-end gap-2 mt-3" aria-hidden>
          {blocks.map((b, i) => (
            <div key={i} style={{ flex: b.items.length, minWidth: 0 }}>
              <div className="u-rail">
                {b.items.map((t) => (
                  <div
                    key={t.topic_id}
                    className="u-rail-seg"
                    style={{ background: colour(t), height: 6 }}
                  />
                ))}
              </div>
              <p className="u-faint u-num mt-1" style={{ fontSize: ".6875rem" }}>
                {b.session === null ? "—" : `L${b.session}`}
              </p>
            </div>
          ))}
        </div>

        <p className="u-faint mt-3">
          Each topic is one short unit: a quick check, a game, the same check again,
          then a short assessment.{" "}
          {longUnits
            ? "About twenty minutes, including a few questions at the end"
            : "About twelve minutes"}
          , and it saves as you go.
        </p>
        <p className="u-faint mt-1.5">
          None of it is graded. A topic stays open for five days, and if you miss
          that, it opens anyway — late just means late.
        </p>
        <p className="u-faint mt-1.5">
          The tutor in the bottom right can help at any point, including during a
          game.
        </p>
      </div>
    </details>
  )
}
