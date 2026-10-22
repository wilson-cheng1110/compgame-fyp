# USB deploy pack — the whole rebuild chain, runnable from a stick

For rebuilding the study box after C1 (the wipe). One script assembles the stick on the
dev machine; one script on the box runs the entire existing chain in order — it
**sequences** `setup.ps1 / start.ps1 / firewall.ps1 / publish.ps1 / install-*.ps1`,
it does not reimplement them.

## Phase A — before the stick (not scripted, on purpose)

1. **C1 wipe** — Wilson's per-step GO; clean Windows install on the box.
2. Tailnet console: **delete the old JEFF3090 node** and kill its keys; create a
   **new tagged, reusable auth key** (you type it into the box once).
3. Box basics: network up, log in as the study user, Windows Update current.

## Phase B — build the stick (dev machine)

```powershell
powershell -File deploy\usb\build-stick.ps1 -DriveLetter E
```

Produces `E:\compgame-deploy\` with the repo bundle of committed master
(fingerprint-verified), the carry-across files git never carries (participant key —
checked against fingerprint `3e4d9879f95bab51` — admin/researcher lists, roster,
`.env.local` as flag source), and the on-box master script. Use `-WhatIf` to preview.

**The stick then holds the participant key, the roster and `.env.local`.** Physical key
rules: known drawer, and wipe it after the rebuild.

## Phase C — on the wiped box (one command)

```powershell
# elevated PowerShell
E:\compgame-deploy\run-deploy.ps1
```

Phases, each gated (any red gate stops the run; fix and re-run — it is safe to re-run):

| # | Phase | What it does |
|---|-------|--------------|
| 0 | Preflight | stick complete, network up, target dir clean |
| 1 | Runtimes | winget: git, Python 3.11, Node LTS, Ollama, Tailscale |
| 2 | Repo | `git clone` the bundle → `C:\COMPGame`; origin reset for `update.ps1` |
| 3 | Carry-across | key + lists placed; **fingerprint must match or it stops** |
| 4 | `setup.ps1` | deps, ~8 GB models, build, go-live gates (the slow part) |
| 5 | Flags | `QUESTIONNAIRES_ENABLED=1`, `TELEMETRY_ENABLED=1`, heartbeat/idle merged into `.env.local` |
| 6 | Tailscale | `tailscale up --authkey … --unattended` (you type the new key) |
| 7 | `firewall.ps1` | `-WhatIf` preview first; type `APPLY` to enforce |
| 8 | `start.ps1` | services up; `/api/health` checked through 3000 |
| 9 | `publish.ps1 -Via tailscale` | funnel up; you confirm the `https://…ts.net` URL → `ALLOWED_ORIGINS` → restart → public health check |
| 10 | Persistence | `install-services.ps1` → `install-user-autostart.ps1` (watchdog + hourly backup + heartbeat) |

Interactive exactly three times: the auth key, the firewall `APPLY`, the funnel hostname.

## Phase D — operator checks (none automatable)

1. Phone on cellular (not the box, not the house network): open the `ts.net` URL, sign in.
2. Tailnet console: old node confirmed gone.
3. Keep the study user logged in (Startup-folder keep-alive); set Windows Update active hours.
4. First backup line in `C:\COMPGame\deploy\logs\keepalive.log` within a minute.
5. **Wipe the stick.**
6. Optional, from another machine: `$env:E2E_APP="https://<host>"; $env:E2E_API="https://<host>"; node frontend\e2e\run.mjs`

## Undo paths

- Firewall: `C:\COMPGame\deploy\firewall.ps1 -Revert` (restores recorded third-party rules).
- Keep-alive: `deploy\install-user-autostart.ps1 -Remove`.
- Services: `deploy\start.ps1 -Stop`.

## Deliberately not in the chain

C1 itself (per-step GO), participant-key minting (carry-across only), router port
forwards (funnel needs none), Parsec (optional — install later, re-run `firewall.ps1`,
it is idempotent), offline model blobs (the box has network), the C4 Next.js pin bump
(tracked backlog item).
