# Testing the user flow — a plan

Written 2026-08-30, after an afternoon of using the thing and finding it confusing.

The method is not borrowed from outside: **this platform teaches COMP3423, and COMP3423
teaches the two techniques that evaluate it.** Cognitive Walkthrough and Nielsen–Molich
heuristic evaluation are both on the syllabus, both in the corpus (deck 06), and both are
things the students will themselves be assessed on. Evaluating the platform with the
course's own instruments is the cheapest defensible method available and it writes a
paragraph of the FYP report for free.

Happy path first. The adversarial pass is Part 6 and is deliberately last: there is no
point hardening a flow that does not yet work.

---

## Part 0 — Write down the intended flow. It does not exist yet.

**This is the first gap and everything else depends on it.** There is no document
stating what a student is supposed to do, in order, with what in their head at each
point. Without it, "is this confusing?" has no baseline — you can only compare the
product against your own memory of what you meant.

Produce one table. Nothing else in this plan can start until it exists.

| # | Student's goal right now | Correct action | What tells them it worked |
|---|---|---|---|
| 1 | Get in | Enter SID + password at `/login` | Dashboard appears with their name |
| 2 | Know what to do | Read the "next up" card | It names one topic and one verb |
| 3 | Start the topic | Click the open row | Unit opens at Step 1 of 7 |
| 4 | Answer honestly | Six MC items, submit | "Recorded" — deliberately no score |
| 5 | Do the activity | Open the game, play to the end | Debrief, then back into the unit |
| 6 | Answer again | Six MC items, submit | Score **and** per-item feedback |
| 7 | Prove it | Assessment, earn a badge | Badge level rises |
| 8 | Ask something | Tutor | An answer grounded in the lecture |
| 9 | Stop | Close | Progress survives; they can resume anywhere |

Two columns matter more than they look. **"What tells them it worked"** is Norman's Gulf
of Evaluation, written as an acceptance criterion. **"What's in their head"** — add it as
a fifth column — is what makes the walkthrough in Part 1 possible.

---

## Part 1 — Cognitive Walkthrough (the primary method)

For each step in the Part 0 table, ask Wharton's four questions. Answer **as a first-time
student**, not as the person who built it.

1. Will the user try to achieve the right effect?
2. Will they notice the correct action is available?
3. Will they connect the correct action with the effect they want?
4. If the correct action is performed, will they see progress toward their goal?

A step passes only if all four are yes. Record a failure as *(step, question, what they
would do instead)* — the wrong action is the finding, not the frustration.

**Some of this is machine-checkable and should be**, because a script does not get bored
and does not know what the button is called. Question 2 in particular:

```
for each step of the unit:
  the primary control is present, enabled, in the viewport, and has an accessible name
  there is exactly ONE primary control (two competing CTAs is a question-3 failure)
  the control's label contains the verb from the goal column
```

`e2e/resilience.mjs` already has the harness for this. Questions 1, 3 and 4 need a human.

### Findings already in hand, from using it today

These came from real use, not review, and they are pre-loaded so the walkthrough starts
with evidence rather than a blank page.

| Step | CW question | Finding | Status |
|---|---|---|---|
| 1→2 | Q4 | Name asked at signup **and** again at onboarding, second time with an empty box, required. The value was stored and the next screen never read it | **fixed** |
| 3 | Q1 | A locked row showed a state and a date but never *why*, so the student cannot form a correct goal ("come back when?") | **fixed** — rows now say "opens with lecture 5, a week before your Tue class" |
| 5 | Q4 | Crossing into a game loses topic, step and progress. Across all 26 routes the only shared chrome was one corner Exit, styled in the *game's* register so even that read as game UI | **fixed** — a shell-register strip carries topic + Step N of M |
| 5 | Q4 | *Inside* a game there is no progress at all: they are state machines (`learn → compare → debrief`) and only **4 of 24** show the player where they are | **OPEN** |
| 2 | Q1 | The 13 topics map to 6 lecture sessions and that structure is invisible; `journey-path.tsx` colours by state, not session | **OPEN** |
| — | Q3 | A professor cannot set release dates without editing `topic_schedule.json` by hand | **OPEN** |

