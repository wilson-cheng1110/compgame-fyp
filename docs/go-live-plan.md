# Go-live plan — public deployment on the 3090, and what still has to be tested

Written 2026-08-30. Companion to `runbook.md` (how to operate it) and
`stage2-deployment-plan.md` (why it is shaped this way). This file is the **sequence**:
what has to be true, in what order, and who owns it.

Teaching runs Mon 31 Aug – Sat 28 Nov 2026. The first topics close **Sun 13 Sep**, so
there is roughly two weeks of slack — enough, but not enough to also discover something
structural.

---

## The short version

Four things block launch and **none of them are code**. Everything the software needs
is green: backend 359 assertions, browser 352, all 13 topics banked, 28 game surfaces
mounting, and the two security defects found on 2026-08-30 are fixed and
mutation-proven. What is left is approval, content, one calendar decision, and a
machine.

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| 1 | Stage-2 ethics amendment approved | Wilson + supervisor | **recruitment** |
| 2 | 2026/27 lecture decks in the corpus | Wilson | the tutor on `norman`, `hicks-law`; a thin `webers-law` |
| 3 | Section C session 5 falls on National Day | Wilson / lecturer | `schedule.py --validate` exits 1 |
| 4 | The 3090 actually serving | Wilson | everything |

---

## Phase 0 — decisions, before any machine work

**0.1 Submit the ethics amendment.** Draft is `ethics-amendment-stage2.md`. It has four
open questions for the supervisor at the foot; those want answers before submission, not
after. Nothing else in this plan is worth doing if hosting has to move to a PolyU VM,
because that changes the security attachment.

**0.2 Decide the National Day clash.** Thursday 1 Oct 2026 is a general holiday and it is
section C's session 5 — which carries `visual-perception`, `webers-law` and `gestalt`.
Three of thirteen topics for a third of the cohort. Edit the date in
`topic_schedule.json` and nowhere else; every window derives from it. Then
`python backend/schedule.py --validate` must exit 0.

**0.3 Decide the corpus.** `check_corpus_coverage.py` reports zero coverage for `norman`
and `hicks-law`, and three hits for `webers-law` — which is a *measured* topic resting on
one slide. Two options:
- **Supply the 2026/27 decks** and `python rebuild_db.py`. Best outcome.
- **Ship without them**, which is already the agreed position for `norman` and
  `hicks-law` — they stay extra topics whose gain is reported separately, not pooled as
  H1 evidence. Say so in the paper; do not quietly pool them.

`webers-law` is the one that has neither an exemption nor coverage. Decide it explicitly.

**0.4 Decide the class list.** With `enrolled_sids.txt`, sign-up is restricted and the
section is authoritative. Without it, sign-up is open and the student self-reports —
a wrong pick means a wrong release window and bad data nobody can detect. If there is no
roster, the `/admin` panel becomes the correction mechanism and someone has to watch for
mismatches in week 1.

---

## Phase 1 — make the box serve, on loopback only (half a day)

Everything here is `runbook.md` §1–§2. The sequence that matters:

1. **Full-disk encryption on**, before any participant data exists. This is a condition
   in the ethics amendment, not a nicety.
2. **Copy the participant key** into `backend/.participant_secret` from the off-machine
   backup, and verify the fingerprint matches
   `3e4d9879f95bab51f430e54b365ef50c6b9b2ae123055dcd49faeed32a9eabf3`. Do this *before*
   first run — otherwise the code generates a different key on first use and the backup
   becomes worthless.
3. **Ollama tuned**: `OLLAMA_NUM_PARALLEL=4`, matching `ops.MAX_CONCURRENT`. Two numbers,
   one meaning; if they drift the queue moves inside Ollama where it cannot be measured.
4. **Both services under NSSM** so they come back after a reboot without a human. A home
   box reboots for Windows Update whether or not anyone is watching.
