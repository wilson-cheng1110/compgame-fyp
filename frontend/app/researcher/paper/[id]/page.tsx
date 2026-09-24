import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getPaper, PAPERS, paperLiveTone } from "@/lib/papers"
import { StaffHeader, Panel, StatGrid, StatCard, DataTable, THEAD_ROW_STYLE, TROW_STYLE } from "@/components/staff"
import type { PaperSlice } from "@/lib/api"

// ONE PAPER's page, in the research-programme dashboard added to /researcher. A SERVER
// component, following app/topics/[topicId]/page.tsx exactly: gate server-side with the
// forwarded session cookie, resolve to one of a small Loaded union, and render the
// outcome directly — no client-side "checking…" flash, no state that shows nothing and
// says nothing.
//
// Gated the SAME way the rest of /researcher is (session + researcher_sids.txt
// membership, via researcher_api._researcher / GET /api/researcher/whoami) — a teacher
// or a student who guesses this URL learns only that it isn't theirs, same as the
// monitor page. Nothing here is a separate or weaker gate.
//
// PHASE 1: the scholarly "artifact part" (hypothesis/DV, venue, fit verdict, key
// measures, for/against) comes from the static frontend/lib/papers.ts constant — ported
// from docs/lit/, not fetched. The live-data panel is a PLACEHOLDER: it shows the
// paper's own `liveStatus` string and says Phase 2 wires the real query. No live number
// is invented here.

export const dynamic = "force-dynamic" // per-researcher-session, gated on a session cookie

// ABSOLUTE, and deliberately NOT the browser's relative API_BASE — same reasoning as
// app/topics/[topicId]/page.tsx: this is a SERVER component, so a relative fetch has no
// origin to resolve against. Talks to the API directly over loopback.
const API = (process.env.API_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/$/, "")

type Loaded =
  | { kind: "ok"; sid: string }
  | { kind: "unauthenticated" }
  | { kind: "denied" }
  | { kind: "unreachable" }

async function loadAccess(): Promise<Loaded> {
  // The session is HttpOnly, so it must be forwarded explicitly — a server-side fetch
  // does not carry the browser's cookie jar for us.
  const jar = await cookies()
  const session = jar.get("session")?.value
  if (!session) return { kind: "unauthenticated" }

  let res: Response
  try {
    res = await fetch(`${API}/api/researcher/whoami`, {
      headers: { cookie: `session=${session}` },
      cache: "no-store",
    })
  } catch {
    return { kind: "unreachable" }
  }

  if (res.status === 401) return { kind: "unauthenticated" }
  if (res.status === 403) return { kind: "denied" }
  if (!res.ok) return { kind: "unreachable" }

  const body = (await res.json()) as { ok: true; sid: string }
  return { kind: "ok", sid: body.sid }
}

