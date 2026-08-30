"use client"

import { useCallback, useEffect, useState } from "react"
import SchedulePanel from "./schedule-panel"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { admin, auth, type AdminParticipant, type AuditEntry, type SectionOption } from "@/lib/api"

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

export default function AdminPage() {
  const router = useRouter()
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking")
  const [rows, setRows] = useState<AdminParticipant[]>([])
  const [counts, setCounts] = useState<{ total: number; withdrawn: number; claimed: number } | null>(null)
  const [roster, setRoster] = useState(true)
  const [sections, setSections] = useState<SectionOption[]>([])
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [pw, setPw] = useState("")
  const [endSessions, setEndSessions] = useState(false)
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null)

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
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <span className="u-chip u-chip-open">Course team</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        <p className="u-eyebrow">Admin</p>
        <h1 className="u-h1 mt-1">Accounts</h1>
        <p className="u-stem u-muted mt-2">
          Correct a section, or reset a password for a student who has lost theirs. Every
          change here is logged with your SID. Answers and scores are not on this page —
          those come out of the pseudonymised export.
        </p>

        {counts && (
          <div className="flex gap-6 mt-6 flex-wrap" data-testid="admin-counts">
            {[
              ["Accounts", counts.total],
              ["Signed up", counts.claimed],
              ["Withdrawn", counts.withdrawn],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <p className="u-eyebrow">{label}</p>
                <p className="u-h2 u-num mt-1">{n}</p>
              </div>
            ))}
          </div>
        )}

        {roster && (
          <p className="u-faint mt-5" style={{ borderLeft: "3px solid var(--rule-strong)", paddingLeft: ".75rem" }}>
            A class list is configured, so it decides each student&apos;s section. Sign-in
            re-reads it every time, so changing a section here would be undone —
            edit <span className="u-num">enrolled_sids.txt</span> instead.
          </p>
        )}

        {note && (
          <div
            className="u-card p-4 mt-5"
            data-testid="admin-note"
            style={{
              borderColor: note.kind === "ok" ? "var(--state-done)" : "var(--state-late)",
              color: note.kind === "ok" ? "var(--state-done)" : "var(--state-late)",
            }}
          >
            {note.text}
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
                  <span className="flex-1 min-w-0 truncate">{r.username ?? <span className="u-faint">no name yet</span>}</span>
                  <span className="u-chip u-chip-open">Section {r.section ?? "—"}</span>
                  {!r.has_password && <span className="u-chip u-chip-locked">Not signed up</span>}
                  {!!r.withdrawn && <span className="u-chip u-chip-late">Withdrawn</span>}
                  <button
                    className="u-btn"
                    data-testid="admin-manage"
                    onClick={() => {
                      setOpen(open === r.sid ? null : r.sid)
                      setPw("")
                      setNote(null)
                    }}
                  >
                    {open === r.sid ? "Close" : "Manage"}
                  </button>
                </div>

                {open === r.sid && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--rule)" }}>
                    <p className="u-eyebrow mb-2">Section</p>
                    <div className="flex gap-2 flex-wrap">
                      {sections.map((s) => (
                        <button
                          key={s.code}
                          disabled={roster}
                          onClick={() => changeSection(r.sid, s.code)}
                          data-testid="admin-section"
                          className="u-btn"
                          style={{ opacity: roster ? 0.45 : 1 }}
                        >
                          {s.code} · {s.day}
                        </button>
                      ))}
                    </div>

                    <p className="u-eyebrow mt-5 mb-2">Reset password</p>
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
                      <label className="u-faint flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={endSessions}
                          onChange={(e) => setEndSessions(e.target.checked)}
                          data-testid="admin-endsessions"
                        />
                        also sign them out everywhere
                      </label>
                      <button
                        className="u-btn u-btn-primary"
                        onClick={() => resetPassword(r.sid)}
                        data-testid="admin-reset"
                      >
                        Set it
                      </button>
                    </div>
                    <p className="u-faint mt-2">
                      A forgotten password is not a compromise, so their existing sessions
                      stay alive unless you tick the box.
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
          {!filtered.length && <p className="u-muted mt-4">No accounts match that.</p>}
        </ol>

        {entries.length > 0 && (
          <div className="mt-10">
            <p className="u-eyebrow">Recent changes</p>
            <p className="u-faint mt-1 mb-3">
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
        )}

        {/* Lecture dates last: it is the rarest job on this page and the one with
            the widest blast radius, so it sits below the everyday ones rather than
            competing with them. `refresh` pulls the audit log back so a date change
            shows up in the same log as a section change, which is the point. */}
        <SchedulePanel onDone={() => void load()} />
      </div>
    </main>
  )
}