5. **API bound to loopback.** Not `0.0.0.0`. The tunnel is the only ingress.
6. **`COOKIE_SECURE=1`** and `ALLOWED_ORIGINS` set to the tunnel hostname only.
7. **Run the go-live gate** (`runbook.md` §2c) with the corrected expectations below.

### The gate, with current numbers

`runbook.md` §2c predates today's work and still says 262 / 124. Current:

| Gate | Command | Must show |
|---|---|---|
| Server logic | `python backend/tests/run_all.py` | **359** assertions, 0 failures |
| Types | `npx tsc --noEmit` | no output |
| Build is whole | `node frontend/verify-build.mjs` | build is complete |
| Real browser | `node frontend/e2e/run.mjs` | **352** assertions, 0 failures |
| Item banks | `python backend/checks.py` | 13 topics, all `balanced: true` |
| Corpus | `python backend/check_corpus_coverage.py` | exit 0, or a written exemption per §0.3 |
| Schedule | `python backend/schedule.py --validate` | exit 0 (see §0.2) |
| Backups | `python backend/backup_sink.py --verify` | integrity_check ok |
| Loopback | start the API | no public-bind banner |
| Fails closed | `curl /api/research/export`, POST `/api/grade` with a valid body | 503 both |
| Cohort size | `/api/health` | `enrolment.enrolled` = the real number, not 8000 |
| **Key present** | `sha256sum backend/.participant_secret` | matches the fingerprint above |

The last row is new and belongs in the runbook: it is the one file whose absence
silently produces a *different* study rather than a broken one.

---

## Phase 2 — the public URL

**Use a Cloudflare Tunnel.** No port forwarding, TLS terminated for you, a stable
hostname, and the residential IP is never exposed. The alternative — port-forwarding
plus a dynamic-DNS name plus your own certificate — puts a home router on the public
internet in front of 300 students' credentials, and there is no upside.

```
cloudflared tunnel create compgame
cloudflared tunnel route dns compgame <hostname>
# ingress: <hostname> -> http://127.0.0.1:3000, and /api -> http://127.0.0.1:8080
```

Then, in order:

1. `ALLOWED_ORIGINS=https://<hostname>` — **not** a wildcard. A wildcard with credentialed
   cookies means any page a student visits can call the API as them.
2. `COOKIE_SECURE=1`.
3. Rebuild the frontend. `API_BASE` is **baked at build time**; a frontend built against
   `localhost:8080` will not talk to the tunnel. This is the single most likely deploy
   failure and it produces a site that loads perfectly and does nothing.
4. Re-run the browser suite against the public origin:
   `E2E_APP=https://<hostname> E2E_API=https://<hostname> node e2e/run.mjs`
   Expect to fix at least one cookie/origin issue here. That is what this step is for.
5. Run the capacity test in §4 below. On the 3090, not here.

---

## Phase 3 — pilot, then open

**Do not open to 300 on day one.**

1. **n ≈ 5 non-participants**, one full topic each, on their own devices and networks.
   This is also the item-bank pilot the instrument has been waiting for
   (`quiz-item-banks.md` §"Human pilot protocol") — report P and D per item, and rebalance
   anything with P < 0.20, P > 0.95, or D < 0.20 before the banks lock.
2. **Section A only** for the first topic (Tuesday). One section is ~100 students, which
   is the real concurrency question and a third of the blast radius.
3. **Watch the first release window** actively: `/api/health`, the queue counters, and the
   sink row count. If sign-ins pile up at 09:00, that is what the throttle and the
   threadpool fix are for — confirm it in the logs rather than assuming.
4. Open B and C.

---

## Phase 4 — what still has no test, and how to close it

Two gaps are named honestly rather than hidden. Both are P5.

### 4.1 No game is played to completion

The resilience suite proves all 28 game surfaces **mount**. Nothing proves any of them
can be **finished**. A game that renders and then cannot be completed — a button that
never enables, an off-by-one that never reaches the debrief — is invisible to every test
that exists, and it costs a student their topic.

This is automatable. The interaction each game needs, from its source:

