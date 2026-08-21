# COMPGame — deployment runbook

How to run this for a real cohort on the RTX 3090 box, and what to do when it breaks.
Design rationale lives in `revamp.md`; the loop-by-loop analysis in `stage2-deployment-plan.md`.
This file is only operations.

---

## 1. Configuration

Everything is environment variables. Nothing below has a safe default for production —
each one is either required or defaults to *dev*, deliberately.

| Variable | Dev default | Production |
|---|---|---|
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | **the tunnel URL.** CORS is no longer a wildcard, so an unlisted origin is refused — including your own tunnel until you add it |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8080` | the tunnel URL. Baked in at **build** time, so rebuild the frontend after changing it |
| `COOKIE_SECURE` | `1` | `1`. Only set `0` for plain-http local dev |
| `EXPORT_TOKEN` | *unset → export disabled* | a long random string. **Unset means the export endpoint 503s**, which is the safe direction |
| `PARTICIPANT_HMAC_SECRET` | auto-generated to `backend/.participant_secret` | set explicitly, or back up the generated file |
| `OLLAMA_NUM_PARALLEL` | `4` | `4` on the 3090. Must match `ops.MAX_CONCURRENT` |
| `OLLAMA_MAX_LOADED_MODELS` | — | `2` — `gemma4:e4b` **and** `nomic-embed-text` both stay resident; the vector leg embeds on every query |
| `OLLAMA_KEEP_ALIVE` | — | `-1`, so the model never unloads between quiet periods |
| `MAX_QUEUE` | `40` | tune from observed `waiting` in `/api/health` |
| `GRADE_TOKEN` | *unset → `/api/grade` 503s* | set only if you want the endpoint reachable. **The batch does not need it** — `grade_batch.py` calls the model directly. Unset is the right production value |
| `GRADE_NUM_PREDICT` | `1536` | **do not lower.** Measured on `gemma4:e4b`: 320/512/640/768 return an EMPTY string, 1024+ return correct JSON. An empty reply is indistinguishable from "the student wrote too little", so a low cap silently turns every answer into a missing datum while the batch looks like it ran |
| `TELEMETRY_ENABLED` | `0` | **stays `0` until HSESC approval.** The backend strips telemetry while off |
| `BACKUP_DIR` | `./backups` | a path on a **different disk** |

Required files, none of them in git:

- `backend/enrolled_sids.txt` — `SID,section` per line. **Nobody can log in without it.**
- `backend/.participant_secret` — HMAC key. Back it up off the machine; lose it and no
  future export joins to any past one.
- `backend/topic_schedule.json` — real 2026/27 dates. `python schedule.py --validate` before every term.

---

## 2. Start

```powershell
# 1. Ollama, with the production tuning
$env:OLLAMA_NUM_PARALLEL=4; $env:OLLAMA_MAX_LOADED_MODELS=2; $env:OLLAMA_KEEP_ALIVE="-1"
ollama serve

# 2. API  (port 8080)
cd backend
python -m uvicorn rag_api:app --host 0.0.0.0 --port 8080

# 3. Frontend
cd frontend
npm run build; npm run start
```

`START_ALL_SERVICES.ps1` does the dev version of this in three terminals. It is **not**
suitable for production: nothing restarts on failure and nothing survives logout.

### Make it survive a reboot

Windows Update *will* restart this box mid-term. Register all three as services with
[NSSM](https://nssm.cc/) so they come back without a human:

```powershell
nssm install COMPGameOllama   "C:\path\to\ollama.exe" serve
nssm install COMPGameAPI      "C:\path\to\python.exe" "-m uvicorn rag_api:app --host 0.0.0.0 --port 8080"
nssm set     COMPGameAPI      AppDirectory "C:\path\to\backend"
nssm install COMPGameWeb      "C:\path\to\npm.cmd" "run start"
nssm set     COMPGameWeb      AppDirectory "C:\path\to\frontend"
nssm install COMPGameTunnel   "C:\path\to\cloudflared.exe" "tunnel run compgame"
```

Then, and this matters more than the services: **disable sleep and disk spin-down**, and
set Active Hours so Windows cannot reboot during a release window.

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

### Public URL

A Cloudflare named tunnel (not a quick tunnel — those get a new hostname on every
restart, and the hostname is baked into the frontend build):

```powershell
cloudflared tunnel login
cloudflared tunnel create compgame
cloudflared tunnel route dns compgame compgame.<your-domain>
```

Then set `ALLOWED_ORIGINS` and `NEXT_PUBLIC_API_BASE` to that hostname and **rebuild the
frontend**. Forgetting the rebuild is the most likely launch-day failure: the app loads
and every API call fails CORS.

---

## 3. Watch

`GET /api/health` — unauthenticated, no participant identifiers, cheap enough to poll
every 30s. Returns **503** when a critical component is down, so a monitor can alert on
the status code alone.

```json
{"status":"ok",
 "components":{"research_sink":{"ok":true},"accounts":{"ok":true},
               "rag_model":{"ok":true},"schedule":{"ok":true},
               "enrolment":{"ok":true,"enrolled":5}},
 "queue":{"max_concurrent":4,"waiting":0,"served":42,"refused":0,"p50_seconds":3.9}}
