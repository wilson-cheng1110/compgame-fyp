import { NextResponse } from "next/server"

// Proxy the research data export from the FastAPI backend.
// The legacy-labs .txt export that lived here has been removed.
// Usage:
//   GET /api/export-data          → JSON (all participant events)
//   GET /api/export-data?format=csv → CSV download
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") ?? "json"

  try {
    const res = await fetch(`http://localhost:8080/api/research/export?format=${encodeURIComponent(format)}`)
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