| Shape | Games | How Playwright drives it |
|---|---|---|
| MCQ / click-through | norman, language, ergonomics, experiment-design, visual-perception, problem-solving, stroop (quiz half), memory (quiz half), mental-model, hicks (understanding) | click every option, click next, repeat to the debrief |
| Reaction time | hicks-law assessment, stroop understanding | click the highlighted control; the highlight is a class/style, readable from the DOM |
| Colour naming | stroop assessment | read the word's computed colour, click the matching button |
| Pointing | fitts-law assessment, fitts distance + size | targets are positioned divs; read `left`/`top` from the DOM and click the centre |
| Digit span | memory assessment | read the digits on screen, type them back |
| Perceptual | webers-law assessment | click any option each round — the score does not matter, completion does |
| Sort / rank | mental-model, gestalt | click-to-order in the recorded correct sequence |

**Done-test:** each of the 26 routes reaches its debrief, and the completion is recorded
in the sink. Assert *finishability*, not score — a test that requires a good score is
testing the model of the student, not the software.

Cost: roughly a day, and it is the last large hole in the suite.

### 4.2 Tutorial-scale tutor load is untested, and cannot be tested here

The gate is `MAX_CONCURRENT=4` with a queue of 40, and a warm call takes ~7 s on the dev
box. A tutorial where 100 students ask the tutor at once means 4 served, 40 queued, and
**56 refused** — and the 40th in the queue waits about 70 seconds. That may be perfectly
acceptable, or it may be the thing that defines the demo. Nobody knows, because the
number that matters is the 3090's, not this machine's.

Write the test so it **runs on the deployment box**:

```
N concurrent POSTs to /api/ask with a realistic question
measure: served / queued / refused (429), p50 and p95 latency, and whether
         /api/topics stays responsive throughout   <- the number that matters
sweep N = 10, 25, 50, 100
```

The last line is the same question the sign-in burst asked and answered: an unrelated
cheap endpoint is the honest measure of whether the server is still usable for everyone
else. Then set expectations from data — either raise `MAX_CONCURRENT` to match what the
3090 sustains, or tell students in the brief that the tutor queues at busy times, which
is a perfectly reasonable thing for a tutor to do.

---

## Failure modes specific to a machine in a flat

Worth pre-deciding rather than discovering at 09:00 on a Tuesday.

| Failure | Consequence | Mitigation |
|---|---|---|
| Windows Update reboot | Everything down until a human notices | NSSM services; check `/api/health` after any reboot |
| Power cut | Same, plus possible sqlite damage | Hourly backup; `backup_sink.py --verify` after any unclean shutdown |
| ISP outage / IP change | Tunnel drops | Cloudflare Tunnel reconnects on its own; a port-forward would not |
| Disk fills | Writes fail silently-ish | Watch free space; the sink and Ollama models are the two growers |
| GPU busy with something else | Tutor latency doubles | Do not game on the study box during teaching hours |
| Nobody looking | A dead box on release day costs a whole topic for a section, unrecoverably | Set a calendar reminder for each of the 13 release mornings |

That last row matters, but **less than I first wrote here**, and the correction is
worth keeping. An earlier draft of this file said a topic missed by an outage is lost
permanently. It is not. The release window is **five days wide** — `memory` for section A
opens Tue 8 Sep 09:00 and closes Sun 13 Sep 09:00 — so an outage of hours, or even most
of a day, is absorbed by students coming back. And `schedule.py` hot-reloads on mtime, so
a window can be extended by editing one field in `topic_schedule.json` with no restart.

What is genuinely unrecoverable is narrower: an outage spanning most of a five-day window
for a whole section, or one that goes unnoticed until after a window closes. That is an
argument for an external uptime check on `/api/health` and a UPS — not for
re-architecting.

### Would hosting the frontend on Vercel help?

No, and the reason is worth writing down because it will be asked again.

