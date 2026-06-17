// VLM pass over the render-check screenshots using the local llava model
// (Ollama). Catches visually-blank/broken renders that a textLen or console-error
// check misses — e.g. a canvas game that mounts cleanly but paints nothing.
//
// Run: node scripts/vlm-scan.mjs   (Ollama must be running with llava pulled)

import fs from "node:fs"
import path from "node:path"

const SHOTS = path.join(process.cwd(), "scripts", "shots")
const OLLAMA = "http://localhost:11434/api/generate"
const MODEL = "llava:latest"

const PROMPT =
  "This is a screenshot of a web-based educational game UI. Answer in exactly this format on one line: " +
  "'STATUS=OK <reason>' if the page shows real rendered content (text, buttons, graphics, charts, or a game scene), " +
  "or 'STATUS=BLANK <reason>' if it is essentially empty, all-white, all-one-color, or visibly broken. Keep the reason under 8 words."

const files = fs.readdirSync(SHOTS).filter((f) => f.endsWith(".png")).sort()
const results = []

for (const f of files) {
  const b64 = fs.readFileSync(path.join(SHOTS, f)).toString("base64")
  let line = "STATUS=ERR no-response"
  try {
    const res = await fetch(OLLAMA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt: PROMPT, images: [b64], stream: false }),
    })
    const j = await res.json()
    line = (j.response || "").trim().split("\n")[0].slice(0, 120)
  } catch (e) {
    line = "STATUS=ERR " + e.message
  }
  const blank = /STATUS=BLANK/i.test(line)
  results.push({ file: f, blank, verdict: line })
  console.log(`${blank ? "⚠ BLANK" : "  ok   "} ${f.replace(".png", "").padEnd(34)} ${line}`)
}

fs.writeFileSync(path.join(process.cwd(), "scripts", "vlm-report.json"), JSON.stringify(results, null, 2))
const flagged = results.filter((r) => r.blank)
console.log(`\n=== VLM SUMMARY === scanned ${results.length}, flagged blank/broken: ${flagged.length}`)
for (const r of flagged) console.log("  ", r.file, "→", r.verdict)
