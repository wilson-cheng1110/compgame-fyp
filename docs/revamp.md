# COMPGame — the revamp

**One document.** Merged 2026-08-16 from `topic-session-revamp.md`, `course-topic-map.md` and
`rollout-plan.md`, which are deleted. Where this disagrees with `experiment-design.md`,
`stage2-deployment-plan.md` or `CLAUDE.md`, **this wins** — Part 18 is the ledger of exactly what it
supersedes and where those files were patched.

**Scope:** 13 topics × 300 students, 3 sections of ~100 on Tue / Wed / Thu, released in lecture-notes
order. COMP3423 2026/27 Semester 1. Deployment on the RTX 3090; the 5060 Ti is dev only.

**Stacks on** `stage2-deployment-plan.md` (Loops A–E), which is still current for deployment,
operations and the data loop. This does not replace that work — it queues behind it.

---

# Part 0 — Decisions (the contract)

| Question | Decision | Date |
|---|---|---|
| Item source | **Hybrid** — fixed MC from the validated bank (scored) + AI-asked short answer (graded full/partial/no, feeds the teacher report) | 08-15 |
| 太game | **Restructure the shell + full visual pass** — a topic becomes a study unit; games are the activity *inside* it. Typography, colour and chrome also in scope | 08-16 |
| Teacher report | **Offline generator script** — one brief per topic *per section*. No new auth surface | 08-15 |
| Target | **September semester rollout, real COMP3423 students** | 08-15 |
| Scope | **All 13 topics × 300 students**, lecture-notes order, 3 sections Tue/Wed/Thu | 08-16 |
| Deployment box | **RTX 3090.** The 5060 Ti is dev; its ~12 s p50 does not transfer (Part 16) | 08-16 |
| Auth model | **Server-side accounts.** Explicitly overrides `CLAUDE.md`'s "Do NOT add: remote database / server-side auth", which was written for a single-browser demo | 08-16 |
| Credential | **SID only, no secret**, gated on an enrolled-SID allowlist — see below | 08-16 |
| IV assignment | **Per-topic randomised FLIP/CONTROL**, ~half each per participant, counterbalanced across the cohort, **server-assigned and recorded** | 08-16 |
| Pre-test | **Per-topic Form A is the H1 instrument.** `signup/page.tsx`'s 5-item MCQ demotes to a one-off prior-knowledge baseline, never entering a gain score | 08-16 |
| Grader model | **Undecided by design** — measure Cohen's κ for `gemma4:e4b` vs a larger model on the same ~60 human-coded answers, pick on evidence | 08-16 |
| Telemetry | **Build complete, ship gated.** Behavioural capture (Part 11) and teacher-visible answers (Part 12) behind a config flag defaulting **OFF** until HSESC approval | 08-16 |

### The constraint "SID only, no secret" creates

There is no credential, so **the session cookie is an identity hint, not a security boundary** — anyone
who knows a classmate's SID can enter as them. Two consequences, neither optional:

1. **Gate on an enrolled-SID allowlist.** Only the ~300 SIDs on the class list may start a session.
   Enrolment control on a public URL without introducing a secret; costs one text file. It does **not**
   stop impersonation between enrolled students.
2. **State it in the paper.** Attribution is self-asserted. Reasonable for a low-stakes formative
   coursework tool, but it belongs in the limitations section because a reviewer will ask.

Part 13's HMAC pseudonymisation and the withdrawal-deletion path both work unchanged under this model.

---

# Part 1 — What changes for a student

The whole revamp in one comparison. Everything else exists to move the left column to the right.

| Today | After |
|---|---|
| Logs in with SID + password. The account exists in **that browser only** — clear the cache and progress is gone | Enters their SID, checked against the class list. Account follows them to any device; they can withdraw and have data deleted |
| — | Consent is taken before a single event is recorded |
| Dashboard is a grid of 13 topics, every game unlocked, any order, any time | Dashboard is a journey in lecture order. One topic open at a time, with a closing date, locked before and after |
| Picks a game, plays it, gets a badge, returns to the grid. Nothing connects one topic to the next | A topic is a guided six-step unit, not a menu (Part 2) |
| AI tutor floats in the corner of every page, identical everywhere, unrelated to what they're doing | The tutor is a step inside the flow, on the topic just worked through |
| Nothing reaches the teacher. The tutorial is planned blind | The teacher gets a brief 48 h before each tutorial, per section (Part 12) |

---

# Part 2 — The unit: six steps, in this order

**The order is the experiment.** Half the topics put the game *before* the post-check (FLIP), half
*after* (CONTROL), assigned per student per topic by the server. Today the flag is merely *observed* —
`progress-context.tsx:89` records `playedUnderstandingFirst: current.understandingCompleted` — and the
live data shows the cost: **27 of 33 assessments recorded `played_understanding_first = 0`**, with only
2 of 22 participants ever completing an Understanding module.

| # | Step | What happens |
|---|---|---|
| 01 | **Brief** | One screen framing the concept. Enough to attempt the pre-check honestly, not enough to teach it |
| 02 | **Pre-check** — *no feedback* | 5 MC from the validated bank, one submission each, + 1 AI-asked short answer. No score, no answers revealed — anything revealed here contaminates the post-check. **Keys stay server-side** |
| 03 | **The game** — *FLIP arm only* | The existing Understanding game, unchanged. All 26 game routes keep working as-is; they gain a way back into the unit, nothing more. CONTROL students reach this at step 05 |
| 04 | **Post-check** — *answers shown* | 5 different but matched MC, one submission, + a second short answer. Full feedback — correct answer and why each distractor was wrong. Measurement is done, so teaching can start |
| 05 | **Tutor** | The Socratic turn that already exists, grounded in the topic just finished rather than floating in a corner. Formative — never returns a grade |
| 06 | **Close** | Summary card, unit locks, next topic shows its opening date. Short answers queue for the teacher's brief |

This structure fixes three things at once: it de-emphasises the arcade framing, it forces the sequence
that makes the IV a manipulated variable rather than an observed one, and it gives short answers a fixed
place to be collected from.

---

# Part 3 — Build phases

Ordered by dependency, not size. Grading and the teacher report deliberately sit late — **both run
offline in a batch, so they don't block launch.** Short answers can be collected from day one and
graded weeks later.

