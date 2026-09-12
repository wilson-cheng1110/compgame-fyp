"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { researcher, type ResearcherMonitor, type ForgetPreview } from "@/lib/api"
import {
  StaffHeader,
  Panel,
  StatCard,
  StatGrid,
  DataTable,
  THEAD_ROW_STYLE,
  TROW_STYLE,
  Banner,
  ConsoleSkeleton,
} from "@/components/staff"

// The researcher (PI) surface. Everything here is enforced server-side
// (researcher_api.py: a valid session AND membership of researcher_sids.txt) — this
// page only ASKS. It draws three states, because the interesting failures are non-200s:
//
//   401  not signed in            -> /login
//   403  signed in, not a researcher -> a plain refusal (a teacher lands here too, and
//                                    must learn nothing — the whole surface is kept off
//                                    the teacher panel so a lecturer cannot teach to the
//                                    FLIP/CONTROL manipulation)
//   200  the monitoring dashboard
//
// Read-only monitoring + the pseudonymised export + the participant-forget the consent
// form promises. Blind grading is NOT here: it stays the offline grade_batch.py pass.
//
// Revamp (2026-09): the manipulation-check health is promoted to a hero stat band at the
// top (with the no_activity alarm as a prominent amber card); everything else is grouped
// into Panels, and the two non-read-only actions (export, erase) sit in their own
// "sensitive" zone. Presentation only — all figures, alarms and flows are unchanged.

