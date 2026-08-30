# Plan — teacher, experiment, and what nobody can see

Written 2026-08-30, revised the same day against Wilson's answers. Companion to
`measurement-inventory.md` (the catalogue) and
`incident-2026-08-30-completion-events-lost.md` (why this exists).

**Four answers reshaped this plan, so they go first:**

| question | answer | what it changes |
|---|---|---|
| Who reads the tutorial brief? | **The COMP3423 lecturer AND Wilson** | Two readers with opposed needs. Raises a blinding problem — see §1 |
| When is the 28-item battery run? | **Every topic** | H2–H4 become testable between arms. Also 364 items per student — see §2 |
| Going live this semester? | **Yes, real students in September** | **First window opens ~8 Sept. Nine days.** Everything below is ordered by that |
| Is June–August data real? | **All pilot and test traffic** | The ten-week outage cost nothing. Closed |

**The deadline is the plan.** Everything is now "before 8 Sept" or "after", and the
default answer to anything not on the first list is *no*.

---

## 1. The teacher — and a blinding problem the answer created

**Empathise.** A lecturer with a hundred students and sixty minutes, who will read one
page once, standing up. They are not exploring a dashboard. And separately, Wilson,
who wants to know whether the study is working.

**Define.** *"In one page: what do I teach today, and can I believe it."*

| they need | today |
|---|---|
| the two or three items the class got wrong | ✅ per-item error table |
| what the wrong answers have in common | ✅ LLM clusters the short answers |
| whether the class did the activity at all | ✅ added today |
| **who is quiet but struggling** (slow *and* wrong) | ✅ "Who to spend the hour on", added today |
| whether the numbers are trustworthy | ✅ warns when nothing is recorded |
| nothing projectable with a SID on it | ✅ three files, always — and two of them are blind to the experiment |

### The problem the answer creates

Both readers get the same file, and the participation block I added today says how
many *"played it BEFORE the second check"*. **That tells the lecturer the manipulation
exists.** A lecturer who knows some students saw the game first can — with the best
intentions — teach to compensate, and that is differential instruction by condition:
a confound that lands directly on H1 and cannot be removed afterwards.

**Done.** Split by *audience* as well as by SIDs — three files, every time:

- **lecturer copy** — items missed, misconceptions, "how many have not done the
  activity yet" (a participation number they legitimately need for chasing), the
  struggling list. **No sequence, no arms, no FLIP/CONTROL.**
- **researcher copy** — everything, including the order and the compliance rate.

One `blind` flag through `render()`. It is the cheapest confound removal available
and it expires the moment the lecturer reads one brief, which is why it had to land
before September rather than after.

---

## 2. Full battery every topic — consequences, stated once

Chosen deliberately. Three things follow, and they are not objections:

1. **H2/H3/H4 become properly testable.** Arm is randomised per topic, so a per-topic
   battery attaches motivation, interaction and satisfaction to a *condition*. Run
   once at the end it could only ever have been descriptive. This is the stronger
   design.
2. **364 items per student across the semester** (28 × 13), plus the Paas item. Expect
   fatigue, drop-off and straight-lining — and note that the effort screen built today
   is exactly the detector for it: identical-response runs on a Likert grid are the
   same computation as on the MC checks. **The high-burden choice makes that screen
   load-bearing rather than optional.**
3. **The unit stops being twelve minutes.** 29 extra items after a 12-minute unit
   roughly doubles it. The dashboard currently promises *"About 12 minutes"* in the
   calm card and the "How this works" panel. **That copy has to change before students
   see it**, or the first thing the study does is break a promise — which is precisely
   the cortisol problem the shell was rebuilt to avoid.

**Where it goes:** the unit's `close` step, after everything is recorded, next to the
Paas item. This does not touch the pre → activity → post ordering, so the experiment's
sequence is untouched.

**A trim is data, not code.** The bank is generated from the study pack, so dropping
to a subset later is an edit to `questionnaires.json` plus a regeneration — no
release. Worth knowing if the first week's completion rate is bad.

---

## 3. The unseen — three kinds

The damage this month was never in a failing assertion. It was in what nothing looked
at.

### A. Unseen by tests

All 26 game routes are named by a test, but **mounted, not played**. `finishable.mjs`
now measures the real question — does it emit the completion event the unit waits on —
and the answer is **15 of 26 yes, 11 no** (`game-finishability.md`).

**This got dangerous today.** While the unit had "I've finished it — continue", a game
that could not be completed was a nuisance. Now Continue waits on a recorded
completion, so an uncompletable game is a wall with only the logged escape past it.
**Before 8 Sept the 11 must be played by hand**, on the deployment box, by a human —
not all 26. Bespoke drivers (P5) are the durable answer and there is no time for them.

