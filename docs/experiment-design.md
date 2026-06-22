# COMPGame — Flip-Learning Experiment Design & Measurement Plan

> Research instrument plan for measuring the effectiveness of the
> Understanding-then-Assessment (flip) sequence in COMPGame, augmented by an AI tutor.
> Every instrument and effect size below is drawn from a published, linkable source
> (see [References](#references)). Page numbers / volume-issue for the newer
> meta-analyses must be verified against the source before paper submission — the
> URLs are the ground truth actually retrieved.

---

## 1. Session flow (participant timeline)

| Step | Activity | ~Time |
|------|----------|-------|
| 1 | Intro + informed consent | 3 min |
| 2 | Demographics + prior-knowledge **pre-test** + 4 baseline motivation items | 7 min |
| 3 | Choose **3 games**, each an Understanding learning game (~10 min) | 30 min |
| 4 | Assessment module (scored) | ~8 min |
| 5 | Short AI-tutor (chatbot) interaction | 5 min |
| 6 | **Reflection** (open + Likert) | 3 min |
| 7 | **Post-test** (parallel form) + **Questionnaire** battery | 12 min |
| | **Total** | **~70 min** |

> **Burden warning.** The session is already long. Do **not** administer full-length
> IMMS (36) + CoI (34) + EGameFlow (42) = 110+ items, or participants will satisfice
> and data quality collapses. Use the validated **short forms** specified in §4.3.

---

## 2. Research design

**Recommended: between-subjects with a control group** (the design your actual
hypothesis requires).

- **Group A — Flip:** Understanding game → Assessment
- **Group B — Control:** Assessment-only (skip the Understanding game, or show a
  static text page of equivalent content)
- Both groups take the **same pre-test and post-test**.

| Element | Definition |
|---------|------------|
| **IV** | Whether the student played the Understanding (flip) module before Assessment |
| **DV (primary)** | Learning performance — normalized gain `⟨g⟩` + assessment score |
| **DV (secondary)** | Motivation, game+AI interaction, satisfaction, completion time, attempts |
| **Control var.** | Prior knowledge (pre-test), captured at signup |

> **Why a control group matters.** A one-group pretest–posttest design is classed as
> *pre-experimental / weak*: history, maturation, testing, instrumentation,
> regression, selection, and mortality all threaten internal validity
> (Campbell & Stanley, 1963). Adding a comparison group is the standard, cheapest
> remedy. If two groups are infeasible, fall back to one-group pre/post **but state
> the validity threat explicitly** in the paper — examiners penalise the omission,
> not the design.

### Hypotheses (evidence-calibrated)

- **H1 (performance):** Group A shows higher normalized gain than Group B. *(Supported by flip + game + AI-tutor meta-analyses — §5.A.)*
- **H2 (motivation):** Group A reports higher intrinsic motivation. *(Supported.)*
- **H3 (satisfaction):** **Exploratory / null-expected.** Best evidence (van Alten et al., 2019; 114 studies) found flip does **not** move satisfaction (g = 0.05, *p* = .73). Do **not** hypothesise a satisfaction gain — that predicts against the field.

---

## 3. Measurement architecture — what is measured PRE vs POST

The four constructs are **not** all measured at both ends. This is the point people get wrong:

| Construct | Pre | Post | Why |
|-----------|:---:|:----:|-----|
| **Learning performance** | ✅ knowledge quiz | ✅ parallel quiz | Both ends needed → normalized gain |
| **Motivation** | ✅ short baseline | ✅ full short-form | Reaction-to-materials is post; baseline gives a delta |
| **Interaction (game + AI as "teacher")** | ❌ | ✅ only | Can't rate an experience not yet had |
| **Satisfaction** | ❌ | ✅ only | Post-only by definition |

- **Pre** = consent + demographics + prior-knowledge quiz + 4 baseline motivation items.
- **Post** = parallel quiz + reflection + questionnaire battery.

---

## 4. The three artifacts

### 4.1 Reflection (short; open + Likert — captures the "why")

Qualitative layer to *explain* the numbers + metacognition. ~3 min, after the 3rd game.

**3 open prompts** (2–3 sentences each):
1. "Before the assessment, did playing the game change how ready you felt? How?" — *flip experience*
2. "When you used the AI tutor, what did it help with — or not?" — *AI interaction*
3. "One thing that clicked, and one thing still confusing." — *learning*

**4 self-perceived-learning Likert items** (1–5): understand concept better than before; the game made it concrete; knew what to do next at each step; would want to learn this way again.

**Scoring:** open text → thematic coding (count themes); Likert → mean. Supporting evidence, not a primary DV.

### 4.2 Small quiz = the learning-performance instrument (load-bearing)

Two quizzes: **pre-test** and **post-test**, built like a mini **concept inventory**
(Force Concept Inventory methodology — Hestenes et al., 1992).

- **Format:** 4–5 MCQs **per concept** × 3 games ≈ **12–15 items**. Mix recall + one application item per concept. MCQ = auto-scorable, objective.
- **Parallel, not identical:** post-test items must be **isomorphic** (same concept, different surface/numbers). Reusing identical items measures memory of the pre-test, not learning — the single most common reviewer complaint.
- **Item quality:** report **difficulty (P)** and **discrimination (D**, top-27% minus bottom-27% rule) on your own sample.
- **In-app Assessment score, completion time, attempts** (already logged) → secondary performance DVs, ideal for the A-vs-B comparison.

**Scoring — Hake's normalized gain:**

```
g = (post% − pre%) / (100% − pre%)
```

Classed: low `< 0.3`, medium `0.3–0.7`, high `> 0.7` (Hake, 1998). Report per-group mean `g`; compare A vs B with t-test / Mann–Whitney.

### 4.3 Questionnaire (post battery — short forms only, ~30 items, ~8 min)

| Construct | Instrument (short form) | Items | Source |
|-----------|-------------------------|:-----:|--------|
| **Motivation** *(pick ONE)* | **IMI** (SDT) — interest/enjoyment, competence, effort, value subscales | ~12 | McAuley et al. (1989); SDT |
| | *or* **IMMS** (ARCS) 12-item reduced | 12 | Loorbach et al. (2015) |
| **Interaction (game + AI as "teacher")** | **CoI** — Teaching + Social Presence, reworded "instructor" → "the game and AI tutor" | ~8 | Arbaugh et al. (2008) |
| **AI tutor specifically** | **TAM/TAM3** — Perceived Usefulness + Ease of Use + interaction satisfaction | ~6 | TAM3 chatbot studies (2025) |
| **Game engagement** *(optional, strong for a game paper)* | **EGameFlow** — pick 2–3 dimensions (e.g. concentration, challenge, knowledge improvement) | ~6 | Fu et al. (2009) |
| **Satisfaction** | ARCS-Satisfaction subscale (inside IMMS) + 2–3 global items | 5 | (within IMMS) |
| **Cognitive load** *(near-free bonus)* | **Paas** single-item, 9-point ("mental effort"), per game | 1×3 | Paas (1992) |

All Likert **1–5** (or 1–7) for comparability. Don't double-count satisfaction (it sits inside IMMS).

> **Motivation recommendation:** for a *game* study, use **IMI** — SDT-grounded, the
> standard in game-based-learning research, subscale reliabilities α = .85–.94. Use
> **IMMS** only if you want motivation tied specifically to instructional materials.
> Pick **one** to keep the survey short.

---

## 5. Academic evidence dossier

### 5.A Proof the intervention is worth studying (meta-analytic effect sizes)

| Ingredient | Effect on learning | Source |
|------------|--------------------|--------|
| Flipped classroom | Small-positive on outcomes; **no effect on satisfaction (g = 0.05, p = .73)**; 114 studies | van Alten et al. (2019) |
| Flipped (higher-ed, varies) | g = 0.98–1.22 in subject-specific metas — heterogeneity is real | Science/Math flipped meta (ERIC EJ1315589); 2025 second-order meta |
| Digital game-based learning | Overall **g = 0.54**, cognitive **g = 0.67** (2024) | Barz et al. (2024) |
| Serious games (seminal) | Cognitive + motivational gains; larger when collaborative | Wouters et al. (2013) |
| Intelligent tutoring systems | **+0.66 SD** (median, 50 controlled evals) | Kulik & Fletcher (2016) |
| AI chatbots / ChatGPT tutoring | **g = 0.67** (35 experiments, 2026); chatbots ≈ 1.02 in AI-in-ed meta | ChatGPT meta, *Nature HSSC* (2026) |

> **Heterogeneity caveat:** flipped-classroom effect sizes range g = 0.05 → 1.2 across
> meta-analyses. Cite the **range**, not one convenient number.

### 5.B Validated instruments + psychometrics (Instrumentation section)

| Construct | Instrument | Psychometrics | Source |
|-----------|------------|---------------|--------|
| Learning performance | Concept inventory + normalized gain | Validated on 6,000+ students, 62 courses; FCI item P + D | Hake (1998); Hestenes et al. (1992) |
| Motivation (intrinsic) | **IMI** (SDT) | 6 subscales, 7-pt; α = .85–.94 | McAuley et al. (1989) |
| Motivation (reaction) | **IMMS** (ARCS) | 36 items / 4 subscales; 12-item SEM-validated short form | Loorbach et al. (2015) |
| Interaction | **CoI** | 34 items; multi-institutional validation across 4 institutions | Arbaugh et al. (2008) |
| AI tutor | **TAM/TAM3** | Perceived Usefulness = strongest predictor of chatbot use | TAM3 chatbot studies (2025) |
| Game engagement | **EGameFlow** | 8 dimensions, 42 items; validated n = 166 | Fu et al. (2009) |
| Cognitive load | **Paas** single-item | 9-point; reliable/valid for overall load | Paas (1992) |

### 5.C Methodology rigor (what examiners attack)

| Decision | What the literature requires | Source |
|----------|------------------------------|--------|
| Design | One-group pre/post is weak; add a comparison group | Campbell & Stanley (1963) |
| Performance scoring | Normalized gain `⟨g⟩`, classed low/med/high | Hake (1998) |
| Quiz construction | Parallel/isomorphic forms; report difficulty + discrimination + reliability on own sample | Hestenes et al. (1992) |
| Survey reliability | Re-report Cronbach's α ≥ 0.70 per subscale on own sample (validated ≠ exempt) | per each scale's validation paper |
| Interaction → satisfaction | Interaction *mediates* satisfaction in flipped settings — testable if n permits | Interactive Learning Environments (2021) |

---

## 6. Scoring summary (what you compute)

- **Performance:** normalized gain `⟨g⟩` per student → group means → A vs B test. Plus assessment score / time / attempts.
- **Each subscale:** mean of items per student; report **Cronbach's α on your sample** (target > 0.70).
- **Motivation delta:** post minus pre baseline (overlapping dimensions only).
- **Interaction → satisfaction:** correlation / mediation if n allows.
- **Reflection:** thematic coding → theme frequencies, to interpret the quantitative results.

---

## 7. Three decisions this evidence changes

1. **Add a control group** (Assessment-only) — without it the result is, per Campbell & Stanley, "uninterpretable." Cheapest credibility win.
2. **Reframe satisfaction as null/exploratory** — flip does not reliably move satisfaction (van Alten, 114 studies).
3. **Prefer IMI over IMMS** for motivation (game context, SDT, α up to .94); keep total survey to short forms.

---

## References

*APA 7. Page numbers / volume-issue for 2021–2026 entries should be verified against
the source before submission; URLs are the retrieved ground truth.*

- Arbaugh, J. B., Cleveland-Innes, M., Diaz, S. R., Garrison, D. R., Ice, P., Richardson, J. C., & Swan, K. P. (2008). Developing a community of inquiry instrument: Testing a measure of the Community of Inquiry framework using a multi-institutional sample. *The Internet and Higher Education, 11*(3–4), 133–136. https://www.sciencedirect.com/science/article/abs/pii/S1096751608000250
- Barz, N., Benick, M., Dörrenbächer-Ulrich, L., & Perels, F. (2024). The effect of digital game-based learning interventions on cognitive, metacognitive, and affective-motivational learning outcomes in school: A meta-analysis. *Review of Educational Research.* https://journals.sagepub.com/doi/10.3102/00346543231167795
- Campbell, D. T., & Stanley, J. C. (1963). *Experimental and quasi-experimental designs for research.* Rand McNally. https://files.eric.ed.gov/fulltext/ED406440.pdf
- Fu, F.-L., Su, R.-C., & Yu, S.-C. (2009). EGameFlow: A scale to measure learners' enjoyment of e-learning games. *Computers & Education, 52*(1), 101–112. https://www.sciencedirect.com/science/article/abs/pii/S0360131508001024
- Hake, R. R. (1998). Interactive-engagement versus traditional methods: A six-thousand-student survey of mechanics test data for introductory physics courses. *American Journal of Physics, 66*(1), 64–74. https://arxiv.org/pdf/physics/0106087
- Hestenes, D., Wells, M., & Swackhamer, G. (1992). Force Concept Inventory. *The Physics Teacher, 30*(3), 141–158. (item analysis methodology: https://arxiv.org/pdf/1504.06099)
- Keller, J. M. (2010). *Motivational design for learning and performance: The ARCS model approach.* Springer. (IMMS)
- Kulik, J. A., & Fletcher, J. D. (2016). Effectiveness of intelligent tutoring systems: A meta-analytic review. *Review of Educational Research, 86*(1), 42–78. https://journals.sagepub.com/doi/abs/10.3102/0034654315581420
- Loorbach, N., Peters, O., Karreman, J., & Steehouder, M. (2015). Validation of the Instructional Materials Motivation Survey (IMMS) in a self-directed instructional setting aimed at working with technology. *British Journal of Educational Technology, 46*(1), 204–218. https://bera-journals.onlinelibrary.wiley.com/doi/abs/10.1111/bjet.12138
- McAuley, E., Duncan, T., & Tammen, V. V. (1989). Psychometric properties of the Intrinsic Motivation Inventory in a competitive sport setting: A confirmatory factor analysis. *Research Quarterly for Exercise and Sport, 60*(1), 48–58. (IMI scale + scoring: https://selfdeterminationtheory.org/intrinsic-motivation-inventory/)
- Paas, F. G. W. C. (1992). Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach. *Journal of Educational Psychology, 84*(4), 429–434. (single-item validation: https://link.springer.com/article/10.1007/s11251-024-09692-6)
- van Alten, D. C. D., Phielix, C., Janssen, J., & Kester, L. (2019). Effects of flipping the classroom on learning outcomes and satisfaction: A meta-analysis. *Educational Research Review, 28*, 100281. https://research-portal.uu.nl/en/publications/effects-of-flipping-the-classroom-on-learning-outcomes-and-satisf-2/
- Wouters, P., van Nimwegen, C., van Oostendorp, H., & van der Spek, E. D. (2013). A meta-analysis of the cognitive and motivational effects of serious games. *Journal of Educational Psychology, 105*(2), 249–265. https://link.springer.com/article/10.1007/s10648-019-09498-w
- *(ChatGPT meta-analysis, 2026)* ChatGPT's impact on student learning outcomes: a meta-analysis of 35 experimental studies. *Humanities and Social Sciences Communications.* https://www.nature.com/articles/s41599-026-07019-z — **author list/volume not captured; verify before citing.**
- *(Interaction–satisfaction mediation, 2021)* Investigating factors affecting learning satisfaction and perceived learning in flipped classrooms: the mediating effect of interaction. *Interactive Learning Environments.* https://www.tandfonline.com/doi/full/10.1080/10494820.2021.2018616

---

## Limitations / honesty note

- Every instrument and effect size is quoted from the linked published sources; **none have been re-validated on the COMPGame population** — the Cronbach's α re-reporting step is done with collected data.
- The 12-item IMMS, CoI subscale selection, and EGameFlow trimming are **recommended adaptations** for survey burden, **not** drop-in validated short forms — report exactly which items were kept.
- The van Alten (2019) full text could not be opened directly (ScienceDirect 403); its figures (114 studies; satisfaction g = 0.05, p = .73) are from the publisher portal + secondary reports — **verify the exact learning-outcome g against the PDF** before quoting it as a headline number.
- Flipped-classroom effect sizes are highly heterogeneous (g = 0.05–1.2) — cite the range.