Vercel cannot host the part that is fragile. Ollama needs a GPU; Vercel has none. sqlite
needs a persistent filesystem; Vercel's is ephemeral with no shared state between
invocations. ChromaDB the same. The API, the model and all three databases stay on this
box regardless — Vercel would serve the shell, which is the half that is not the risk. A
shell that loads while the backend is down shows students a working site that cannot sign
them in.

It also breaks the property this deployment is built around. Frontend on `*.vercel.app`
with the API on a tunnel is **cross-site**, which forces `SameSite=None; Secure` cookies —
blocked by default under Safari's ITP and Chrome's third-party-cookie deprecation. On a
cohort with many iPhones, sign-in would silently fail for a slice of it.
`stage2-deployment-plan.md` Loop A already chose "one origin" for exactly this reason, and
`SameSite=Lax` only works because of it. Vercel rewrites can proxy `/api/*` to preserve
single-origin, but then every call is browser → Vercel edge → tunnel → box: a third
dependency and added latency, for a CDN that 300 users do not need. Availability becomes
the product of three systems rather than two.

**The version of the idea that is right** is to split by *criticality*, not by
frontend/backend — and the code already anticipates it. `rag_api.py` states that the auth,
topic and research routers must not import chromadb/langchain "because students have to be
able to log in". So the measurement path (auth, topics, checks, sink — stdlib sqlite, no
GPU) can run anywhere always-on, while the tutor stays on the GPU box as a *degradable*
extra; the resilience suite already proves it degrades rather than hangs. That is the
shape to adopt **if** hosting moves for ethics reasons. It is not worth doing pre-emptively
while the window is five days wide and recruitment is still blocked on approval.

---

## Red hat — the case against this plan

Written against my own plan, because everything above is advocacy for a deployment and
none of it attacks the premise.

**Strongest single objection.** The plan is elaborate mitigation for a problem that is
better solved by not having it. Phases 1, 2 and the entire "failure modes in a flat"
table exist because the study runs on a workstation in a residence. A PolyU VM deletes
that whole class of risk — reboots, power, ISP, disk, someone gaming on the box — and
the build is *indifferent to which it runs on*: the only change is a hostname. If the
supervisor's answer to open question 1 is "use a VM", most of this document becomes
unnecessary, and I have written it as though the home box were settled when it is
actually still question 1 of 4.

**Failure mode at stress.** ~100 students of section A arrive at 09:00 on a Tuesday.
Sign-in survives — that is measured (173/s, health at 84 ms). The tutor does not:
4 concurrent, 40 queued, ~7 s each means **56 students refused outright** and the 40th
waits over a minute. And the topic unit under that load has *never been measured at
all* — only sign-in and `/api/health` have. `journey()` reads the whole sink per call;
if it degrades under 100 concurrent, the dashboard stalls for everybody and the first
thing 300 students see is a dead page.

**Load-bearing premises, none of them verified.**
1. Ollama on the 3090 performs like the dev box (~7 s warm). Never measured there.
2. A Cloudflare Tunnel comfortably carries ~100 concurrent students. Untested at scale.
3. `next build` on the 3090, with `API_BASE` pointed at the tunnel, produces a working
   bundle. The entire frontend hangs off one build-time constant, and the failure looks
   like a site that loads perfectly and does nothing.
4. The app works on students' own devices and networks. Every test so far has run in one
   Chromium, on one machine, over loopback.

**Cheapest invalidation test.** Before Phase 3 and before any pilot: stand up the tunnel,
then run the existing browser suite **from a different machine on a different network**:

```
E2E_APP=https://<hostname> E2E_API=https://<hostname> node e2e/run.mjs
```

One command, ~11 minutes, and it attacks premises 2, 3 and 4 simultaneously. If it does
not go green there, nothing downstream in this plan is worth doing. Run it before the
n≈5 pilot, not after — a pilot on a broken origin burns five people and teaches nothing.

The premise this does *not* test is 1, the tutor's latency on the 3090. That needs its
own measurement (§4.2) and it should happen the same afternoon.
