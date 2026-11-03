# 3090 bring-up checklist

The operator runbook for taking the deployment box live for the study. `README.md` explains
the *why*; this is the *do it in this order, don't skip a row*. A study box is a one-shot
target — each student sits each topic once, there is no second run to fix a bad launch — so
the point of this list is that `publish.ps1` never puts a misconfigured box in front of a
student, and that the box survives without you afterwards.

> **Run every command below in PowerShell, from the repository root** (the folder
> holding `deploy\`, `backend\`, `frontend\`); every path is relative to it. As written
> the commands are copy-paste-ready for PowerShell.

> **Shortcut:** with the step-1 files in place AND `deploy\service.ps1 install` already run
> (elevated — start.ps1 refuses without the nginx front door it fetches), `deploy\bootstrap.ps1`
> does prerequisites + `setup.ps1` + `start.ps1` in one command (add `-SecretFingerprint <16hex>`
> to have the key checked). `publish.ps1` stays separate. The steps below are
> the same thing, unrolled.

## 0. On the box already
- [ ] **Git** (to clone): `winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements`. An NVIDIA GPU + drivers to *run* the tutor at a usable speed.
- [ ] The repo pulled to the current branch HEAD (`git pull` / clone). The tree **builds from a clean clone** — verified — so a pull is enough; you do not hand-copy source.
- [ ] **Python + Node + Ollama + cloudflared, in one command** (after cloning, from the repo root):
      ```powershell
      winget import -i deploy\winget-packages.json --accept-package-agreements --accept-source-agreements
      ```
      Then open a **new** PowerShell so PATH picks them up. (`setup.ps1` re-checks Python/Node/Ollama and stops with a link if one is still missing.)

## 1. Carry across the files git does NOT bring (all gitignored — they hold real people)
git will not deliver these. Put them in place **before** `start.ps1`.

- [ ] **`backend\.participant_secret`** — copy from your backup, then **verify the fingerprint**:
      ```powershell
      (Get-FileHash backend\.participant_secret -Algorithm SHA256).Hash   # first 16 hex must be 3e4d9879…
      ```
      This is the only file the publish gate checks for *presence* but **not** for being the
      *right* key. A freshly-minted one passes the gate and silently breaks every cross-export
      join — unrecoverable. This checkbox is the guard the gate can't be.
- [ ] **`backend\enrolled_sids.txt`** — the real class roster, `SID,section` per line. Without it
      signup is open and each student self-reports their section (their release window). The
      publish gate refuses only the **8000-row e2e fixture**, so a real roster and an absent one
      both pass — placing the real one is your call, not the gate's.
- [ ] **`backend\admin_sids.txt`** — teacher SIDs (one per line) for the `/admin` panel.
- [ ] **`deploy\.env.local`** — must contain:
      - `COOKIE_SECURE=1`  (publish **refuses** on `0` — cookies would travel unencrypted)
      - `HEARTBEAT_URL=…`   (a free healthchecks.io ping URL — the dead-man's switch the watchdog pings, step 3)
      - leave `QUESTIONNAIRES_ENABLED` / `TELEMETRY_ENABLED` **unset** until the HSESC amendment lands.

## 2. Install (once, re-runnable)
- [ ] `powershell -ExecutionPolicy Bypass -File deploy\setup.ps1`
      — installs deps, **builds** the app, and **pulls `gemma4:e4b` + `nomic-embed-text` (~8 GB)**.
      It never overwrites a secret, a DB, or an existing `.env.local`. Re-run after a failure; it resumes.

## 3. Front door + start on loopback
- [ ] From an **elevated** PowerShell, once: `powershell -ExecutionPolicy Bypass -File deploy\service.ps1 install`
      — hash-verifies the nginx front door into `deploy\tools\nginx\` (start.ps1 refuses without it)
      and registers five Scheduled Tasks as the box user, S4U/Limited, **never SYSTEM** (so any box
      shell can kill any component): **Boot** (start at startup), **Watchdog** (every 5 min: verify the
      served build matches the disk build, ping `HEARTBEAT_URL` while healthy, re-assert the funnel
      after two consecutive public-path failures), **Backup** (hourly), **Checks** (6am), **Decks** (5am).
      There is deliberately **no non-admin fallback** — a second supervision path is what created the
      2026-11-03 zombie.
- [ ] `powershell -ExecutionPolicy Bypass -File deploy\start.ps1`  (waits until the whole chain answers through nginx on 8081)
- [ ] Stop, if needed: `powershell -ExecutionPolicy Bypass -File deploy\start.ps1 -Stop`

## 4. Sanity BEFORE publishing (the gate is good, but measure the box)
- [ ] `Invoke-RestMethod http://127.0.0.1:8081/api/health | ConvertTo-Json -Depth 6` → `status: ok`, `enrolment` your cohort size (**not 8000**), `rag_model.ok: true`. Through **8081**, not 3000 — that proves the whole nginx chain (API leg, static leg, app leg), not just one service. (Plain `curl` in PowerShell is an alias for Invoke-WebRequest and prints an object, not JSON — use this.)
- [ ] **One tutor call, timed.** The 3090's tutor latency is unmeasured here — the dev box was ~7 s warm. Sign in as a test student and ask the tutor once; if it's tens of seconds, fix that before a section arrives (the concurrency gate will hold at 4 concurrent / 40 queued, refusing honestly, but slow is still slow).
- [ ] Run **one full topic unit** as a test student end-to-end (pre-check → activity → post-check), then withdraw or ignore that account. Confirm your data lands in the sink.

## 5. Go public
- [ ] `powershell -ExecutionPolicy Bypass -File deploy\publish.ps1`
      — **refuses on a red gate**: web+API healthy through nginx on :8081, `service.ps1 verify` green (the served webpack hash exists in the on-disk build — a port probe alone cannot tell our server from a stale leftover process), `COOKIE_SECURE≠0`, participant key present, enrolment ≠ 8000, bundle names no hardcoded origin. Note the URL it prints.

## 6. Make it survive without you (the "walk away" half)
- [ ] Supervision was installed in step 3 — confirm it: `powershell -ExecutionPolicy Bypass -File deploy\service.ps1 status`
      should show the five tasks Ready and every listener on 3000/8080/8081 **owned by the box user**. A
      SYSTEM- or foreign-owned listener is the zombie signature — stop, and kill it from an elevated shell.
- [ ] **Reboot the box once** and confirm it comes back (`/api/health` ok) and the heartbeat resumes at healthchecks.io. The S4U tasks fire at boot without a login, so this reboot is the only real proof of "leave it alone."

## 7. Know these going in (accepted, not blockers)
- **Session idle timeout:** `SESSION_IDLE_MINUTES` default **30** (env-tunable in `.env.local`). A student idle 30 min with zero interaction is logged out; the keep-alive pings on any activity, so active use — including typing a probe answer — never expires. In-progress, *unsubmitted* answers are lost on a logout; a *recorded* step is safe (progress is server-side, they re-login and resume).
- **`norman` / `hicks-law`** have thin RAG corpus (built from 2023 decks) — the tutor is weaker on those two. Reported separately; not H1 evidence.
- **Backups:** `backend\backup_sink.py` snapshots the sink + accounts, but ONLY if scheduled: `deploy\service.ps1 install` in step 3 registers `COMPGame-Backup` (hourly, destination `BACKUP_DIR` in `deploy\.env.local`, default `C:\compgame-backups`; a different disk is better). Until 2026-10-08 nothing scheduled it and this line wrongly said it ran. Confirm on `/researcher` health that the last backup is under an hour old.
- A release window is **five days wide**, not one morning: an hour of downtime is not a lost topic. Do not panic-fix during a window.

## Rollback
Publishing is reversible: kill the tunnel / `start.ps1 -Stop`. Supervision rollback is `deploy\service.ps1 remove`. Code rollback is `git checkout <prev>` + `setup.ps1`. **Data already collected under a bug is not reversible** — which is why steps 1 and 4 exist, and why the gate refuses rather than warns.
