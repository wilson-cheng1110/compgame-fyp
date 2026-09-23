"use client"

import { useCallback, useEffect, useState } from "react"
import { admin, type GradeRunState, type GradeRunStatus } from "@/lib/api"
import { Banner } from "@/components/staff"

// The teacher can TRIGGER the offline, arm-BLIND short-answer grading pass from here and
// WATCH its coarse state, instead of ssh-ing onto the box and running grade_batch by hand
// — "press it online AND see it there."
//
// This surface is deliberately thin, exactly like the backend route it drives. It shows
// only grade_runner's coarse status — a state and two timestamps — and NEVER a grade, an
// answer, a SID or an arm; the per-student report is written to reports/grades on the box
// and read only by the offline tooling that already owns that boundary. Blindness is
// structural one layer down (grade.blind strips the arm before any prompt is built), so
// nothing unsafe can reach this card even in principle. Everything is enforced server-side
// (admin_api.py: a valid session AND the admin allowlist file); this client only asks.

const STATE_COPY: Record<GradeRunState, { label: string; tone: "ok" | "info" | "warn" }> = {
  idle: { label: "Idle — no run has been started yet", tone: "info" },
  running: { label: "Running — grading in the background", tone: "info" },
  done: { label: "Finished — the last run completed", tone: "ok" },
  error: { label: "Stopped — the last run did not finish", tone: "warn" },
}

const fmt = (iso?: string) => {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(+d) ? null : d.toLocaleString()
}

export default function GradeRunPanel() {
  const [status, setStatus] = useState<GradeRunStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const r = await admin.gradeRunStatus()
    if (r.ok && r.data) setStatus(r.data)
  }, [])

  // Read the current state once on mount.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Poll ONLY while a run is in flight — a coarse endpoint, so a slow 4s tick is plenty to
  // catch the running -> done/error transition without hammering the cohort-facing box.
  useEffect(() => {
    if (status?.state !== "running") return
    const id = setTimeout(() => void refresh(), 4000)
    return () => clearTimeout(id)
  }, [status, refresh])

  const run = async () => {
    if (busy) return
    setNote(null)
    setBusy(true)
    try {
      const r = await admin.gradeRun()
      if (!r.ok) {
        // 429 throttled, 400 unknown topic, or the 401/403 gate — show the backend's
        // own message rather than inventing one.
        setNote({ kind: "bad", text: r.message ?? "Couldn't start a grading run." })
      } else if (r.data?.state === "already_running") {
        setNote({ kind: "ok", text: "A grading run is already in progress." })
      } else {
        setNote({ kind: "ok", text: "Grading run started — it runs in the background." })
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const running = status?.state === "running"
  const copy = status ? STATE_COPY[status.state] ?? STATE_COPY.idle : null
  const startedAt = fmt(status?.started_at)
  const finishedAt = fmt(status?.finished_at)

  return (
    <section className="mt-8" data-testid="admin-grade-run">
      <h2 className="u-h2">Blind grading pass</h2>
      <p className="u-stem u-muted mt-2">
        Runs the offline, arm-blind short-answer grading pass in the background — the same
        pass you would otherwise start from a shell on the study machine. It grades on the
        box and writes its report there; nothing on this card is ever a grade, an answer, or
        a student. Start one here and watch its state.
      </p>

      <div className="u-card p-4 mt-5" data-testid="grade-run-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="u-eyebrow mb-1">Current state</p>
            {copy ? (
              <p style={{ fontWeight: 600 }} data-testid="grade-run-state">
                {copy.label}
                {status?.state === "error" && status.error ? ` (${status.error})` : ""}
              </p>
            ) : (
              <p className="u-faint" data-testid="grade-run-state">
                Checking…
              </p>
            )}
            <p className="u-faint mt-1">
              {startedAt && <span>Started {startedAt}</span>}
              {startedAt && finishedAt && <span> · </span>}
              {finishedAt && <span>Finished {finishedAt}</span>}
              {!startedAt && !finishedAt && <span>No run recorded yet.</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {running && <span className="u-chip u-chip-open">In progress</span>}
            <button
              className="u-btn u-btn-primary"
              onClick={run}
              disabled={busy || running}
              data-testid="grade-run-btn"
            >
              {busy ? "Starting…" : running ? "Running…" : "Run now"}
            </button>
          </div>
        </div>

        {note && (
          <div className="mt-4">
            <Banner tone={note.kind === "ok" ? "ok" : "warn"} testid="grade-run-note">
              {note.text}
            </Banner>
          </div>
        )}
      </div>

      <p className="u-faint mt-3">
        Kicking off a run while one is already in flight does nothing — a single pass writes
        the grades at a time. Grading itself stays offline and blind by design.
      </p>
    </section>
  )
}