---

## Part 2 — Heuristic evaluation (the second lens)

Nielsen's ten, scored with Nielsen's severity scale (0 = not a problem, 4 = catastrophe,
fix before release). Two evaluators minimum, independently, then reconcile — a single
evaluator finds roughly a third of the issues, which is the whole reason the method
specifies more than one.

The heuristics that already have hits:

| Heuristic | Where it bites here |
|---|---|
| **1. Visibility of system status** | The in-game one, still open. A student inside a game cannot tell how long it is or where they are |
| **2. Match with the real world** | "Session 5" is the platform's word; the student's word is "next Tuesday's lecture". Half fixed on the dashboard, not elsewhere |
| **4. Consistency and standards** | The two registers. Documented as deliberate (`revamp.md` 14.1) — the *decision* is defensible, the *transition* was never designed |
| **6. Recognition over recall** | Coming back after a week, can they tell what they already finished without opening it? |
| **7. Flexibility** | The keyboard path works (tested); is it *pleasant*? |
| **10. Help** | The tutor exists on every page. Do students know it is for the topic they are on? |

Heuristics 3 (user control), 5 (error prevention), 8 (minimalist design) and 9 (error
recovery) have no findings yet — which means nobody has looked, not that they are clean.

---

## Part 3 — Then, and only then, real users

Five is the right number; the sixth finds almost nothing new.

**Protocol.** Think-aloud, one topic end to end, on their own laptop, no help. You watch
and say nothing. Record:

- **completion** — did they finish the unit unaided (binary, per step)
- **time on step** — the sink already stamps this; no new instrumentation
- **backtracks** — every time they go back or re-read. A backtrack is a Q3 failure with a
  timestamp
- **"what do I do now"** — count it. It is the single best signal, and it costs nothing
- **where they stopped talking** — going quiet is confusion, not concentration

**Do not** ask "was that confusing?" at the end. They will say no, because by then they
have worked it out and will report the resolved state rather than the confusion. The
answer you want is in the recording, at the moment their hand hesitated.

Run this **before** the n≈5 item-bank pilot in `go-live-plan.md` §Phase 3, or fold the
two together — same five people, one sitting, two sets of findings.

---

## Part 4 — What to fix, in what order

Rank by Nielsen severity × frequency, not by how annoying it is to you. The three open
items above, provisionally:

1. **In-game progress** (severity 3): affects every student on every one of 13 topics,
   26 routes, at the exact moment they are furthest from the app's frame.
2. **The session map** (severity 2): affects orientation and the sense that 13 topics are
   a course rather than a list. Needs the lecture structure, so it is partly blocked.
3. **Admin release dates** (severity 2, but for one user): a professor editing JSON is a
   real failure; it is just not a *student* failure. Note it also mutates the independent
   variable, so it must be audited like every other admin action.

---

## Part 5 — Regressions, so the fixes stay fixed

Everything fixed above should acquire an assertion, or the next redesign quietly undoes
it. Cheap ones, in the existing harness:

```
the unit's step counter survives the trip into a game and back
no step of the unit offers two competing primary controls
a locked row states a reason, not only a date
nothing asks the student for the same information twice
```

The last one is the interesting test to write and the one that would have caught the
signup/onboarding duplicate: collect every input label across the whole journey and
assert no two ask for the same thing.

---

## Part 6 — The adversarial pass, deferred on purpose

Written down so it is not forgotten, and explicitly **not now**: a flow has to work
before it is worth hardening.

- a student who tries to reach the assessment without the checks
- two people sharing one account
- answering the post-check without opening the activity
- a student who withdraws mid-topic
- browser back and forward through a completed unit
- devtools against the client-side gates — the answer key is server-side and already
  tested, but the *step order* is the independent variable and deserves the same scrutiny

Some of this exists in `e2e/unhappy-path.mjs` already. The rest is a session of its own.