export default function ResearcherPage() {
  const router = useRouter()
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking")
  const [mon, setMon] = useState<ResearcherMonitor | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)

  // forget flow: look up a SID, see the blast radius, then confirm by re-typing it.
  const [sid, setSid] = useState("")
  const [preview, setPreview] = useState<ForgetPreview | null>(null)
  const [confirmSid, setConfirmSid] = useState("")

  const load = useCallback(async () => {
    setRefreshing(true)
    const res = await researcher.monitor()
    if (res.ok && res.data) {
      setMon(res.data)
      setLoadedAt(new Date())
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    researcher.whoami().then(async (res) => {
      if (res.status === 401) {
        router.replace("/login")
        return
      }
      if (!res.ok) {
        setState("denied")
        return
      }
      setState("ok")
      await load()
    })
  }, [router, load])

  const lookUp = async () => {
    setNote(null)
    setPreview(null)
    setConfirmSid("")
    const target = sid.trim()
    if (!target) {
      setNote({ kind: "bad", text: "Type a student ID to look up." })
      return
    }
    const res = await researcher.participant(target)
    if (!res.ok || !res.data) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't look that up." })
      return
    }
    setPreview(res.data)
    if (res.data.events === 0) {
      setNote({ kind: "ok", text: `${res.data.sid} has no research rows to erase.` })
    }
  }

  const doForget = async () => {
    if (!preview) return
    setNote(null)
    const res = await researcher.forget(preview.sid)
    if (!res.ok || !res.data) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't erase that." })
      return
    }
    setNote({
      kind: "ok",
      text: `Erased ${res.data.removed} row(s) for ${res.data.sid}. Their account record is kept (that is what stops the SID reappearing in the data); only the research events are gone.`,
    })
    setPreview(null)
    setSid("")
    setConfirmSid("")
    await load()
  }

  if (state === "checking") {
    return (
      <main className="shell min-h-screen">
        <StaffHeader chip="Researcher" />
        <ConsoleSkeleton />
      </main>
    )
  }

  if (state === "denied") {
    return (
      <main className="shell min-h-screen flex items-center justify-center px-5">
        <div className="u-card p-8 max-w-md text-center" data-testid="researcher-denied">
          <p className="u-eyebrow">Not for you</p>
          <h1 className="u-h2 mt-2">This page is for the study&apos;s researcher.</h1>
          <p className="u-stem u-muted mt-3">
            Nothing is wrong with your account — this part of the site just isn&apos;t yours.
          </p>
          <Link href="/dashboard">
            <button className="u-btn u-btn-primary u-btn-lg u-btn-block mt-6">
              Back to your topics →
            </button>
          </Link>
        </div>
      </main>
    )
  }

  const a = mon?.accounts
  const c = mon?.coverage
  const sectionCodes = a ? Object.keys(a.by_section).sort() : []
  const qKeys = mon ? Object.keys(mon.questionnaires).sort() : []
  const confirmReady =
    !!preview && preview.events > 0 && confirmSid.trim().toUpperCase() === preview.sid

  const pct = (num: number, den: number) => (den > 0 ? Math.round((100 * num) / den) : null)
  const detPct = c ? pct(c.determinable, c.pairs) : null
  const compPct = c ? pct(c.complied, c.determinable) : null
  const noActShare = c && c.pairs > 0 ? c.no_activity / c.pairs : 0
  // The silent-failure signature: undeterminable pairs dominated by "no activity ever".
  // This is exactly what the 2026 completion-events loss looked like, so it earns amber.
  const noActAlarm = !!c && c.no_activity > 0 && noActShare >= 0.5
  const hasData = !!mon && mon.sink.total_events > 0
  // Per-topic arm totals, for the table's foot row.
  const armTotals = (mon?.arms ?? []).reduce(
    (acc, t) => ({
      flip: acc.flip + t.flip,
      control: acc.control + t.control,
      determinable: acc.determinable + t.determinable,
      complied: acc.complied + t.complied,
    }),
    { flip: 0, control: 0, determinable: 0, complied: 0 },
  )

  return (
    <main className="shell min-h-screen">
      <StaffHeader chip="Researcher" />

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        <p className="u-eyebrow">Study</p>
        <h1 className="u-h1 mt-1">Monitoring</h1>
        <p className="u-stem u-muted mt-2">
          Read-only. How the data is filling in — arm balance, the manipulation check, and
          coverage per section. The teacher panel cannot see any of this. Grading stays the
          offline blind pass; nothing here reveals a score against an identity.
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button
            className="u-btn"
            onClick={load}
            disabled={refreshing}
            data-testid="researcher-refresh"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {loadedAt && <span className="u-faint">as of {loadedAt.toLocaleTimeString()}</span>}
        </div>

        {note && (
          <div className="mt-5">
            <Banner tone={note.kind === "ok" ? "ok" : "warn"} testid="researcher-note">
              {note.text}
            </Banner>
          </div>
        )}

        {mon && !hasData && (
          <div className="mt-6">
            <Banner tone="info" testid="researcher-empty">
              No study events recorded yet — this is the pre-launch state, not an error.
              Accounts and sections show below; arm balance and the manipulation check
              populate once students begin their topics.
            </Banner>
          </div>
        )}

        {/* HERO — the manipulation check, promoted to the top of the page. */}
        {c && (
          <Panel
            title="Study health — the manipulation check"
            testid="researcher-coverage"
            desc="For how many participant×topic pairs can we tell whether the activity came before the post-check? A pair we can't determine can't be used in the FLIP-vs-CONTROL comparison."
          >
            <StatGrid cols={5}>
              <StatCard
                label="Determinable"
                value={detPct == null ? c.determinable : `${detPct}%`}
                sub={`${c.determinable} of ${c.pairs} pairs`}
                accent
              />
              <StatCard
                label="Complied with arm"
                value={compPct == null ? "—" : `${compPct}%`}
                sub={compPct == null ? `of ${c.determinable}` : `${c.complied} of ${c.determinable}`}
                accent
              />
              <StatCard
                label="No activity recorded"
                value={c.no_activity}
                sub={c.pairs ? `${Math.round(noActShare * 100)}% of pairs` : null}
                alarm={noActAlarm}
              />
              <StatCard label="No post-check" value={c.no_posttest} />
              <StatCard label="Took the escape" value={c.took_escape} />
            </StatGrid>
            {noActAlarm && (
              <div className="mt-3">
                <Banner tone="alarm">
                  Most undeterminable pairs have no recorded activity at all — the signature
                  of the 2026 completion-events loss. Check the game→sink write path before
                  trusting a low determinable count.
                </Banner>
              </div>
            )}
          </Panel>
        )}

        {/* Accounts + sink overview */}
        {a && mon && (
          <Panel title="Accounts & sink">
            <StatGrid cols={6} testid="researcher-overview">
              {(
                [
                  ["Accounts", a.total],
                  ["Signed up", a.claimed],
                  ["Withdrawn", a.withdrawn],
                  ["Disabled", a.disabled],
                  ["Events in sink", mon.sink.total_events],
                  ["Participants with data", mon.sink.participants],
                ] as [string, number][]
              ).map(([label, n]) => (
                <StatCard key={label} label={label} value={n} />
              ))}
            </StatGrid>
          </Panel>
        )}

        {mon?.test_traffic_excluded != null && mon.test_traffic_excluded > 0 && (
          <div className="mt-4">
            <Banner tone="info">
              {mon.test_traffic_excluded} non-roster (test) row(s) are excluded from the
              per-topic figures below.
            </Banner>
          </div>
        )}

        {/* Per-section headcount, MSC included */}
        {a && (
          <Panel title="By section" desc="Accounts by section (MSc included).">
            <DataTable testid="researcher-sections" caption="Accounts by section (MSc included)">
              <thead>
                <tr className="u-faint" style={THEAD_ROW_STYLE}>
                  <th scope="col" className="p-3">Section</th>
                  <th scope="col" className="p-3">Accounts</th>
                  <th scope="col" className="p-3">Signed up</th>
                  <th scope="col" className="p-3">Withdrawn</th>
                  <th scope="col" className="p-3">Disabled</th>
                </tr>
              </thead>
              <tbody>
                {sectionCodes.map((s) => (
                  <tr key={s} style={TROW_STYLE}>
                    <th scope="row" className="p-3 u-num" style={{ fontWeight: 600, textAlign: "left" }}>
                      {s}
                    </th>
                    <td className="p-3 u-num">{a.by_section[s].total}</td>
                    <td className="p-3 u-num">{a.by_section[s].claimed}</td>
                    <td className="p-3 u-num">{a.by_section[s].withdrawn}</td>
                    <td className="p-3 u-num">{a.by_section[s].disabled}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Panel>
        )}

        {/* Per-topic arm balance */}
        {mon && mon.arms.length > 0 && (
          <Panel
            title="Arm balance, per topic"
            desc={
              <>
                Participants with any event on a topic, by the arm they were assigned.
                Determinable and complied are the subset we can read a sequence for. Assignment
                is ~50/50 by design, so an{" "}
                <span style={{ color: "var(--state-late)" }}>amber</span> FLIP/CONTROL pair flags
                a topic whose engagement has skewed by arm — worth a look.
              </>
            }
          >
            <DataTable testid="researcher-arms" caption="Per-topic arm balance" minWidth={560}>
              <thead>
                <tr className="u-faint" style={THEAD_ROW_STYLE}>
                  <th scope="col" className="p-3">#</th>
                  <th scope="col" className="p-3">Topic</th>
                  <th scope="col" className="p-3">FLIP</th>
                  <th scope="col" className="p-3">CONTROL</th>
                  <th scope="col" className="p-3">Determinable</th>
                  <th scope="col" className="p-3">Complied</th>
                </tr>
              </thead>
              <tbody>
                {mon.arms.map((t) => {
                  const n = t.flip + t.control
                  const skew =
                    n >= 6 && Math.min(t.flip, t.control) < 0.5 * Math.max(t.flip, t.control)
                  const armStyle = skew
                    ? { color: "var(--state-late)", fontWeight: 600 }
                    : undefined
                  return (
                    <tr key={t.topic_id} style={TROW_STYLE}>
                      <td className="p-3 u-num">{t.order}</td>
                      <td className="p-3">{t.topic_id}</td>
                      <td className="p-3 u-num" style={armStyle}>{t.flip}</td>
                      <td className="p-3 u-num" style={armStyle}>{t.control}</td>
                      <td className="p-3 u-num">{t.determinable}</td>
                      <td className="p-3 u-num">{t.complied}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--rule-strong)", fontWeight: 600 }}>
                  <td className="p-3" colSpan={2}>All topics</td>
                  <td className="p-3 u-num">{armTotals.flip}</td>
                  <td className="p-3 u-num">{armTotals.control}</td>
                  <td className="p-3 u-num">{armTotals.determinable}</td>
                  <td className="p-3 u-num">{armTotals.complied}</td>
                </tr>
              </tfoot>
            </DataTable>
          </Panel>
        )}

        {/* Questionnaire completion */}
        {qKeys.length > 0 && (
          <Panel title="Questionnaires" desc="People who finished each instrument.">
            <StatGrid cols={5} testid="researcher-questionnaires">
              {qKeys.map((k) => (
                <StatCard key={k} label={k.replace(/^questionnaire_/, "")} value={mon!.questionnaires[k]} />
              ))}
            </StatGrid>
          </Panel>
        )}

        {/* Export — a non-read-only action, in its own zone */}
        <Panel
          title="Export"
          tone="sensitive"
          desc="Pseudonymised. Real student IDs never leave the box, and withdrawn participants are excluded. Every download is logged."
        >
          <div className="flex gap-2 flex-wrap">
            <a
              href={researcher.exportUrl("csv")}
              className="u-btn u-btn-primary"
              data-testid="researcher-export-csv"
            >
              Download CSV
            </a>
            <a
              href={researcher.exportUrl("json")}
              target="_blank"
              rel="noreferrer"
              className="u-btn"
              data-testid="researcher-export-json"
            >
              View JSON
            </a>
          </div>
        </Panel>

        {/* Participant forget — the other non-read-only action */}
        <Panel
          title="Erase a participant's data"
          tone="sensitive"
          desc={
            <>
              The consent form promises a participant can have their responses discarded. This
              erases their research events. It does <strong>not</strong> delete their account
              record — that is what keeps a withdrawn SID from signing up again and reappearing
              in the data.
            </>
          }
        >
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="student ID"
              className="u-field"
              style={{ maxWidth: "18rem" }}
              data-testid="researcher-forget-sid"
            />
            <button className="u-btn" onClick={lookUp} data-testid="researcher-forget-lookup">
              Look up
            </button>
          </div>

          {preview && preview.events > 0 && (
            <div
              className="u-card-quiet mt-4"
              style={{ padding: "1rem 1.1rem" }}
              data-testid="researcher-forget-preview"
            >
              <p className="u-stem">
                <span className="u-num" style={{ fontWeight: 600 }}>{preview.sid}</span> has{" "}
                <span className="u-num">{preview.events}</span> research row(s)
                {preview.withdrawn ? " · withdrawn" : ""}. This cannot be undone.
              </p>
              <p className="u-faint mt-3 mb-2">Type the student ID again to confirm.</p>
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={confirmSid}
                  onChange={(e) => setConfirmSid(e.target.value)}
                  placeholder="re-type the student ID"
                  className="u-field"
                  style={{ maxWidth: "18rem" }}
                  data-testid="researcher-forget-confirm-input"
                />
                <button
                  className="u-btn u-btn-primary"
                  disabled={!confirmReady}
                  onClick={doForget}
                  data-testid="researcher-forget-confirm"
                >
                  Erase {preview.events} row(s)
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </main>
  )
}
