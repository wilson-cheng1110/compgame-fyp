# Retention Application Bank — Short Answer (13 Topics)

> **STATUS: DRAFT, for researcher review only. NOT wired into any route yet.** This is the
> constructed-response companion to the MC retention bank (`docs/retention-item-banks.md`, Form C).
> It touches no live code by existing; like Form C, it is authored as a bank first and wired later.
>
> **Why this exists (Wilson, 2026-09-26).** "The topic is easy in MC by design; how to *apply* the
> HCI law is the hard part." MC is a recognition format — it hands the learner the answer among the
> options, so even application-framed MC can be solved by elimination without the learner being able
> to *generate* an application. The flip-learning **delayed-retention** hypothesis is specifically
> about application/transfer, so the discriminating retention DV must make the learner PRODUCE an
> application. Form C (MC) stays as the easy **recognition floor** (gross retention/decay); THIS
> bank is the hard, discriminating half. See memory `feedback-mc-recognition-not-application`.
>
> **Format.** One application scenario per topic. Each carries a **model answer** (what full credit
> covers) and a **0–2 rubric** with the key points a grader keys on:
> - **0** — no application, wrong law, or restates the scenario.
> - **1** — names/invokes the correct law but applies it shallowly or partially (one key point).
> - **2** — correctly applies the law to the scenario AND justifies it (≥2 key points, sound reasoning).
>
> **Grading (proposed).** Offline, blind, LLM-graded like the existing `topic_probe` short answer
> (`backend/grade.py` rubric path, `grade_batch.py`), NOT auto-graded MC. temperature=0. The key /
> model answer never ships to the client. A fresh scenario per topic (not the pre/post probe's
> scenario) so recall of the earlier probe answer can't carry it.
>
> **Not piloted, not desk-reviewed.** Provisional until Wilson reviews. Scenarios were authored
> against the same game/lecture concepts as Forms A/B/C; content validity, answer-leakage vs. the
> in-game assessment, and rubric calibration still need the same desk review Form C awaits.

---

## 1. Weber's Law (`webers-law`)
**Prompt.** You are designing a volume slider. A junior designer makes every pixel-step change the
volume by the same fixed amount. Users complain the slider feels over-sensitive when quiet and
sluggish when already loud. Using Weber's Law, explain *why* equal-sized steps feel uneven, and say
what you would change.
**Model answer.** The just-noticeable difference is proportional to the current level (ΔI/I = k), so
a fixed absolute step is a large *fraction* of a low volume (very noticeable) but a tiny fraction of
a high volume (barely noticeable). Make each step a roughly **constant percentage** of the current
volume (logarithmic / multiplicative steps) so every step feels like an equal change.
**Rubric key points.** (a) JND scales with baseline / ΔI/I = k; (b) fixed step = big fraction low, small fraction high; (c) fix = multiplicative / logarithmic (percentage) steps.

---

## 2. Problem Solving (`problem-solving`)
**Prompt.** A user is stuck halfway through assembling flat-pack furniture with no numbered steps.
Describe how **means–end analysis** and **working backwards** would each guide them out of the
impasse, and say which fits this situation better and why.
**Model answer.** Means–end: identify the difference between the current half-built state and the
finished piece, and pick the action that most reduces that gap, repeating forward. Working backwards:
start from the finished piece and reason what must have been attached just before, stepping back to
the current state. Working backwards fits well here because the goal state (the assembled item) is
well-defined while the forward path is not.
**Rubric key points.** (a) means–end = reduce current-to-goal gap, forward; (b) working backwards = reason from goal state toward now; (c) reasoned pick given a well-defined goal but unclear forward path.

---

## 3. Gestalt Principles (`gestalt`)
**Prompt.** You must visually group 30 settings into related clusters, but you may not use colour,
boxes, or borders. Choose a Gestalt principle, explain exactly how you would apply it, and why it
works perceptually.
**Model answer.** Use **proximity**: place related settings close together with larger gaps between
groups. The visual system groups nearby elements pre-attentively, so users perceive the clusters
instantly without any explicit divider. (Similarity via a shared shape/typographic weight is an
acceptable alternative if justified.)
**Rubric key points.** (a) names a valid principle (proximity/similarity); (b) concrete application (spacing / shared form); (c) why — perceptual grouping happens automatically, no explicit divider needed.

---

