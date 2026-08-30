# Manuals

Three deliverables, PDF. Screens are captured from the **live application** with
Playwright and labelled figure-by-figure — not mock-ups.

| # | File | For | Source |
|---|------|-----|--------|
| 1 | `1-installation-guide.pdf` | Whoever stands up the study server | `../../deploy/install-3090.html` (rendered to PDF) |
| 2 | `2-student-user-manual.pdf` | Students | `student-user-manual.html` + `img/s*.png` |
| 3 | `3-teacher-user-manual.pdf` | Course team | `teacher-user-manual.html` + `img/t*.png` |

## Regenerating after a UI change

Screenshots go stale when the UI moves. To refresh them and rebuild the PDFs, from
`frontend/` with the dev servers running (`:3000` + `:8080`):

```powershell
node ux-uat-student.mjs         # student journey  -> .shots-uat/NN-*.png
node ux-uat-teacher.mjs         # admin walkthrough (evidence)
node ux-manual-firstrun.mjs     # consent + onboarding first-run screens (fresh SID)
node ux-manual-teacher-vp.mjs   # admin panel as viewport shots (not 118k-px full-page)
# then curate/trim into docs/manuals/img/ and:
node make-manuals-pdf.mjs       # -> docs/manuals/*.pdf
```

The capture scripts drive a real signup/login, so they need an **open topic** on the
schedule and an unclaimed roster SID. `make-manuals-pdf.mjs` renders with screen media
(keeps the CUBIK look) and injects a print-only wrap fix for the install runbook's long
PowerShell commands.
