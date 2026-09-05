"use client"

import { useEffect, useState } from "react"
import { admin, auth, type ReportRow, type SectionOption } from "@/lib/api"
import { TOPICS } from "@/lib/topic-definitions"

// The teacher's actual weekly job, finally reachable by clicking.
//
// Before this the only route to a brief was: ssh onto the box, run
// generate_tutorial_report.py, open a .md in an editor. The report was well built and
// completely undeliverable, which for the person meant to read it is the same as not
// existing.
//
// Rendered as plain text in a <pre>, deliberately. A markdown renderer here would be
// a dependency, an XSS surface over a file containing student SIDs, and a way for the
// document a lecturer projects to look different from the file on disk. The brief is
// written to be readable as text -- that is why its numbers are in tables and its
// findings are in sentences.

const when = (iso: string) => {
  const d = new Date(iso)
  return isNaN(+d) ? "" : d.toLocaleString()
}

export default function ReportsPanel() {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [genTopic, setGenTopic] = useState(TOPICS[0]?.id ?? "")
  const [genSection, setGenSection] = useState("A")
  const [sections, setSections] = useState<SectionOption[]>([])
  const [genMsg, setGenMsg] = useState<string | null>(null)
  // The generator can run up to 120 s server-side (ops.run_report_job is serial, off
  // the loop). Without a busy guard the button stays clickable and an impatient admin
  // double-/triple-clicks, self-stacking requests behind their own semaphore wait with
  // no feedback (finding L6). Disable while in flight and say so.
  const [genBusy, setGenBusy] = useState(false)
  const generate = async () => {
    if (genBusy) return
    setGenMsg(null)
    setGenBusy(true)
    try {
      const r = await admin.generateReport(genTopic, genSection)
      if (r.ok) {
        setGenMsg(`Generated ${genTopic} · section ${genSection}.`)
        const rr = await admin.reports()
        if (rr.ok && rr.data) setRows(rr.data.reports)
      } else {
        setGenMsg(r.message ?? "Could not generate that brief.")
      }
    } finally {
      setGenBusy(false)
    }
  }

  useEffect(() => {
    admin.reports().then((r) => setRows(r.ok && r.data ? r.data.reports : []))
    // Sections come from the schedule config (auth.sections), so a new section — MSc —
    // appears here the moment it is added. Hardcoding A/B/C is exactly what left MSc
    // without a tutor summary.
    auth.sections().then((r) => {
      if (r.ok && r.data) {
        setSections(r.data.sections)
        if (r.data.sections[0]) setGenSection(r.data.sections[0].code)
      }
    })
  }, [])

  const view = async (path: string) => {
    setBusy(true)
    setOpen(path)
    const r = await admin.report(path)
    setText(r.ok && r.data ? r.data.markdown : (r.message ?? "Could not read that."))
    setBusy(false)
  }

  if (!rows) return <p className="u-muted mt-6">Loading briefs…</p>

  return (
    <section className="mt-12" data-testid="admin-reports">
      <h2 className="u-h2">Tutorial briefs</h2>
      <p className="u-stem u-muted mt-2">
        What the class missed, what the wrong answers had in common, who has not done
        the activity, and who is worth calling on. Generated per topic and section.
      </p>

      {/* GENERATE, in the browser. The empty state used to hand a non-technical
          lecturer a raw CLI command (sweep M9); this runs the same generator
          server-side. */}
      <div className="u-card p-4 mt-4 flex items-end gap-3 flex-wrap" data-testid="report-generate">
        <label className="block">
          <span className="u-eyebrow">Topic</span>
          <select className="u-field mt-1" value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)} data-testid="gen-topic">
            {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="u-eyebrow">Section</span>
          <select className="u-field mt-1" value={genSection}
                  onChange={(e) => setGenSection(e.target.value)} data-testid="gen-section">
            {sections.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
          </select>
        </label>
        <button className="u-btn u-btn-primary" onClick={generate} disabled={genBusy} data-testid="gen-submit">
          {genBusy ? "Generating…" : "Generate this week’s brief"}
        </button>
        {genMsg && <span className="u-faint">{genMsg}</span>}
      </div>

      {rows.length === 0 ? (
        <div className="u-card p-5 mt-5" data-testid="reports-empty">
          <p style={{ fontWeight: 600 }}>Nothing generated yet.</p>
          <p className="u-faint mt-1.5">
            On the study machine:{" "}
            <code>python backend/generate_tutorial_report.py --topic &lt;id&gt; --section
            &lt;section&gt;</code>
          </p>
        </div>
      ) : (
        <ul className="u-card mt-5" style={{ overflow: "hidden" }} data-testid="reports-list">
          {rows.map((r) => (
            <li
              key={r.path}
              className="flex items-center justify-between gap-4 p-4 flex-wrap"
              style={{ borderTop: "1px solid var(--rule)" }}
            >
              <div className="min-w-0">
                <p style={{ fontWeight: 600 }}>{r.name}</p>
                <p className="u-faint u-num">{when(r.modified)}</p>
              </div>
              {/* WHICH ONE IS SAFE TO PROJECT, said before they open it in front of a
                  room rather than after. */}
              <span className={`u-chip ${r.projectable ? "u-chip-open" : "u-chip-late"}`}>
                {r.projectable ? "Safe to project" : "Has student IDs"}
              </span>
              <button className="u-btn" onClick={() => view(r.path)} data-testid="report-open">
                Read
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="u-card p-5 mt-4" data-testid="report-view">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p style={{ fontWeight: 600 }} className="u-num">{open}</p>
            <button className="u-btn" onClick={() => setOpen(null)}>Close</button>
          </div>
          {open.endsWith("-teacher.md") && (
            <p className="u-faint mt-2" style={{ color: "var(--state-late)" }}>
              This copy carries student IDs. Do not screen-share it.
            </p>
          )}
          <pre
            className="u-stem mt-4"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "60vh",
              overflowY: "auto",
              fontFamily: "var(--font-roboto-mono), ui-monospace, monospace",
              fontSize: ".8125rem",
              lineHeight: 1.6,
            }}
          >
            {busy ? "Loading…" : text}
          </pre>
        </div>
      )}
    </section>
  )
}
