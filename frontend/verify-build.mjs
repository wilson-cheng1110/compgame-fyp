// Prove the build on disk is complete before anyone serves it.
//
//     node verify-build.mjs        # exit 0 = every referenced chunk exists
//
// WHY THIS EXISTS. On 2026-08-27 the app served pages that rendered and then never
// hydrated: 200 OK, no error anywhere, the topic unit stuck on "Loading…" forever.
// The cause was a PARTIAL `.next` — a build run while `next start` was serving. The
// only visible sign was `next start` logging MODULE_NOT_FOUND on a vendor chunk, and
// only on a cold restart.
//
// A warning in the runbook does not stop that. This does: it reads the build's own
// manifests, checks every file they reference actually exists, and exits non-zero if
// not. Deterministic, offline, about a second. Run it between `build` and `start`.
//
// It cannot prove a chunk's CONTENTS are right — only that nothing is missing. That is
// the failure mode that actually occurred, and the one that is silent at runtime.

import { readFile, access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Resolved from THIS FILE, not the cwd: the go-live gate invokes it as
// `node frontend/verify-build.mjs` from the repo root, and a cwd-relative
// ".next" made that exit 1 on a perfectly good build. A gate that goes red
// for the wrong reason teaches people to ignore it.
const NEXT = join(dirname(fileURLToPath(import.meta.url)), ".next")
const problems = []
let checked = 0

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function readManifest(name) {
  try {
    return JSON.parse(await readFile(join(NEXT, name), "utf8"))
  } catch (e) {
    problems.push(`${name} is missing or unreadable — the build did not finish`)
    return null
  }
}

// Every client chunk each App Router route needs.
const app = await readManifest("app-build-manifest.json")
if (app?.pages) {
  for (const [route, files] of Object.entries(app.pages)) {
    for (const f of files) {
      checked++
      if (!(await exists(join(NEXT, f)))) problems.push(`${route}  ->  missing ${f}`)
    }
  }
}

// The pages-router manifest still exists for _document etc.
const pages = await readManifest("build-manifest.json")
for (const f of pages?.polyfillFiles ?? []) {
  checked++
  if (!(await exists(join(NEXT, f)))) problems.push(`polyfill  ->  missing ${f}`)
}
for (const [route, files] of Object.entries(pages?.pages ?? {})) {
  for (const f of files) {
    checked++
    if (!(await exists(join(NEXT, f)))) problems.push(`${route}  ->  missing ${f}`)
  }
}

// Server-side vendor chunks: the thing that was actually missing, and the thing that
// turns into a 500 at request time rather than at build time.
const required = await readManifest("required-server-files.json")
if (required && required.config?.output === "standalone") {
  problems.push(
    "config.output is 'standalone' — `next start` cannot serve that build " +
      "(it 200s the HTML and 400s every asset). See docs/runbook.md §2.",
  )
}

console.log(`  checked ${checked} referenced build files`)
if (problems.length) {
  console.log(`\n  BUILD IS INCOMPLETE — ${problems.length} problem(s):\n`)
  for (const p of problems.slice(0, 20)) console.log(`    · ${p}`)
  if (problems.length > 20) console.log(`    … and ${problems.length - 20} more`)
  console.log(
    "\n  Do not serve this. Stop the server, delete .next, and rebuild:\n" +
      "    rm -rf .next && npm run build && node verify-build.mjs\n",
  )
  process.exitCode = 1
} else {
  console.log("  build is complete — safe to serve")
}
