# Game completions silently unrecorded, 2026-06-23 → 2026-08-30

Found while removing the unit's self-declared "I've finished it — continue" button, at
Wilson's instruction ("else people will just skip it and not do anything"). Recording it
because it has consequences for the dataset, and those are Wilson's to judge, not mine.

## What happened

`markGameComplete()` — the single function every one of the 26 games reaches to record
that it was played — began with:

```ts
const users = getUsers()
if (!users[sid]) return          // <- silent
```

Nothing creates `users[sid]`. Both onboarding writes are guarded `if (users[sid])` and only
ever **update** an existing record:

```ts
// app/onboarding/avatar/page.tsx, app/onboarding/username/page.tsx
const users = getUsers()
if (users[userData.sid]) { users[userData.sid].avatarId = ...; setUsers(users) }
```

That was harmless while accounts lived in this same blob and signup wrote it. Accounts moved
**server-side on 2026-08-16** (`backend/auth_store.py`), and the `users` blob moved from a
cookie to `localStorage` before that. After those changes a student's local record is never
created, so the guard fired on every write and returned.

The same `if (!users[sid]) return` sat in `recordReflection`, and `addBadge` had the
equivalent `if (users[userData.sid]) { ... }` wrapper in `lib/badge-context.tsx`.

## Evidence

`backend/research_events.db`, counted 2026-08-30 before the fix:

```
event_type                count   first .. last
understanding_complete        9   2026-06-23T14:33 .. 2026-06-23T14:38
assessment_complete          33   2026-06-17T21:24 .. 2026-06-23T14:38
topic_pretest                37   2026-08-30T01:09 .. 2026-08-30T08:14
topic_probe                  16   2026-08-30T01:16 .. 2026-08-30T08:14
topic_complete                8   2026-08-30T01:11 .. 2026-08-30T08:09
consent_recorded            136   2026-08-21T03:28 .. 2026-08-30T08:14
```

Both completion events **stop dead on 2026-06-23**. Everything that does not travel through
`markGameComplete` — the checks and probes, which post server-side, and consent — runs to the
present day. Nine `topic_complete` rows exist from 2026-08-30 with no gameplay recorded at all.

## Why nobody noticed

The unit's activity step carried an always-enabled **"I've finished it — continue"**, under a
line reading *"We have not seen the activity finish yet — you can carry on either way."* The
observed twin was displayed but nothing depended on it, so a permanently-false flag looked
exactly like a student who had chosen to skip. The button was masking the bug, and removing
it is what surfaced it within minutes.

## What it costs

- **`game_done` / `assess_done` are false for every topic** since 2026-06-23, so
  `played_understanding_first` — **the independent variable** — was never written from
  gameplay for any participant after that date.
- Badges awarded since then were dropped the same way.
- Any pilot data collected in that window has pre/post scores but **no behavioural record of
  whether the activity was played**, which is precisely the variable H1 turns on.
- **No real participant data was lost.** Wilson confirmed 2026-08-30 that everything in the
  sink from June to August is pilot and test traffic. The window therefore needs no
  disclosure in the paper and nothing has to be excluded: this is a code defect caught
  before it could touch a cohort, which is the only reason it is cheap. Nine more days and
  it would have eaten the first real topic.

## Fix

`lib/user-store.ts` gains `ensureUser(sid)`, which initialises the record instead of
returning, and the three call sites use it. A missing per-device cache entry is not a reason
to drop a write.

Proven end to end rather than by reading, in
`e2e/happy-path.mjs` → *"playing the activity opens the gate, without the escape"*: a fresh
student plays `memory-understanding` to its debrief, and the unit then shows
"✓ We have your activity recorded" while `/api/topics` reports `game_done: true`. Before the
fix the same test reported `game_done: false` with the debrief plainly on screen.

Sink after the fix: `understanding_complete` 9 → 14, `assessment_complete` 33 → 35, newest
timestamp `2026-08-30T08:24`.

## Two things left for Wilson

1. **`TELEMETRY_ENABLED` says something that is not true.** `backend/topic_api.py` documents
   it as *"The frontend collects nothing while this is false"*, and it ships `0` pending the
   HSESC amendment. But `markGameComplete` mirrors `understanding_complete` / `assessment_
   complete` to the sink with no such guard, and the checks and probes post server-side
   regardless. In substance those are the study's core measures and are plausibly covered by
   the existing consent — but the comment overstates what the flag does, and the ethics
   amendment at `docs/ethics-amendment-stage2.md` should say which of the two it means.
   I have not changed the behaviour: which events the flag should gate is an ethics decision.

2. ~~The window above may need disclosing.~~ **Closed** — it is all test traffic.
