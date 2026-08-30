# What gets measured, who reads it, and how you know it is still arriving

Written 2026-08-30, immediately after finding that three of the study's signals had
been dead for ten weeks without anything noticing
(`incident-2026-08-30-completion-events-lost.md`).

Two people need things from this system and they need different things. Neither was
being served properly, and for the same underlying reason.

---

## The cause, before the inventory

The system kept **two unreconciled records of the same fact** — "did this student do
this thing?"

| | written by | read by | fails |
|---|---|---|---|
| `localStorage users[sid].topicProgress` | the games, client-side | dashboard, badges, the unit | silently, per device, on a cleared cache |
| `research_events.db` | a fire-and-forget mirror **of the first one** | the paper, the teacher report | silently, because it only sees what the client chose to send |

The second is a mirror of the first, so anything that breaks the first empties the
second and **nothing anywhere reports a problem**. Absence of the event and absence
of the behaviour are the same byte.

That is exactly what happened: `markGameComplete`, `recordReflection` and `addBadge`
all began `if (!users[sid]) return`, nothing created that record once accounts moved
server-side, and so `understanding_complete`, `assessment_complete` and
`reflection_complete` all stopped on 2026-06-23. Checks and consent kept flowing,
because those post to the server directly and never touch the blob.

It was compounded by a naming problem. **`played_understanding_first` was one column
holding two different variables**, populated by whichever writer touched the row:

```
topic_pretest / topic_posttest / topic_probe   the condition the server ASSIGNED
assessment_complete                            what the student DID (from the blob)
understanding_complete / topic_complete        NULL
```

So the column cannot be read without knowing which row you are on, and half of it was
stuck at 0.

### The fix that removes the class

Stop asking the client. Three named things, derived server-side, in `backend/measures.py`:

| | what it is | where it comes from |
|---|---|---|
| `arm` | the condition **assigned** | `schedule.arm_for(sid, index)` — deterministic from the SID, never travelled through a browser |
| `played_first` | what the student **did** | `ts(understanding_complete) < ts(topic_posttest)`, both server timestamps |
| `complied` | do those agree | derived from the two above |

`played_first` is **recomputable** over data already collected, and — the property
that matters — **countable**. "For how many participant × topic pairs can we determine
this?" is a number. For the last ten weeks it was zero, and nobody had a place to look
at it.

---

## What Wilson needs to log, systematically

Not a list to remember — a command that answers it:

```bash
python backend/check_measurement_coverage.py           # the table
python backend/check_measurement_coverage.py --quiet   # exit 1 if a signal is broken
```

It reads the sqlite sink directly (no server, no Ollama — a check that needs the stack
running is a check nobody runs) and reports every signal the paper depends on, what
claim rests on it, and whether it is still arriving.

**Relative staleness is the whole trick.** "No `understanding_complete` in 14 days"
means nothing on its own — the study may not have started. "None in 14 days *while 496
other events arrived*" means the pipe is severed. An absolute threshold would have
stayed green through the entire outage.

It also names what is **not built yet** — IMI, CoI, ARCS, Paas — rather than staying
silent about them, so the gap is visible instead of rediscovered, and so the checker
does not cry wolf about something nobody wired.

Run it **before each week's release** and **before touching the data for analysis**.

### The single number to watch

```
Manipulation check -- the number to watch
  participant x topic pairs with any event : 86
  played_first DETERMINABLE                : 1  (1%)
```

A FLIP-versus-CONTROL comparison over data where this is undeterminable is
uninterpretable: you know what each student was *asked* to do, not what they *did*.
The check fails when it drops below half.

---

## What the professor needs to see, for a tutorial

`backend/generate_tutorial_report.py` already produced the right shape — counts in
code, LLM only for clustering free text, two files every time (teacher with SIDs,
anonymised safe to project). What it did **not** show was whether the class had done
the activity at all.

That mattered: it could report *"pre 41% → post 58%"* with no way to tell whether a
flat gain meant the game does not teach or that half the class never opened it. Those
call for opposite tutorials.

There is now a **"Did they actually do the activity"** block, ahead of the item
breakdown, from the same server-side derivation:

- how many have the activity recorded, and how many do not
- of those that can be placed in sequence, how many played it before the second check
- how many pressed *"the activity didn't record"* and carried on — worth a word,
  because either the game broke for them or they went round it
- and, when nothing is recorded for anyone, an explicit warning to run the coverage
  check **before** concluding anything about the game

```bash
python backend/generate_tutorial_report.py --topic memory --section A --no-llm
```

`--no-llm` still produces the full numeric report. The numbers are the part a teacher
needs and they never depend on a model being up.

---

## Everything the study needs to measure

Organised by the question each one answers, because that is what makes it checkable.
Status is what is true today, not what is planned.

