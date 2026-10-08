# Pre-registration — Does the flip work? (H1, confirmatory primary)

*Format: AsPredicted / OSF style. Draft for public filing. Companion literature dossier:
`docs/lit/01-flip-effectiveness.md`. Design of record: `docs/experiment-design.md`,
`docs/revamp.md` (Stage 2), `docs/study-pack/06_scoring-codebook-analysis.md`.*

> **This pre-registration locks the confirmatory analysis for H1 BEFORE any outcome analysis is
> run.** It is the single confirmatory test of the portfolio's flagship hypothesis; every other
> analysis in this study remains exploratory.

---

**1. Have any data been collected for this study already?**

Yes — data collection is **ongoing**. The platform is live to the enrolled cohort and events are
accruing as students work through released topics. However, **no analysis relating experimental
condition to any learning outcome has been conducted or examined.** Randomisation (FLIP/CONTROL per
topic per participant) is assigned and recorded automatically server-side at each topic's release;
short-answer grading is performed by an offline, arm-blind batch pass; and researcher monitoring to
date is restricted to operational quantities (enrolment, per-section N, arm balance, completion /
coverage), which do **not** expose the pre-vs-post gain by condition. This is a pre-registration of
the analysis plan filed before that analysis, not before data collection — declared here in full so
the confirmatory status is honest.

> **Disclosure — revision of 2026-10-08 (an interim look HAS now happened).** Before this plan was
> filed, one unregistered interim condition-by-outcome analysis was run on the pseudonymised export
> (232 participants with both conditions; 9 H1 topics released). Results, reported here in full so
> nothing is hidden: mixed model on post with pre as covariate, completers, FLIP − CONTROL
> **+1.17 points / 100, 95% CI [−0.28, +2.63], p = .11**; intention-to-treat (missing post = pre)
> **+0.85, 95% CI [−0.59, +2.30], p = .25**; ⟨g⟩ FLIP 0.565 vs CONTROL 0.448. Attrition before the
> post-check: FLIP 38 vs CONTROL 6 participant × topic rows. That look prompted the change of primary
> DV and dataset below (⟨g⟩ → covariate-adjusted post score; completers → intention-to-treat). The
> reasons are measurement properties, not the direction of the result: post scores are ceiling'd and
> 7-valued, and ⟨g⟩ is bounded above at 1 but unbounded below, so a few large negative values move
> the mean. The revised primary yields a **smaller** FLIP estimate than ⟨g⟩, so the change does not
> favour H1. Either outcome — FLIP helps, or it does not — is reported as a finding. Because of this
> look, H1 is reported as **confirmatory with a disclosed interim analysis**, and the final estimate
> is computed once, on the full immediate-check dataset, after the last topic closes.
>
> **Second disclosure — 2026-10-09.** A follow-up exploratory look found that participants who left
> the check's page scored higher within-student (pre-check +7.0, post-check +5.5 points, controlling
> time on page) — interpreted as **external help**, source not identified — and that FLIP
> participants left the page less on the post-check (−6 points; no difference on the pre-check).
> H1 re-estimated with a pre-check "left the page" covariate: **+1.35** (95% CI −0.13 to +2.84,
> p = .07; same pairs without it +1.32). Pre-checks taken without leaving the page had a mean of
> 78.9 vs 84.1 overall. This prompted sensitivity analysis (e) in §5; it does not change the primary.

**2. What's the main question / hypothesis?**

**H1 (confirmatory):** For the same learner and the same topic, completing the interactive
*Understanding* module **before** the assessment (FLIP) produces a higher conceptual learning gain
than completing the assessment without the prior Understanding module (CONTROL). Directional,
one-sided in prediction; tested two-sided.

**3. Dependent variable(s) and how measured.**

- **Primary DV:** **post-check score (0–100), with the pre-check score as a covariate**, on a
  uniform conceptual pre/post concept inventory (parallel **Form A / Form B**, 6 items per form),
  administered as the pre-check and post-check steps of each topic unit and scored server-side
  against a key that never ships to the client. Analysed at the participant × topic level.
- **Descriptive only (not a test):** Hake normalised gain ⟨g⟩ = (post − pre) / (100 − pre), reported
  for comparability with the flipped-learning literature, with its known bias stated (bounded above
  at 1, unbounded below, undefined at pre = 100; inflated near ceiling).
- **Secondary DVs (exploratory, listed for completeness):** in-game assessment score, time-on-task /
  duration, and attempt count per topic.

**4. Conditions.**

Two, **within-subjects and within-topic**: **FLIP** (Understanding-then-Assessment) vs **CONTROL**
(Assessment without prior Understanding). Condition is randomised **per participant per topic**
(~50/50), counterbalanced across the cohort, and assigned/recorded at release time — never inferred
from completion order. Each participant therefore contributes both conditions across the topic set.

**5. Analyses to test the main hypothesis.**

Linear mixed-effects model on the post-check score, pre-check as covariate, with **crossed random
intercepts** for participant and for topic, on the **intention-to-treat** dataset (every
participant × topic with a scorable pre-check; a missing post-check is set to the pre-check score,
i.e. "no change" — conservative given attrition is higher under FLIP):

```
post_pt  ~  condition  +  pre_pt  +  (1 | participant)  +  (1 | topic)
```

