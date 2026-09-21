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

**2. What's the main question / hypothesis?**

**H1 (confirmatory):** For the same learner and the same topic, completing the interactive
*Understanding* module **before** the assessment (FLIP) produces a higher conceptual learning gain
than completing the assessment without the prior Understanding module (CONTROL). Directional,
one-sided in prediction; tested two-sided.

**3. Dependent variable(s) and how measured.**

- **Primary DV:** Hake normalised gain ⟨g⟩ = (post − pre) / (100 − pre) on a uniform conceptual
  pre/post concept inventory (parallel **Form A / Form B**, 6 items per form), administered as the
  pre-check and post-check steps of each topic unit and scored server-side against a key that never
  ships to the client. Analysed at the participant × topic level.
- **Secondary DVs (exploratory, listed for completeness):** in-game assessment score, time-on-task /
  duration, and attempt count per topic.

**4. Conditions.**

Two, **within-subjects and within-topic**: **FLIP** (Understanding-then-Assessment) vs **CONTROL**
(Assessment without prior Understanding). Condition is randomised **per participant per topic**
(~50/50), counterbalanced across the cohort, and assigned/recorded at release time — never inferred
from completion order. Each participant therefore contributes both conditions across the topic set.

**5. Analyses to test the main hypothesis.**

Linear mixed-effects model on the topic-level gain with **crossed random intercepts** for
participant and for topic:

```
gain_gt  ~  condition  +  (1 | participant)  +  (1 | topic)
```

(equivalently, a model on post-test score with pre-test as a covariate and the same random-effects
structure, reported as a robustness check). The **fixed effect of condition** (FLIP − CONTROL) is
the confirmatory test; H1 is supported if its estimate is positive with a two-sided *p* < .05 (95%
CI excluding 0). Random slopes for condition by topic will be added if the model converges; if it
does not, the intercepts-only model above is the pre-specified primary.

**Confirmatory family & correction:** H1 is the single primary test. Should the affective bundle
(pre-registration `02`) be filed as confirmatory alongside it, the primary tests across the two
pre-registrations are corrected together with **Holm–Bonferroni** at family-wise α = .05.

**6. Outliers and exclusions (pre-specified).**

- **Topic exclusions from the H1 primary:** `norman` and `hicks-law` are analysed **separately**,
  not pooled into the H1 estimate — both have zero lecture-corpus coverage, so their gain is not
  comparable to the lecture-backed topics (decision of record, 2026-08-30). `webers-law`'s in-game
  assessment is **perceptual, not a knowledge quiz**, so its behavioural measure is excluded from
  the conceptual-gain DV and reported as a separate perceptual measure.
- **Rapid-response / non-effortful check attempts:** pre/post responses completed below a
  rapid-response time floor (two-state solution-vs-rapid-guessing threshold, method per
  Wise & Kong 2005 / Kong et al. 2007) are flagged; the primary is run both with and without these,
  and the flagging rule is fixed before analysis.
- **Attrition:** a participant × topic contributes only if it has a scorable pre **and** post for
  that topic. Differential attrition by condition is reported (a CONSORT-style diagram; attrition
  bias budget per `docs/lit/06-classroom-rct-methods.md`).
- Withdrawn / disabled accounts are excluded per the study's withdrawal tombstone rule.

**7. Sample size.**

Not power-planned in the conventional sense: the sample is a **fixed captive cohort** — the enrolled
COMP3423 sections (~315 undergraduates across 3 sections) plus the added MSc COMP5517 section
(its inclusion HSESC-gated; see pre-reg `05`). Sample size is therefore **enrolment-bounded**, and
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
  not as a failure of the design. No transfer/delayed measure is currently instrumented; a null on
  immediate gain does **not** license a post-hoc transfer claim.
- **Exploratory (not confirmatory):** all secondary DVs (§3), per-topic heterogeneity of the effect,
  and any moderation by section, prior score, or completion behaviour.

---

*Status: DRAFT — ready for PI review and public filing. File the confirmatory version before the
first condition-by-outcome analysis is run.*
