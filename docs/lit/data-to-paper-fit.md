# Data → paper fit map

**Built 2026-09-21**, against `master` @ `362ce87`. This is the honest deliverable for deciding
which of the nine papers are actually writable **today** — every "banked / missing / thin / zero"
claim below is grounded against a file grepped or read this session, or a live count read from
production this session. Where something could not be verified this run, it says so and says why,
rather than assuming.

**Do not read this as a verdict on the science.** It is a verdict on the **plumbing**: does the
code capture the measure the paper needs, and is data for it actually accruing on the live server.
A paper can be well-instrumented and still fail its hypothesis, or poorly instrumented and still be
salvageable with a schema-free `meta` JSON addition (§8 of `docs/experiment-design.md`).

## Method (so this isn't vibes)

**Step 1 — the 9 papers, from durable sources only:** read `docs/lit/README.md`,
`docs/lit/arguments-for-against.md`, `docs/impact-grounding.md`, `docs/pre-registration/README.md`
+ `01-flip-effect.md` + `02-affective-experience.md`, `docs/experiment-design.md`, and all nine
`docs/lit/0X-*.md` dossiers for each paper's stated hypothesis/DV and "gap this paper fills".

**Step 2 — grounded against code**, read/grepped this session: `backend/questionnaires.json`,
`frontend/lib/game-telemetry.tsx`, `frontend/lib/progress-context.tsx`, `frontend/lib/telemetry.ts`,
`frontend/lib/research-log.ts`, `backend/topic_api.py`, `backend/checks.py`, `backend/grade.py`,
`backend/grade_batch.py`, `backend/measures.py`, `backend/research_store.py`, `backend/research_api.py`,
`backend/researcher_api.py`, `backend/schedule.py`, `backend/rag_api.py`,
`frontend/components/reflection-dialog.tsx`, `frontend/components/game-debrief.tsx`, and the four
psychophysics game clients (`stroop-understanding`, `hicks-law-understanding`, `webers-law-understanding`,
`fitts-law-understanding`) plus their `-assessment` counterparts. `docs/quiz-item-banks.md` item-bank
coverage and `docs/grading-rubric.md` probe coverage were checked by **running the parsers live**
(`python backend/checks.py`, `python -c "...grade.rubric_for(t)..."`), not by reading a claim about them.

**Step 3 — grounded against live prod, read-only:** reused the `frontend/.prod-admin-check.mjs`
pattern (Playwright, Admin login `SID=Admin` / `pw=Adminpassword`, staff dropped from the sink) in a
throwaway script (`frontend/.prod-monitor-check.mjs`, deleted immediately after the run — no
credentials left on disk) that hit `GET /api/health`, `GET /api/admin/whoami`,
`GET /api/researcher/whoami`, and **`GET /api/researcher/monitor`** on
`https://jeff3090.tailfb2423.ts.net`. Read at **2026-09-21, session run**. No mutation endpoint was
called (`/researcher/forget`, `/researcher/export`, `/api/research/export`, any `/admin` write route),
no account was created, no PDF/deck was generated. Counts below are copied verbatim from that one
response.

---

## Live snapshot (the numbers every per-paper section below cites)

`GET /api/researcher/monitor` (Admin session), 2026-09-21:

| Accounts | A | B | C | MSC | Total |
|---|---|---|---|---|---|
| total | 103 | 81 | 60 | 74 | **318** |
| claimed (password set) | 103 | 81 | 60 | 74 | 318 |
| withdrawn | 11 | 0 | 0 | 1 | 12 |
| disabled | 9 | 0 | 0 | 0 | 9 |

Sink: **11,100 total events, 313 distinct participants** with ≥1 event (`research_store.summary()`).
`roster_active: false`, `test_traffic_excluded: null` (no roster gating live right now, so this is
*all* traffic reaching the sink, not filtered to a class list).

Coverage (topic × participant pairs, all 13 scheduled topics pooled): **933 pairs**, 839 determinable
(has both an activity-timestamp and a post-check timestamp to compare), **838/839 = 99.9% complied**
with their assigned arm, 84 "activity never recorded", 10 "post-check not sat", 53 used the logged
escape hatch.

Per-topic arm balance + coverage (release order 1–13; only topics with ≥1 row are listed —
**topics 9–13 have zero rows**):

