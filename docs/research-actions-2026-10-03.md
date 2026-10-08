# Research + ops actions — 2026-10-03

Source: live `/api/researcher/health` + all 9 `/api/researcher/paper/{id}` slices on the study box,
read 2026-10-01 and 2026-10-03 (researcher API, read-only). Descriptive interim numbers only — no
inferential test has been run on any of them.

## Snapshot (2026-10-03)
- Sink: 21,366 events (20,141 on 10-01), 335 accounts, every event type flowing, corpus covers all topics.
- Manipulation: 1,689 / 1,692 determinable pairs complied. No-activity 162, no-post-check 27, escape 106.
- Paper 01 now 10 topics (lecture 6 released `mental-model` + `norman`).
- Health `ok: false` — single problem: last backup 58 h ago (the manual one on 10-01).

## Actions, in order

### 1. Intention-to-treat check on the gestalt drop-out
**Evidence.** `gestalt` FLIP: 20 of 106 assigned never reached the post-check (23/101 on 10-01);
CONTROL: 0 of 81. No other topic shows this (fitts FLIP 5, all others 0–1).
**Why.** In FLIP the activity sits between the two checks, so a FLIP-only exit is differential
attrition by arm — the survivors' ⟨g⟩ (FLIP 0.525 vs CONTROL 0.287) may be inflated.
**Do.** (a) Re-estimate gestalt with ITT (all assigned; missing post handled by a stated rule, e.g.
post = pre, or multiple imputation) and report it beside the per-protocol number. (b) Check whether
the gestalt Understanding game is long, confusing or breaking mid-way (`activity_not_recorded` /
escape counts for gestalt, a walkthrough of the game).