## 4. Miller's Law (`memory`)
**Prompt.** A checkout page shows a 16-digit card field and a flat menu of 20 shipping options.
Redesign both to respect working-memory limits, and justify each change with Miller's Law.
**Model answer.** Card field: display/segment the 16 digits into **4 chunks of 4**, so the user
tracks 4 chunks rather than 16 items. Menu: group the 20 options into about **5 labelled sections**,
so each section is one chunk. Both reduce the number of discrete items short-term memory must hold at
once (~7±2), lowering load.
**Rubric key points.** (a) invokes 7±2 / limited STM capacity; (b) chunk the digits (e.g. 4×4); (c) group the menu into ~5 labelled chunks.

---

## 5. Principle of Consistency / Stroop (`stroop`)
**Prompt.** In a new app, the **Delete** button is green and the **Confirm** button is red. Using
stimulus–response compatibility, explain why users will make errors — especially when rushed — and
how you would fix it.
**Model answer.** Users have a strongly learned mapping (red = stop/danger/cancel, green = go/safe).
The interface contradicts it, so the automatic response competes with the required one; under time
pressure the automatic (wrong) response wins, causing errors. Fix: restore the conventional mapping
(green = confirm, red = delete) so the signal matches the learned response.
**Rubric key points.** (a) conflicts with a learned/automatic colour mapping; (b) haste favours the automatic response → errors; (c) fix = align colours with convention.

---

## 6. Hick's Law (`hicks-law`)
**Prompt.** A TV remote has 40 buttons on one flat surface and users are slow to find any function.
Apply Hick's Law to redesign it, and explain the role of the logarithmic relationship in your choice.
**Model answer.** Decision time rises with the number of alternatives, ~log₂(n+1). Reduce the choices
facing the user at once — expose a few common functions and nest the rest under grouped menus/modes.
Note the log means splitting one big choice into two smaller ones doesn't automatically win (two
decisions add), so group by genuine task frequency/relatedness rather than blindly nesting.
**Rubric key points.** (a) RT rises with log₂(n+1) of options; (b) reduce simultaneous choices (surface common, group/nest rest); (c) awareness that nesting adds a second decision / group sensibly.

---

## 7. Fitts' Law (`fitts-law`)
**Prompt.** A frequently-used **Close** button is small and sits far from where the cursor normally
rests. Apply Fitts' Law to improve how fast users can hit it, naming both properties the law uses.
**Model answer.** Movement time depends on **distance (A)** and **target width (W)**:
ID = log₂(A/W + 0.5). Make the target **larger** (bigger W) and/or **closer** (smaller A) to the
resting cursor. Bonus: put it against a screen edge, which gives effectively infinite width because
the cursor can't overshoot.
**Rubric key points.** (a) names distance and target size (A and W); (b) enlarge target and/or reduce distance; (c) (bonus) screen-edge = effectively infinite width.

---

## 8. Visual Perception (`visual-perception`)
**Prompt.** Design a dashboard alert a driver will catch in peripheral vision without looking
straight at it. Apply what you know about the rods/cones and the structure of the retina to justify
your design.
**Model answer.** The periphery is rod-dominated: sensitive to **motion and contrast** in low light
but poor at **colour and fine detail**. So use a **flashing / moving, high-contrast** cue, not small
text or a subtle colour change (which the fovea would have to read). Keep any detail for when the
driver actually glances over.
**Rubric key points.** (a) periphery = rods, motion/contrast, weak on colour/detail; (b) design = motion/flash/high-contrast; (c) rejects fine text / colour-only as unreadable peripherally.

---

## 9. Mental Models & Affordances (`mental-model`)
**Prompt.** Users expect a trash-can icon to permanently delete a file, but in your app it only
*archives* it — and many later panic when they can't find "deleted" files. Explain the problem in
terms of mental models, affordances and signifiers, and propose a fix.
**Model answer.** Users hold a shared **mental model** (trash = permanent delete) that the system
contradicts, so they mispredict the outcome. Fix by aligning to the model (a separate, clearly
labelled Archive action) or by adding **signifiers** that reset the model — rename/relabel the action
"Archive", show where archived items go, and confirm what happened.
**Rubric key points.** (a) user mental model contradicts system behaviour; (b) distinguishes affordance (what it does) vs signifier (the cue); (c) fix = align to the model or add signifiers/labels.

---

