# Deploy

Three commands. Nothing else to configure.

```powershell
powershell -ExecutionPolicy Bypass -File deploy\setup.ps1     # once, on a fresh box
powershell -ExecutionPolicy Bypass -File deploy\start.ps1     # run it here
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1   # put it on the internet
```

> **New box? Follow the step-by-step.** The visual runbook is **`deploy\install-3090.html`**
> (open it in a browser — copy-paste commands, gate/gotcha callouts). The same steps with
> the *why* on each are in **`deploy\3090-bringup.md`**. And **`deploy\bootstrap.ps1`** does
> prerequisites → `setup` → `start` in one command once your carry-across files are placed.

`setup.ps1` is safe to re-run: every phase checks before it acts, so a second run is a
no-op and a run after a failure resumes instead of starting over. It never overwrites a
database, a secret, or an existing `.env.local`.

## What you install first

Only these. The script checks for them and stops with a link if one is missing.

| | why | get it |
|---|---|---|
| Python 3.11+ | the API | python.org — tick **Add to PATH** |
| Node 18+ | the app | nodejs.org (LTS) |
| Ollama | the AI tutor | ollama.com |

An NVIDIA GPU is not required to *run*, but the tutor is unusably slow without one.
`setup.ps1` pulls `gemma4:e4b` and `nomic-embed-text` (~8 GB, once).

## The one thing you must carry across yourself

`backend\.participant_secret`.

It is the key that turns a student ID into the pseudonym in every export — the thing that
joins a participant's pre-test row to their post-test row. **`setup.ps1` deliberately will
not create one.** The code would happily mint a new one on first use, and if it did that
here while a different key exists elsewhere, the two sets of exports could never be joined
again: silently, with no error, and not fixable afterwards.

Copy it from your backup, then check the fingerprint matches:

```powershell
(Get-FileHash backend\.participant_secret -Algorithm SHA256).Hash
```

## How it is wired, in one paragraph

**One origin, one exposed port.** Next.js serves the app on 3000; FastAPI listens on 8080
**loopback only** and is never published. The browser calls a *relative* `/api/...`, which
`next.config.mjs` rewrites to the API. Three things follow, and each was a real hazard:

- the build is **portable** — nothing bakes in a hostname, so a bundle built here works
  behind any tunnel. A build with an absolute origin loads perfectly on a deployed box and
  then does nothing at all: 200s everywhere, no data, no error in any log.
- **no CORS.** Same-origin requests do not preflight.
- the session cookie stays **first-party** (`SameSite=Lax`). A split origin would force
  `SameSite=None`, which Safari's ITP and Chrome's third-party-cookie deprecation block by
  default — silent sign-in failure for every student on an iPhone.

Server-side callers (`app/topics/[topicId]/page.tsx`, `app/api/export-data/route.ts`) use
an **absolute** loopback URL instead, because they run on the server where a relative URL
has no origin to resolve against. `API_ORIGIN` controls those.

## Going public

`publish.ps1` checks before it opens anything, and refuses on a red gate:

- the app and the API both answer, **and `/api/health` answers through port 3000** — if
  the rewrite is not in effect the site loads and every data call 404s
- `COOKIE_SECURE` is not 0
- the participant key exists
- enrolment is not **8000** (that is the e2e fixture, not a class)
- the built bundle names no API origin

Pick a tunnel. Port forwarding is deliberately not offered — it puts a home router on the
public internet in front of 300 students' credentials and buys nothing.

```powershell
deploy\publish.ps1 -Via cloudflare -Hostname compgame.yourdomain.com   # stable; needs a domain
deploy\publish.ps1 -Via tailscale                                      # stable; no domain
deploy\publish.ps1 -Via quick                                          # demo only: URL changes every restart
```

After a named tunnel is up, set `ALLOWED_ORIGINS` to that https:// hostname in
`deploy\.env.local` and restart. Then run the browser suite **from a different machine on
a different network** — it is the cheapest test that the origin, the cookies and the
tunnel all work together, and it costs eleven minutes:

```powershell
$env:E2E_APP="https://<hostname>"; $env:E2E_API="https://<hostname>"; node frontend\e2e\run.mjs
```

## When something is wrong

```
deploy\logs\api.log   deploy\logs\web.log     what the services said
deploy\start.ps1 -Stop                        stop everything
deploy\setup.ps1                              re-run; it resumes
```

The full operational runbook — backups, grading, exports, incident handling — is
`docs\runbook.md`. The launch sequence and what is still blocking is
`docs\go-live-plan.md`.