| # | Phase | State | What it does | Key files |
|---|---|---|---|---|
| 00 | Foundations | **3 of 4** | Server accounts, corpus staleness check, closing the hole where 300 real SIDs would have been committed to git | `auth_store.py` ✓ · `check_corpus_coverage.py` ✓ · `.gitignore` ✓ · `enrolled_sids.txt` **missing** |
| 01 | Identity & consent | **next** | SID login against the class list, consent gate before any recording, withdrawal path. The `user` cookie keeps its exact shape so all 15 call sites keep working untouched | `rag_api.py` · `app/login/` · `app/consent/` (new) · `lib/user-store.ts` |
| 02 | Schedule & sequencing | queued | Release windows per section, FLIP/CONTROL assignment, dashboard becomes a journey. **Where the IV actually gets manipulated** | `schedule.py` (new) · `topic_schedule.json` (new) · `app/dashboard/page.tsx` |
| 03 | The topic unit | queued | The six-step shell, pre/post components, server-held keys. Biggest single piece of frontend work | `app/topics/[topicId]/` (new) · `checks.py` (new) |
| 04 | Grading | **done 2026-08-21** | Grading endpoint separate from the tutor + a batch pass that strips pre/post labels and shuffles before grading. Verified end-to-end on 42 answers | `grade.py` ✓ · `grade_batch.py` ✓ · `docs/grading-rubric.md` ✓ · probe step in `topic_api.py` ✓ · `components/topic-probe.tsx` ✓ |
| 05 | Telemetry | **ships off** | Mouse hesitation, typing dynamics, idle gaps, paste + tab-switch counts. Aggregates per item, not raw traces. Flag defaults off until ethics approval | `lib/telemetry.ts` (new) · `lib/research-log.ts` |
| 06 | Teacher report | **done 2026-08-21** | The tutorial brief generator. Counting in code, clustering + discussion points from the model, two versions out. Verified end-to-end | `generate_tutorial_report.py` ✓ · `reports/` (gitignored — holds verbatim answers + SIDs) |
| 07 | Visual pass | **done 2026-08-21** | The 太game fix, done as REGISTER SEPARATION rather than a repaint: the **CUBIK design system ported** into a `.shell` layer (`app/shell.css`) for every measured surface; the 26 game routes untouched | `app/shell.css` ✓ · `fonts.ts` ✓ · dashboard · topic unit · check · probe · consent · login · badges · about |
| R | Item banks | **rolling** | 9 topics still need pre/post sets. ~1 a week, drafted from each lecture deck as it becomes relevant | `docs/quiz-item-banks.md` · 4 of 13 done |

**Prerequisites that are not this document's work but block it** — `stage2-deployment-plan.md`
Loops A/C: A1 origins · A3 queue · C2 health check · C1 unattended-box hardening. At 300 students
across 3 sections these are not optional.

---

# Part 4 — Blocked on you

Nothing above moves without these. All five are one email plus an afternoon; none need the app to exist.

1. **The class list** → `backend/enrolled_sids.txt`, SIDs with their section, one per line. Both the
   enrolment gate and what assigns students to the Tue/Wed/Thu windows. Until it exists nobody can log in.
2. **The ethics amendment.** Mouse telemetry, teacher-visible answers and keeping real SIDs all exceed
   the current consent sheet. **The only item that can't be sped up by working harder** — so it goes first.
3. **The 2026/27 lecture decks.** The corpus is built from 2023 slides: *zero* content on Norman's
   Action Cycle and Hick's Law, ~1 slide each on Weber's Law, mental models, Stroop, Miller's Law.
   New decks in → `python rebuild_db.py` → re-run `check_corpus_coverage.py` (Part 9).
4. **The timetable.** All 13 session dates × 3 sections, plus holiday moves. Every release window is
   calculated from these; every date currently in the config is a placeholder. Also confirm the tutorial
   is still the 3rd hour of class, and that COMPGame **replaces** pre-class reading rather than adding
   to it (~7 h across the semester is fine as substitution, corrosive as addition).
5. **A backup of `backend/.participant_secret`** — off this machine, today. It links a student's
   pre-test to their post-test across exports. Lose it and no future export joins to any past one. It
   must never reach git either, or the anonymised export becomes trivially reversible.

---

# Part 5 — How this goes wrong

| If | Then |
|---|---|
| The grading batch isn't actually blind | The model sees it's marking a post-test, marks generously, and **manufactures the improvement the study exists to detect**. Doesn't survive one reviewer question. Highest-consequence item in the build |
| The corpus never gets rebuilt | The tutor answers confidently from general knowledge on two topics while instructed it's grounded in the lecture. **300 students, unsourced tutoring**, no error message |
| Ethics approval arrives after teaching starts | **The first cohort's data is unusable** and the study is a cohort short. No code change fixes this retroactively |
| The visual pass starts before phases 01–03 | Most satisfying work, least load-bearing. **It will quietly eat September** if it isn't kept last |
| A holiday collapses Tue/Wed/Thu into one deadline | Sections stop staggering and **the evening load triples**. Holiday moves live in one place in the schedule config for exactly this reason |
| Item banks slip to just-in-time | A set written the night before its window opens gets no review. **A bad question can't be un-asked** once 100 students answered it |
| The HMAC secret is lost | Every prior export becomes un-joinable to every future one. Back it up somewhere that is not this machine, on day one |
| The teacher report is wrong once | One miscounted number and it never gets opened again. Hence counting in code, not in the model (Part 12) |

---

# Part 6 — The course this plugs into

Source: `backend/01 COMP3423 Introducing HCI 1 2023 08 29.pdf` slides 3 and 5, cross-checked against
the full text of all 9 committed decks.

> The committed decks are the **2023** run. The course also assigns Shneiderman chapters per week
> (slide 4) plus tutorial material not in this repo. "Absent from the decks" below means exactly that,
> not "not in the course" — the lecturer confirms Norman, Hick's Law and Miller's 7±2 **are** taught.

## 6.1 Six lecture topics (slide 3)

| # | Lecture topic | SIGCHI cells |
|---|---|---|
| 1 | Use and context | U1–3 |
| 2 | Human information processing | H1 |
| 3 | Visual perception and computer graphics | H1, C4 |
| 4 | Language, communication, and dialogue techniques | H2, C2/3/5 |
| 5 | Ergonomics, I/O devices, haptics, sound | H3, C1 |
| — | ~~Design approaches and implementation~~ | ~~D1–2~~ — **struck through on the slide; dropped** |
| 6 | Evaluation techniques and example systems | D3–4 |

The strike-through matters: the course deliberately does **not** cover design methods. Any COMPGame
topic in that space has no home in the syllabus.

## 6.2 Thirteen sessions, two per topic (slide 5)

2023 ran two sections (N001, Y302) a day apart. **2026/27 runs three sections of ~100 on Tue/Wed/Thu** —
same content, three consecutive days.

| Session | Content | Course topic | | Session | Content | Course topic |
|---|---|---|---|---|---|---|
| 1 | Intro HCI 1 | 1 | | 8 | Language 2 | 4 |
| 2 | Intro HCI 2 | 1 | | 9 | Ergo_I/O 1 | 5 |
| 3 | Human 1 | 2 | | 10 | Ergo_I/O 2 | 5 |
| 4 | Human 2 | 2 | | 11 | Testing 1 | 6 |
| 5 | Visual 1 | 3 | | 12 | Testing 2 | 6 |
| 6 | Visual 2 | 3 | | 13 | Response, test exam | — |
| 7 | Language 1 | 4 | | | | |

**Three structural facts that drive everything:**

1. **Every topic spans exactly two sessions.**
2. **Tutorials are the 3rd hour of class, from session 2** → 12 slots × 3 sections = **36 tutorials**.
   The report is generated **per section**, never merged — different students, different misconceptions.
3. **Public holidays displace sessions** (2023: Oct 2 → Oct 3; Oct 23 → Oct 24). 2026/27 will have its
   own. The schedule config must be editable without a redeploy.

The three-day section offset is the single most useful operational fact here: it staggers the cohort
into thirds for free. Every load figure in Part 16 is **per section (~100)**, not 300 at once.

## 6.3 Where each COMPGame topic lives