| # | topic | FLIP | CONTROL | determinable | complied | no_activity | no_posttest |
|---|---|---|---|---|---|---|---|
| 1 | memory | 121 | 98 | 207 | 207 | 12 | 0 |
| 2 | problem-solving | 79 | 107 | 169 | 169 | 17 | 0 |
| 3 | stroop | 102 | 77 | 157 | 157 | 21 | 1 |
| 4 | hicks-law | 75 | 92 | 162 | 161 | 4 | 1 |
| 5 | fitts-law | 92 | 77 | 133 | 133 | 29 | 7 |
| 6 | visual-perception | 1 | 5 | 6 | 6 | 0 | 0 |
| 7 | webers-law | 4 | 0 | 3 | 3 | 0 | 1 |
| 8 | gestalt | 0 | 3 | 2 | 2 | 1 | 0 |
| 9–13 | mental-model, norman, language, ergonomics, experiment-design | 0 | 0 | 0 | 0 | 0 | 0 |

Overall FLIP/CONTROL split on the five topics with real N: 469 FLIP vs 451 CONTROL (~51/49) — the
per-topic-per-participant randomisation (`backend/schedule.py:67-90`) is balancing close to the
designed ~50/50 live, not just in theory.

Questionnaire submissions (**distinct participants**, `research_store.event_counts_by_type("questionnaire")`,
`backend/researcher_api.py:173`): **imi=157, coi=157, arcs=157, paas=157, demographics=86, feedback=1**.

Health (`GET /api/health`): `status: "degraded"` — the only failing component is
`enrolment: {ok:false, enrolled:0}` (no active roster file loaded, matches `roster_active:false`
above; expected with an open-signup deployment, not a fault). `research_sink`, `accounts`,
`rag_model`, `schedule` all `ok:true`. Queue stats: `served:842, refused:0, p50_seconds:2.0` — the
Ollama-backed tutor is live and being used.

---

## 01 — Does the flip work? *(Computers & Education, H1 confirmatory primary)*

**Hypothesis/DV:** FLIP (Understanding-then-Assessment) produces higher normalised gain ⟨g⟩ on a
uniform pre/post concept inventory than CONTROL, within participant, within topic
(`docs/pre-registration/01-flip-effect.md`).

