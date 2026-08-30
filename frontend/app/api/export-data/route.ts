import { NextResponse } from "next/server"

// Proxy the research data export from the FastAPI backend.
// The legacy-labs .txt export that lived here has been removed.
// Usage:
//   GET /api/export-data          → JSON (all participant events)
//   GET /api/export-data?format=csv → CSV download
// Absolute loopback for the same reason as app/topics/[topicId]/page.tsx: this is a
// route HANDLER, so it runs on the server and a relative URL has nothing to resolve
// against. It used to hardcode the origin outright, with no environment variable at
// all, which meant this one route ignored every deployment setting.
const API = (process.env.API_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/$/, "")

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") ?? "json"

  try {
    const res = await fetch(`${API}/api/research/export?format=${encodeURIComponent(format)}`)
    if (!res.ok) {
      return NextResponse.json({ error: "Research backend unavailable" }, { status: 502 })
    }

    const body = await res.text()
    const contentType = format === "csv" ? "text/csv" : "application/json"
    const headers: Record<string, string> = { "Content-Type": contentType }
    if (format === "csv") {
      headers["Content-Disposition"] = "attachment; filename=research_events.csv"
    }
    return new NextResponse(body, { status: 200, headers })
  } catch {
    return NextResponse.json({ error: "Research backend unavailable — is it running on port 8080?" }, { status: 502 })
  }
}