// The paper's live-data slice — a SECOND server-side fetch, gated identically (the
// forwarded session cookie; researcher_api re-checks membership). Returns null on any
// failure so the panel falls back to the static liveStatus string rather than erroring.
async function loadSlice(id: string): Promise<PaperSlice | null> {
  const jar = await cookies()
  const session = jar.get("session")?.value
  if (!session) return null
  try {
    const res = await fetch(`${API}/api/researcher/paper/${encodeURIComponent(id)}`, {
      headers: { cookie: `session=${session}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as PaperSlice
  } catch {
    return null
  }
}

// The error/blocked-state chrome — a real message inside the researcher header, not a
// bare "not found" or a client spinner. Named `Notice` (not `Panel`) because this page
// also imports the staff-console `Panel` for its real content sections.
function Notice({
  eyebrow,
  children,
  testid,
}: {
  eyebrow: string
  children: React.ReactNode
  testid?: string
}) {
  return (
    <main className="shell min-h-screen">
      <StaffHeader chip="Researcher">
        <Link href="/researcher" className="u-faint hover:underline">
          All papers
        </Link>
      </StaffHeader>
      <div className="mx-auto w-full max-w-2xl px-5 py-16">
        <div className="u-card p-8" data-testid={testid}>
          <p className="u-eyebrow">{eyebrow}</p>
          {children}
          <Link href="/researcher">
            <button className="u-btn u-btn-primary mt-7">Back to the papers</button>
          </Link>
        </div>
      </div>
    </main>
  )
}

export default async function ResearcherPaperPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const access = await loadAccess()

  if (access.kind === "unauthenticated") redirect("/login")

  if (access.kind === "unreachable") {
    return (
      <Notice eyebrow="Couldn&apos;t load this paper" testid="paper-unreachable">
        <p className="u-stem mt-3">
          The server didn&apos;t answer. Try again in a moment — nothing here depends on
          anything that could be lost.
        </p>
      </Notice>
    )
  }

  if (access.kind === "denied") {
    return (
      <main className="shell min-h-screen flex items-center justify-center px-5">
        <div className="u-card p-8 max-w-md text-center" data-testid="paper-denied">
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

  const paper = getPaper(id)
  if (!paper) {
    return (
      <Notice eyebrow="Not found" testid="paper-unknown">
        <p className="u-stem mt-3">That paper isn&apos;t part of this programme.</p>
      </Notice>
    )
  }

  const order = PAPERS.findIndex((p) => p.id === paper.id) + 1
  const tone = paperLiveTone(paper.liveStatus)
  const chipClass =
    tone === "live" ? "u-chip-open" : tone === "caveat" ? "u-chip-late" : "u-chip-locked"
  const chipLabel = tone === "live" ? "live" : tone === "caveat" ? "partial" : "pending"

  const slice = await loadSlice(paper.id)
  const sliceChip = slice
    ? slice.status === "live"
      ? { cls: "u-chip-open", label: "live" }
      : slice.status === "proxy"
        ? { cls: "u-chip-late", label: "live proxy" }
        : slice.status === "flag_off"
          ? { cls: "u-chip-locked", label: "telemetry off" }
          : { cls: "u-chip-locked", label: "pending" }
    : { cls: chipClass, label: chipLabel }

  return (
    <main className="shell min-h-screen">
      <StaffHeader chip="Researcher">
        <Link href="/researcher" className="u-faint hover:underline">
          All papers
        </Link>
      </StaffHeader>

      <div className="mx-auto w-full max-w-5xl px-5 py-8 pb-20">
        <p className="u-eyebrow">
          Paper {order} of {PAPERS.length} · {paper.role}
        </p>
        <h1 className="u-h1 mt-1">{paper.title}</h1>
        <p className="u-stem u-muted mt-2">
          {paper.venue}
          {paper.backupVenue ? ` (alt: ${paper.backupVenue})` : ""}
        </p>

        <Panel title="Hypothesis / DV" testid="paper-hypothesis">
          <p className="u-stem">{paper.hypothesisDV}</p>
        </Panel>

        <Panel title="Fit verdict" testid="paper-fit-verdict" desc="A verdict on the plumbing — is the measure instrumented and live — not on the science.">
          <p className="u-stem">{paper.fitVerdict}</p>
        </Panel>

        <Panel title="Key measures" testid="paper-key-measures">
          <div className="u-card" style={{ padding: "1.1rem 1.2rem" }}>
            <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", display: "grid", gap: "0.6rem" }}>
              {paper.keyMeasures.map((m, i) => (
                <li key={i} className="u-stem" style={{ fontSize: "0.95rem" }}>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {paper.forAgainst && (
          <Panel
            title="For / against the hypothesis"
            testid="paper-for-against"
            desc="Two independent lists from the dossier — row N on one side is not a reply to row N on the other."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="u-card" style={{ padding: "1.1rem 1.2rem" }}>
                <p className="u-eyebrow" style={{ color: "var(--state-done)" }}>
                  For
                </p>
                <ul style={{ listStyle: "disc", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem", marginTop: "0.5rem" }}>
                  {paper.forAgainst.for.map((f, i) => (
                    <li key={i} className="u-faint">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="u-card" style={{ padding: "1.1rem 1.2rem" }}>
                <p className="u-eyebrow" style={{ color: "var(--state-late)" }}>
                  Against / threat
                </p>
                <ul style={{ listStyle: "disc", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem", marginTop: "0.5rem" }}>
                  {paper.forAgainst.against.map((a, i) => (
                    <li key={i} className="u-faint">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        )}

        <Panel
          title="Live data"
          testid="paper-live-data"
          tone="sensitive"
          desc="Aggregate + pseudonymised only — counts and distributions from the sink via measures.py, never a participant row. Same researcher gate as the rest of /researcher."
        >
          {slice ? (
            <div data-testid="paper-live-slice">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`u-chip ${sliceChip.cls}`}>{sliceChip.label}</span>
                <p className="u-stem" style={{ maxWidth: "62ch" }}>
                  {slice.basis}
                </p>
              </div>

              {slice.stats.length > 0 && (
                <div className="mt-4">
                  <StatGrid
                    cols={
                      slice.stats.length >= 6
                        ? 6
                        : slice.stats.length >= 5
                          ? 5
                          : slice.stats.length >= 4
                            ? 4
                            : 3
                    }
                  >
                    {slice.stats.map((s, i) => (
                      <StatCard key={i} label={s.label} value={s.value} sub={s.sub ?? null} />
                    ))}
                  </StatGrid>
                </div>
              )}

              {slice.table && slice.table.rows.length > 0 && (
                <div className="mt-4">
                  <DataTable minWidth={Math.max(520, slice.table.columns.length * 96)}>
                    <thead>
                      <tr className="u-faint" style={THEAD_ROW_STYLE}>
                        {slice.table.columns.map((col, ci) => (
                          <th key={col} scope="col" className={ci === 0 ? "p-3" : "p-3 u-r"}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slice.table.rows.map((row, ri) => (
                        <tr key={ri} style={TROW_STYLE}>
                          {row.map((cell, ci) => (
                            <td key={ci} className={ci === 0 ? "p-3" : "p-3 u-num u-r"}>
                              {cell === null ? "—" : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              )}

              {slice.note && <p className="u-faint mt-3">{slice.note}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`u-chip ${chipClass}`}>{chipLabel}</span>
              <p className="u-stem" style={{ maxWidth: "56ch" }}>
                {paper.liveStatus}
              </p>
            </div>
          )}
        </Panel>
      </div>
    </main>
  )
}
