import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sid = searchParams.get("sid")

  if (!sid) return NextResponse.json({ error: "SID required" }, { status: 400 })

  const resultsDir = path.join(process.cwd(), "public", "legacy-labs", "results")

  try {
    if (!fs.existsSync(resultsDir)) return NextResponse.json({ data: [] })

    const files = fs.readdirSync(resultsDir)
    // Filters for files like "22077541D_lab1.txt"
    const userFiles = files.filter(file => file.startsWith(sid))

    const allResults = userFiles.map(file => {
      const content = fs.readFileSync(path.join(resultsDir, file), "utf8")
      return JSON.parse(content)
    })

    return NextResponse.json({ sid, exportDate: new Date().toISOString(), data: allResults })
  } catch (error) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}