### B. Unseen by measurement

Catalogued in `measurement-inventory.md`. Remaining after today: per-item response
time, device/viewport, depth inside a game, `/api/ask` use outside the reflection.
**None is required for 8 Sept.**

### C. Unseen by anyone — silent failure

Any fault where nothing changes visibly, because absence of the signal is
indistinguishable from absence of the behaviour.

| if this stops | who notices | detector |
|---|---|---|
| game completions stop recording | **nobody — ran 10 weeks** | ✅ `check_measurement_coverage.py` |
| reflections stop recording | nobody | ✅ same (red right now) |
| e2e writes into the real sink | nobody | ✅ `e2e/run.mjs` refuses |
| RAG corpus goes stale | nobody | ✅ `check_corpus_coverage.py` (red: `norman`, `hicks-law`) |
| probes never graded | brief says "not yet graded" | ⚠ printed, nothing chases it |
| Ollama down ⇒ reflections cannot complete | students see a degraded tutor | ⚠ health knows; nobody watches |
| the hourly sink backup stops | nobody | ✅ heartbeat + a >26h check, added today |
| the box is simply OFF | inbound monitoring cannot tell | ✅ dead-man's switch in `deploy/` |

**Both holes are closed.** The backup stamps a heartbeat and the coverage check fails
when it goes stale; `COMPGame-Checks` runs all three checkers daily at 6am and its
verdict is printed at the top of the next tutorial brief. Together they are what stands
between you and repeating this month.

---

## 4. Before 8 Sept — status

**Executed today (7 of 9).**

| # | item | state |
|---|---|---|
| 1 | play all 26 games by hand | ⚠ **narrowed from 26 to 11.** `node frontend/finishable.mjs` drives every game and watches the wire for `understanding_complete` / `assessment_complete` — the event the unit now blocks on. **15 of 26 record a completion**; the other 11 are the by-hand list and are named in `game-finishability.md` |
| 2 | questionnaire client | ✅ built, mounted on the close screen, verified with the flag on (12/8/8/1 items, one-submission 409, out-of-range 400, scoring key not leaked). **Still ships off** — §5.1 |
| 3 | the "12 minutes" copy | ✅ dashboard and session map now read `questionnaires_enabled` from the server and say 20 when the battery is on |
| 4 | blind the lecturer's brief | ✅ **three files now**: `-teacher` and `-discussion` are blind to the experiment, `-research` is not. Verified: the arm-revealing line appears in 1 of 3 |
| 5 | checkers on a schedule | ✅ `deploy/daily-checks.ps1` + `COMPGame-Checks` daily at 6am. Result reaches a human through the tutorial brief, not a log |
| 6 | backup heartbeat | ✅ `backup_sink.py` stamps on success; the coverage check fails at >26h. Verified "never" → "0.0 hours ago" |
| 7 | `struggling` in the brief | ✅ new "Who to spend the hour on" section, with SIDs in the identified copy only |
| 8 | deploy + `.participant_secret` | ✗ needs the 3090 |
| 9 | freeze | ✗ after 8 |

### The 11 to play by hand

Several are expected — a generic clicker cannot do a reaction-time, pointing or slider
task, and `fitts-law-understanding`, `hicks-law-assessment`, `webers-law-understanding`
and `problem-solving-understanding` are all of that kind. **The ones to look at first
are the quiz-shaped games that should have been clickable and were not:**
`memory-assessment`, `mental-model-assessment`, `mental-model-understanding`,
`ergonomics-understanding`, `experiment-design-understanding`, and both gestalt routes
(which run in an iframe and record through a different path).

A "no" is not proof a game is broken. It means **nothing has ever verified it**, and
the unit now blocks on it.

## 5. Decisions still only yours

1. **Switch the questionnaires on** — `QUESTIONNAIRES_ENABLED=1`. Ships off because
   starting a new class of data collection should not be something a merge can do.
   Tied to `ethics-amendment-stage2.md`, **which is still unsigned and now nine days
   from needing to be.**
2. **Blind the lecturer's copy?** My recommendation is yes (§1). Your call.
3. **What `TELEMETRY_ENABLED` should gate.** It says "the frontend collects nothing
   while this is false"; completions and checks record regardless. Either the comment
   or the behaviour is wrong.
4. **The rapid-guess threshold.** `THRESHOLD_S_PER_ITEM = 5.0` is a placeholder. Set
   it from the cohort's own distribution — and write the number down *before* looking
   at outcomes.