**✅ live** · **⚠ derivable** (the data is in the sink, nothing reads it yet) ·
**✗ missing** (needs a change, with its cost)

### A. Is this response a response at all? — effort

Rapid guessing is the *expected* failure mode here, not an edge case: the study is
ungraded and says so on the dashboard, which is honest and necessary and also removes
the main reason not to click straight through. A score cannot distinguish six
considered answers from six clicks, and the two need opposite responses — one is a
teaching problem, the other is a data problem.

| measure | status | note |
|---|---|---|
| seconds per check item | **✅** | `duration_ms ÷ items`, retroactive over all data |
| accuracy against chance | **✅** | `chance = total ÷ n_options`, both already stored |
| straight-lining (same option throughout) | **✅** | from `meta.answers`, 4+ items |
| the time × accuracy verdict | **✅** | rapid guess · struggling · fast-and-correct · engaged |
| degenerate probe text (one word, echoes the prompt, pre == post) | **⚠** | text is stored; ~20 lines |
| whole-unit elapsed, and whether it was one sitting | **⚠** | first → last event per pair; ~10 lines |
| per-**item** response time (proper Wise & Kong RTE) | **✗** | client change: stamp each option click. Better, not required — total ÷ items is the standard coarse form |

**"Struggling" is the one to notice.** Slow *and* wrong is not bad data, it is the
most useful signal a tutorial can get, and it is invisible without timing.

### B. Did the treatment actually happen, and how much of it? — dosage

| measure | status | note |
|---|---|---|
| activity played before/after the post-check | **✅** | `measures.played_first`, from timestamps |
| complied with the assigned arm | **✅** | `arm` vs `played_first` |
| took the logged escape | **✅** | `activity_not_recorded` |
| replays | **⚠** | count of `understanding_complete` per pair; ~5 lines |
| **time spent inside the activity** | **✗** | **the biggest gap.** `duration_ms` is NULL on all 19 `understanding_complete` rows. Completion is binary: 20 seconds and 8 minutes are the same datum, and for a flip-learning claim they are not the same treatment |
| depth inside the game (rounds, attempts, score trajectory) | **✗** | per-game; medium cost |

### C. Did they learn — H1

| pre/post correct, normalized gain ⟨g⟩ | **✅** |
| per-item error rate | **✅** in the teacher report |
| short answer graded full/partial/none | **✅** `grade.py`, blind, offline |
| probe pre → post | **✅** |

### D. Under what conditions — confounds

| measure | status | note |
|---|---|---|
| late flag | **✅** | |
| where in the 5-day window they worked | **⚠** | `server_ts` vs the schedule window; ~15 lines |
| position in *their own* 13-topic sequence (fatigue, practice) | **⚠** | ~10 lines. Matters: topic 13 in November is not topic 1 in September |
| time of day | **⚠** | free from `server_ts` |
| device / viewport | **✗** | one field on the first event. A pointing game on a phone is a different task |

### E. Motivation, interaction, satisfaction — H2–H4

| IMI · CoI · ARCS-S · Paas load | **✗ not built** | the largest outstanding piece; instruments exist in `docs/study-pack/`, none is wired |
| reflection depth (turns, counted turns, insight, direct answers) | **⚠** | already inside `reflection_complete.meta`; nothing reads it. ~10 lines |
| tutor use *outside* the reflection (`/api/ask`) | **✗** | not logged to the sink at all; small backend change |

### F. Can the dataset be trusted — integrity

| consent, withdrawal, deletion | **✅** |
| **test traffic separated from participants** | **⚠** | `measures.enrolled_only()` filters by the class list, but **`node e2e/run.mjs` writes to the same `research_events.db`** unless `RESEARCH_DB_PATH` points elsewhere. On this box it does not, which is why the effort screen currently reads a median of 0.4 s/item — that is the test suite, not students. **Free fix, config only, and until it is done every number here is polluted.** |
| shared passwords / one person, two accounts | **✗** | inherent; belongs in the paper's limitations |

---

## If only three things get done

1. **Point the e2e suite at its own sink** (`RESEARCH_DB_PATH=.../e2e.db`). Free,
   config only, and nothing above is trustworthy until it is true.
2. **Record how long the activity took.** One field through `markGameComplete`. It
   turns the treatment from a yes/no into a dose, which is what a flip-learning
   claim actually rests on.
3. **Wire one questionnaire.** H2–H4 are currently unmeasurable, and no amount of
   care with H1 substitutes.

---

## The order to read them in

1. `check_measurement_coverage.py` — is the data real?
2. `generate_tutorial_report.py` — what should the tutorial cover?
3. `measures.py --participant <SID>` — one student, when someone asks.

Step 1 first, always. Every number in steps 2 and 3 is worthless if step 1 is red, and
for ten weeks it would have been.
