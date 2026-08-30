// One-shot: render local HTML files to PDF with Playwright (screen media, backgrounds
// on, so the CUBIK-styled manuals keep their look). Usage: node make-manuals-pdf.mjs
import { chromium } from "playwright"
import { pathToFileURL } from "url"
import { resolve } from "path"
import { existsSync, statSync } from "fs"

// The install runbook is authored for screen width; at A4 the long winget/PowerShell
// commands overflow the right margin and clip, and the "copy" buttons are dead in a
// PDF. Inject a print-only fix (wrap commands, drop the buttons) at render time so the
// committed source HTML is untouched.
const INSTALL_PRINT_CSS = `
  .copy{ display:none !important; }
  .cmd pre, .cmd code, pre code{ white-space:pre-wrap !important; overflow-wrap:anywhere !important; word-break:break-word !important; }
  .cmd{ overflow:visible !important; }
  .cmd pre{ font-size:11px !important; line-height:1.5 !important; }
`
const JOBS = [
  { in: "../deploy/install-3090.html",            out: "../docs/manuals/1-installation-guide.pdf", inject: INSTALL_PRINT_CSS },
  { in: "../docs/manuals/student-user-manual.html", out: "../docs/manuals/2-student-user-manual.pdf" },
  { in: "../docs/manuals/teacher-user-manual.html", out: "../docs/manuals/3-teacher-user-manual.pdf" },
  { in: "../docs/manuals/researcher-pi-runbook.html", out: "../docs/manuals/4-researcher-pi-runbook.pdf" },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const job of JOBS) {
  const inAbs = resolve(job.in)
  const outAbs = resolve(job.out)
  if (!existsSync(inAbs)) { console.log(`SKIP (missing): ${job.in}`); continue }
  await page.goto(pathToFileURL(inAbs).href, { waitUntil: "networkidle" })
  await page.emulateMedia({ media: "screen" })          // keep the designed look, not print stylesheet
  if (job.inject) await page.addStyleTag({ content: job.inject })
  await page.waitForTimeout(600)                          // let webfonts settle
  await page.pdf({
    path: outAbs,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate:
      '<div style="width:100%;font-size:8px;font-family:Inter,Arial;color:#6b7280;padding:0 12mm;display:flex;justify-content:space-between;">' +
      '<span>COMPGame FYP</span><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  })
  const kb = (statSync(outAbs).size / 1024).toFixed(0)
  console.log(`OK  ${job.out}  (${kb} KB)`)
}
await browser.close()
console.log("done")
