# Paper 03 — reflection-depth / help-seeking coding scheme

**STATUS UPDATE (2026-09-21): the harness in this section is now BUILT** — `backend/code_batch.py`
(`collect()` / `write_double_coding_sheet()` / `kappa_report()`, 58 passing assertions in
`backend/tests/test_code_batch.py`) plus the coder-facing codebook at
`docs/study-pack/10_reflection-coding-codebook.md`. What is **still not done**, and remains the
actual blocker: no human coding has happened yet. Nobody has run `--sheet`, handed the two coders
a copy each, or run `--kappa` against real transcripts, so there is no κ figure and the
pre-registration stub 03 blocker is not yet lifted — see the closing section below for exactly
what remains. Also still not built, deliberately: any automated or LLM-assisted coding pass (the
"optional LLM-assisted scale-up" row in (b) is explicitly deferred, not implemented here).

*Original framing, kept for context:* this was scoped on the strength of the 2026-09-21 decision
to **build** the scheme (`docs/lit/data-to-paper-fit.md`, "Decisions & reframes"), before the harness
below existed (`docs/lit/data-to-paper-fit.md`'s "03 — NOT INSTRUMENTED" finding, at the time still
holding).

**Why this file exists.** `docs/pre-registration/README.md` stub 03 names the exact blocker: "requires
the reflection-depth and help-seeking coding scheme to be fixed and inter-rater-checked before any
coding against outcomes." This scopes that fix so it can be built and run, without inventing a new
theory or rubric — every category below is the one already named in the paper-03 dossier and the
pre-registration stub, not a new one picked for this document.

---

## (a) The coding rubric — two axes, each tied to its cited source

Paper 03's own hypothesis, as pre-registered, is two-axis: *"deeper reflection **and** a lower rate
of executive help-seeking predict higher learning gain"* (`docs/pre-registration/README.md`, stub 03,
Q2). The rubric below codes exactly those two axes — nothing else — because that is what the
pre-registration already committed to testing (Q3):

### Axis A — Reflection depth (Bisra et al. 2018; Chi et al. 1989)

The pre-reg stub already names the categories verbatim: *"reflection **depth** coded from the
mandatory post-test reflection (generative vs shallow/metacognitive-only, per Bisra et al. 2018 /
Chi et al. 1989)"* (stub 03, Q3a). This scheme adopts that binary directly, plus one bookkeeping
category the pre-reg stub doesn't need but a coder will hit immediately:

| Code | Definition | Cited basis |
|---|---|---|
| `none` | No substantive reflection turn to code (the transcript is empty, or every counted turn is off-topic / a "just tell me" request logged as `direct: true`). | Not from the psych literature — reuses the existing `null`-as-missing-datum convention already established for short-answer grading (`docs/grading-rubric.md` "The `none`/`null` split"), so a transcript with nothing to say about depth is excluded from the depth analysis rather than silently scored as "shallow." |
| `shallow` | The student's turn is a **metacognitive self-report** — a statement about their own state of knowing/feeling ("I get it now," "that makes sense," "I'm still confused") — with no new content connection. | Bisra, Liu, Nesbit, Salimi & Winne (2018), *Educational Psychology Review* 30(3): meta-analysis finds self-explanation prompts that only elicit a metacognitive self-report produce a *smaller* effect than prompts that elicit content connections — this is the operational line the meta-analysis itself draws between prompt/response types, adopted here as the boundary between `shallow` and `generative`. |
| `generative` | The turn **constructs a content connection** — explains *why* a mechanism works, relates it to a different example or a prior misconception, or extends the tutor's explanation with a new inference, in the student's own words. | Chi, Bassok, Lewis, Reimann & Glaser (1989), *Cognitive Science* 13(2): good learners in the studied protocols produced far more of exactly this kind of self-generated explanation (15.3 vs 2.8) than poor learners, and explanation *quality* (not just presence) predicted problem-solving success — the source of "generative" as a distinct, higher category rather than a synonym for "long." |

Coded **per substantive turn** (i.e., per entry in the transcript where `direct` is not `true`), then
aggregated to a per-reflection-event summary (e.g. proportion of turns coded `generative`) for the
mixed-effects model the pre-reg's Q5 analysis specifies.

### Axis B — Help-seeking style (Aleven, Roll, McLaren & Koedinger 2016)

The pre-reg stub names this one too: *"help-seeking **style** coded instrumental vs executive from
tutor logs (Aleven et al. 2016 scheme)"* (stub 03, Q3b). The dossier spells out the same source's
definitions in full (`docs/lit/03-reflection-help-seeking.md`, Aleven et al. 2016 entry):