```

- `status: degraded` — sink and accounts fine, something else isn't. Students can still
  work; the tutor may be down. Not a 3am problem.
- `status: down` — the sink or the accounts DB is unreadable. **Students are losing data.**
- `queue.refused > 0` — requests are being turned away. Raise `MAX_QUEUE`, or accept it:
  refusing honestly beats an unbounded queue.
- `queue.waiting` persistently high — the GPU is the bottleneck. Stagger the windows.

Point any uptime monitor at it. The failure that actually bites is nobody noticing for
six hours, not the crash itself.

---

## 4. Back up

```powershell
python backend\backup_sink.py --dest D:\compgame-backups --verify
schtasks /create /tn COMPGameBackup /sc hourly /tr "python C:\path\to\backend\backup_sink.py --dest D:\compgame-backups"
```

Uses sqlite's online-backup API, so it is safe against a live database — a plain file
copy of a DB mid-write can capture a torn page and produce a backup that only fails when
you finally need it. Keeps 48 snapshots (2 days hourly).

The **HMAC secret is deliberately not included**. Back it up by hand, somewhere else —
stored next to the data it pseudonymises, it protects nothing.

---

## 5. Grade the short answers, and brief the tutor

Both run **after** a topic's window closes, offline, on the box. Nobody is waiting.

```powershell
# 1. Grade, blind. Re-runnable: same seed -> same order -> same grades.
python backend\grade_batch.py --dry-run                 # what would be graded, no model
python backend\grade_batch.py --topic webers-law        # ~15 s per answer on the 5060 Ti
python backend\grade_batch.py --resume                  # after an interruption

# 2. Reliability. Do this ONCE, early, before any grade reaches the paper.
python backend\grade_batch.py --sample-for-human 60     # blank sheet, no machine grades in it
#    ... hand-code the 4th column ...
python backend\grade_batch.py --kappa human-coding-sheet-60.csv

# 3. The tutorial brief. Writes TWO files every time.
python backend\generate_tutorial_report.py --topic webers-law --section B
python backend\generate_tutorial_report.py --topic webers-law --section B --no-llm
```

`--no-llm` still produces a complete report: every number is computed in code and
does not depend on a model being up. Only the clustering and discussion points are
lost — which is the right thing to lose when Ollama is down.

**`<topic>-<date>-teacher.md` carries SIDs and must not leave the machine.**
`<topic>-<date>-discussion.md` is anonymised and safe to project; the generator
greps it for roster SIDs and warns if any survived. `reports/` is gitignored.

Below **κ ≈ 0.6** the short-answer grades are descriptive colour only and must be
labelled that way. That is a reporting decision, not a bug to fix by re-grading
until the number improves.

---

## 6. Export for analysis

```powershell
curl -H "X-Export-Token: $env:EXPORT_TOKEN" "https://<host>/api/research/export?format=csv" -o events.csv
```

Always pseudonymised; there is no identified mode over HTTP. For the teacher report,
read the sqlite file **on the box** — identified data never travels.

---

## 7. When it breaks

| Symptom | Cause | Fix |
|---|---|---|
| Every API call fails in the browser, works in curl | origin not in `ALLOWED_ORIGINS`, or frontend built against the wrong `NEXT_PUBLIC_API_BASE` | add the origin, **rebuild the frontend** |
| Login says "not on the class list" for everyone | `enrolled_sids.txt` missing or unreadable | check `/api/health` → `components.enrolment.enrolled` |
| Tutor answers "I don't know" on a whole topic | corpus has no chunks for it | `python check_corpus_coverage.py`; add the current decks, `python rebuild_db.py` |
| Server dies at startup, no traceback in the window | console-encoding crash on a log line | already guarded; if it returns, run with `PYTHONUTF8=1` |
| 503 `busy` under load | queue at `MAX_QUEUE` | expected under a spike. Raise it, or stagger windows |
| Everything locked, nobody can start | schedule dates wrong | `python schedule.py --validate` then `--preview` |
| Export returns 503 | `EXPORT_TOKEN` unset | set it. The 503 is deliberate — it fails closed |
| Grading batch reports everything ungradeable | `num_predict` too low → model returns an empty string | raise `GRADE_NUM_PREDICT`; 1536 is the tested floor-with-margin |
| Report says "n = 20 of 2" | it won't — the generator suppresses the ratio and flags a class-list mismatch instead | fix `enrolled_sids.txt`, then regenerate |

---

## 8. Measured on the dev box (RTX 5060 Ti, 2026-08-16)

Real numbers, not estimates. **The 3090 is the deployment box and was not measured** —
treat these as a conservative floor, since it has roughly twice the memory bandwidth.

| | |
|---|---|
| `/api/ask`, uncontended | **~7 s** end-to-end (`CLAUDE.md` says ~12 s — that figure is now pessimistic) |
| `/api/socratic`, uncontended | ~8 s |
| p50 per gated call | 3.9 s (each request makes two: retrieval + generation) |
| 14 concurrent requests | 6 served, 8 rate-limited; median 31 s, max 46 s; `refused: 0` |
| Server cold start | ~30 s to load Chroma + models |

Re-measure on the 3090 before the first topic opens, and replay ~600 queued calls at it
— that is the peak-evening load for one section (`revamp.md` Part 16).
