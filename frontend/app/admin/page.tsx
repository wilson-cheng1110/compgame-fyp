"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ReportsPanel from "./reports-panel"
import SchedulePanel from "./schedule-panel"
import { admin, auth, researcher, type AdminParticipant, type AuditEntry, type SectionOption } from "@/lib/api"
import { StaffHeader, StatCard, StatGrid, Banner, ConsoleSkeleton } from "@/components/staff"

// The teacher surface. Everything here is enforced server-side (admin_api.py: a valid
// session AND membership of the allowlist file) — this page only ASKS. It draws three
// states rather than one, because the interesting failures are the non-200s:
//
//   401  not signed in           -> /login
//   403  signed in, not a teacher -> a plain refusal, not an empty table. A student
//                                    who guesses this URL should learn nothing except
//                                    that the page is not theirs.
//   200  the table
//
// A section change is refused (409) while a class list is configured, and the reason
// is shown verbatim rather than being swallowed: sign-in re-reads the section from
// that file every time, so a change made here would be silently reverted at the
// student's next login. Saying so beats appearing to work.
//
// Revamp (2026-09): stat cards for the counts, the account "Manage" panel de-crammed
// into labelled sub-cards, the audit trail behind a collapsible, and a deck callout up
// top — this is the lecturer's real weekly job. Presentation only; still BLIND to the
// study (no arms/sequence anywhere on this surface).

// The three jobs this panel does, at three different cadences: everyday account fixes,
// the weekly tutorial deck, the rare lecture-date move. They were one long scroll; they
// are now three tabs. Accounts is the default — which is also where the teacher/unhappy
// e2e suites expect to land.
const TABS = [
  ["accounts", "Accounts"],
  ["briefs", "Tutorial decks"],
  ["schedule", "Lecture dates"],
] as const
type AdminTab = (typeof TABS)[number][0]

