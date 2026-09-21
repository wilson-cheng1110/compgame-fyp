# Pre-registration — How the flip feels (H2–H4 affective bundle, confirmatory)

*Format: AsPredicted / OSF style. Draft for public filing. Companion literature dossier:
`docs/lit/02-motivation-experience.md`. Instruments locked 2026-06-22; design of record:
`docs/experiment-design.md` §3, `docs/study-pack/`.*

> **Locks the confirmatory analysis for the affective constructs BEFORE any outcome analysis is
> run.** File alongside pre-reg `01`; the primary tests of `01` and `02` form one Holm–Bonferroni
> family.

---

**1. Have any data been collected already?**

Yes — collection is **ongoing** (questionnaires are wired into the topic flow, consent-gated, one
submission per instrument). As with pre-reg `01`, **no analysis relating condition to any affective
outcome has been conducted or examined**; monitoring is limited to questionnaire *completion counts*,
not scored construct values by condition.

**2. Main question / hypotheses.**

Does the flip change how learning **feels**, net of effort cost?

- **H2 (motivation):** FLIP raises intrinsic motivation vs CONTROL.
- **H3 (community / interaction):** FLIP raises sense of learning community (game + AI tutor).
- **H4 (satisfaction):** FLIP raises course/activity satisfaction (null expected a priori).
- **Effort (Paas):** whether any felt benefit survives the added cognitive effort of the flip
  (i.e. is a motivation/community gain, if present, achieved *without* a proportionate rise in
  perceived load).

**3. Dependent variables and measurement.**

- **Motivation:** IMI (validated subscales — interest/enjoyment, perceived competence, effort,
  pressure, choice).
- **Interaction/community:** Community of Inquiry survey, **reworded** "instructor" → "game + AI
  tutor" (non-validated adaptation — flagged exploratory within this bundle).
- **Satisfaction:** ARCS-S (Attention–Relevance–Confidence–Satisfaction).
- **Cognitive load:** Paas 9-point subjective mental-effort rating.
- Reflection (open + Likert) is collected and analysed under pre-reg `03`, not here.

**4. Conditions.**

As in pre-reg `01`: **FLIP vs CONTROL**, within-subjects, randomised per participant per topic,
recorded server-side at release. Affective instruments are keyed to the participant's condition on
the topic(s) they follow.

**5. Analyses.**

For each construct, a linear mixed-effects model with crossed random intercepts:

```
construct_score  ~  condition  +  (1 | participant)  [ + (1 | topic) where per-topic ]
```

The **fixed effect of condition** is the confirmatory test per construct. **H2 and H3 are the
confirmatory primaries** of this bundle; **H4 (satisfaction) is confirmatory-null** (predicted no
effect — reported as such, not spun if null). The reworded-CoI adaptation is exploratory. Paas load
enters as a co-equal outcome and, secondarily, as a covariate to test whether an H2/H3 effect holds
net of effort.

**Correction:** the confirmatory primaries here (H2, H3) join H1 (pre-reg `01`) and are corrected
together with **Holm–Bonferroni** at family-wise α = .05.

**6. Outliers and exclusions (pre-specified).**

- **Straight-lining / careless responding** on the questionnaires flagged via a long-string /
  consistency index (method per Meade & Craig 2012); primary run with and without flagged sets.
- One submission per instrument is enforced server-side (partial unique index), so duplicates are
  not an exclusion case.
- Same account-status exclusions (withdrawn/disabled) as pre-reg `01`.

**7. Sample size.**

Enrolment-bounded (see pre-reg `01` §7). Questionnaire N is a subset of the topic cohort (a
participant must reach the questionnaire step); realised N per instrument will be reported and is
**not** used to decide whether to keep collecting.

**8. Anything else to pre-register.**

- **Registered counter-evidence to engage (not a surprise if it replicates):** van Alten et al.
  (2019) found flip has **no** effect on satisfaction; Deslauriers et al. (2019, PNAS) found active
  learning can **lower felt learning** even while raising actual learning. A flat H4 and/or a
  motivation gain accompanied by *higher* perceived load are both anticipated outcomes and will be
  interpreted against this literature — the "effort without felt benefit" branch is a real result,
  not a design failure.
- The satisfaction meta-analytic literature is itself split (Strelan 2020 positive vs van Alten
  2019 null); this bundle's contribution is measuring all four constructs **jointly**,
  within-subjects, so the felt-experience question can be adjudicated net of effort.
- **Exploratory:** the reworded CoI adaptation, any construct-by-section or construct-by-prior-score
  moderation, and correlations between affective gain and H1 learning gain.

---

*Status: DRAFT — ready for PI review and public filing. Confirmatory only if the PI commits this
bundle; otherwise it stays exploratory (Holm–Bonferroni as framed in `docs/experiment-design.md`).*