The **fixed effect of condition** (FLIP − CONTROL, in points out of 100) is the confirmatory test;
H1 is supported if its estimate is positive with a two-sided *p* < .05 (95% CI excluding 0). Random
slopes for condition by topic will be added if the model converges; if it does not, the
intercepts-only model above is the pre-specified primary. The estimate and its CI are reported
whatever their direction; a CI that excludes effects above a few points is reported as evidence
**against** a large immediate benefit, not as "no result".

**Pre-specified sensitivity analyses (reported alongside, not substituted for, the primary):**
(a) the same model on **completers only** (scorable pre and post); (b) **ceiling-aware**: logistic
GEE on P(post = 100) ~ condition + pre + topic, clustered by participant; (c) the primary re-run
**excluding rapid-response attempts** (§6); (d) ⟨g⟩ by condition, descriptive only (§3);
(e) **external help on the pre-check**: the primary with a covariate for whether the participant
left the check's page during the PRE-check (any item `tab_blur_count` > 0; per-item telemetry,
recorded from 2026-09-10 — earlier pairs carry no flag and are reported separately), plus the
primary restricted to pre-checks taken without leaving the page. Only the PRE-check flag is used:
leaving the page during the POST-check happens after the manipulation and differs by condition
(FLIP 6 points less often at the interim), so adjusting for it or filtering on it would condition
on a post-treatment variable and is not done.

**Confirmatory family & correction:** H1 is the single primary test. Should the affective bundle
(pre-registration `02`) be filed as confirmatory alongside it, the primary tests across the two
pre-registrations are corrected together with **Holm–Bonferroni** at family-wise α = .05.

**6. Outliers and exclusions (pre-specified).**

- **Topic exclusions from the H1 primary:** `norman` and `hicks-law` are analysed **separately**,
  not pooled into the H1 estimate — both have zero lecture-corpus coverage, so their gain is not
  comparable to the lecture-backed topics (decision of record, 2026-08-30). `webers-law`'s in-game
  assessment is **perceptual, not a knowledge quiz**, so its behavioural measure is excluded from
  the conceptual-gain DV and reported as a separate perceptual measure.
- **Rapid-response / non-effortful check attempts** (Wise & Kong 2005; Kong et al. 2007), rule
  fixed 2026-10-08: an item response is **rapid** when its time is below **10% of that item's
  median response time across all participants, capped at 10 s** (normative threshold NT10,
  Wise & Ma 2012). Item time is the per-item telemetry `total_time_ms` where recorded (from
  2026-09-10) and the submission's duration ÷ item count otherwise. A check submission is
  **flagged** when at least half its items are rapid. The primary is run with and without flagged
  pre/post rows and both are reported, with flag rates by condition. (For scale: a crude
  < 5 s/item rule flagged ~17% of submissions at the 2026-10-08 interim; NT10 is expected to flag
  fewer, because many fast answers on easy items are simply known.)
- **Attrition:** the primary is intention-to-treat (§5) — a participant × topic contributes if it has
  a scorable pre-check; completers-only is sensitivity analysis (a). Differential attrition by
  condition is reported (a CONSORT-style diagram; attrition bias budget per
  `docs/lit/06-classroom-rct-methods.md`) — at the 2026-10-08 interim it was FLIP 38 vs CONTROL 6
  rows, concentrated in `gestalt` and `fitts-law`.
- Withdrawn / disabled accounts are excluded per the study's withdrawal tombstone rule.

**7. Sample size.**

Not power-planned in the conventional sense: the sample is a **fixed captive cohort** — the enrolled
COMP3423 sections (~315 undergraduates across 3 sections) plus the added MSc COMP5517 section
(its inclusion cleared; see pre-reg `05`). Sample size is therefore **enrolment-bounded**, and
data collection ends when the topic release schedule closes. Sensitivity (not power planning): with
a within-subjects, within-topic design over up to **11** H1-eligible topics and N in the hundreds,
the design is well powered to detect even a small condition effect (⟨g⟩ difference well below the
d ≈ 0.2–0.5 range reported by flip meta-analyses, Bredow et al. 2021; Sinha & Kapur 2021). A
precise minimum-detectable-effect will be reported from the realised N and intraclass correlations,
**not** used to decide whether to keep collecting.

**8. Anything else to pre-register.**

- **Positioning:** H1 is framed as a **within-subjects, multi-topic replication/extension**, not a
  first demonstration — the nearest prior test is DeCaro et al. (2026, BJEP; explore-first vs
  instruct-first with a knowledge assessment). The paper will engage this directly.
- **Declared boundary condition (registered so it is not treated as a surprise):** Saba, Kapur &
  Roll (2025) found exploration-first can **lower immediate** post-test gain while benefiting
  transfer. The primary DV here is an **immediate** post-check, so a null or reversed H1 has
  documented precedent and will be interpreted as a boundary condition (immediate gain vs transfer),
  not as a failure of the design. A **delayed** measure is now instrumented — the end-of-study
  battery (Form C retention MC + an application short-answer probe, window ~2026-11-23..26). Its
  analysis is **not** registered here; it will be pre-registered separately **before that window
  opens**, so a null on immediate gain still does **not** license a post-hoc transfer claim.
- **Exploratory (not confirmatory):** all secondary DVs (§3), per-topic heterogeneity of the effect,
  and any moderation by section, prior score, or completion behaviour.

---

*Status: DRAFT, revised 2026-10-08 — primary switched to covariate-adjusted post score on the
intention-to-treat dataset, ⟨g⟩ demoted to descriptive, and one interim look disclosed in §1. File
before the final immediate-check analysis is run.*