### 2. Run participant-forget for the 12 withdrawn students
**Evidence.** `signal.withdrawals.stuck_in_sink = 12` on both reads.
**Why.** Exports already exclude them, but the consent form promises erasure.
**Do.** `/researcher` → participant-forget, per withdrawn participant. Note: 24113538 (Huang Xin)
was REINSTATED on 2026-10-01 (PI-approved, audit #352) — do NOT forget him; confirm the list first.

### 3. Schedule the backup — it has never been automated
**Evidence.** `deploy/install-services.ps1` registers only COMPGame-Boot / Watchdog / Heartbeat /
Checks / Decks — there is **no backup task**, although `deploy/3090-bringup.md` says
`backup_sink.py` "runs hourly". The only backups ever taken are the manual one on 2026-10-01.
The box has **no D: drive**; current destination `C:\compgame-backups` is same-disk.
**Do (on the box, elevated PowerShell — untested command, check the paths first):**
```powershell
schtasks /Create /TN COMPGame-Backup /SC HOURLY /RU SYSTEM /F /TR "C:\Users\jeffp\compgame-fyp\backend\.venv\Scripts\python.exe C:\Users\jeffp\compgame-fyp\backend\backup_sink.py --dest C:\compgame-backups --verify"
```
Then confirm `/researcher` health shows `backup.hours_since < 1`. Durable fix: add a
`COMPGame-Backup` task to `install-services.ps1` and correct `3090-bringup.md`. Off-disk copy
(USB / another machine) still needed, plus `backend/.participant_secret` off-machine.

### 4. Add an ANCOVA as a second analysis in the pre-registration
**Evidence.** Post-check scores are quantised and ceiling'd (every post ≥ 90 is exactly 100);
per-student ⟨g⟩ misbehaves near the ceiling (stroop FLIP: mean post 89.1 < mean pre 90.9, yet
⟨g⟩ = +0.386). Baselines can be unbalanced: `mental-model` CONTROL pre 91.2 vs FLIP 80.9.
**Do.** In `docs/pre-registration/01-flip-effect.md`, register post-score ANCOVA (post ~ arm + pre,
topic as a random/fixed effect) as a secondary analysis, alongside ⟨g⟩, before more data is read.

## 2026-10-08 update — H1 interim + why it is null (ALL EXPLORATORY)

**Status changes since 10-03.** Backup still unscheduled (174 h on 10-08). Item 4 is DONE: the H1
pre-registration now has covariate-adjusted post score + ITT as primary, ⟨g⟩ descriptive, and this
interim look disclosed (`docs/pre-registration/01-flip-effect.md`, `75ec6a6`). Decision (Wilson):
no further H1 tuning; wait for November; "flip helps or not, both are findings".

**H1 interim (per-student, pseudonymised export, 232 participants with both arms).** Mixed model
post ~ condition + pre + topic + (1|student), H1 topics, completers: **+1.17 / 100, 95% CI
[−0.28, +2.63], p = .11**; ITT +0.85, p = .25. ⟨g⟩ 0.565 vs 0.448 overstates it. Attrition before
the post-check FLIP 38 vs CONTROL 6. A large immediate benefit is ruled out.

**Why null — four exploratory checks.** None re-estimates H1 or may be reported as confirmatory.

1. **Form A and Form B are not equivalent.** CONTROL has nothing between pre (A) and post (B) and
   the pre reveals nothing, yet CONTROL items rise +5.9 pp (FLIP +6.6). The per-item-pair rise
   correlates 0.74 across arms → a property of the items, not the teaching. Worst pairs (B easier):
   visual-perception #5 +35, problem-solving #4 +24, language #2 +24, webers-law #6 +24,
   fitts-law #4 +21. Effect: post scores pushed to ceiling in both arms, leaving FLIP no headroom.
2. **Low dose.** FLIP game time median 76 s; 16% < 30 s, 39% < 60 s. post ~ log(game s) + pre:
   +1.8 pts per log-unit, p = .007 (confounded with engagement). Fastest quartile +6.0 ≈ CONTROL
   +5.9; longest quartile (~4 min) +8.3.
3. **Game–item misalignment (keyword proxy).** Item concepts found in each Understanding game's
   source: problem-solving 3/6 and stroop 3/6 (the two FLIP-negative topics), fitts 4/6,
   webers-law 4/6, mental-model 5/6, visual-perception 5/6, language 5/6, memory 6/6, gestalt 6/6.
   Keyword presence ≠ taught; needs a human read.
4. **Timing.** The window closes 48 h before the lecture, so pre-checks mostly measure prior
   knowledge — but 21% of completed units were done AFTER the lecture (balanced by arm), 19% late
   but pre-lecture, 60% on time. FLIP effect on-time **+2.11 [+0.51, +3.70], p = .010**;
   after-lecture −2.01. Post-hoc subgroup: hypothesis-generating only.

Scripts (scratchpad, not committed): `h1.py`, `whynull.py`, `lateness.py`, run on the researcher
export with statsmodels; item responses re-graded against `checks._key()` (0 score mismatches).

## Auto-mode run, 2026-10-08 — what got done

| Plan item | Status | Where |
|---|---|---|
| Schedule the hourly backup | **Code done**; box step pending (run `deploy\install-services.ps1` elevated) | `a4bd21d` — `COMPGame-Backup` → `deploy\backup.ps1`, `BACKUP_DIR` in `.env.local`, default `C:\compgame-backups` |
| Form C vs the form gap | **Packet done**; human review pending | `029bb66` — `docs/retention-review-packet.md` (20 flagged slots: 6 A/B-gap, 14 hardened), `scripts/form_gap_report.py` |
| Pre-register the delayed analysis | **Drafted**; PI to file before 2026-11-23 | `dbf6e3e` — `docs/pre-registration/01b-retention.md` |
| Gestalt drop-out | **Diagnosed — a navigation bug, not difficulty** (below) | `scripts/h1_interim/gestalt.py` |
| Reproducible analysis scripts | Done | `b7b0ced` — `scripts/h1_interim/` |
| Participant-forget ×12 | **Not run** — irreversible; needs Wilson's explicit yes | — |

**Gestalt drop-out — cause found, and it is a routing bug.** Of the 19 gestalt FLIP rows with no
post-check, **18 went `understanding_complete` → `assessment_complete`** and never saw the
post-check. Mechanism (live route `frontend/app/games/[gameId]/gestalt-understanding-wrapper.tsx`):
the menu's five principle links (`:246-250`, `/games/gestalt-understanding/app/<principle>`) and
each sub-game's "Back to the Gestalt menu" link (`gestalt-understanding/{similarity,proximity,
continuity,symmetry,closure}-game.tsx`, bare `href="/games/gestalt-understanding"`) all DROP the
`?unit=` tag. Back on the menu the completion button (`:321-331`) therefore thinks it is free play:
it reads "Take the Assessment →", records the game complete, and `router.push`es to
`/games/gestalt-assessment` — **skipping the unit's post-check and running the scored assessment
outside the unit**. Only students who actually opened a sub-game lose the tag, so the bug
selectively removes the MORE engaged FLIP students; CONTROL is untouched because its post-check
comes before the game. It is therefore a **bug-induced differential attrition by arm**, and the
gestalt per-protocol estimate is biased by it (the ITT primary treats them as "no change").
Scope: a scan of all 13 Understanding games found bare internal links ONLY in gestalt (the others
are single-page; fitts carries the tag via `withUnit`), so ergonomics and experiment-design are
safe. Fitts' 7 (also `understanding_complete` then no post) have a different, still-unknown cause.
Also: gestalt's `understanding_complete` carries no `duration_ms`, so gestalt is absent from the
dose analysis. **FIXED 2026-10-08 (Wilson's decision):** every gestalt link now carries the query
string via `useUnitQuery()` (`lib/unit-link.tsx`); no instrument change. Verified in a production
build: from `?unit=gestalt`, each of the 5 sub-games keeps the tag through to the menu, whose
button still reads "Back to the unit"; free play still offers the assessment (22/22 checks). Rows
recorded before the fix are unchanged — report the bug in papers 01/06 as a documented instance of
a navigation defect producing differential attrition, with the fix date as the boundary.

## 2026-10-08 — the other papers, drilled (ALL EXPLORATORY)

| Paper | Finding | Action taken |
|---|---|---|
| 02 | IMI/CoI/ARCS are asked after every topic, but the measures kept only each student's FIRST answer (~185 of 766 batteries used) and claimed "no arm split". Within-student: FLIP edges IMI interest/enjoyment +0.064 (p=.022) and ARCS satisfaction +0.065 (p=.028); nothing else; none survive Holm. **Straight-lining: CoI 72%, ARCS 73%, IMI 41%** (55% of students straight-line CoI/ARCS every time) — the main caveat for paper 02 | `37f22a5` measures read every battery, FLIP/CONTROL columns + straight-lined % on the dashboard; `ec47247` concrete careless-responding rule + interim disclosed in pre-reg 02 |
| 09 | Fitts per-target times are order-confounded: the easy fish is caught first 65/65 and 62/63 rounds, so the per-target contrast reads Fitts' law backwards. Stroop replicates (~600 ms interference). Weber JND FLIP 22.6 vs CONTROL 27.3 (unexplained) | `997b0e7` order-confounded flag + dashboard caveat |
| 04 | < 5 s/item responding ≈ 17% of check submissions (dashboard's accuracy-based "rapid guess" says 3%) | `ec47247` NT10 rapid-guess rule fixed in pre-reg 01 / 01b |
| 03/07 | Tutor "insight" (51%) is unrelated to arm or post score; asking for the answer weakly predicts lower post (p=.057) — the tutor's own "understood" flag is not a learning measure | none (report) |

**Does on-site behaviour reflect learning?** (`scripts/h1_interim/behaviour.py`; check items with
telemetry since 2026-09-10; 24,048 item responses, 260 students, 87% mouse.) The literal "click
faster after the Fitts game" is not testable: knowing a motor law does not change motor speed, and
no target geometry is recorded. Decisiveness IS measurable:
- **Validity:** selection changes and options hovered go with WRONG answers; time and direction
  changes go with RIGHT answers (effort). Index = selection changes + options hovered:
  −0.028 per SD on P(correct), p < .001.
- **FLIP students are more decisive on the post-check:** −0.041 SD (95% CI −0.072 to −0.010),
  p = .010, controlling pre-check hesitation, topic, student.
- **FLIP students' cursors dwell more on the correct option:** share 0.51→0.53 vs 0.50→0.51,
  +0.015 (p = .019).
- So behaviour shows a FLIP effect the 6-item score (p = .11) is too coarse to show. Caveat: the
  index was refined after the validity check — exploratory. Registered as an exploratory DV in
  `01b-retention.md` so November is a fair test; the battery now records per-item telemetry.

## Follow-up plan

**Now (this week)**
- Box: schedule the hourly backup (item 3) and run `deploy\update.ps1` (ships the paper-09 Fitts
  fix, `6487887`). Confirm `/researcher` health is green.
- Participant-forget for the 12 withdrawn (item 2), excluding the reinstated 24113538.
- Gestalt ITT check (item 1) — now partly answered by the ITT primary; still walk the gestalt
  game to see where FLIP students stop.

**Before the November window (opens ~2026-11-23) — the important part**
- **Form C vs the form gap.** Form C mirrors Form A; compare each Form C item to its A/B partners
  above, and give the worst pairs a human difficulty read. A delayed test with the same easy-item
  problem will ceiling again.
- **Human desk-review** of the 13 hardened Form C items + 13 application prompts.
- **Pre-register the delayed analysis** (new `docs/pre-registration/01b-retention.md`): primary =
  same mixed model on Form C score with immediate post as covariate, ITT; pre-specify
  **completion timing (on time vs after lecture)** and **game time** as moderators, so the
  exploratory patterns above get a fair, registered test on new data. File it before any battery
  data exists.
- **Turnout plan** with the teacher: class time or a reminder in the last lecture week; turnout
  matters more than any analysis choice.

**At / after November**
- Run the registered immediate H1 once, on the full dataset, after the last topic closes.
- Run the registered delayed analysis on the battery.
- Paper 01 discussion: report the four checks above as exploratory explanations, alongside
  whatever the delayed test shows.

**Next study (not mid-study)** — games that cover every item concept, a minimum play time before
the post-check, and counterbalanced forms (A/B order swapped across students).

## Watch items (no action yet)
- **Arm sizes on the new topics:** `mental-model` 42 FLIP / 66 CONTROL, `norman` 63 / 38 assigned.
  Lecture 3 opened the same way (75/102, 99/71) and evened out to 96/117, 111/96. Re-check after
  lecture 7.
- `mental-model` is the first topic with CONTROL ⟨g⟩ > FLIP (0.554 vs 0.500) — confounded by the
  10-point baseline gap above; read it through the ANCOVA, not ⟨g⟩.
- Paper 04 mean per-item time is 203 s vs median 16.5 s (idle tabs) — report the median; fastest
  0.7 s/item looks like rapid guessing.
- Tutor reflection: 93% of turns count toward the floor, ~20% marked "understood", 10% ask for the
  answer (paper 07).
- Paper 08 κ still needs human coding; paper 09 has trials for 4 topics only, per-game parsers not built.