| Code | Definition | Cited basis |
|---|---|---|
| `none` | No help-seeking turn in this reflection (the student never asked for the answer or a hint). | Bookkeeping category, same rationale as Axis A's `none`. |
| `instrumental` | The request is **aimed at learning** — asks for a hint, an analogy, or "why," in a way that reduces future dependence on the tutor. | Aleven, Roll, McLaren & Koedinger (2016), *IJAIED* 26(1): the instrumental category from their synthesis of a decade+ of ITS help-seeking research, which associates with achievement. |
| `executive` | The request is **aimed at finishing the task** — a direct "just tell me the answer" ask, with minimal engagement with the reasoning. | Same source: the executive category, which does *not* associate with (and in the ITS "hint abuse" literature the dossier also cites — Baker et al. 2004 — actively predicts lower) learning. |

**A machine-readable proxy already exists for part of this axis and should seed, not replace, the
human code:** `reflection-dialog.tsx`'s `direct` turn flag and its `directAnswers` counter (logged in
`meta.directAnswers`, `frontend/components/reflection-dialog.tsx:92,307`) are a raw count of
"give me the answer"-type turns — the nearest thing in the logs to `executive` today, per
`docs/lit/data-to-paper-fit.md`'s own note under paper 03. It is a **count, not the classification**:
a coder still has to look at *how* a non-`direct` turn asks for help to place it as `instrumental`
vs a genuine `none`. Treat `directAnswers > 0` as a pre-filter that flags which transcripts need the
closest look on this axis, not as the code itself.

---

## (b) Coding harness — mirrors `backend/grade_batch.py`'s blind pass + `--kappa` step

The existing short-answer grading pipeline (`backend/grade_batch.py`, `backend/grade.py`) is the
house pattern for exactly this kind of problem — "score free text against a rubric, reproducibly,
without contaminating the analysis with a coder who can see the labels" — and Paper 03's two axes
are the same shape of problem, so the planned harness (working name `backend/code_reflection.py`, not
yet created) mirrors it structurally rather than inventing a new pipeline:

| Step | Grading pipeline (built, for reference) | Reflection-coding harness (planned) |
|---|---|---|
| Collect | `grade_batch.collect()` (`backend/grade_batch.py:60-91`) pulls `topic_probe`/`topic_probe_post` rows from `research_store.fetch_all()`, extracts the free-text answer out of `meta`, carries `id`/`participant_id`/`topic_id`/`phase`/`arm` along for later re-join. | `collect()` pulls `reflection_complete` (and `reflection_skipped`, for the Axis-A/B `none` case) rows the same way, extracting `meta.transcript`, `meta.turnQuality`, `meta.directAnswers`, `meta.countedTurns`, `meta.insight`, `meta.endReason` — the exact shape `reflection-dialog.tsx:295-309` already logs. Unlike the probe events, `reflection_complete` is **not** in the once-per-topic unique index (`research_store.py:160-163` lists the once-only event types explicitly and excludes `reflection_*` — the code comment at `research_store.py:132-134` says this is deliberate, because a student can legitimately replay a game and its reflection from the close-screen). So `collect()` must decide up front whether the unit of analysis is *per reflection event* or *per participant-topic* (picking, e.g., the first or the most-recorded one) — a design decision to make when this is built, not before. |
| Blind | `grade.blind()` (`backend/grade.py:253-274`): strips participant id, arm, and phase label, builds a `{tag: sha256(seed:id)[:16]}` mapping, **shuffles** deterministically under a seed so pre/post position can't leak the label. `grade.unblind()` (`grade.py:277-285`) re-joins after coding, raising loudly on an unknown tag. | Same two functions, reused as-is (no need to reinvent): a transcript carries no explicit pre/post or arm label the way a probe answer's `meta.phase`/`meta.arm` does, but it does carry the topic and student's own phrasing, so the same strip-then-shuffle discipline applies before either a human or an LLM-assisted first pass sees it. |
| Human coding sheet | `grade_batch._sample()` (`backend/grade_batch.py:248-264`): writes a blank CSV — `tag, topic_id, answer, your_grade(...), notes` — deliberately carrying **no machine grade**, "an anchored coder measures compliance, not agreement." | A blank double-coding sheet per transcript with **two** grade columns, one per axis (`reflection_depth(none/shallow/generative)`, `help_seeking_style(none/instrumental/executive)`) plus `notes` — same "no machine code pre-filled" discipline, and (unlike the short-answer grader, which is graded by the model with human spot-checks) this is coded by **two independent human coders** first, because Aleven's and Bisra/Chi's own methodologies are human-coded qualitative schemes, not machine-graded rubrics — an LLM-assisted first pass is a possible later addition (see below), not the primary coder. |
| Reliability | `grade_batch._kappa()` (`backend/grade_batch.py:267-330`) reads a hand-coded CSV, re-derives the matching machine grade by tag, and calls `grade.cohen_kappa()` (`backend/grade.py:290-315`) — agreement + kappa, with the same `docs/grading-rubric.md` threshold ("below κ≈0.6, descriptive colour only, not a measure"). | `--kappa coder_a.csv coder_b.csv`, run **twice** (once per axis), reusing `grade.cohen_kappa()` unchanged — it already treats disagreement about categories (including a `None`/`none` category) as real disagreement, which is exactly what's needed here. Same κ≈0.6 usability line as the existing grading rubric, for consistency across the two coding systems this project now runs. |
| Optional LLM-assisted scale-up | N/A — the grader *is* the model, by design (blindness is the point). | Only after the two-human kappa is itself established: an LLM-assisted first pass (same `ChatOllama` pattern as `grade.py:323-348` — temperature 0, `format="json"`, a pinned `num_predict` given the documented empty-string cliff at `grade.py:333-345`) could pre-code at the 300-student × 13-topic scale, but its output would then need to clear its **own** kappa against the two-human-coded sample before being trusted — the same "below 0.6 is descriptive colour only" rule the grading rubric already applies. This tier is explicitly deferred: build and validate the human scheme first. |

