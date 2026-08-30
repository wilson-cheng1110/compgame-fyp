# The whole path, every screen

Written 2026-08-30 because it did not exist, and its absence is why problems kept
surfacing one at a time instead of being found from a map.

Derived from the code, not from memory: `middleware.ts`, `lib/session-handoff.ts`,
`app/topics/[topicId]/unit-client.tsx`, `backend/topic_api.py`, `backend/schedule.py`.

---

## 0. The gate chain — where a student is sent, and why

`middleware.ts` is a **convenience redirect only**: no `user` cookie ⇒ `/login?next=…`.
It is not a security boundary and says so. The real gating is server-side on the
HttpOnly `session` cookie, re-checked on every `/api/*` call.

After any sign-in or sign-up, `nextStep()` decides in this fixed order:

```
needsConsent   -> /consent
needsOnboarding-> /onboarding/avatar
needsBaseline  -> /onboarding/baseline      <- a GATE: prior knowledge must be
                                               measured before any topic content
else           -> /dashboard
```

Nothing can jump this queue: `/dashboard` re-checks all three on mount and bounces.

---

## 1. First contact — once per student

| # | screen | what happens | recorded |
|---|---|---|---|
| 1 | `/` | landing. Two ways in: sign in, create account | — |
| 2 | `/signup` | SID + password (+ section, only when no roster is configured). Names its refusals, because a signup form that will not say why is unusable | — |
| 2b | `/login` | SID + password. **One identical 401** for unknown SID / wrong password / unclaimed / withdrawn — it must never enumerate who is enrolled | — |
| 3 | `/consent` | information sheet + explicit agree. **Nothing is recorded before this** | `consent_recorded` |
| 4 | `/onboarding/avatar` | pick a look. "Step 1 of 3" | — |
| 5 | `/onboarding/username` | preferred name. "Step 2 of 3" | — |
| 6 | `/onboarding/baseline` | prior-knowledge pre-test. Sat once, reveals nothing, **gates the dashboard** | `pre_test_complete` |

Exit at any time: `/account` → download my data, or withdraw (tombstones the account
and kills every session).

---

## 2. The dashboard — the hub, seen every visit

`/dashboard`

- **"How this works"** — orientation. Four sentences and a gapped rail showing 13
  topics arriving as 7 lectures. Open only while nothing is finished.
- **Next up** — the one actionable topic, with how long it takes, when it closes, and
  "you can stop whenever you like".
- **Lecture groups** — 13 topics grouped into 7 `<details>`, open only when something
  inside is live. Under a real mid-term schedule that is **3 visible rows, not 13**.
- **Sidebar** — avatar, progress, badges, account.
- **Tutor** — floating button, every page.

---

## 3. The topic unit — the experiment, run 13 times

`/topics/[topicId]`. The server component renders the content before any JS runs;
`unit-client.tsx` is the interactive half. The step list is built per student per
topic from `arm`, `has_bank` and `has_probe`.

### The two arms

```
FLIP      brief -> pre -> preProbe -> ACTIVITY -> post -> postProbe -> assess -> tutor -> close
CONTROL   brief -> pre -> preProbe -> post -> postProbe -> ACTIVITY -> assess -> tutor -> close
```

**The only difference is where the activity sits.** The assessment is after the
post-check in both arms (Wilson, 2026-08-27), so the pre→post window has already
closed before any scored round starts — that is what keeps the primary DV clean by
placement rather than by exclusion.

`arm` is assigned server-side by `schedule.arm_for(sid, index)`: deterministic from
the SID, ~50/50 across the cohort, alternating down the list so every student gets
6 or 7 of each across 13 topics.

### How many steps a student actually sees

| topics | probe? | steps |
|---|---|---|
| `memory`, `problem-solving`, `gestalt`, `webers-law` | yes | **9** |
| the other 9 | **no** | **7** |

**All 13 have MC banks. Only 4 have a short-answer probe.** So the qualitative half of
H1 exists for under a third of the study, and no checker reports that as a problem
because the events that do arrive look healthy.

### Step by step

| step | what the student does | gate to leave | recorded |
|---|---|---|---|
| `brief` | what this topic is, how long it takes | Start | — |
| `pre` | MC check, all items required | submit; answers revealed **only after** | `topic_pretest` (one submission, server-graded, key never ships) |
| `preProbe` | short answer, in their own words | **non-empty** (empty used to burn the one allowed submission) | `topic_probe` |
| **`game`** | **the treatment.** Opens `/games/<id>?unit=…&step=…&of=…` | **the activity must RECORD.** No self-declared completion | `understanding_complete` + `duration_ms` |
| `post` | the same check, form B | submit, then read the feedback | `topic_posttest` |
| `postProbe` | short answer again | non-empty | `topic_probe_post` |
| `assess` | scored round; badge levels up | **must record** | `assessment_complete` + score + duration |
| `tutor` | Socratic reflection — it pushes back, it does not answer | **a real reflection** (insight, or the turn floor) | `reflection_complete` / `reflection_skipped` |
| `close` | pre→post delta, journey rail, **replay**, questionnaire | — | `topic_complete`, then `questionnaire_*` |

Progress is saved per step in `localStorage` — students close laptops mid-topic, and
reopening resumes where they were.

### The escapes, and why they exist

Three steps wait on a real recorded completion. Each offers a way past **only after the
student has actually opened the thing**, and it logs:

```
activity_not_recorded · assessment_not_recorded · reflection_not_recorded
```

This is not softness. In FLIP the activity sits **between** the two checks, so a hard
gate would cost stuck FLIP students their post-check and cost CONTROL nothing —
differential attrition by condition, which lands on H1 and cannot be undone. A skip
that is recorded is data; a skip indistinguishable from a completion is contamination.

---

## 4. Inside a game

`/games/[gameId]` — 26 routes, each its own state machine.

- **The strip** (top-left, every route): `← Back | Topic title | Step 3 of 7`, and
  under it the in-game rail: `Puzzle · 2 of 3`. Nested, one piece of furniture.
- **The clock** starts on entry (per game, per tab, survives a reload).
- **The debrief** ends 25 of 26 routes: records the completion, its duration, the
  badge, and fires the reflection for assessments.
- **Under `?unit=`** the jump straight to the assessment is withdrawn — that door let
  a student take a scored round *between* the two checks.

**15 of 26 record a completion under an automated driver; 11 do not**
(`game-finishability.md`). Those 11 are the by-hand list, and the unit now blocks on
them.

---

## 5. Everything off the main path

| route | what it is |
|---|---|
| `/badges` | the collection; the demoted reward layer |
| `/account` | download my data · withdraw |
| `/about` | what this is |
| `/admin` | course team only — accounts, section fixes, password resets, **lecture dates**. Every mutation audited |
| tutor widget | floating, every page, answers questions (`/api/ask`) |
| reflection dialog | the Socratic surface (`/api/socratic`), opened by the tutor step and after each assessment |

---

## 6. What is still unverified on this path

| | |
|---|---|
| 11 of 26 games | never driven to a completion by anything |
| the battery | built and verified with the flag on; **ships off** pending ethics |
| 9 of 13 topics | have no short-answer probe at all |
| `reflection_complete` | WORKS again — the sweep completed a real one end-to-end (2026-08-30) |
| corpus | `norman` and `hicks-law` have zero coverage |
| the whole path on the 3090 | never run there |
