# Pre-registrations — HCI Playground flip-learning study

Public pre-registration drafts (AsPredicted / OSF style) for the study's **confirmatory** claims.
These exist to do one thing: **lock each confirmatory hypothesis and its analysis before that
analysis is run**, so a supported (or null) result cannot be a post-hoc story. Companion literature
for every hypothesis is in `docs/lit/`; the design of record is `docs/experiment-design.md` +
`docs/revamp.md`.

## Honest status (read first)

Data collection is **LIVE and ongoing** — the platform is deployed to the cohort and events accrue
as topics release. So these are pre-registrations of **analysis before analysis**, not before data
collection. That is legitimate here, and the reasons are stated plainly rather than hidden:

- Condition (FLIP/CONTROL) is **randomised and recorded automatically server-side** at each topic's
  release — not chosen by anyone, not inferred after the fact.
- Short-answer grading is an **offline, arm-blind** batch pass; MC scoring is server-side against a
  key that never ships.
- Researcher monitoring to date sees only **operational** quantities (enrolment, per-section N, arm
  balance, completion/coverage) — **not** any outcome (gain, motivation, etc.) broken down by
  condition. No one has "peeked" at a result.

The remaining discipline is simply to **file before the first condition-by-outcome analysis**. File
these then.

## Confirmatory vs exploratory map

| Paper | Hypothesis | Status | Pre-reg |
|---|---|---|---|
| **01** Does the flip work? | H1 — flip raises learning gain | **Confirmatory (primary)** | `01-flip-effect.md` ✅ drafted |
| **02** How the flip feels | H2/H3/H4 — motivation, community, satisfaction, effort | **Confirmatory (if PI commits)** | `02-affective-experience.md` ✅ drafted |
| **03** Reflection & help-seeking | reflection depth / answer-grabbing vs learning | Confirmatory **candidate** | stub below |
| **05** Transfer to master's students | flip effect holds UG→PG | Confirmatory **candidate**, HSESC-gated | stub below |
| 04 / 08 / 09 | test-taking traces / small-model / game-as-experiment | **Exploratory** — do **not** pre-register as confirmatory | — |
| 06 / 07 | classroom-RCT method / AI-tutor design | Methods & design contributions | — |

The confirmatory primaries across the filed pre-registrations (H1, and H2/H3 if `02` is committed)
are corrected **together** with Holm–Bonferroni at family-wise α = .05.

**Do not** dress 04/08/09 in pre-specified "hypothesis" language — they are exploratory measures on
the shared platform (collect-the-data), and the board's per-paper Hypothesis line for them reads as
a framing question, not a registered prediction.

---

## Stub — 03 Reflection & help-seeking *(complete only if the PI commits it as confirmatory)*

- **Q2 hypothesis:** deeper reflection and a lower rate of executive ("just tell me") help-seeking
  predict higher learning gain, within participant across topics.
- **Q3 DVs:** (a) reflection **depth** coded from the mandatory post-test reflection (generative vs
  shallow/metacognitive-only, per Bisra et al. 2018 / Chi et al. 1989); (b) help-seeking **style**
  coded instrumental vs executive from tutor logs (Aleven et al. 2016 scheme); learning gain as in
  pre-reg `01`.
- **Q5 analysis:** mixed-effects model of gain on reflection-depth and help-seeking-style scores,
  random intercepts for participant and topic. Confirmatory if committed.
- **Q8 — must pre-address:** the **2025 ACM L@S preregistered RCT (N≈1,005, Zengilowski et al.)** found a
  reflection-before-hint prompt moved neither hint use nor post-test scores — the strongest existing
  evidence for the null. Register that a null here has precedent; the added value is the *joint*
  depth × help-seeking-style coding within one AI-tutor platform, which that study did not do.
- **Blocker:** requires the reflection-depth and help-seeking coding scheme to be fixed and
  inter-rater-checked **before** any coding against outcomes.

## Stub — 05 Cross-population transfer *(HSESC-gated; complete only if the MSc arm is cleared and the PI commits it)*

- **Q2 hypothesis:** the flip's learning advantage (H1) is of comparable magnitude for the MSc
  (COMP5517) cohort as for the undergraduate cohort — i.e. **no** condition × population interaction.
- **Q3 DV:** normalised gain ⟨g⟩ as in pre-reg `01`, same instruments and schedule.
- **Q5 analysis:** the pre-reg `01` model **plus** a `condition × population` interaction term
  (multi-group approach per Talsma et al. 2023); the interaction coefficient is the confirmatory
  test. A non-significant interaction supports transfer; a significant negative interaction supports
  population-specificity.
- **Q8 — must pre-address:** Chen et al. (2018, *Medical Education*) found a **near-null/negative**
  pooled flip effect for a graduate subgroup (but on only ~4 studies), and the expertise-reversal
  literature (Tetzlaff et al. 2025) predicts a guided "learn-first" scaffold may transfer poorly to
  more expert learners. Register that a population interaction is a live, theory-backed possibility —
  not a surprise.
- **Blocker:** MSc arm inclusion is gated on the HSESC amendment (`docs/ethics-amendment-stage2.md`).
  Do not file 05 as confirmatory until that clears.

---

*See `docs/lit/README.md` for the full literature positioning and the cross-cutting finding that
motivates the replication/extension framing.*
