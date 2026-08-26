import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { TOPICS } from "@/lib/topic-definitions"
import type { Journey, JourneyTopic } from "@/lib/api"
import UnitHeader from "./unit-header"
import TopicUnitClient from "./unit-client"

// THE TOPIC UNIT - a SERVER component. This is the fix, not a refactor.
//
// It used to be `"use client"` and fetch its own state on mount, so its first render
// was always `Loading...` and everything real depended on hydration. When the client
// bundle did not arrive or did not run, the student sat on `Loading...` indefinitely:
// no error, nothing to click, and a 200 in the server log. A client-side timeout could
// not rescue it either, because a timer needs hydration too.
//
// Now the server does the fetch and renders the outcome:
//
//   not signed in     -> redirect to /login, before any HTML is sent
//   topic unknown     -> a real message
//   locked / not open -> the blocked panel, fully rendered, no JS required
//   open              -> the unit itself, already populated
//
// The interactive half (unit-client.tsx) still hydrates so the steps can advance, but
// it is HANDED its state, so its first render - server-side - is the real unit. There
// is no longer any state in which this page shows nothing and says nothing.
//
// docs/revamp.md Part 2; the failure it replaces is written up in frontend/e2e/README.md.

export const dynamic = "force-dynamic" // per-student, gated on a session cookie

const API =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://localhost:8080"

type Loaded =
  | { kind: "ok"; topic: JourneyTopic; telemetryEnabled: boolean }
  | { kind: "unauthenticated" }
  | { kind: "unknown-topic" }
  | { kind: "unreachable" }

async function loadTopic(topicId: string): Promise<Loaded> {
  // The session is HttpOnly, so it must be forwarded explicitly - a server-side fetch
  // does not carry the browser's cookie jar for us.
  const jar = await cookies()
  const session = jar.get("session")?.value
  if (!session) return { kind: "unauthenticated" }

  let res: Response
  try {
    res = await fetch(`${API}/api/topics`, {
      headers: { cookie: `session=${session}` },
      cache: "no-store",
    })
  } catch {
    return { kind: "unreachable" }
  }

  if (res.status === 401) return { kind: "unauthenticated" }
  if (!res.ok) return { kind: "unreachable" }

  const journey = (await res.json()) as Journey
  const topic = journey.topics?.find((t) => t.topic_id === topicId)
  if (!topic) return { kind: "unknown-topic" }
  return { kind: "ok", topic, telemetryEnabled: journey.telemetry_enabled }
}

function Panel({
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
      <UnitHeader />
      <div className="mx-auto w-full max-w-2xl px-5 py-16">
        <div className="u-card p-8" data-testid={testid}>
          <p className="u-eyebrow">{eyebrow}</p>
          {children}
          <Link href="/dashboard">
            <button className="u-btn u-btn-primary mt-7">Back to my topics</button>
          </Link>
        </div>
      </div>
    </main>
  )
}

export default async function TopicUnitPage({
  params,
}: {
  params: Promise<{ topicId: string }>
}) {
  const { topicId } = await params
  const loaded = await loadTopic(topicId)

  if (loaded.kind === "unauthenticated") redirect("/login")

  if (loaded.kind === "unreachable") {
    return (
      <Panel eyebrow="Couldn&apos;t load this topic" testid="topic-unreachable">
        <p className="u-stem mt-3">
          The server didn&apos;t answer. Your work is saved on it, so nothing is lost -
          try again in a moment. If it keeps happening, tell your course team.
        </p>
      </Panel>
    )
  }

  if (loaded.kind === "unknown-topic") {
    return (
      <Panel eyebrow="Not found" testid="topic-unknown">
        <p className="u-stem mt-3">That topic doesn&apos;t exist.</p>
      </Panel>
    )
  }

  const { topic, telemetryEnabled } = loaded
  const meta = TOPICS.find((t) => t.id === topic.topic_id)

  if (topic.state === "locked" || topic.state === "unscheduled") {
    return (
      <Panel eyebrow="Not open yet" testid="topic-blocked">
        <p className="u-stem mt-3">
          {topic.opens
            ? `This topic opens on ${new Date(topic.opens).toLocaleDateString()}.`
            : "This topic isn&apos;t scheduled yet."}
        </p>
      </Panel>
    )
  }

  if (!meta) {
    return (
      <Panel eyebrow="Not found" testid="topic-unknown">
        <p className="u-stem mt-3">That topic isn&apos;t part of this course.</p>
      </Panel>
    )
  }

  return <TopicUnitClient state={topic} telemetryEnabled={telemetryEnabled} />
}
