"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { researcher, type ResearcherMonitor, type ForgetPreview } from "@/lib/api"

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

/** One monitoring figure with its denominator underneath — a count with no denominator
 *  is not a reading. `alarm` paints it amber for the one number that means "look now". */
function Metric({ label, value, sub, alarm }: {
  label: string; value: number; sub?: string | null; alarm?: boolean
}) {
  return (
    <div>
      <p className="u-eyebrow">{label}</p>
      <p className="u-h2 u-num mt-1" style={alarm ? { color: "var(--state-late)" } : undefined}>
        {value}
      </p>
      {sub && <p className="u-faint u-num">{sub}</p>}
    </div>
  )
}

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
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Checking…</p>
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
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <span className="u-chip u-chip-open">Researcher</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        <p className="u-eyebrow">Study</p>
        <h1 className="u-h1 mt-1">Monitoring</h1>
        <p className="u-stem u-muted mt-2">
          Read-only. How the data is filling in — arm balance, the manipulation check, and
          coverage per section. The teacher panel cannot see any of this. Grading stays
          the offline blind pass; nothing here reveals a score against an identity.
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button
            className="u-btn"
            onClick={load}
            disabled={refreshing}
            data-testid="researcher-refresh"
            style={{ opacity: refreshing ? 0.55 : 1 }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {loadedAt && (
            <span className="u-faint">as of {loadedAt.toLocaleTimeString()}</span>
          )}
        </div>

        {note && (
          <div
            className="u-card p-4 mt-5"
            data-testid="researcher-note"
            style={{
              borderColor: note.kind === "ok" ? "var(--state-done)" : "var(--state-late)",
              color: note.kind === "ok" ? "var(--state-done)" : "var(--state-late)",
            }}
          >
            {note.text}
          </div>
        )}

        {mon && !hasData && (
          <div className="u-card p-4 mt-6" data-testid="researcher-empty"
               style={{ borderLeft: "3px solid var(--rule-strong)" }}>
            <p className="u-stem">
              No study events recorded yet — this is the pre-launch state, not an error.
              Accounts and sections show below; arm balance and the manipulation check
              populate once students begin their topics.
            </p>
          </div>
        )}

        {/* Overview */}
        {a && mon && (
          <div className="flex gap-6 mt-6 flex-wrap" data-testid="researcher-overview">
            {[
              ["Accounts", a.total],
              ["Signed up", a.claimed],
              ["Withdrawn", a.withdrawn],
              ["Disabled", a.disabled],
              ["Events in sink", mon.sink.total_events],
              ["Participants with data", mon.sink.participants],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <p className="u-eyebrow">{label}</p>
                <p className="u-h2 u-num mt-1">{n}</p>
              </div>
            ))}
          </div>
        )}

        {mon?.test_traffic_excluded != null && mon.test_traffic_excluded > 0 && (
          <p className="u-faint mt-4" style={{ borderLeft: "3px solid var(--rule-strong)", paddingLeft: ".75rem" }}>
            {mon.test_traffic_excluded} non-roster (test) row(s) are excluded from the
            per-topic figures below.
          </p>
        )}

        {/* Per-section headcount, MSC included */}
        {a && (
          <div className="mt-10">
            <p className="u-eyebrow">By section</p>
            <div className="u-card mt-3 p-0 overflow-x-auto">
              <table className="w-full text-left" data-testid="researcher-sections">
                <caption className="u-faint p-2 text-left" style={{ captionSide: "top" }}>
                  Accounts by section (MSc included)
                </caption>
                <thead>
                  <tr className="u-faint">
                    <th scope="col" className="p-3">Section</th>
                    <th scope="col" className="p-3">Accounts</th>
                    <th scope="col" className="p-3">Signed up</th>
                    <th scope="col" className="p-3">Withdrawn</th>
                    <th scope="col" className="p-3">Disabled</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionCodes.map((s) => (
                    <tr key={s} style={{ borderTop: "1px solid var(--rule)" }}>
                      <th scope="row" className="p-3 u-num" style={{ fontWeight: 600, textAlign: "left" }}>{s}</th>
                      <td className="p-3 u-num">{a.by_section[s].total}</td>
                      <td className="p-3 u-num">{a.by_section[s].claimed}</td>
                      <td className="p-3 u-num">{a.by_section[s].withdrawn}</td>
                      <td className="p-3 u-num">{a.by_section[s].disabled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* The manipulation-check headline */}
        {c && (
          <div className="mt-10" data-testid="researcher-coverage">
            <p className="u-eyebrow">Manipulation check</p>
            <p className="u-faint mt-1 mb-3">
              For how many participant×topic pairs can we tell whether the activity came
              before the post-check? A pair we can&apos;t determine can&apos;t be used in
              the FLIP-vs-CONTROL comparison.
            </p>
            <div className="flex gap-6 flex-wrap">
              <Metric label="Determinable" value={c.determinable}
                sub={detPct == null ? `of ${c.pairs} pairs` : `${detPct}% of ${c.pairs} pairs`} />
              <Metric label="Complied with arm" value={c.complied}
                sub={compPct == null ? null : `${compPct}% of determinable`} />
              <Metric label="No activity recorded" value={c.no_activity}
                sub={c.pairs ? `${Math.round(noActShare * 100)}% of pairs` : null}
                alarm={noActAlarm} />
              <Metric label="No post-check" value={c.no_posttest} />
              <Metric label="Took the escape" value={c.took_escape} />
            </div>
            {noActAlarm && (
              <p className="u-faint mt-3"
                 style={{ color: "var(--state-late)", borderLeft: "3px solid var(--state-late)", paddingLeft: ".75rem" }}>
                Most undeterminable pairs have no recorded activity at all — the signature of
                the 2026 completion-events loss. Check the game→sink write path before trusting
                a low determinable count.
              </p>
            )}
          </div>
        )}

        {/* Per-topic arm balance */}
        {mon && mon.arms.length > 0 && (
          <div className="mt-10">
            <p className="u-eyebrow">Arm balance, per topic</p>
            <p className="u-faint mt-1 mb-3">
              Participants with any event on a topic, by the arm they were assigned.
              Determinable and complied are the subset we can read a sequence for. Assignment
              is ~50/50 by design, so an <span style={{ color: "var(--state-late)" }}>amber</span>{" "}
              FLIP/CONTROL pair flags a topic whose engagement has skewed by arm — worth a look.
            </p>
            <div className="u-card mt-1 p-0 overflow-x-auto">
              <table className="w-full text-left" data-testid="researcher-arms">
                <caption className="u-faint p-2 text-left" style={{ captionSide: "top" }}>
                  Per-topic arm balance
                </caption>
                <thead>
                  <tr className="u-faint">
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
                    const skew = n >= 6 && Math.min(t.flip, t.control) < 0.5 * Math.max(t.flip, t.control)
                    const armStyle = skew ? { color: "var(--state-late)", fontWeight: 600 } : undefined
                    return (
                      <tr key={t.topic_id} style={{ borderTop: "1px solid var(--rule)" }}>
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
              </table>
            </div>
          </div>
        )}

        {/* Questionnaire completion */}
        {qKeys.length > 0 && (
          <div className="mt-10">
            <p className="u-eyebrow">Questionnaires</p>
            <p className="u-faint mt-1 mb-3">People who finished each instrument.</p>
            <div className="flex gap-6 flex-wrap" data-testid="researcher-questionnaires">
              {qKeys.map((k) => (
                <div key={k}>
                  <p className="u-eyebrow">{k.replace(/^questionnaire_/, "")}</p>
                  <p className="u-h2 u-num mt-1">{mon!.questionnaires[k]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="mt-12">
          <p className="u-eyebrow">Export</p>
          <p className="u-faint mt-1 mb-3">
            Pseudonymised. Real student IDs never leave the box, and withdrawn
            participants are excluded. Every download is logged.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a href={researcher.exportUrl("csv")} className="u-btn u-btn-primary" data-testid="researcher-export-csv">
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
        </div>

        {/* Participant forget */}
        <div className="mt-12">
          <p className="u-eyebrow">Erase a participant&apos;s data</p>
          <p className="u-faint mt-1 mb-3">
            The consent form promises a participant can have their responses discarded.
            This erases their research events. It does <strong>not</strong> delete their
            account record — that is what keeps a withdrawn SID from signing up again and
            reappearing in the data.
          </p>
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
            <div className="u-card p-4 mt-4" data-testid="researcher-forget-preview">
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
                  style={{ opacity: confirmReady ? 1 : 0.45 }}
                >
                  Erase {preview.events} row(s)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