## 10. Norman's Action Cycle (`norman`)
**Prompt.** A public information kiosk confuses people: they can't tell how to start a task, and when
they do act, nothing on screen tells them it worked. Diagnose the two problems using the **Gulf of
Execution** and the **Gulf of Evaluation**, and give one fix for each.
**Model answer.** Gulf of Execution (they can't tell how to act): make the available actions
**visible and clearly labelled** (obvious buttons, plain wording). Gulf of Evaluation (they can't
tell what happened): give **perceptible feedback** of the system's state (confirmation, progress,
result). One fix per gulf, matched to the right gulf.
**Rubric key points.** (a) identifies execution gulf = acting, and its fix (visible/labelled controls); (b) identifies evaluation gulf = perceiving outcome, and its fix (feedback); (c) fixes matched to the correct gulf.

---

## 11. Language & Ambiguity (`language`)
**Prompt.** A voice-ordering assistant keeps mis-handling ambiguous commands like "add the usual" or
"the same but bigger." Using the levels of language (syntax / semantics / pragmatics), explain where
the ambiguity lives and how you would reduce it **at the source**.
**Model answer.** These are largely **pragmatic** (and referential) ambiguities — meaning depends on
context the system doesn't share ("the usual" = which order?). Rather than repair after the fact,
constrain the input toward a small set of **unambiguous phrasings** (structured quick-replies /
confirm-and-disambiguate prompts) so fewer ambiguous commands arise.
**Rubric key points.** (a) locates ambiguity at pragmatics/reference (context-dependent meaning); (b) reduce at source (structured/constrained input) vs repair after; (c) sound example of the fix.

---

## 12. Ergonomics & I/O Devices (`ergonomics`)
**Prompt.** A supermarket cashier scans items at a station so low that they must bend their wrist
sharply upward hundreds of times a shift, and they report wrist pain. Apply physical-ergonomics
principles to redesign the station, and justify the change.
**Model answer.** Sustained wrist **extension** past a safe range, repeated at high frequency, drives
repetitive-strain injury. Reposition the scanner (raise/angle it) so the wrist stays near
**neutral**, and reduce the force/repetition (e.g. a fixed scanner the item passes over). The fit
between the body's posture limits and the task's physical demands is the ergonomic issue.
**Rubric key points.** (a) identifies sustained non-neutral wrist posture + repetition as the cause; (b) fix = restore neutral posture (reposition station); (c) frames it as body–task physical fit / reduce load.

---

## 13. HCI Experiment Design (`experiment-design`)
**Prompt.** You want to test whether a new onboarding flow improves task-success rate, but only 12
participants are available. Design the study: state the independent and dependent variables, choose a
design type and justify it for this N, and name the main threat you must control and how.
**Model answer.** IV = onboarding flow (old vs new); DV = task-success rate (or completion/time).
With only 12 people, use **within-subjects** (everyone tries both) to get enough power from few
participants. The main threat is then an **order effect** (practice/fatigue) — control it by
**counterbalancing** the order. (Naming random assignment / a specific confound is also creditable.)
**Rubric key points.** (a) correct IV and DV; (b) within-subjects justified for small N; (c) names order effect (or a confound) and counterbalancing (or the matching control).

---

## Wiring notes (for whoever wires this — NOT done here)
Mirror how the MC retention bank was wired, but on the **short-answer grading** path, not MC auto-grade:
- **Loader/router**: a companion to `backend/retention.py` (or a section of it) that parses this file
  per topic, serving only the **prompt** (never the model answer / rubric) — same "key never ships"
  rule. A new event type, e.g. `topic_retention_probe`, added to the once-only index like
  `topic_retention` was.
- **Gate order** identical to Form C: session → consent → end-of-study window
  (`schedule.end_of_study_open`) → topic COMPLETE for this sid → one-submission → record. Score is
  NOT revealed immediately (unlike MC) because it's graded offline/blind.
- **Grading**: offline blind pass via `backend/grade.py` rubric grading + `grade_batch.py`
  (temperature=0, `num_predict` ≥ 1024 per the documented cliff), keyed by the 0–2 rubric above —
  NOT the deterministic MC grader. Report as a per-topic 0–2 (or 0–1 normalised) retention-application
  score, analysed as a continuous DV alongside Form C's recognition score.
- **Frontend**: add a short-answer step to `frontend/components/end-of-study-battery.tsx` after each
  topic's MC — a free-text box (reuse the probe's short-answer input idiom), one submission.
- **Tests**: mirror `test_retention.py` (loader, key-never-ships, window/consent/complete gates,
  one-submission) + a `validate_*` structural check (every completed+banked topic has an application
  prompt + rubric).
- **Scope invariant**: does NOT touch `checks.py`, Forms A/B, `quiz-item-banks.md`, or the live
  pre/post path — same hard invariant Form C's build held.
