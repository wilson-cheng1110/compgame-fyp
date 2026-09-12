"use client"

import { useEffect, useState } from "react"
import { admin, auth, type ReportRow, type SectionOption } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"
import { EmptyState } from "@/components/staff"

// The teacher's actual weekly job, finally reachable by clicking.
//
// This page serves the DECK: the runnable .pptx the teacher stands up with in the
// tutorial hour, with the concept recap, the discussion questions to project, and the
// answers/talking-points in the speaker notes. The deck is generated automatically
// before each class (deploy schedules make_tutorial_decks.py) and can also be built on
// demand here.
//
// Every deck is BLIND to the study conditions and carries no student ID -- the generator
// asserts both before saving -- so there is nothing here that is unsafe to project, and
// the file is a plain download. The SID-level "who to call on" detail stays in the .md
// teacher brief, which this page never exposed and still does not.
//
// Revamp (2026-09): the newest deck is spotlighted as a hero card (that is the one the
// teacher wants before this class); the rest fall below. Presentation only.

// "built 2 h ago" / "built yesterday" — a teacher grabbing a deck before class wants
// freshness at a glance, not a timestamp to parse.
const builtAgo = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(+d)) return ""
  const mins = Math.round((Date.now() - +d) / 60000)
  if (mins < 1) return "built just now"
  if (mins < 60) return `built ${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `built ${hrs} h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? "built yesterday" : `built ${days} days ago`
}

// A deck's human title, from its structured parts (topic id -> lecture title), with a
// graceful fall back to the filename if an older row has no parts.
const deckTitle = (r: ReportRow) =>
  (r.topic && (TOPICS.find((t) => t.id === r.topic)?.title ?? r.topic)) || r.name

export default function ReportsPanel() {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [genTopic, setGenTopic] = useState(TOPICS[0]?.id ?? "")
  const [genSection, setGenSection] = useState("A")
  const [sections, setSections] = useState<SectionOption[]>([])
  const [genMsg, setGenMsg] = useState<string | null>(null)
  // The generator can run up to 120 s server-side (ops.run_report_job is serial, off the
  // loop). Without a busy guard the button stays clickable and an impatient admin
  // double-/triple-clicks, self-stacking requests. Disable while in flight and say so.
  const [genBusy, setGenBusy] = useState(false)
  const generate = async () => {
    if (genBusy) return
    setGenMsg(null)
    setGenBusy(true)
    try {
      const r = await admin.generateReport(genTopic, genSection)
      if (r.ok) {
        setGenMsg(`Generated ${genTopic} · section ${genSection}.`)
        const rr = await admin.decks()
        if (rr.ok && rr.data) setRows(rr.data.reports)
      } else {
        setGenMsg(r.message ?? "Could not generate that deck.")
      }
    } finally {
      setGenBusy(false)
    }
  }

  useEffect(() => {
    admin.decks().then((r) => setRows(r.ok && r.data ? r.data.reports : []))
    // Sections come from the schedule config (auth.sections), so a new section — MSc —
    // appears here the moment it is added. Hardcoding A/B/C is exactly what left MSc
    // without a tutor deck.
    auth.sections().then((r) => {
      if (r.ok && r.data) {
        setSections(r.data.sections)
        if (r.data.sections[0]) setGenSection(r.data.sections[0].code)
      }
    })
  }, [])

  if (!rows) return <p className="u-muted mt-6">Loading decks…</p>

  return (
    <section className="mt-8" data-testid="admin-reports">
      <h2 className="u-h2">Tutorial decks</h2>
      <p className="u-stem u-muted mt-2">
        A ready-to-run slide deck for the tutorial hour — the concept recap, discussion
        questions to project, and how the class actually did. Answers and talking points are
        in the speaker notes. Built automatically before each class; generate one here any time.
      </p>

      {/* GENERATE, in the browser. Same generator the scheduled task runs. */}
      <div className="u-card p-4 mt-5" data-testid="report-generate">
        <p className="u-eyebrow mb-3">Build one now</p>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="u-eyebrow">Topic</span>
            <select
              className="u-field mt-1"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              data-testid="gen-topic"
            >
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="u-eyebrow">Section</span>
            <select
              className="u-field mt-1"
              value={genSection}
              onChange={(e) => setGenSection(e.target.value)}
              data-testid="gen-section"
            >
              {sections.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
          <button
            className="u-btn u-btn-primary"
            onClick={generate}
            disabled={genBusy}
            data-testid="gen-submit"
          >
            {genBusy ? "Generating…" : "Generate this week’s deck"}
          </button>
          {genMsg && <span className="u-faint">{genMsg}</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="No decks yet." testid="reports-empty">
            One is built automatically before each class. To make one now, pick a topic and
            section above — or on the study machine:{" "}
            <code>python backend/make_tutorial_decks.py</code>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-5 space-y-2" data-testid="reports-list">
          {rows.map((r, i) => {
            const hero = i === 0
            return (
              <li key={r.path}>
                <div
                  className="u-card flex items-center justify-between gap-4 flex-wrap"
                  style={{
                    padding: hero ? "1.15rem 1.25rem" : "0.85rem 1.1rem",
                    borderLeft: hero ? "3px solid var(--accent)" : undefined,
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontWeight: 600, fontSize: hero ? "1.05rem" : undefined }}>
                        {deckTitle(r)}
                      </p>
                      {hero && <span className="u-chip u-chip-open">Newest</span>}
                    </div>
                    <p className="u-faint mt-0.5">
                      {r.section ? `Section ${r.section} · ` : null}
                      {builtAgo(r.modified)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="u-chip u-chip-done">Ready to project</span>
                    <a
                      className="u-btn u-btn-primary"
                      href={admin.deckDownloadUrl(r.path)}
                      download
                      data-testid="report-download"
                    >
                      Download slides
                    </a>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
