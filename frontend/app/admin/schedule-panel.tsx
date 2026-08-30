"use client"

import { useEffect, useState } from "react"
import { admin, type ScheduleGrid, type SessionDateResult } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"

// MOVING A LECTURE, WITHOUT SSH.
//
// Until now the only way to move a lecture was to hand-edit backend/topic_schedule.json
// on the deployment box. That is fine for the person who wrote the file and untenable
// for a course team in week nine: a typhoon day, a room change, a public holiday
// nobody had entered. The file's own comment says holiday displacements are edited
// there "and nowhere else", and every release window derives from those dates, so
// exactly one field is exposed here -- sessions[n][section] -- and the derivation
// stays in schedule.py where it can be tested.
//
// TWO STEPS, ALWAYS. The date of a lecture is the timing of the independent variable.
// Pushing one forward can put a topic a student is halfway through back behind a
// lock; pulling one back marks topics late, which is still enterable by design. So
// the panel previews first and shows precisely which topics change state, and the
// teacher presses Apply against that list rather than against a date picker.

const title = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id

export default function SchedulePanel({ onDone }: { onDone: () => void }) {
  const [grid, setGrid] = useState<ScheduleGrid | null>(null)
  const [edit, setEdit] = useState<{ session: number; section: string } | null>(null)
  const [date, setDate] = useState("")
  const [preview, setPreview] = useState<SessionDateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)

  const load = async () => {
    const res = await admin.schedule()
    if (res.ok && res.data) setGrid(res.data)
  }
  useEffect(() => {
    void load()
  }, [])

  const start = (session: number, section: string, current: string) => {
    setEdit({ session, section })
    setDate(current)
    setPreview(null)
    setNote(null)
  }

  const doPreview = async () => {
    if (!edit) return
    setBusy(true)
    const res = await admin.setSessionDate(edit.session, edit.section, date, false)
    setBusy(false)
    setPreview(res.data)
    setNote(res.ok ? null : { kind: "bad", text: res.message ?? "Couldn't check that date." })
  }

  const doApply = async () => {
    if (!edit) return
    setBusy(true)
    const res = await admin.setSessionDate(edit.session, edit.section, date, true)
    setBusy(false)
    if (!res.ok || !res.data?.committed) {
      setNote({ kind: "bad", text: res.message ?? "Nothing was saved." })
      return
    }
    setNote({
      kind: "ok",
      text:
        `Lecture ${edit.session}, section ${edit.section} moved from ` +
        `${res.data.old} to ${res.data.new}. Logged with your SID.`,
    })
    setEdit(null)
    setPreview(null)
    await load()
    onDone()
  }

  if (!grid) return <p className="u-muted mt-6">Loading the schedule…</p>

  const secs = Object.keys(grid.sections)

  return (
    <section className="mt-12" data-testid="admin-schedule">
      <h2 className="u-h2">Lecture dates</h2>
      <p className="u-stem u-muted mt-2">
        Topics open seven days before their lecture and close two days before the next
        one, per section — so moving a date here moves that section&apos;s release
        window and nothing else. Every change is logged with your SID.
      </p>

      {grid.problems.length > 0 && (
        <div
          className="u-card p-4 mt-5"
          style={{ borderColor: "var(--state-late)" }}
          data-testid="schedule-problems"
        >
          <p style={{ fontWeight: 600 }}>The schedule has problems right now</p>
          <ul className="u-faint mt-1.5 space-y-1">
            {grid.problems.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {note && (
        <p
          className="u-stem mt-5"
          data-testid="schedule-note"
          style={{
            borderLeft: `3px solid ${
              note.kind === "ok" ? "var(--state-done)" : "var(--state-late)"
            }`,
            paddingLeft: ".75rem",
          }}
        >
          {note.text}
        </p>
      )}

      <div className="u-card mt-5" style={{ overflowX: "auto" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr>
              <th className="u-eyebrow text-left p-3">Lecture</th>
              {secs.map((s) => (
                <th key={s} className="u-eyebrow text-left p-3">
                  {s} · {grid.sections[s].day}
                </th>
              ))}
              <th className="u-eyebrow text-left p-3">Topics</th>
            </tr>
          </thead>
          <tbody>
            {grid.sessions.map((row) => (
              <tr key={row.session} style={{ borderTop: "1px solid var(--rule)" }}>
                <td className="p-3 u-num" style={{ fontWeight: 600 }}>
                  {row.session}
                </td>
                {secs.map((s) => (
                  <td key={s} className="p-3">
                    <button
                      className="u-num hover:underline"
                      style={{ color: "var(--ink)" }}
                      onClick={() => start(row.session, s, row.dates[s] ?? "")}
                      aria-label={`Change the date of lecture ${row.session} for section ${s}`}
                    >
                      {row.dates[s] ?? "—"}
                    </button>
                  </td>
                ))}
                <td className="p-3 u-faint">
                  {row.topics.length ? row.topics.map(title).join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="u-card p-5 mt-4" data-testid="schedule-edit">
          <p style={{ fontWeight: 600 }}>
            Lecture {edit.session}, section {edit.section}
          </p>
          <div className="flex items-end gap-3 mt-3 flex-wrap">
            <label className="block">
              <span className="u-eyebrow">New date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setPreview(null)
                }}
                className="u-field u-num mt-1"
                data-testid="schedule-date"
              />
            </label>
            <button className="u-btn" onClick={doPreview} disabled={busy || !date}>
              Check this date
            </button>
            {/* Apply stays disabled until a preview has come back clean, so a date
                nobody has checked cannot be committed. */}
            <button
              className="u-btn u-btn-primary"
              onClick={doApply}
              disabled={busy || !preview?.ok || (preview.added_problems?.length ?? 0) > 0}
              data-testid="schedule-apply"
            >
              Apply
            </button>
            <button
              className="u-btn"
              onClick={() => {
                setEdit(null)
                setPreview(null)
              }}
            >
              Cancel
            </button>
          </div>

          {!preview && (
            <p className="u-faint mt-3">
              Check the date first — it will show which topics change before anything
              is saved.
            </p>
          )}

          {preview && (
            <div className="mt-4">
              {(preview.added_problems?.length ?? 0) > 0 && (
                <>
                  <p style={{ fontWeight: 600, color: "var(--state-late)" }}>
                    This would break the schedule. Nothing will be saved.
                  </p>
                  <ul className="u-faint mt-1.5 space-y-1">
                    {preview.added_problems!.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </>
              )}
              {preview.ok && (
                <>
                  <p className="u-faint">
                    {preview.old} → {preview.new}
                  </p>
                  {preview.affected?.length ? (
                    <>
                      <p className="mt-2" style={{ fontWeight: 600 }}>
                        {preview.affected.length} topic
                        {preview.affected.length === 1 ? "" : "s"} would change for
                        section {edit.section} today:
                      </p>
                      <ul
                        className="u-faint mt-1.5 space-y-1"
                        data-testid="schedule-affected"
                      >
                        {preview.affected.map((a) => (
                          <li key={a.topic_id}>
                            · {title(a.topic_id)}: {a.from} → <strong>{a.to}</strong>
                            {a.to === "locked" &&
                              " — a student part-way through would lose access"}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="u-faint mt-2">
                      No topic changes state today. The window moves with the date.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