---

## (c) The data it runs on

- **Event type:** `reflection_complete` — logged client-side at `frontend/components/reflection-dialog.tsx:295-309`
  (`finish()`), with `meta: {turns, countedTurns, insight, endReason, transcript, turnQuality,
  directAnswers}`. `transcript` is the full turn history (`history: Turn[]`, each `{role: "human"|
  "assistant", content, direct?, ts?}` per the type at `reflection-dialog.tsx:21-34`); `turnQuality`
  is the per-turn `{counts: boolean|null, understood: boolean|null}[]` signal that comes from the
  Socratic model's own JSON envelope, not from student input (`backend/rag_api.py:363-373`,
  `_parse_socratic` at `rag_api.py:576-625`).
- **Escape-hatch event type:** `reflection_skipped` — logged at `reflection-dialog.tsx:312-318`
  (`leave()`) with `meta: {turns, directAnswers}` — no transcript, since nothing was finished. Useful
  for an `none` floor on both axes and for attrition accounting, not for depth/help-seeking coding.
- **Storage:** both event types land in the same `events` table every other research-sink event does
  (`backend/research_store.py:105-117`: `id, participant_id, event_type, topic_id, mode, score,
  played_understanding_first, duration_ms, client_ts, server_ts, meta`), with the free-text payload
  in the `meta` TEXT column, read back via `research_store.fetch_all()` (`research_store.py:346`+) —
  the exact same access path `grade_batch.collect()` already uses for probe answers.
  `reflection_complete`/`reflection_skipped` are **deliberately excluded** from the one-row-per-topic
  unique index (`research_store.py:160-163`, comment at `:132-134`), so a participant-topic pair can
  have more than one reflection row (e.g. the debrief-screen game replay flow) — the coding harness's
  `collect()` step needs to decide how to select among duplicates before this is built, as noted above.
- **Not surfaced by the live monitor:** `backend/researcher_api.py:173`'s `_build_monitor()` only
  calls `research_store.event_counts_by_type("questionnaire")` — a `questionnaire_*`-prefixed filter.
  `reflection_complete` volume is therefore invisible to `/api/researcher/monitor` (confirmed again
  this session, matching `docs/lit/data-to-paper-fit.md`'s paper-03 row) and must come from a direct
  `research_store.fetch_all()` read (as `grade_batch.py` already does) or the pseudonymised export —
  not from the read-only HTTP monitor pass this fit-map's grounding used.

---

## What this document is not

It is not a running coding tool, not a validated rubric, and not a kappa figure. It names the two
already-cited constructs (Bisra/Chi for depth, Aleven for help-seeking style), the exact fields the
platform already logs for them, and the harness shape to build by mirroring `grade_batch.py` — so
that building it is an afternoon of engineering against a known target, not a research-methods
open question. The blocker in `docs/pre-registration/README.md` stub 03 remains a blocker until
`code_reflection.py` exists, a coding sheet has gone out to two human coders, and `--kappa` clears
(or is reported honestly as below 0.6) on both axes.
