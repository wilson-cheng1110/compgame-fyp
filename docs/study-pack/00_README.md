# COMPGame — Stage 1 Focus-Group Study Pack

Ready-to-administer materials for the COMPGame flip-learning study (COMP3423 HCI, PolyU FYP).
Everything here can be run on **paper or as a Google Form**, with no app instrumentation
required (Stage 1 is external by design — see `experiment-design.md` §8 staging note).

## Design for this stage — read first

This pack runs a **one-group pretest–posttest** study. Every participant goes through the
**flipped** sequence for each topic (per-topic pre-test → *Understanding* game → *Assessment*
game → post-test → short load rating), then completes the post questionnaire battery.

This is a deliberate **simplification of the locked design** in `experiment-design.md` §2,
which specifies a within-subjects 2-FLIP / 2-CONTROL Latin-square. At focus-group scale a
clean counterbalanced control is not feasible, so there is **no control condition** here —
just the standalone pre/post on the same people. The cost is honest and must be stated in the
write-up: a one-group pre/post has **no counterfactual**, so a pre→post gain cannot be
cleanly attributed to the flip sequence rather than to testing effects, practice, or
maturation (Campbell & Stanley, 1963). Treat Stage 1 as **formative instrument-and-flow
validation plus a feasibility-signal effect size**, not a confirmatory test of H1–H4. The
counterfactual returns at Stage 2 (wide rollout) when N supports a comparison group. The full
rationale and the limitation paragraph for the paper are in `06_scoring-codebook-analysis.md`
§A and the addendum at the end of this file.

## What maps to what (constructs → instruments)

| # | Construct | Instrument | When | File |
|---|-----------|-----------|------|------|
| H1 | Learning performance | Concept inventory, Form A (pre) / Form B (post), 6 isomorphic items × 4 topics | Pre **and** post, per topic | `03_concept-inventory.md` |
| H2 | Motivation | IMI short form — interest/enjoyment, perceived competence, effort, value (12 items) | Post | `04_post-questionnaire.md` §1 |
| H3 | Interaction | CoI — Teaching + Social Presence, reworded "instructor"→"the game and AI tutor" (8 items) | Post | `04_post-questionnaire.md` §2 |
| H4 | Satisfaction | ARCS-Satisfaction subscale + 3 global items (8 items) | Post | `04_post-questionnaire.md` §3 |
| — | Cognitive load (context, not an H) | Paas single-item, 9-point, per topic | After each topic | `05_reflection-and-load.md` §2 |
| — | Reflection (qualitative "why") | 3 open prompts + 4 self-perceived-learning Likert | After last topic | `05_reflection-and-load.md` §1 |

**Study topics (4):** Weber's Law, Problem Solving, Gestalt Principles, Miller's Law.

## Response scales

- **Concept inventory (H1):** multiple choice, scored % correct → Hake normalized gain ⟨g⟩.
- **All questionnaires (H2/H3/H4, reflection Likert):** 5-point Likert,
  `1 = strongly disagree … 5 = strongly agree`, for cross-instrument comparability.
  - *Note:* IMI is natively a 7-point scale; it is administered here on the project's
    common 1–5 scale. This is a deliberate adaptation (disclosed in the scoring doc) — report
    that the IMI 1–5 form was used, not the original 7-point.
- **Cognitive load (Paas):** single 9-point item, `1 = very, very low mental effort …
  9 = very, very high mental effort`.

## File index

| File | Contents | Audience |
|------|----------|----------|
| `00_README.md` | This file — design, mapping, order | Researcher |
| `01_information-sheet-and-consent.md` | Participant information sheet + informed consent | Participant |
| `02_demographics.md` | Background / demographics questionnaire (pre) | Participant |
| `03_concept-inventory.md` | H1 Form A (pre) + Form B (post), 4 topics × 6 items — **no answer marks** | Participant |
| `04_post-questionnaire.md` | H2 IMI + H3 CoI + H4 ARCS battery — **no scoring marks** | Participant |
| `05_reflection-and-load.md` | Reflection (open + Likert) + Paas cognitive load | Participant |
| `06_scoring-codebook-analysis.md` | Answer keys, reverse-scored flags, subscale maps, Hake gain, variable codebook, analysis plan | Researcher only |
| `07_facilitator-protocol.md` | Session script, order of administration, timing, integrity checks | Researcher / facilitator |

> **Keep `06_scoring-codebook-analysis.md` away from participants** — it holds the answer keys.
> Participant-facing files (01–05) are deliberately free of answer marks and reverse-score flags.

## Administration order (per participant)

```
1. Information sheet + consent            (01)         ~3 min
2. Demographics                           (02)         ~3 min
   For each of the 4 topics, in turn:
3.   Concept inventory Form A (pre)        (03, this topic)
4.   Understanding game  → Assessment game  (in app)
5.   Concept inventory Form B (post)        (03, this topic)
6.   Paas cognitive-load item               (05 §2, this topic)
7. Reflection (open + Likert)             (05 §1)      ~3 min
8. Post questionnaire: IMI + CoI + ARCS    (04)        ~8 min
```

Full timing, the two-session option, and the facilitator script are in `07_facilitator-protocol.md`.

---

## Addendum — design-change record (for the supervisor / methods section)

The measurement model in `experiment-design.md` (locked 2026-06-22) was authored around a
within-subjects flip-vs-control comparison. For the Stage-1 focus group this pack drops the
control condition and runs a **single-group pretest–posttest** on the flipped sequence only.

- **Unchanged:** the four constructs (H1 performance, H2 motivation, H3 interaction, H4
  satisfaction), all instruments, the Hake ⟨g⟩ scoring of H1, the exploratory framing, and the
  CoI non-validation caveat.
- **Changed:** H1 is now a **within-person pre→post gain** (paired, single group), not a
  flip-vs-control contrast. H2/H3/H4 are **single post administrations** reported
  descriptively. No Latin-square / counterbalancing is applied because there is one condition.
- **Limitation introduced (must disclose):** without a control or counterbalanced comparison,
  observed gains are confounded with testing/practice/maturation effects. The isomorphic A/B
  forms mitigate the *testing effect* specifically, but not maturation. Stage 1 therefore
  reports effect sizes as **feasibility signal**, and the causal claim waits for Stage 2.

When Stage 2 reintroduces the control arm, `experiment-design.md` §2 applies again unchanged.
