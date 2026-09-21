import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getPaper, PAPERS, paperLiveTone } from "@/lib/papers"
import { StaffHeader, Panel } from "@/components/staff"

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

  return (
    <main className="shell min-h-screen">
      <StaffHeader chip="Researcher">
        <Link href="/researcher" className="u-faint hover:underline">
          All papers
        </Link>
      </StaffHeader>

      <div className="mx-auto w-full max-w-3xl px-5 py-8 pb-20">
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
          desc="Placeholder — Phase 2 wires the real query (a new measures.py function + a researcher_api.py endpoint, aggregate + pseudonymised only). This is the paper's stated status, not a live number."
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`u-chip ${chipClass}`}>{chipLabel}</span>
            <p className="u-stem" style={{ maxWidth: "56ch" }}>
              {paper.liveStatus}
            </p>
          </div>
        </Panel>
      </div>
    </main>
  )
}