export default function AdminPage() {
  const router = useRouter()
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking")
  const [rows, setRows] = useState<AdminParticipant[]>([])
  const [counts, setCounts] = useState<{ total: number; withdrawn: number; disabled: number; claimed: number } | null>(null)
  const [roster, setRoster] = useState(true)
  const [sections, setSections] = useState<SectionOption[]>([])
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [pw, setPw] = useState("")
  const [endSessions, setEndSessions] = useState(false)
  const [uname, setUname] = useState("")
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)
  // Shown ONLY to a researcher. A teacher-only admin (Jeff) never sees this link — the
  // researcher surface must stay off the teacher's radar, or knowing the manipulation
  // exists is itself the confound. is_researcher is a separate allowlist from is_admin.
  const [isResearcher, setIsResearcher] = useState(false)
  const [tab, setTab] = useState<AdminTab>("accounts")

  const load = useCallback(async () => {
    const res = await admin.participants()
    if (res.ok && res.data) {
      setRows(res.data.participants)
      setCounts(res.data.counts)
      setRoster(res.data.roster)
    }
    const log = await admin.audit()
    if (log.ok && log.data) setEntries(log.data.entries)
  }, [])

  useEffect(() => {
    admin.whoami().then(async (res) => {
      if (res.status === 401) {
        router.replace("/login")
        return
      }
      if (!res.ok) {
        setState("denied")
        return
      }
      setState("ok")
      const s = await auth.sections()
      if (s.ok && s.data) setSections(s.data.sections)
      // Is this teacher ALSO the researcher? Only then does the researcher link appear.
      researcher.whoami().then((r) => setIsResearcher(r.ok))
      await load()
    })
  }, [router, load])

  const changeSection = async (sid: string, section: string) => {
    setNote(null)
    const res = await admin.setSection(sid, section)
    if (!res.ok) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't change that." })
      return
    }
    setNote({ kind: "ok", text: `${sid} moved to section ${section}.` })
    await load()
  }

  const resetPassword = async (sid: string) => {
    setNote(null)
    if (pw.length < 8) {
      setNote({ kind: "bad", text: "Pick a password of at least 8 characters." })
      return
    }
    const res = await admin.resetPassword(sid, pw, endSessions)
    if (!res.ok) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't reset that." })
      return
    }
    // Shown once, here, because there is no email and no self-serve reset: the
    // teacher reads it off this screen and tells the student. It is deliberately not
    // in the API response — that would put it in every proxy log.
    setNote({
      kind: "ok",
      text: `${sid}: password set to "${pw}"${
        res.data?.sessions_ended ? ` — signed out of ${res.data.sessions_ended} session(s)` : ""
      }. Tell them now; it is not stored anywhere you can read it back.`,
    })
    setPw("")
    setEndSessions(false)
    setOpen(null)
    await load()
  }

  const toggleDisabled = async (sid: string, disabled: boolean) => {
    setNote(null)
    const res = await admin.setDisabled(sid, disabled)
    if (!res.ok) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't change that." })
      return
    }
    setNote({
      kind: "ok",
      text: disabled
        ? `${sid} disabled — signed out and blocked from signing in. Their data is untouched.`
        : `${sid} re-enabled — they can sign in again.`,
    })
    await load()
  }

  const saveUsername = async (sid: string) => {
    setNote(null)
    if (!uname.trim()) {
      setNote({ kind: "bad", text: "The display name can't be empty." })
      return
    }
    const res = await admin.setUsername(sid, uname.trim())
    if (!res.ok) {
      setNote({ kind: "bad", text: res.message ?? "Couldn't change that." })
      return
    }
    setNote({ kind: "ok", text: `${sid} is now shown as "${uname.trim()}".` })
    setUname("")
    setOpen(null)
    await load()
  }

  if (state === "checking") {
    return (
      <main className="shell min-h-screen">
        <StaffHeader chip="Course team" />
        <ConsoleSkeleton />
      </main>
    )
  }

  if (state === "denied") {
    return (
      <main className="shell min-h-screen flex items-center justify-center px-5">
        <div className="u-card p-8 max-w-md text-center" data-testid="admin-denied">
          <p className="u-eyebrow">Not for you</p>
          <h1 className="u-h2 mt-2">This page is for the course team.</h1>
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

  const filtered = q
    ? rows.filter(
        (r) =>
          r.sid.toLowerCase().includes(q.toLowerCase()) ||
          (r.username ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : rows

  return (
    <main className="shell min-h-screen">
      <StaffHeader chip="Course team">
        {isResearcher && (
          <Link href="/researcher" className="u-btn" data-testid="researcher-link">
            Researcher tools →
          </Link>
        )}
      </StaffHeader>

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        <p className="u-eyebrow">Admin</p>
        <h1 className="u-h1 mt-1">Course team</h1>

        {/* The lecturer's real weekly job, one click away from wherever they land. */}
        {tab !== "briefs" && (
          <div className="u-card mt-5 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p style={{ fontWeight: 600 }}>This week&apos;s tutorial decks are ready</p>
              <p className="u-faint mt-0.5">
                A slide deck is built automatically before each class — concept recap,
                discussion questions to project, and how the class actually did.
              </p>
            </div>
            <button className="u-btn u-btn-primary" onClick={() => setTab("briefs")}>
              Open decks →
            </button>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Course-team sections"
          className="flex gap-1 mt-6"
          style={{ borderBottom: "1px solid var(--rule)" }}
        >
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              data-testid={`admin-tab-${key}`}
              onClick={() => setTab(key)}
              className="u-btn"
              style={{
                border: "none",
                borderRadius: 0,
                background: "transparent",
                borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
                color: tab === key ? "var(--accent)" : undefined,
                fontWeight: tab === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "accounts" && (
          <div>
            <p className="u-stem u-muted mt-4">
              Correct a section, or reset a password for a student who has lost theirs. Every
              change here is logged with your SID. Answers and scores are not on this page —
              those come out of the pseudonymised export.
            </p>

            {counts && (
              <div className="mt-6">
                <StatGrid cols={3} testid="admin-counts">
                  <StatCard label="Accounts" value={counts.total} />
                  <StatCard label="Signed up" value={counts.claimed} />
                  <StatCard label="Withdrawn" value={counts.withdrawn} />
                </StatGrid>
              </div>
            )}

            {roster && (
              <div className="mt-5">
                <Banner tone="info">
                  A class list is configured, so it decides each student&apos;s section. Sign-in
                  re-reads it every time, so changing a section here would be undone — edit{" "}
                  <span className="u-num">enrolled_sids.txt</span> instead.
                </Banner>
              </div>
            )}

            {note && (
              <div className="mt-5">
                <Banner tone={note.kind === "ok" ? "ok" : "warn"} testid="admin-note">
                  {note.text}
                </Banner>
              </div>
            )}

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a student by ID or name"
              className="u-field mt-6"
              data-testid="admin-search"
            />

            <ol className="mt-4 space-y-2" data-testid="admin-list">
              {filtered.map((r) => (
                <li key={r.sid}>
                  <div className="u-row p-4">
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <span className="u-num" style={{ fontWeight: 600 }}>
                        {r.sid}
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        {r.username ?? <span className="u-faint">no name yet</span>}
                      </span>
                      <span className="u-chip u-chip-open">Section {r.section ?? "—"}</span>
                      {!r.has_password && <span className="u-chip u-chip-locked">Not signed up</span>}
                      {!!r.withdrawn && <span className="u-chip u-chip-late">Withdrawn</span>}
                      {!!r.disabled && <span className="u-chip u-chip-locked">Disabled</span>}
                      <button
                        className="u-btn"
                        data-testid="admin-manage"
                        onClick={() => {
                          setOpen(open === r.sid ? null : r.sid)
                          setPw("")
                          setUname(r.username ?? "")
                          setNote(null)
                        }}
                      >
                        {open === r.sid ? "Close" : "Manage"}
                      </button>
                    </div>

                    {open === r.sid && (
                      <div
                        className="mt-4 pt-4 grid gap-3 sm:grid-cols-2"
                        style={{ borderTop: "1px solid var(--rule)" }}
                      >
                        {/* Section */}
                        <div className="u-card-quiet" style={{ padding: "0.9rem 1rem" }}>
                          <p className="u-eyebrow mb-2">Section</p>
                          <div className="flex gap-2 flex-wrap">
                            {sections.map((s) => (
                              <button
                                key={s.code}
                                disabled={roster}
                                onClick={() => changeSection(r.sid, s.code)}
                                data-testid="admin-section"
                                className="u-btn"
                              >
                                {s.code} · {s.day}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Access */}
                        <div className="u-card-quiet" style={{ padding: "0.9rem 1rem" }}>
                          <p className="u-eyebrow mb-2">Access</p>
                          {r.disabled ? (
                            <button
                              className="u-btn u-btn-primary"
                              onClick={() => toggleDisabled(r.sid, false)}
                              data-testid="admin-enable"
                            >
                              Re-enable this account
                            </button>
                          ) : (
                            <button
                              className="u-btn"
                              onClick={() => toggleDisabled(r.sid, true)}
                              data-testid="admin-disable"
                            >
                              Disable this account
                            </button>
                          )}
                          <p className="u-faint mt-2">
                            Disabling blocks sign-in and signs them out now, but keeps their data.
                            Removing a participant from the study is withdrawal, not this.
                          </p>
                        </div>

                        {/* Reset password */}
                        <div className="u-card-quiet" style={{ padding: "0.9rem 1rem" }}>
                          <p className="u-eyebrow mb-2">Reset password</p>
                          <div className="flex gap-2 flex-wrap items-center">
                            <input
                              type="text"
                              value={pw}
                              onChange={(e) => setPw(e.target.value)}
                              placeholder="new password, 8+ characters"
                              className="u-field"
                              style={{ maxWidth: "18rem" }}
                              data-testid="admin-newpw"
                            />
                            <button
                              className="u-btn u-btn-primary"
                              onClick={() => resetPassword(r.sid)}
                              data-testid="admin-reset"
                            >
                              Set it
                            </button>
                          </div>
                          <label className="u-faint flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={endSessions}
                              onChange={(e) => setEndSessions(e.target.checked)}
                              data-testid="admin-endsessions"
                            />
                            also sign them out everywhere
                          </label>
                          <p className="u-faint mt-2">
                            A forgotten password is not a compromise, so their existing sessions
                            stay alive unless you tick the box.
                          </p>
                        </div>

                        {/* Display name */}
                        <div className="u-card-quiet" style={{ padding: "0.9rem 1rem" }}>
                          <p className="u-eyebrow mb-2">Display name</p>
                          <div className="flex gap-2 flex-wrap items-center">
                            <input
                              type="text"
                              value={uname}
                              onChange={(e) => setUname(e.target.value)}
                              placeholder="display name"
                              className="u-field"
                              style={{ maxWidth: "18rem" }}
                              data-testid="admin-username"
                            />
                            <button
                              className="u-btn"
                              onClick={() => saveUsername(r.sid)}
                              data-testid="admin-username-save"
                            >
                              Save name
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {!filtered.length && <p className="u-muted mt-4">No accounts match that.</p>}
            </ol>

            {entries.length > 0 && (
              // Open by default: a collapsed details element hides its content from
              // innerText, breaking the "audit trail nobody can read is decoration"
              // invariant. Still collapsible, just visible by default.
              <details className="u-group mt-10" open>
                <summary className="u-group-head">
                  <span className="u-eyebrow" style={{ color: "var(--ink-body)" }}>
                    Recent changes
                  </span>
                  <span className="u-faint">{entries.length} logged</span>
                </summary>
                <div className="u-group-body">
                  <p className="u-faint mb-3">
                    An audit trail nobody can read is decoration, so it is here.
                  </p>
                  <ol className="space-y-1" data-testid="admin-audit">
                    {entries.slice(0, 20).map((e) => (
                      <li key={e.id} className="u-faint u-num">
                        {new Date(e.at).toLocaleString()} · {e.admin_sid} · {e.action}
                        {e.target_sid ? ` · ${e.target_sid}` : ""}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            )}
          </div>
        )}

        {/* The weekly job. Its own tab, not a scroll past the account list. */}
        {tab === "briefs" && <ReportsPanel />}

        {/* Lecture dates: the rarest job and the widest blast radius, so it is a
            deliberate tab rather than the bottom of a long page. `refresh` pulls the
            audit log back so a date change shows up beside a section change. */}
        {tab === "schedule" && <SchedulePanel onDone={() => void load()} />}
      </div>
    </main>
  )
}