| Required measure | In code? | Collecting live? |
|---|---|---|
| IV: condition ASSIGNED per topic per participant | **INSTRUMENTED** — `backend/schedule.py:29,67-90` (`arm_for`, deterministic, server-side); `plays_game_first` set at `schedule.py:148` | Balanced ~51/49 FLIP/CONTROL across topics 1–5 (table above) |
| IV: condition OBSERVED + compliance check | **INSTRUMENTED** — `backend/measures.py:1-44,86-145` derives `played_first` from `ts(understanding_complete) < ts(topic_posttest)` and `complied` from agreement with the assigned arm (replaces the broken client-reported flag, see the module's own incident narrative) | 838/839 = 99.9% complied |
| Primary DV: ⟨g⟩ from Form A (pre) / Form B (post), 6 isomorphic items each | **INSTRUMENTED** — `backend/checks.py` (whole file) parses `docs/quiz-item-banks.md`; **ran `python backend/checks.py` this session**: all 13 topics return `"balanced": true, "A": 6, "B": 6"` (Gestalt is 5-option/20% chance, the other 12 are 4-option/25% — `bank_report()` flags this) | topics 1,2,3,5 (memory, problem-solving, stroop, fitts-law) have 133–207 determinable pairs each; hicks-law (162) is excluded from the H1 pooled estimate per pre-reg §6; topics 6–8 thin (2–6 pairs); topics 9–13 **zero** |
| Secondary: in-game assessment score, `duration_ms`, attempts | **INSTRUMENTED** — `research_store.py:105-120` schema columns `score`, `duration_ms`; attempts derivable by counting rows per (participant, topic, `assessment_complete`) | accruing alongside the above |
| Pre-specified rapid-response flag on pre/post checks | **INSTRUMENTED, not yet a pre-reg-locked rule** — `backend/measures.py:147-260` (`effort()`/`_classify()`) already computes whole-check `sec_per_item`, a `straight_lined` flag, and a 5-way verdict (`rapid guess` / `fast and correct` / `struggling` / `engaged` / `no timing`) from `duration_ms` + `meta.answers` on every `topic_pretest`/`topic_posttest` row — this is the exact signal pre-reg `01` §6 says will be "fixed before analysis"; the threshold itself (`THRESHOLD_S_PER_ITEM=5.0`) is a documented placeholder, not yet set from the cohort's own distribution | raw inputs (`duration_ms`, `meta.answers`) are flowing (same 933 pairs); the classifier is CLI-only (`check_measurement_coverage.py`, `generate_tutorial_report.py` — `measures.py:143,149` — no live API route), and was **not run against prod this session** (no shell/DB access to the remote box, by design — read-only via HTTP only) |

**Gap / still-needed:** 5 of 13 topics (9–13) have zero data — release-schedule-bound, not a code
gap. Rapid-guess threshold needs to be set from the realised distribution before the primary
analysis (pre-registered as a to-do, not a missing feature). `norman`/`hicks-law` exclusion from the
pooled estimate is a pre-registered decision, already reflected in the numbers above.

**Fit verdict: STRONG.** The entire IV→DV pipeline (assignment, compliance derivation, the concept
inventory, and an effort/rapid-guess classifier) is built, live, and self-diagnosing (the module
that derives the IV documents its own prior ten-week failure and how it was fixed). Five topics
already carry 130–207 determinable pairs at ~100% compliance — enough for an honest interim H1
read today; the full pre-registered N needs the remaining eight topics to release.

---

## 02 — How the flip feels *(Contemp. Educational Psychology, H2/H3/H4 confirmatory-if-committed)*

**Hypothesis/DV:** FLIP raises IMI motivation (H2) and CoI-reworded interaction (H3); ARCS-S
satisfaction (H4) is confirmatory-null; Paas cognitive load is a co-equal bonus outcome
(`docs/pre-registration/02-affective-experience.md`).

| Required measure | In code? | Collecting live? |
|---|---|---|
| IMI, 4 subscales (IE/PC/EI/VU), reverse-scored M9/M11 | **INSTRUMENTED** — `backend/questionnaires.json:4-92`, 12 items | **157** distinct participants |
| CoI reworded ("instructor"→"game + AI tutor"), TP/SP subscales | **INSTRUMENTED** — `questionnaires.json:93-154`, 8 items, flagged non-validated adaptation in its own `"cite"` field | **157** |
| ARCS-S + global satisfaction items | **INSTRUMENTED** — `questionnaires.json:155-216`, 8 items (5 arcs_s + 3 global) | **157** |
| Paas single-item load, per topic | **INSTRUMENTED** — `questionnaires.json:217-241` | **157** (aggregate distinct-participant count; per-topic breakdown not exposed by `/monitor`) |
| Delivery/gating: consent-gated, one submission per instrument, condition-keyed | **INSTRUMENTED** — `backend/questionnaire_api.py` (`/api/questionnaire/*`); deployment default per `deploy/start.ps1:60-62` sets `QUESTIONNAIRES_ENABLED=1` (module default is OFF otherwise) | consistent with the live counts above being non-zero |

**Gap / still-needed:** the CoI-reword construct-validity caveat is a design decision already
disclosed in `docs/experiment-design.md §3`, not a code gap. **The `/researcher/monitor` endpoint
gives distinct-participant counts, not a condition (FLIP/CONTROL) breakdown** — confirming H2/H3
actually differ by arm requires the pseudonymised export, which was explicitly out of scope for this
read-only pass; that breakdown is therefore unverified this session, by design of the check, not
because it's missing.

**Fit verdict: STRONG (instrumentation) / unverified-by-arm (this session).** All four instruments
are wired, consent-gated, and live-collecting at N=157 — roughly half the active cohort has already
completed the full post-battery. This is writable on an interim basis; the condition-level split
needs the export step this run deliberately skipped.

---

## 03 — Reflection & help-seeking *(Metacognition and Learning, confirmatory candidate)*

**Hypothesis/DV:** reflection depth × help-seeking style (instrumental vs executive) predict
learning gain, coded from the mandatory post-test reflection and tutor logs
(`docs/pre-registration/README.md` stub 03).

| Required measure | In code? | Collecting live? |
|---|---|---|
| Raw reflection transcript + turn-level signal | **INSTRUMENTED** — `frontend/components/reflection-dialog.tsx:295-309` logs `event_type: "reflection_complete"` with `meta: {turns, countedTurns, insight, endReason, transcript, turnQuality, directAnswers}`; `turnQuality`/`understood`/`counts` come from the Socratic model's own JSON envelope (`backend/rag_api.py:363-373`) | not shown by `/researcher/monitor` (only `questionnaire_*`-prefixed event types are surfaced there — `researcher_api.py:173`); volume unverified this session (export was out of scope) |
| **Reflection-depth coding** (generative vs shallow, Bisra/Chi scheme) | **NOT INSTRUMENTED** — no coding/classification of `transcript` into a depth score exists in code; `docs/pre-registration/README.md` states this explicitly as a **blocker**: "requires the reflection-depth and help-seeking coding scheme to be fixed and inter-rater-checked before any coding against outcomes" | n/a — this is a planned human-coding task, not a missing instrumentation feature |
| **Help-seeking style coding** (instrumental vs executive, Aleven 2016 scheme) | **NOT INSTRUMENTED** — grepped `backend/` and `frontend/lib/` for `instrumental`/`executive`/help-seeking classification: no matches. `directAnswers` (a raw count of "give me the answer"-type turns, `reflection-dialog.tsx:92`) is the nearest proxy in the logs, but it is a count, not the instrumental/executive classification the paper needs | same blocker as above |

**Gap / still-needed:** the raw material (full transcripts, per-turn `understood`/`counts` flags,
`directAnswers` counts) is genuinely being logged, but **both** required analytic constructs
(depth coding, help-seeking style coding) are explicitly deferred, pre-registered human-coding steps
— not started, per the pre-reg's own "Blocker" line. Live volume of `reflection_complete` rows is
unknown from this session's read (not surfaced by `/monitor`; export was out of scope).

**Fit verdict: THIN.** The logging exists to eventually support this paper, but neither of its two
DVs has a coding scheme yet, and this session could not confirm how much reflection data has even
accumulated. Confirmatory status is realistic only after the coding scheme is built and inter-rater
checked — currently a research-methods prerequisite, not a data problem.

---

## 04 — How students take the tests *(Journal of Learning Analytics, exploratory)*

**Hypothesis/DV:** response-time effort, hesitation, and straight-lining traces on the pre/post
checks predict performance and engagement, longitudinally within one course.

| Required measure | In code? | Collecting live? |
|---|---|---|
| Whole-check timing vs accuracy, chance-adjusted | **INSTRUMENTED** — `backend/measures.py:147-260`: `effort()`/`_classify()` computes `sec_per_item`, a chance-adjusted correctness comparison, and a 5-way verdict (`rapid guess`/`fast and correct`/`struggling`/`engaged`/`no timing`) directly from `duration_ms` + `meta.answers` on `topic_pretest`/`topic_posttest` rows | raw inputs flowing: same 933 topic×participant pairs as paper 01 (each pair implies a timed pre- and post-check submission); the classifier itself is CLI-only (not called from any live route) and **was not run against prod this session** |
| Straight-lining flag | **INSTRUMENTED** — `measures.py:226`: `straight_lined = n_items>=4 and len(set(answers.values()))==1` | same as above |
| Per-item (not whole-check) RT | **NOT INSTRUMENTED** — the code's own comment (`measures.py:161-163`) says per-item RTE "would need a client change"; only whole-check `duration_ms` exists | n/a |
| Hesitation/revisit/reread signal | **PARTIALLY INSTRUMENTED** — `frontend/lib/telemetry.ts`'s `ItemTracker` (pointer move, key, paste, `selectionchange`, visibility) is wired into checks/probes per `frontend/lib/game-telemetry.tsx:1-11`'s own comment ("reuses the SAME ItemTracker as the MC checks/probes... unchanged"), gated behind `TELEMETRY_ENABLED` (`backend/topic_api.py:34`, `backend/research_store.py:149-158`) | deployment default is ON (`deploy/start.ps1:60-62`), but the live env-var state was **not independently confirmed this session** (not exposed by `/api/health` or `/monitor`) |

**Gap / still-needed:** an engagement/motivation outcome to pair against the process traces (per the
dossier's "predicts performance *and* engagement" framing) — this exists via the IMI/CoI live data
(paper 02) but the two have not been joined in any code path; that join is an analysis step, not an
instrumentation gap. The rapid-guess threshold needs cohort calibration (same note as paper 01).

**Fit verdict: MODERATE-STRONG.** The core process-trace-vs-score classifier already exists and is
more built-out than the lit dossier's framing implies — it is whole-check rather than per-item, a
disclosed and reasonable simplification. The main open question is whether `TELEMETRY_ENABLED` is
actually on in prod right now, which this read-only session could not confirm.

---

## 05 — Transfer to master's students *(BJET, confirmatory candidate, HSESC-gated)*

**Hypothesis/DV:** the flip effect (H1) is of comparable magnitude for the MSc (COMP5517) cohort as
for undergraduates — no condition × population interaction (`docs/pre-registration/README.md` stub 05).

| Required measure | In code? | Collecting live? |
|---|---|---|
| Population factor (UG vs MSc) | **INSTRUMENTED** — `auth_store` section field includes `"MSC"`; confirmed live in the account table above: **74 MSc accounts (74 claimed, 1 withdrawn, 0 disabled)** | live and populated |
| Same H1 pipeline (⟨g⟩, arm, compliance) applied to the MSc section | **INSTRUMENTED** — identical code path to paper 01 (`schedule.py`, `measures.py`, `checks.py`); no MSc-specific branch or exclusion in the pipeline | **could not be separately confirmed this session** — `/researcher/monitor`'s `arms` table aggregates FLIP/CONTROL/compliance **across all sections combined**; it does not break out MSC vs A/B/C per topic, so I cannot say from this read how much of the 133–207 determinable pairs per topic (paper 01's table) come from the MSc section specifically |
| Ethics clearance to include MSc in the analysis | **NOT a code question** — per project docs, inclusion in the study analysis is HSESC-amendment-gated (`docs/ethics-amendment-stage2.md`), independent of whether the platform collects the data | n/a |

**Gap / still-needed:** a per-section breakdown of the arms/coverage table (currently aggregate-only
in `/monitor`) would be needed to know the MSc-specific N per topic without going to the export. The
HSESC amendment clearing MSc for analysis is a governance blocker, not an instrumentation one.

**Fit verdict: MODERATE-THIN.** The MSc cohort is real, live, and running through the identical
instrumented pipeline as the UG sections (74 accounts, same schema, same arm logic) — the platform
side is ready. What is unverified this session is the actual MSc-specific volume per topic (masked
by monitor's aggregation), and the paper cannot be confirmatory until the ethics amendment clears.

---

## 06 — Running a real classroom RCT *(ACM Learning @ Scale, methods/feasibility)*

**Claim:** a blinded, attrition-bounded RCT can be run inside one live course without harming
teaching or data — here is the reproducible recipe (`docs/lit/06-classroom-rct-methods.md`).

| Required "measure" (the machinery itself) | In code? | Collecting live? |
|---|---|---|
| Server-side, deterministic randomisation (not inferred, not client-chosen) | **INSTRUMENTED** — `backend/schedule.py:67-90` (`arm_for`) | confirmed balanced ~51/49 across 5 topics with real N (live table above) |
| Blinded grading | **INSTRUMENTED** — `backend/grade.py:12-22` (`blind()` strips the pre/post label + participant id + shuffles, structurally, before the model ever sees the record); `grade_batch.py:6-7,267-327` (offline batch + Cohen's kappa reliability pass) | not directly observable live (offline by design); code exists and is documented as run via `--kappa` |
| Consent-gated recording | **INSTRUMENTED** — `backend/topic_api.py:56-59` (`_consented`) checked before any event is recorded, ahead of the schedule gate | consistent with the withdrawal/disabled counts above (12 withdrawn, 9 disabled — real people exercising real exits) |
| Attrition tracking (CONSORT-shape inputs) | **INSTRUMENTED** — the live coverage block above (`pairs`, `determinable`, `complied`, `no_activity`, `no_posttest`, `took_escape`) **is** a CONSORT-diagram's inputs, already computed | **933 pairs, 84 no-activity, 10 no-posttest, 53 escape-hatch, 12 withdrawn, 9 disabled** — real numbers, today |
| Withdrawal tombstone (irreversible exit, reversible disable distinct from it) | **INSTRUMENTED** — `auth_store.py` (per project CLAUDE.md's Auth & data model section); disable vs withdraw are separately counted live (9 vs 12 above) | live |

**Gap / still-needed:** none structural — this paper needs the write-up and the attrition-bias-budget
calculation (Deke & Chiang 2017) applied to the live numbers above, which is an analysis task, not a
missing feature.

**Fit verdict: STRONG — the most writable of the nine.** Unlike the other eight, this paper's
"measure" is the machinery itself, and the machinery is demonstrably running with real, non-trivial
numbers (318 accounts, 11,100 events, 99.9% compliance, a working consent/withdrawal/disable
distinction). It could be drafted today from this session's live snapshot alone.

---

## 07 — The AI tutor *(AIED / IJAIED, design contribution)*

**Hypothesis/DV:** a Socratic tutor that withholds the answer and detects understanding beats a
plain answer-bot; tested (per the dossier) as a within-subjects, per-topic randomised comparison of
gate-vs-answer-bot on the same RAG pipeline (`docs/lit/07-ai-tutor-design.md` "Gap this paper fills").

| Required measure | In code? | Collecting live? |
|---|---|---|
| Understanding-detection gate | **INSTRUMENTED** — `backend/rag_api.py:363-373` (`understood`/`counts` JSON envelope), `:378-389` (`format="json"`, `num_predict=512`, temperature 0.4), `:576-625` (`_parse_socratic`, defensive recovery of truncated JSON) | tutor is live and serving — `/api/health` queue stats show **842 served, p50=2.0s** |
| Mandatory-turn gate fed by the detection flag | **INSTRUMENTED** — `frontend/components/reflection-dialog.tsx:104` (`canFinish = countedTurns >= REFLECTION_FLOOR \|\| insight`), fed by the model's own `counts`/`understood` flags | same as above |
| **A randomised gate-vs-plain-answer-bot comparison condition, on the same pipeline** | **NOT INSTRUMENTED** — grepped `backend/rag_api.py` for a mode/branch toggle: none found. `/api/ask` (plain, direct-answer RAG — used by `components/ai-chat-widget.tsx`, the always-on floating chatbot) and `/api/socratic` (gated — used only by `reflection-dialog.tsx`) are architecturally **separate, fixed-role endpoints for different UI surfaces**, not two randomised arms of one experimental manipulation. No code assigns a participant/topic to "gated" vs "ungated" as a controlled variable | n/a — the comparison condition literally does not exist to collect data from |

**Gap / still-needed:** the dossier's comparative hypothesis ("Socratic-gated beats plain-answer-bot,
within-subjects, per-topic randomised, same pipeline") has no experimental arm to test it against —
only the gated arm was ever built. `docs/pre-registration/README.md` already classifies 07 as a
**method/design contribution**, not a registered hypothesis test, which is consistent with what's
actually buildable from what exists: a design write-up of the gate mechanism (correlating `understood`/
`counts`/turn-count against ⟨g⟩ and IMI/ARCS, both of which are live) rather than the literal RCT the
lit dossier frames.

**Fit verdict: THIN as a comparative RCT / MODERATE as a design-and-correlational paper.** The gate
itself is real, live, and well-instrumented, and its outputs can be correlated against paper 01's
gain and paper 02's motivation/satisfaction data (both live). But the specific controlled comparison
the dossier's hypothesis describes was never built — writing 07 as posed would require either
building an ungated-answer-bot arm first, or reframing the paper around the correlational design
already collected.

---

## 08 — Can a small local model run this? *(COLM / EMNLP, exploratory/feasibility)*

**Hypothesis:** one sub-5B local model, in both a live Socratic-tutor role and an offline blind-grader
role, is good enough — and where it isn't, the failure modes are characterisable
(`docs/lit/08-small-local-model.md`).

| Required measure | In code? | Collecting live? |
|---|---|---|
| Same model backs both roles | **INSTRUMENTED, confirmed by direct read**: `backend/rag_api.py:81` — `OLLAMA_LLM = "gemma4:e4b"` (tutor); `backend/grade.py:329` — `model = os.environ.get("OLLAMA_LLM", "gemma4:e4b")` (grader) — same default model, same env-var override point | tutor role confirmed live-serving (`rag_model: {ok:true}`, 842 served, `/api/health`) |
| Role-appropriate generation params (tutor: multi-turn, temp 0.4; grader: single-shot, temp 0, pinned `num_predict`) | **INSTRUMENTED** — `rag_api.py:389` (temp 0.4, `num_predict=512`) vs `grade.py:346-347` (temp 0, `num_predict=1536`, with the module's own comment that the value "IS NOT ARBITRARY AND MUST NOT BE LOWERED", citing a measured empty-string cliff below 1024) | n/a (config, not a live count) |
| Offline blind-grading pipeline + reliability check | **INSTRUMENTED** — `backend/grade_batch.py:6-7` (`--sample-for-human`, `--kappa`), `:267-327` (`_kappa`, calls `grade.cohen_kappa`) | **could not confirm from this session whether this batch has actually been run against real student probe submissions yet** — no grading-status field is exposed by any endpoint read this session, and running it would require DB/shell access to the remote box that this read-only pass deliberately did not use |
| Material for the grader to work on (short-answer probes) | **INSTRUMENTED for 4 of 13 topics only** — **ran `grade.rubric_for(t)` for all 13 scheduled topics this session**: only `memory`, `problem-solving`, `webers-law`, `gestalt` have a probe + rubric; the other 9 (including `stroop`, `hicks-law`, `fitts-law`) return `NO-PROBE` | consistent with these 4 being the original Stage-1 study topics |

**Gap / still-needed:** whether `grade_batch.py --kappa` has actually been run on live data (i.e.
whether a reliability figure and failure-mode characterisation already exist) is unknown from this
session's read-only check — this is the single biggest open question for this paper, and it is
answerable, just not from a browser-only pass.

**Fit verdict: MODERATE.** The dual-role architecture is real and grounded in code (same model,
role-appropriate params, a documented empty-string cliff already characterised as one failure mode),
and the tutor half is confirmed live-serving. The grader half's live-execution status is unverified
this session — a live count would resolve it quickly but requires access this pass didn't use.

---

## 09 — The game is the experiment *(Cognitive Science / npj SoL, exploratory/speculative)*

**Hypothesis:** living a perceptual phenomenon (Stroop/Fitts/Weber/Hick) teaches the underlying law
better than reading about it (`docs/lit/09-game-psychophysics.md`).

| Required measure | In code? | Collecting live? |
|---|---|---|
| Stroop: per-trial RT by block (consistent/inconsistent) | **INSTRUMENTED** — `frontend/app/games/stroop-understanding/game-client.tsx:98-108`: `stroopResult = {game:"stroop", trials:[{round, block, rt_ms, timed_out}], consistent_avg_ms, inconsistent_avg_ms}`, passed to `<GameDebrief result={stroopResult}>` at line 317 | topic `stroop` has 157 determinable pairs live (paper 01 table) — **if** telemetry is on (see caveat below), this volume of games has already been played |
| Hick's: RT × number of choices | **INSTRUMENTED** — `frontend/app/games/hicks-law-understanding/game-client.tsx:73-90`: `hicksResult = {game:"hicks", trials:[{comparison_id, n_choices_a, n_choices_b, chosen,...}]}` | topic `hicks-law`: 162 determinable pairs |
| Fitts: movement time × index of difficulty (distance + size sub-canvases) | **INSTRUMENTED** — `frontend/app/games/fitts-law-understanding/debrief/page.tsx:35,48,60`: reconstructs `{game:"fitts", distance, size}` from `localStorage` across the two sub-canvas routes, passed to `GameDebrief` once both are done | topic `fitts-law`: 133 determinable pairs |
| Weber's: JND (noticed value vs base value vs theoretical Weber fraction) | **INSTRUMENTED** — `frontend/app/games/webers-law-understanding/game-client.tsx:60-70`: `weberResult = {game:"weber", trials:[{attribute, base_value, k_theory, noticed_value, jnd_pct}]}` | topic `webers-law`: only **3** determinable pairs — thin regardless of telemetry state |
| Gate: all four behind one flag | **INSTRUMENTED** — `frontend/lib/game-telemetry.tsx` (`isGameTelemetryEnabled`/`resolveEnabled`, sessionStorage-cached, server-confirmed via `topics.journey().telemetry_enabled`) → `frontend/lib/progress-context.tsx:124` (`game_result: isGameTelemetryEnabled() ? result : undefined`) → `backend/research_store.py:161-168` (server-side re-gate on `TELEMETRY_ENABLED`, belt-and-braces) | **live ON/OFF state not independently confirmed this session** — not exposed by `/api/health` or `/monitor`; deployment default is ON per `deploy/start.ps1:60-62` |
| Data comes from Understanding play, not Assessment | **CONFIRMED BY GREP**: only the `-understanding` game clients build/send a `result` prop; `stroop-assessment/game-client.tsx:288` calls `<GameDebrief gameId="stroop-assessment" score={...} totalQuestions={...}>` with **no** `result` argument — same pattern checked for the others | n/a — a design fact, not a gap |
| A "reading-only" control arm (game vs. an equally well-designed explanation), per the dossier's framing | **NOT INSTRUMENTED as such** — `backend/schedule.py:29`: `CONTROL = "CONTROL"  # Understanding game AFTER the post-check`. The platform's CONTROL is *assessment-first, game offered afterward for fairness* (not measured) — i.e. **game vs. no-game-yet**, not **game vs. reading a description of the same phenomenon**. The dossier's specific contrast (living it vs. a good explanation) has no distinct "reading" condition anywhere in the schedule/arm logic | n/a |

**Gap / still-needed:** confirm `TELEMETRY_ENABLED` is actually on in this prod deployment (would
immediately convert the 133–162-pair volumes on stroop/hicks/fitts into known trial counts); `webers-law`
is thin (N=3) independent of that; and the "reading-only" contrast the literature dossier is built
around does not exist as a platform condition — only "game-first" vs "game-after" does. A paper
framed as "game-first vs. assessment-first" is directly supported; a paper framed as "living it vs.
reading about it" is not, without adding a reading-condition arm.

**Fit verdict: MODERATE.** All four psychophysics measures are fully and correctly coded, gated, and
(for stroop/hicks/fitts) sitting on top of already-substantial topic engagement. Two real open items
prevent a stronger verdict: the telemetry flag's live state is unconfirmed, and the study's actual
CONTROL condition doesn't match the dossier's "vs. reading" framing — a genuine scope mismatch to
resolve before writing the methods section, not a missing-data problem.

---

## Summary

**Writable now, largely from what's already instrumented and live:** **06** (the RCT-machinery
paper — this session's own live snapshot could be its results table) and **01** (H1's IV/DV pipeline
is complete and 5 topics already carry good N at 99.9% compliance) are the strongest positions.
**02** is close behind — all four instruments are live at N=157 — but needs the export step (out of
scope this run) to confirm the condition-level split. **04** is stronger than the lit dossier assumed:
a whole-check effort/straight-lining classifier already exists in `measures.py`, just unrun against
prod this session.

**Needs the study to keep running:** **05** (MSc N is real at 74 but per-topic MSc volume is masked
by the aggregate monitor view, and ethics clearance for analysis is still pending), **09** (the four
psychophysics measures are solid but three of four topics need the telemetry flag confirmed on, and
`webers-law` needs more N regardless), and **08** (the dual-role architecture is real and the tutor
half is live, but whether the offline grader has actually been exercised on real data is unknown from
a read-only pass).

**Speculative / needs work before it's even collecting the right thing:** **03** (raw logs exist but
neither required coding scheme — reflection depth, help-seeking style — has been built; explicitly a
pre-registered blocker, not an oversight) and **07** (the gate mechanism is real and live, but the
specific randomised gate-vs-answer-bot comparison the dossier's hypothesis needs was never built —
only the gated arm exists; writable today only as a design/correlational paper, not as the RCT posed).

---

*Companion documents: `docs/lit/README.md` (the 9-paper index + cross-cutting finding),
`docs/lit/arguments-for-against.md` (for/against evidence per paper),
`docs/pre-registration/` (locked confirmatory analyses for 01/02, stubs for 03/05),
`docs/experiment-design.md` (the measurement architecture these all sit on).*
