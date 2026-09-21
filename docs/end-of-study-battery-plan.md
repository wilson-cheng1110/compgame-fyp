# End-of-study battery — delivery plan (retention + per-topic affect recall)

**Status:** SPEC, approved by Wilson 2026-09-22. Not yet built. Runs at study end
(~2026-11-23…26), so there is time to build it in safe stages before then. HSESC:
covered (PI-confirmed 2026-09-22) — retention re-testing + per-topic affect are inside
the current amendment.

## What it collects (one end-of-study batch, per student)
For **each topic the student COMPLETED**, in one final sitting:
1. **Retention** — the topic's **Form C** (`docs/retention-item-banks.md`; 6 items, 8 for
   `experiment-design`), multiple choice. Measures retained understanding weeks after the
   post-test. DV: delayed score, and retention loss `C% − B%`; interval = weeks between the
   topic's post-test and this sitting, entered as a covariate.
2. **Affect recall** — 3 items (enjoyment · perceived learning · effort), 5-pt, BY TOPIC
   NAME. Retrospective; PAAS stays the prospective per-topic anchor.

Both joined **server-side** to that topic's arm (`schedule.arm_for`) + per-topic gain
(`measures.per_topic`). Never ask about the arm — students don't know their condition.

## Decisions locked (Wilson)
- **Unlock trigger:** GLOBAL researcher-set window (not per-student-completion), keyed to the
  section's **last lecture**: MSC Mon **2026-11-23**, A Tue **11-24**, B Wed **11-25**, C Thu
  **11-26** (VERIFY against `backend/topic_schedule.json` at build time). Researcher-controlled
  flag/date; battery shown once, consent-gated.
- **Retention grading:** SERVER-SIDE auto-grade (MC is deterministic — like the pre/post
  checks). Score to the sink immediately; **key never ships**. No LLM, no blinding (that is the
  short-answer probe's concern, not MC's).
- **Retention scope:** all completed topics; interval as a continuous covariate.
- **Form C:** fresh isomorphic items; `experiment-design` carries bonus C7 (H₀/Hₐ) + C8
  (confound-diagnosis), 8 items — scoring may treat those as a separate bonus block.

## Build (staged; each stage tested + landed before the next)
1. **`affect_recall` instrument** — 3 items in `backend/questionnaires.json` via
   `build_questionnaires.py`, served by the EXISTING `questionnaire_api` (topic-scoped like
   PAAS, `questionnaire_affect_recall`). Smallest, lowest-risk, reuses proven machinery.
2. **`backend/retention.py` + `/api/retention/*`** — its OWN Form-C loader (parse
   `docs/retention-item-banks.md`; **do NOT touch live `checks.py`**), serve items key-stripped
   per completed topic, server-side auto-grade, record `topic_retention` (score per topic).
   Consent-gated + window-gated + staff-dropped, like every recorded path. Tests: parse, grade,
   key-never-ships, one-submission-per-topic, window gate.
3. **End-of-study frontend flow** — one page/wizard that walks the student's completed topics
   (retention MC then affect recall per topic), gated on the window + consent, shown once
   (pattern: `feedback-card.tsx` post-completion, but a per-topic loop). e2e coverage.
4. **Measures + dashboard** — `retention_by_arm(db)` + `affect_recall_summary(db)` in
   `measures.py`; surface on `/researcher` papers 01 (retention DV) + 02 (affect). Aggregate
   + pseudonymised only, same gate.

## Window mechanism (to finalise at build time)
A researcher-set config (a date/flag; per-section unlock after that section's last lecture is
the natural default given the 4 dates). The battery is available from that date; set a CLOSE
deadline. Keep it a config value the researcher controls, not a code change per run.

## Open / verify at build time
- Exact last-lecture dates per section (verify vs `topic_schedule.json`).
- Window CLOSE deadline (how long after opening).
- Whether the frontend walks ALL completed topics at once (long) or paginates.

See [[end-of-study-measurement-expansion]] memory for the wider decision context (papers 02/04
handling, 07 free-chat capture — already shipped).