| COMPGame topic | Course topic | Session | Evidence | Conf. |
|---|---|---|---|---|
| `problem-solving` | 2 Human info proc | 3–4 | HIP1 p26–63 problem continuum, means-end analysis, forward reasoning; HIP2 p4 problem representation | ✓✓ |
| `fitts-law` | 2 Human info proc | 4 | HIP2 p31 "Fitts' Law: speed vs accuracy", p33 Index of Difficulty; 22 slides across 5 decks | ✓✓ |
| `visual-perception` | 3 Visual | 5 | V1 p6–35 visual system, Hermann grid, colour, optic flow, 3D; V2 p3–11 reading, saccades | ✓✓ |
| `gestalt` | 3 Visual | 5 | V1 p44 similarity, p48 proximity, p59 Kanizsa, p75 surroundedness — **taught as "pattern recognition"; the word "Gestalt" never appears** | ✓✓ˣ |
| `webers-law` | 3 Visual | 5 | V1 p8 "Brightness … measured by **just noticeable difference**" — **JND taught; "Weber" appears in no deck** | ✓ˣ |
| `mental-model` | 3 Visual | 6 | V2 p56 "Mental models of designers and users clash", p61 Blackboard, p40–44 "What does this C mean?" | ◐ |
| `language` | 4 Language | 7–8 | L2 p16 "Ambiguity is pervasive", p83 semantics dominates grammar, p86–93 speech acts + Grice's maxims | ✓✓ |
| `ergonomics` | 5 Ergonomics | 9–10 | E1 contents, p14 anthropometry, p24 cognitive ergonomics; E2 p66–68 | ✓✓ |
| `experiment-design` | 6 Evaluation | 11–12 | T1 p16–55 RQ/H0/HA, IV/DV, measurement scales; T2 p8–19 within/between-subject, confounds | ✓✓ |
| `memory` (Miller's) | 2 Human info proc | 3 | HIP1 contents "memory (sensory, short-, long-term)"; 7±2 lecturer-confirmed, **not in the decks** | ? |
| `stroop` (Consistency) | 2 Human info proc | 3–4 | Lecturer-confirmed. "Stroop" in no deck; "consistency" ×5 but scattered | ✗ᴰ |
| `hicks-law` | 2 Human info proc | 4 | Lecturer-confirmed. **Absent from the 2023 decks** — "Hick" matches only the photo credit "Anthony Sc**hick**" ×10 | ✗ᴰ |
| `norman` (Action Cycle) | 1 Use and context | 1–2 | Lecturer-confirmed. **Absent from the 2023 decks** — "Norman", "action cycle", "gulf of" all zero | ✗ᴰ |

Legend: ✓✓ directly taught · ✓✓ˣ taught under a **different name** · ✓ˣ content taught, concept name absent ·
◐ partially grounded · ? placement plausible but unevidenced · ✗ᴰ **taught, but absent from the 2023 decks** —
a corpus gap (Part 9), not a syllabus gap.

---

# Part 7 — Release order and cadence

## 7.1 The order

Lecture-notes order. Release order is this list, top to bottom.

| # | Topic | Session | | # | Topic | Session |
|---|---|---|---|---|---|---|
| 1 | `norman` | 2 | | 8 | `webers-law` | 5 |
| 2 | `memory` | 3 | | 9 | `gestalt` | 5 |
| 3 | `problem-solving` | 3 | | 10 | `mental-model` | 6 |
| 4 | `stroop` | 3 † | | 11 | `language` | 8 |
| 5 | `hicks-law` | 4 † | | 12 | `ergonomics` | 9 |
| 6 | `fitts-law` | 4 | | 13 | `experiment-design` | 11 |
| 7 | `visual-perception` | 5 | | | | |

† Provisional — inferred, not read off a slide. Pin these when the 2026/27 decks arrive. `fitts-law` →
session 4 is the only confirmed one in the Human-info-processing block.

`norman` in Use and Context closes what would otherwise be an empty weeks 1–2 — the worst possible gap,
since that's peak enrolment and novelty.

## 7.2 Windows close *before* the lecture

```
 D-7   previous session ends            → topic opens in COMPGame
 D-7..D-2  student does the unit        → pre-check · game · post-check · tutor
 D-2   window closes (48 h before)      → no more submissions
 D-2   report generator runs            → teacher brief written
 D-1   teacher reads the brief          → picks discussion points
 D     LECTURE (hours 1–2) · TUTORIAL (hour 3, driven by the brief)
```

Three rules fall out:

1. **The window must close before the lecture, not after.** If students can complete the unit
   post-lecture, the Understanding-first condition is contaminated by the lecture itself and the flip
   claim becomes untestable.
2. **48 hours, not 24.** The teacher needs the brief the evening before, and the LLM pass plus your own
   read-through is not instant. 24 h leaves no room for a failed run.
3. **The release endpoint also returns the arm** (FLIP/CONTROL), so one mechanism does scheduling and
   randomisation, and the arm is *recorded* rather than inferred.

## 7.3 Per-session windows, not per-block

Faithful lecture order puts 10 of 13 topics in sessions 3–6. Assigning each topic to the session that
*teaches* it, rather than to its two-session block, keeps that manageable:

| Closes before | Topics | Load |
|---|---|---|
| Session 3 (HIP 1) | `memory`, `problem-solving`, `stroop`† | ~1 h 45 m |
| Session 4 (HIP 2) | `hicks-law`†, `fitts-law` | ~1 h 10 m |
| Session 5 (Visual 1) | `visual-perception`, `webers-law`, `gestalt` | ~1 h 45 m |
| Session 6 (Visual 2) | `mental-model` | ~35 m |

Peak week ≈ **1 h 45 m** of pre-class work (~35 min/topic: pre-check 6 + game 12 + post-check 7 +
tutor 8; ~7 h across the semester). A normal flipped-classroom prep load — as *substitution*.

Per-session also protects H1: a two-week block window would leave the first lecture of the block sitting
*inside* the window, breaking §7.2 rule 1. Cost is 13 × 3 = 39 report runs instead of 18. It's a script.

## 7.4 Late policy — decide now, not in week 3

A student who opens the topic after `closes`: **open-but-flagged**. They still get the learning, their
row carries `late: true`, and the analysis excludes them from the primary gain. Locking students out of
coursework generates email you won't have time for; silently including them contaminates the data.

---

# Part 8 — Measurement design

## 8.1 Two question types, two jobs

The hybrid only works if the two formats stay strictly separate in what they're used for.

| | Fixed MC | AI short answer |
|---|---|---|
| Source | `quiz-item-banks.md` Form A/B | AI-generated probe, topic-scoped |
| Attempts | **1** | free text, one submission |
| Scored into | **H1 normalized gain ⟨g⟩** | **nothing** |
| Feeds | the paper's primary DV | the teacher report + the tutor |
| Graded by | fixed answer key, no LLM | LLM rubric → full / partial / none |
| Feedback | pre: none · post: shown | pre: none · post: Socratic turn, not a grade |

**The short-answer grade never enters the gain score.** An LLM grade has no established reliability, no
item statistics, and drifts with model version. As a descriptive measure it's defensible and
interesting; as the DV it invalidates H1.

## 8.2 The anchoring trap — the most important section in this document

If the LLM grades a post-test answer **while able to see** it's a post-test, or having seen the same
student's pre-test answer, it will anchor and inflate. That manufactures exactly the pre→post improvement
the study exists to detect. The finding becomes an artefact of the grader, and a reviewer who asks "was
grading blind?" ends the paper.

**So grading is batched, offline, and blind:**

- The student's live experience never waits on a grade. Live they get the MC key (instant, no LLM) and
  the Socratic turn (formative, not a grade).
- A separate pass collects all short answers, **strips pre/post labels and participant IDs, shuffles**,
  and grades each in isolation at `temperature=0` against a written rubric.
- Labels are re-joined after grading.

This also removes ~4 LLM calls per student per topic from the live path — Part 16 shows that's the
difference between the GPU coping and not.

## 8.3 A grading endpoint separate from `/api/socratic`

Do **not** extend `/api/socratic` to grade. Opposite requirements:

| | `/api/socratic` (exists) | `/api/grade` (new) |
|---|---|---|
| Turns | multi-turn dialogue | single-shot |
| Temperature | 0.4 (varied wording) | **0** (reproducible) |
| Goal | don't give the answer | judge the answer |
| Latency | live, student waiting | batched, nobody waiting |

`/api/grade` returns `{ level: "full"|"partial"|"none"|null, evidence: "<quoted span>", rubric_hit: [...] }`.
**Built 2026-08-21.** It also returns `evidence_verbatim`, which checks the quoted span actually
appears in the student's answer — a grade quoting text the student never wrote is the model
reasoning about a student it invented, and the batch warns loudly when any turn up.
`null` = not enough signal to grade (blank, off-topic, one word) — distinct from `"none"` (a real attempt
that misses). `null` is a missing datum; `"none"` is a data point.

**Backward compatibility:** `/api/socratic`'s `understood: true|false|null` envelope stays exactly as-is.
`rag_api.py:222-232` and `_parse_socratic` are load-bearing (the truncated-JSON leak fixed in `5fd319e`) —
do not reopen them for this. `progress-context.tsx:135`'s `reflectionInsight` keeps its meaning.

**The rubric needs human agreement evidence.** Before grades appear in the paper, double-code ~60 answers
by hand and report Cohen's κ. Below κ ≈ 0.6 the LLM grade is descriptive colour only. Half a day of work,
and the difference between a defensible measure and a decorative one. Run the same 60 through `e4b` and a
larger model and pick on evidence — grading is offline, so the 12 s live-latency floor doesn't apply.

## 8.4 Item banks: a rolling pipeline, not a prerequisite

Nine topics have no Form A/B — 90 items, plus desk review and an A/B parity check. That's a blocking
bottleneck only if every bank must exist before launch. It doesn't, for two reasons:

1. **A missing MC bank doesn't block a topic.** The AI short-answer probe works on all 13 from day one.
   A topic without a bank runs the full unit minus one step; it just doesn't contribute to the H1 gain
   until its bank lands. `mc_bank: true|false` in `topic_schedule.json` switches the step on per topic.
2. **Lecture-order release makes banks due one at a time**, a week before *their own* window:

| Bank due | Topics | Status |
|---|---|---|
| ~1 Sep | `norman` | to author — needs its 2026/27 deck first |
| ~8 Sep | `memory`, `problem-solving`, `stroop` | 2 of 3 exist ✓ |
| ~15 Sep | `hicks-law`, `fitts-law` | to author |
| ~22 Sep | `visual-perception`, `webers-law`, `gestalt` | 2 of 3 exist ✓ |
| ~29 Sep | `mental-model` | to author |
| ~13 Oct | `language` | to author |
| ~20 Oct | `ergonomics` | to author |
| ~3 Nov | `experiment-design` | to author |

Nine banks across ten weeks, each drafted from its own deck while that deck is fresh. Two conditions:
**stay one topic ahead** (a bank finished the night before gets no review, and a bad item is
unrecoverable once administered), and **the corpus rebuild comes first** (drafting `norman` items
against a corpus with zero Norman content means writing to the textbook, not to the lecture — the
Part 9.2 vocabulary mismatch, repeated nine times).

## 8.5 Feedback asymmetry

**Pre-check:** no feedback, no score, no review. Anything revealed contaminates the post-check — the
student learns from the test rather than the intervention.

**Post-check:** full feedback — correct answer, why each distractor was wrong, one line per item. This
is where the pedagogical value of testing lands, and it costs nothing because measurement is complete.

**The pre-check answer key must not be in the client bundle.** Serve pre-check items without keys and
grade server-side; ship keys only in the post-check payload. Otherwise the key is one devtools tab away,
and a class of CS students will find it.

---

# Part 9 — Corpus grounding

## 9.1 Coverage, measured

`hci_chroma_db_local/` is built from the 2023 decks. Raw term counts over the committed store
(**1407 chunks**) search the textbook name only, which *overstates* the problem — `proximity` and
`similarity` at 16 each with `Gestalt` at 0 means the content is there and only the label is missing.

**Per-topic coverage searching both vocabularies** — `python backend/check_corpus_coverage.py`:

| Coverage | Topics | Hits |
|---|---|---|
| **ZERO** | `norman`, `hicks-law` | 0 — nothing matched under any name |
| **Thin** | `webers-law` 3 · `mental-model` 7 · `stroop` 8 · `memory` 9 | one to three slides each |
| OK | `visual-perception` 120 · `problem-solving` 102 · `language` 70 · `gestalt` 63 · `ergonomics` 54 · `experiment-design` 48 · `fitts-law` 47 | well grounded |

**`webers-law` is the thinnest point in the study** — 3 hits, essentially one slide (Visual 1 p8), and
it is one of only four topics with a validated item bank. A *measured* topic resting on a single slide.

### What the tutor actually does — measured live, 2026-08-16

An earlier draft of this section claimed the model would "answer from parametric knowledge while
believing it is grounded". **That was wrong, and running it refuted it.** Against the live server:

| Asked | Corpus | Answer |
|---|---|---|
| "What does Hick's Law say about the number of choices?" | 0 chunks | *"I don't know … based on the context provided"* |
| "What is Weber's Law?" | 3 chunks | *"I don't know … based on the current lecture slides"* |
| "What are the Gestalt principles?" | 0 under that name | *"I don't know the specific Gestalt principles"* |
| **"Explain pattern recognition grouping by similarity and proximity"** | 63 chunks | **full, correct, sourced answer** |

Two things follow, and they point in opposite directions:

**The grounding rule holds.** The model refuses rather than inventing. So the risk is *not* confident
hallucination — it is a tutor that is simply **useless on those topics**, telling a student "I don't
know" about the very concept their unit is teaching. Bad, but honest, and it fails safe.

**§9.2's naming fix is now demonstrated rather than argued.** The last two rows are the same underlying
slides. Asked by textbook name the tutor refuses; asked in the lecturer's vocabulary it answers well.
`lecture_terms` is not a nicety — it is the difference between a working tutor and a useless one on
`gestalt` and `webers-law`, both of which are *measured* topics.

`check_corpus_coverage.py` reads `chroma.sqlite3` directly — no Ollama, no server — and exits non-zero
when any topic hits zero. Run it after every deck change. Word-boundary matching is deliberate: a
substring search for `Hick` matches "Anthony Sc**hick**" ten times and reports Hick's Law as well covered.

## 9.2 Two topics taught under different names — the cheapest fix here

| Game topic says | The lecture says | Where |
|---|---|---|
| "Gestalt Principles" | **Pattern recognition** — similarity, proximity, surroundedness | Visual 1 p39–75 |
| "Weber's Law" | **Just noticeable difference (JND)** under Brightness | Visual 1 p8 |

Both recover by adding the lecturer's terminology alongside the textbook name — in the topic title, the
item stems, and above all the **retrieval query**. `"Gestalt principles (pattern recognition: similarity,
proximity)"` retrieves Visual 1 p44–75; `"Gestalt"` alone retrieves nothing. Carried by `lecture_terms`
in Part 10's config.

**This is a measurement issue, not just a tutor one.** If the Gestalt and Weber item banks use vocabulary
the course never used, they measure textbook familiarity, and a pre→post gain partly reflects students
learning the *word* from COMPGame. Re-word both banks before any pilot.

## 9.3 The corpus is stale — top-priority fix

The lecturer confirms Norman, Hick's and Miller's 7±2 are taught. So the zero counts don't mean a syllabus
gap — they mean **the vector store is a stale snapshot of a course that moved on**. That's worse: a
syllabus gap you design around; a stale corpus silently degrades every AI interaction while looking healthy.

1. Get the 2026/27 decks (same email as the timetable).
2. Drop into `backend/`, run `python rebuild_db.py`.
3. Re-run `check_corpus_coverage.py`. Everything should be non-zero. If something is still zero, it's
   taught from the textbook or in tutorial — in which case the assigned Shneiderman chapters need to be
   in the corpus too.

Do this **before** authoring any item bank or wiring any unit. Every downstream component reads from this
corpus. Keep the 9.2 naming fix regardless — if the 2026/27 decks still say "pattern recognition", the
retrieval query still needs both vocabularies.

---

# Part 10 — Schedule config

Windows are **derived**, not hand-written per section: each section's window is computed from that
section's own session date, so the Tue/Wed/Thu offset staggers the cohort automatically and holiday
displacements are edited in one place.

```jsonc
{
  "cohort": "COMP3423-2627S1",
  "sections": { "A": { "day": "Tue", "size": 100 },
                "B": { "day": "Wed", "size": 100 },
                "C": { "day": "Thu", "size": 100 } },
  "window": {
    "opens_days_before": 7,       // relative to THIS section's session date
    "closes_hours_before": 48     // report needs a full day + a retry (§7.2)
  },

  // Lecture-notes order. Release order is this array, top to bottom.
  "topics": [
    { "id": "norman",            "session": 2,  "mc_bank": false },
    { "id": "memory",            "session": 3,  "mc_bank": true  },
    { "id": "problem-solving",   "session": 3,  "mc_bank": true  },
    { "id": "stroop",            "session": 3,  "mc_bank": false, "session_provisional": true },
    { "id": "hicks-law",         "session": 4,  "mc_bank": false, "session_provisional": true },
    { "id": "fitts-law",         "session": 4,  "mc_bank": false },
    { "id": "visual-perception", "session": 5,  "mc_bank": false },
    { "id": "webers-law",        "session": 5,  "mc_bank": true,
      "lecture_terms": ["just noticeable difference", "JND", "brightness"] },
    { "id": "gestalt",           "session": 5,  "mc_bank": true,
      "lecture_terms": ["pattern recognition", "similarity", "proximity", "surroundedness"] },
    { "id": "mental-model",      "session": 6,  "mc_bank": false },
    { "id": "language",          "session": 8,  "mc_bank": false },
    { "id": "ergonomics",        "session": 9,  "mc_bank": false },
    { "id": "experiment-design", "session": 11, "mc_bank": false }
  ],

  // TODO: real 2026/27 dates. Holiday displacements live HERE and nowhere else.
  "sessions": {
    "1": { "A": "2026-09-01", "B": "2026-09-02", "C": "2026-09-03" },
    "2": { "A": "2026-09-08", "B": "2026-09-09", "C": "2026-09-10" }
    // …through session 13
  }
}
```

Three fields carry findings into the running system: **`lecture_terms`** (the 9.2 naming fix, appended
to the retrieval query), **`mc_bank`** (whether Form A/B exists *today* — 4 of 13 — so the MC step
switches on per topic as banks land), and **`session_provisional`** (placement inferred, not read off a
slide; clear when the 2026/27 decks arrive).

**The gate must be server-authoritative** — not localStorage, not the client bundle. Topic availability
and order *is* the IV manipulation; a client-side gate is a suggestion, and the flip claim rests on it
not being bypassable.

---

# Part 11 — Behavioural telemetry

Two hard constraints: **aggregates, not raw traces** (a raw 60 Hz mouse stream is ~1 MB per student per
topic — 300 × 13 ≈ 4 GB into one SQLite file, for data nobody will analyse; aggregate per item at ~300
bytes and the whole study is ~12 MB), and **it changes the consent form** (Part 15).

Per item, into the existing free-form `meta` column — no schema migration (`research_store.py:62`):

| Group | Fields | Reads as |
|---|---|---|
| Pacing | `time_to_first_input_ms`, `total_time_ms`, `idle_gap_count` (>5 s), `max_idle_ms` | deliberation vs clicking through |
| Mouse | `path_length_px`, `direction_changes`, `hover_dwell_ms` per MC option | hesitation between distractors — the actual "thinking" signal |
| Choice | `selection_changes` before submit | changed their mind |
| Typing | `keystrokes`, `backspaces`, `time_to_first_keystroke_ms`, `longest_pause_ms` | composed vs dumped |
| **Integrity** | `paste_detected`, `tab_blur_count`, `total_blur_ms` | see below |
| Confound control | `input_modality` (mouse/touch), `viewport_w/h` | required by `stage2-deployment-plan.md` §B6 — Fitts' and Weber's are perceptual/motor measures, and touch vs mouse produces different numbers for the same student |

`hover_dwell_ms` per option is the highest-value field and the cheapest: a student who hovers the correct
answer for 3 s, moves to a distractor, and comes back has told you something a score cannot.

**"MC limit 1" means one *submission*, not one interaction.** Let them change selection freely before
committing — that produces `selection_changes`, which is signal. Lock after submit.

**The integrity fields are not optional.** A short-answer probe in 2026 is trivially answerable by pasting
into ChatGPT; `paste_detected` and `tab_blur_count` are the only evidence you'll have that an answer was
composed rather than fetched. Use them as **an analysis covariate and a caveat, never a punishment** —
building cheating detection into a coursework tool changes the student's relationship to it and poisons
the motivation measures. Log it, report the rate honestly in limitations, sensitivity-test with
high-blur sessions excluded.

---

# Part 12 — The teacher tutorial report

`backend/generate_tutorial_report.py` → `reports/<cohort>/<section>/<topic>-<date>.md`, run after each
topic's window closes.

```
# Weber's Law — tutorial brief     COMP3423-2627S1 · section B (Wed) · n = 94 of 100 · closed 15 Sep

## Where the class landed
MC pre 41% → post 68%   ·   short answer: full 12 · partial 24 · none 9 · ungradeable 2

## What they got                    ← "good"
1. Nearly all can state the ratio idea in their own words. Quote: "…"

## Where it broke                   ← "bad"
1. 19 of 47 treated the JND as an absolute quantity, not a proportion. Quote: "…"
2. 8 confused the Weber fraction with the threshold itself.

## Suggested discussion points      ← "what points"
1. Open with the $5-off-a-$20-shirt vs $5-off-a-$500-laptop case — 19 students need exactly this.
2. Ask the class to derive why UI progress bars use proportional steps.
3. Two students raised loudness vs brightness unprompted — worth surfacing.

## Flags
· 5 students did not complete · 3 sessions with high off-tab time (see integrity note)
```

**Two passes, not one.** Pass 1 is **code**: counts, distributions, pre→post deltas, per-item error rates.
An LLM asked to count will get it wrong, and a teacher who catches one wrong number stops trusting the
whole report. Pass 2 is the **LLM**: cluster short answers into misconception themes, pick representative
quotes, propose discussion points — given the Pass-1 numbers as fixed context it may cite but not recompute.

**Two versions every time.** Teacher version includes the SID list for non-completion follow-up and never
leaves the machine. Discussion version is anonymised and safe to project. Never generate only the first —
the moment a report with names gets screen-shared you have a data-protection incident during a study that
needed ethics approval.

---

# Part 13 — Identity, pseudonymity, versioning

## 13.1 SID vs pseudonym

"Store SID" and `stage2-deployment-plan.md` §B2's pseudonymisation argument are both right about
different things: the teacher needs to know who to follow up with; the research export must not carry
identifiers. **Split at the boundary, not at the source:**

```
student → SID (real)  ─┬─→ teacher report (SID-bearing)      · stays on the local box, never exported
                       └─→ research export: HMAC(SID, secret) · leaves the box, pseudonymous
```

**DONE 2026-08-16** — `backend/research_api.py`, 21 tests. Two holes were open until then, and both
were live rather than theoretical:

- `/api/research/export` was **completely unauthenticated and emitted real SIDs** on an
  internet-exposed tunnel. It now requires `X-Export-Token` to match `EXPORT_TOKEN`, **fails closed**
  when that env var is unset (a forgotten config must not silently expose the study), and pseudonymises
  `participant_id` with the HMAC. There is deliberately **no `?identified=1` escape hatch** — identified
  data never travels; the teacher report reads the sqlite file locally.
- `/api/research/event` took `participant_id` **from the request body**, so any student could write
  events attributed to a classmate, into the dataset the paper rests on. Identity now comes from the
  session cookie and the body field is overwritten. No session → 401, because an unattributable row is
  worse than a missing one: it pollutes the denominator.

`frontend/lib/research-log.ts` no longer sends an identity at all, and no longer hardcodes
`http://localhost:8080` — it routes through `lib/api.ts` with `credentials: "include"`, which also fixes
the §A1 "nothing works off the server machine" failure for legacy game-completion events.

Deletion-on-withdrawal still works by SID on the local box. The pseudonym is **stable for the life of
`backend/.participant_secret`** so within-subject pre→post joins survive across exports — lose that file
and past exports stop being joinable to future ones.

## 13.2 Stamp the corpus and app version on every event

> "stale then stale lor, requirement updates happen" — Wilson, 2026-08-16

Correct, and that's precisely the problem. The corpus will go stale **again** during the study.
`stage2-deployment-plan.md` Loop E names the general case — shipping a change mid-study splits the
sample — but a corpus rebuild is the sharpest version, because it silently changes what the tutor knows.
Rebuild in week 6 and students in weeks 1–5 had a materially different tutor from weeks 7–13. Unrecorded,
that's an uncontrolled variable underneath H2–H4 with no way to detect it afterwards.

1. **Prefer to freeze.** Rebuild before launch, then leave it alone. A mid-study rebuild should be a
   decision, not a side effect of someone tidying `backend/`.
2. **Stamp it regardless**, because rule 1 will eventually be broken. In `research_store.record_event` —
   **server-side, so it's authoritative and `research-log.ts` needs no change**:

   ```python
   _DB = os.path.join(os.path.dirname(__file__), "hci_chroma_db_local", "chroma.sqlite3")
   _st = os.stat(_DB)
   CORPUS_VERSION = hashlib.sha256(f"{_st.st_size}:{int(_st.st_mtime)}".encode()).hexdigest()[:12]
   ```

   Fold `corpus_version` and an `app_version` into the event's `meta` JSON — purely additive, no migration.

**Status: APPLIED 2026-08-21** in `research_store.record_event`. `corpus_version` and
`app_version` are folded into `meta` server-side on every event — purely additive, no migration,
and rows written before today simply lack the keys, which reads correctly as "predates the stamp".
Current values on this box: `corpus_version = d09e870e5ef8`, `app_version` = the short git sha.

---

# Part 14 — What 太game changes in code

Smaller than it sounds, because the games stay. What changes is what the app *leads with*.

| Surface | Now | After |
|---|---|---|
| `app/dashboard/page.tsx` (404 ln) | grid of game cards, badges prominent | list of **topic units**: locked / open until \<date\> / in progress / done |
| Entry point | student picks any game, any order | student enters the **open** topic; order is server-assigned |
| `app/games/[gameId]` | destination | step 03 *inside* a unit — keeps its own route, gains a "return to unit" contract |
| Badges / avatar | primary reward layer | secondary — kept, moved off the main path, still logged for H2 (IMI) |
| Typography | Press Start 2P throughout | **retained for the 26 game routes only.** The shell is Inter + Roboto Mono (data), ported from CUBIK. Done 2026-08-21 |
| `progress-context.tsx:89` | `playedUnderstandingFirst: current.understandingCompleted` (observed) | still recorded, **plus** the server-assigned arm — observation and assignment agree or you have a bug |

**Do not delete the badge/avatar system.** It's the H2 motivation construct's reason to exist. Demote it;
don't remove it. New: `app/topics/[topicId]/page.tsx` as the unit shell; the 26 game routes stay untouched.

## 14.1 How it was actually done — register separation, on the CUBIK system (2026-08-21)

The diagnosis that decided the design is sharper than "too game-y". The shell was set in
**Press Start 2P at 9-12px** - a face with no lowercase, no stroke contrast and a 1-bit grid,
designed to be read six feet from an arcade cabinet. It was carrying 40-word question stems. A
platform that teaches Gestalt grouping, legibility and Fitts' Law while rendering its own
instructions illegibly is undermined by its own interface. That is a credibility problem in front
of an examiner, not a matter of taste.

**The fix is not a repaint, it is two registers.**

| | Shell | Games |
|---|---|---|
| Surfaces | dashboard, topic unit, checks, probe, consent, login, badges, about | all 26 game routes |
| Type | Inter + Roboto Mono (data) | Press Start 2P + Pixelify Sans |
| Palette | CUBIK: `#006666` teal on `#FFFFFF`/`#F9FAFB`/`#F2F4F5` | unchanged arcade |
| Chrome | glass cards, `rounded-2xl`, 5%-black hairlines | 2-4px black borders, hard offset shadows |

The contrast now *means* something: stepping into a game feels like stepping somewhere else,
which it could not do while everything was equally loud.

### The palette is CUBIK's, not invented

`app/shell.css` is a **port of the CUBIK design system**, so the FYP and the venture read as the
same hand. Source of truth is `~/.antigravity/cubik-website` - its `CLAUDE.md` "Styling" section
and `src/styles/globals.css`:

- brand `#006666` primary teal, `#004d4d` dark teal
- grounds `#FFFFFF`, `#F9FAFB`, `#F2F4F5` - text `#454545` body, black headings
- **Inter**, with **Roboto Mono reserved for stats and data** - here that is SIDs, scores, counts
  and step positions, which is what makes the numbers read as deliberate rather than default
- `liquid-glass` surfaces (9 uses in cubik-website) at `rounded-2xl` (9 uses)
- `btn-primary` is **black, going teal on hover**, with a -2px lift on `cubic-bezier(.4,0,.2,1)`
- generous vertical rhythm (`py-24 md:py-32`)

**If cubik-website changes, `app/shell.css` and `app/fonts.ts` are what get updated.** Do not
drift them by hand - a second palette that "looks about right" is exactly how two products stop
looking related.

### Scoping is the safety story

Everything is under `.shell`. `globals.css` redefines Tailwind's `.text-sm` / `.text-base` /
`.text-lg` **globally** and all 26 game routes are built on top of that. Scoped, the games inherit
nothing from `shell.css` and cannot regress - verified by `git diff --stat -- frontend/app/games/`
coming back **empty**, and by screenshot.

### Three decisions inside the shell worth keeping

1. **The step rail stays a real graphic.** Everything else got quieter; the rail did not, because
   it is the one thing on the page that *encodes* something - how many steps the unit has and
   which one you are on. Structure as information.
2. **State is never hue alone.** locked / open / late / done each carry a glyph and a word as well
   as a colour. Roughly 1 in 12 men has a colour vision deficiency; failing that in an HCI
   course's own interface is not available to us. **This is an addition to CUBIK, not a deviation
   from it** - CUBIK has no state system to copy.
3. **The dashboard's avatar speech bubble became a "Next up" card.** With 13 topics on a release
   schedule exactly one is normally actionable, and naming it answers the question the student
   actually arrived with. The avatar moved to the profile card - demoted, not deleted, since the
   badge/avatar layer is H2's reason to exist.

### /about carried wrong facts, not just old styling

Restyling it surfaced content that contradicts the codebase. Fixed, each checked
against source rather than rewritten to taste:

- It listed the topics as "Fitts' Law, Gestalt Principles, **CPU Scheduling and Page
  Replacement Algorithms**". The last two are OS topics from the superseded 4-topic
  version — they are not in `lib/topic-definitions.ts`. Replaced with the real 13.
- The stack paragraph named only the frontend; the FastAPI + LangChain + ChromaDB +
  Ollama tutor, which is most of what makes this project what it is, went unmentioned.
- The header linked to `/signup`, retired when login became SID-only against the
  enrolled-SID allowlist. A dead link on the one public page.

**Removed 2026-08-21 on Wilson's instruction.** The named author, named supervisor,
"April 2025" and the personal `@connect.polyu.hk` address are gone from the product.
The address was presented as the support contact, so every account problem from 300
students would have gone to someone not running this study — and none of it belongs
on pages read during an ethics-approved run. A second copy lived in
`components/creator-footer.tsx`, which renders on the **public landing page**; that
one is gone too. `/about` now points students at "your course team", matching the
wording already used on the login and consent screens.

**This is a product fix, not a paper decision.** If COMPGame builds on a prior FYP,
the report still needs to declare it — the same way the WorldMonitor reference is
declared (`CLAUDE.md`, "Academic integrity note"). Nothing in `docs/` currently
credits prior work; that is Wilson's call, and it is a separate one from cleaning the
UI.

*(The lecturers' names in the vector store — "Johan F. HOORN and Jeff TANG" on the
slide title pages — are legitimate corpus content and were left alone.)*

### Badges: `level` was in the data and invisible

`level` (1–5) has been in the badge record all along and was never rendered — it is
the only field that says *how well*, so the row now leads with it, drawn with the same
step rail the topic unit uses (same kind of quantity, same graphic, rather than a
second invented one). Also removed: a dead `truncateEmail()` and a `goToBadgesPage()`
that navigated to the page you were already on.

### Known gap

The "Next up" card and the teal `open` chip have **never been seen with real data**, because
`topic_schedule.json` still holds placeholder dates and every topic renders `Locked`. They appear
the moment real session dates land (Part 4).

---

# Part 15 — Ethics deltas

Three changes exceed what `docs/study-pack/01_information-sheet-and-consent.md` covers. Not
paperwork-after-the-fact — running without them invalidates the dataset retroactively.

1. **Behavioural telemetry.** Mouse movement, typing dynamics and off-tab time are behavioural data about
   the participant. Must be named in the information sheet in plain language.
2. **Teacher-visible responses.** Students must know their written answers may be read by the instructor
   and quoted anonymously in tutorial. That changes what they write, so it must be disclosed before they
   write it.
3. **SID retention.** Part 13 keeps real SIDs on the local machine. Retention period, storage location and
   deletion path all need stating.

`stage2-deployment-plan.md` §B1 already flags that there is **zero** consent machinery in the app today
(`grep consent|withdraw|ethics|HSESC` → no matches). That gate is a prerequisite for everything above.

---

# Part 16 — Load math

**Deployment on the RTX 3090; the 5060 Ti is dev.** Two consequences:

1. Use `stage2-deployment-plan.md` §A's existing prescription — `OLLAMA_NUM_PARALLEL=4`,
   `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_KEEP_ALIVE=-1` — and its formula
   `sustainable req/min = 60 × OLLAMA_NUM_PARALLEL ÷ p50_seconds`. Don't reinvent either.
2. **MEASURED 2026-08-16 on the 5060 Ti dev box** (the 3090 remains unmeasured):
   `/api/ask` **~7 s** uncontended, `/api/socratic` ~8 s, p50 3.9 s per gated call (two per request).
   So `CLAUDE.md`'s ~12 s is **pessimistic even on the slower box**, and the figures below — which still
   use 12 s — are a conservative floor. Re-measure on the 3090 before the first topic opens.

   Under load: 14 concurrent requests → 6 served (median 31 s, max 46 s), 8 rate-limited, `refused: 0`.
   The concurrency gate held; nothing queued past `MAX_QUEUE`.

Dev/prod divergence worth naming: `MAX_LOADED_MODELS=2` must hold `gemma4:e4b` **and** `nomic-embed-text`
resident, because the vector leg embeds on every query. Tight in 16 GB, comfortable in 24 — so dev may be
paying model-eviction cost prod won't, a second reason the 12 s figure reads pessimistic.

| Path | Calls/student/topic | Notes |
|---|---|---|
| Live Socratic turn | ~4 | student waiting — latency-critical |
| Short-answer grading | 4 | **batched offline (§8.2)** — off the live path entirely |
| MC grading | 0 | fixed key, arithmetic |

**Per section, per topic:** 100 × 4 = 400 calls ≈ 80 min serial across a 7-day window. Worst case is the
peak week where 3 topics close before the same session (§7.3) — 1200 calls per section for the week, half
of them realistically in the final evening:

| | Serial | At `NUM_PARALLEL=4` |
|---|---|---|
| One section, peak evening (600 calls) | ~2 h | **~30 min** |
| Same night, other sections | nothing — their windows close ±24 h | — |

**The Tue/Wed/Thu split is why this is comfortable.** An earlier draft modelled 300 students as one
cohort and concluded zero headroom; with the real section structure that's wrong — the timetable does the
load-shedding for free. **Do not let the three sections drift into one window**; a holiday displacement
that collapses them triples the peak even parallelised.

Still do all three: the Ollama tuning above, keep grading batched offline, and the queue + honest wait UI
from `stage2-deployment-plan.md` §A3 — margin is not a guarantee, and a stalled page with no feedback
generates support mail at any load.

**The queue is now built** (`backend/ops.py`, wired into `/api/ask` and `/api/socratic`). Two bugs in one
change: LangChain's `.invoke()` is synchronous, so calling it from an async handler blocked the whole
event loop — §A2's "biggest load bug", where one student's 12-second tutor reply stalled every other
request including cheap ones like `/api/topics`. It now runs in a threadpool under an
`asyncio.Semaphore(OLLAMA_NUM_PARALLEL)`, and past `MAX_QUEUE` it refuses with a 503, an honest wait
estimate and a `Retry-After` rather than joining an unbounded queue. Operations detail: `docs/runbook.md`.

---

# Part 17 — Verification

Things you can run, not things you can assert.

| Claim | Check |
|---|---|
| Release gate is server-authoritative | With a locked topic, `curl` the unit endpoint directly — must 403, not just hide in the UI |
| Pre-check keys are not in the client | `grep` the built bundle for a known pre-check answer string — zero hits |
| MC is one submission | Submit, then re-POST the same item — must reject |
| Grading is blind | Run the batch twice with shuffle seeds swapped — grade distribution must be stable; then confirm pre/post labels are absent from the prompt sent to the model |
| Arm assignment matches observation | For every assessment row, server-assigned arm == `played_understanding_first`. Any mismatch is a bug, not noise |
| Pseudonym is stable | Export twice a week apart — same SID must produce the same HMAC |
| Corpus covers every topic | `python backend/check_corpus_coverage.py` — must exit 0 |
| Report numbers are real | Recompute the Pass-1 table by hand from the SQLite rows for one topic |
| GPU survives the spike | Replay 600 queued calls against the 3090 *before* the first topic opens, not during |
| Telemetry volume | After a 20-student pilot, check the `.db` size and extrapolate ×15 |
| κ is acceptable | 60 double-coded answers, report the number — including if it's bad |
| Sections stay staggered | Print the computed close times for all 13 topics × 3 sections; no two sections share one |

---

# Part 18 — What this supersedes

The reconciliation ledger. Each row is a place where an older document said something this one overrides.
All were patched on 2026-08-16 to point here rather than being left to contradict silently.

| Document | Said | Now |
|---|---|---|
| `experiment-design.md` §2 | Stage 2 = **4 topics, 2 FLIP / 2 CONTROL**, Latin-square counterbalanced | **13 topics, per-topic randomised ~50/50**, counterbalanced across the cohort (Part 0). Latin square doesn't extend to 13 topics |
| `experiment-design.md` §2 | prose says "their 3 topics", bullet says "4 topics" | Pre-existing internal inconsistency in that file; both are superseded |
| `experiment-design.md` §8 | Stage 1 = focus group; instruments run **externally via Google Form**, "do NOT wire yet" | **Stage 2 has arrived.** Instruments wire into the app (Parts 2, 8) |
| `CLAUDE.md` | "Do NOT add: Remote database / Server-side auth" | **Overridden 2026-08-16.** Server accounts, SID-only, allowlist-gated (Part 0) |
| `CLAUDE.md` | Games inventory: 4 topics / 8 games | **13 topics / 26 routes** (`lib/topic-definitions.ts`, `app/games/`) |
| `CLAUDE.md` | Storage: "All user data in browser cookies/localStorage. No remote DB" | Progress and accounts move server-side; the `user` cookie survives as UI decoration only |
| `CLAUDE.md` | Stage 1 one-group pretest–posttest, no control | Stage 2 design as above |
| `stage2-deployment-plan.md` §B2 | Replace passwords with **issued access codes** | **SID only, no secret**, allowlist-gated (Part 0). §B2's four benefits are met by the allowlist + Part 13's HMAC, except unforgeable identity, which is accepted and disclosed |
| `stage2-deployment-plan.md` §B3 | Hash credentials with `hashlib.scrypt` | No credential to hash. `auth_store.py` keeps the rest of §B3 — stdlib sqlite3, two cookies, `user` cookie shape unchanged |
| `stage2-deployment-plan.md` §B4 | "Reconcile which pre-test instrument is authoritative before launch" | **Resolved:** per-topic Form A is the H1 instrument; signup MCQ is a baseline covariate |
| `stage2-deployment-plan.md` §B5 | "Either enforce the assignment per topic or accept Stage 2 is observational" | **Resolved:** enforce, server-side (Parts 2, 7.2) |
| `quiz-item-banks.md` admin notes | Counterbalance as a 4-topic Latin square, 2 FLIP / 2 CONTROL | Per-topic randomisation across 13 (Part 0). The *principle* — each topic appears in both conditions across the sample — is unchanged |
| `quiz-item-banks.md` | Weber's and Gestalt items use the textbook names | **Re-word to the lecture's vocabulary before any pilot** (§9.2). "Weber" and "Gestalt" appear in zero corpus chunks |
| `README.md` | "All user data stored in browser cookies. No remote DB" | Server-side accounts; cookie is UI decoration (Part 0) |

**Still current and not superseded:** `stage2-deployment-plan.md` Loops A (request), C (operations),
D (data) and E (change); `experiment-design.md` §§4–7 (instruments, evidence dossier, psychometrics, APA
references); `quiz-item-banks.md` (the 4 existing banks — but re-word Gestalt and Weber's per §9.2).

---

**Built so far** (173 assertions, `python backend/tests/run_all.py`):

*Backend* — `auth_store.py` · `auth_api.py` · `schedule.py` + `topic_schedule.json` · `checks.py` ·
`topic_api.py` · `research_api.py` · `check_corpus_coverage.py` (still exits 1 on `norman`, `hicks-law`).
*Frontend* — `lib/api.ts` · `lib/telemetry.ts` (ships off) · `components/topic-check.tsx` ·
`app/topics/[topicId]` · `app/consent` · SID-only `app/login` · journey `app/dashboard`.
*Safety* — `.gitignore` blocks the SID roster, accounts DB and HMAC secret; CORS is no longer a wildcard;
the export is token-gated and pseudonymised.
*Operations* — `ops.py` (concurrency gate off the event loop, rate limiting, health snapshot) ·
`/api/health` · `backup_sink.py` (sqlite online-backup, hourly, prunes) · `docs/runbook.md`.

**Ran for real, end to end, 2026-08-16** — the whole system started for the first time: Ollama +
`rag_api` with all 15 endpoints + Next. `/api/health` returned `status: ok` with all five components
healthy. That run immediately caught a bug no unit test could: extracting the research endpoints by line
range had also deleted `_IDENTITY_PATTERNS`, so **every** `/api/ask` and `/api/socratic` call died with a
`NameError` 500. Nothing had ever executed that path.

**Still open:** the baseline pre-test has no home since signup was retired · the tutor step isn't wired
to `/api/socratic` · onboarding doesn't sync to `/api/auth/profile` · `middleware.ts` doesn't cover
`/topics` · `corpus_version` stamping (§13.2) proposed but not applied · Phases 04 (grading), 06 (teacher
report) and 07 (visual pass) not started.
