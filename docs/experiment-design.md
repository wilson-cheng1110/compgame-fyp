# COMPGame — Flip-Learning Experiment Design & Measurement Plan

> Research-instrument plan for measuring whether the Understanding-then-Assessment
> (flip) sequence improves learning in COMPGame (COMP3423 **Human–Computer
> Interaction**), augmented by an AI tutor.
>
> Every instrument and effect size is drawn from a published, linkable source (see
> [References](#references)). Page numbers / volume-issue for the newer meta-analyses
> must be verified against source before paper submission — the URLs are the ground
> truth actually retrieved.
>
> **This plan is grounded in the *current* codebase** (13 HCI topics; the OS topics
> CPU-scheduling and page-replacement were removed in commit `e2fba8e`). It maps onto
> instrumentation that **already exists** — the signup pre-test, the SQLite research
> sink, and the per-topic `played_understanding_first` flag — rather than assuming a
> greenfield build.

---

## 0. Topic inventory (the 13 HCI topics, from `lib/topic-definitions.ts`)

| Icon | Topic (id) | Game measures |
|------|------------|---------------|
| 🎯 | Fitts' Law (`fitts-law`) | movement time vs target size/distance |
| ⚡ | Hick's Law (`hicks-law`) | decision time vs number of choices |
| 🚦 | Principle of Consistency (`stroop`) | reaction time + error rate (Stroop) |
| 🧠 | Miller's Law (`memory`) | working memory, 7 ± 2 |
| 🔍 | Weber's Law (`webers-law`) | just-noticeable difference |
| 👁️ | Gestalt Principles (`gestalt`) | visual grouping |
| 🔄 | Norman's Action Cycle (`norman`) | gulfs of execution / evaluation |
| 🗺️ | Mental Models & Affordances (`mental-model`) | prediction cues |
| 🧩 | Problem Solving (`problem-solving`) | means-end search |
| 🌈 | Visual Perception (`visual-perception`) | colour, depth, illusion |
| 💬 | Language & Ambiguity (`language`) | syntax / semantics / pragmatics |
| 🪑 | Ergonomics & I/O Devices (`ergonomics`) | fitting devices to the body |
| 🔬 | HCI Experiment Design (`experiment-design`) | IV/DV, between vs within, counterbalancing |

**Study topics (4): Weber's Law, Problem Solving, Gestalt Principles, Miller's Law.**
Four (not three) for better representativeness across HCI cognitive principles —
perceptual thresholds (Weber), problem-solving strategy (Problem Solving), perceptual
grouping (Gestalt), and memory capacity (Miller). Four also gives a clean
**2-FLIP / 2-CONTROL** split per participant for counterbalancing (§2).

**Assessment formats (verified from game code) differ — this matters for scoring:**

| Topic | In-game assessment format | Score |
|-------|---------------------------|-------|
| Weber's Law | **Perceptual** spot-the-odd-one (8 rounds) | 0–100 — a *behavioral* measure, not knowledge |
| Problem Solving | 6 conceptual MCQ | 0–100 |
| Gestalt | 10 visual "identify the principle" | 0–100 |
| Miller's Law | digit-span (experiential, unscored) + 5 conceptual MCQ | 0–100 (MCQ only) |

> Because the four assessments are **not the same format** (Weber's is perceptual,
> not a knowledge quiz), they cannot serve as a uniform post-test. The performance
> instrument is therefore a **uniform conceptual pre/post (Form A / Form B)** across
> all 4 topics — see `quiz-item-banks.md`. The in-game assessment score is a
> **secondary DV** (and Weber's in-game score is reported as a separate behavioral
> measure).

---

## 1. Session flow (participant timeline)

**Per-topic gating (not batched).** For each topic the order is **Form A (pre) →
[Understanding game if FLIP] → Assessment → Form B (post)**. Form B is taken
immediately after that topic's assessment — never batched to the end, or topic-1
knowledge decays before its post-test.

**Two-session protocol (recommended)** — splits the ~90–100 min load so late-topic
fatigue doesn't confound the result, and the gap enables an optional delayed-retention
check.

**Session 1 (~50 min)**

| Step | Activity | ~Time |
|------|----------|-------|
| 1 | Intro + informed consent | 3 min |
| 2 | Demographics + **signup pre-test** (baseline) | 5 min |
| 3 | **Topics 1 & 2**, each: Form A → [Understanding if FLIP] → Assessment → Form B + Paas load | ~38 min |

**Session 2 (~50 min, 2–7 days later)**

| Step | Activity | ~Time |
|------|----------|-------|
| 0 | *(optional)* delayed-retention: re-administer Session-1 Form B | 4 min |
| 4 | **Topics 3 & 4**, each: Form A → [Understanding if FLIP] → Assessment → Form B + Paas load | ~38 min |
| 5 | Short AI-tutor (chatbot) interaction | 5 min |
| 6 | **Reflection** (open + Likert) | 3 min |
| 7 | **Questionnaire** battery (motivation / interaction / satisfaction) | 10 min |

> **Single-session fallback:** all of the above in one ~90–100 min sitting with a
> mandatory 5-min break after topic 2. Acceptable if scheduling two sessions is
> infeasible, but disclose the fatigue risk.
>
> **Control-topic note:** for a CONTROL topic the Understanding game is skipped
> (`played_understanding_first = false`); offer it *after* Form B for fairness — that
> post-hoc play is not measured.

> **Burden warning.** The session is already long. Do **not** administer full-length
> IMMS (36) + CoI (34) + EGameFlow (42) = 110+ items, or participants satisfice and
> data quality collapses. Use the validated **short forms** in §4.3.

---

## 2. Research design — within-subjects, counterbalanced (recommended)

The platform records **`played_understanding_first` per topic** (see §8), so the flip
IV can be manipulated *within each participant* across their 3 topics. For a small
class sample this is **stronger than between-subjects** — each student is their own
control, removing between-person variance.

- Each participant completes **4 topics**, split **2 FLIP / 2 CONTROL**.
- **Condition is manipulated within participant**: each topic is assigned either
  **FLIP** (Understanding → Assessment) or **CONTROL** (Assessment without prior
  Understanding).
- **Counterbalance topic ↔ condition across participants** (Latin square) so each
  topic appears in both conditions equally across the sample — this **deconfounds
  topic difficulty from condition**.
- The sink records the assigned condition automatically via `played_understanding_first`.

| Element | Definition |
|---------|------------|
| **IV** | Flip vs Control (`played_understanding_first`), manipulated within-subject per topic |
| **DV (primary)** | Assessment score + normalized gain `⟨g⟩` (per topic) |
| **DV (secondary)** | Motivation, game+AI interaction, satisfaction, `duration_ms`, attempts |
| **Control var.** | Prior knowledge — signup pre-test + per-topic pre-test |
| **Analysis** | Paired comparison (Wilcoxon / paired-t) of flip vs control topics within subject |

**Threats handled:** within-subjects removes selection variance; Latin-square
counterbalancing handles order **and** topic-difficulty; isomorphic pre/post items
handle the testing effect (Campbell & Stanley, 1963).

**Trade-offs to disclose:** within-subjects introduces practice/carryover across
topics, and a student who experiences both conditions may infer the hypothesis
(demand characteristics) — mitigate by counterbalancing and not revealing the
purpose. *Fallback:* if the sample is large enough, a between-subjects design (Group
A flip / Group B assessment-only) is simpler to explain — state whichever you use.

### Hypotheses (evidence-calibrated)

**Decision (2026-06-22): the four constructs are co-equal outcomes** — none is privileged as *the* primary DV. This is the user's framing and it is defensible *if* declared honestly: with four co-equal tests there is no single confirmatory hypothesis, so the study is framed **exploratory**, and the family of construct-level tests is **Holm–Bonferroni corrected** (control family-wise error across H1–H4). Report both raw and adjusted *p*, plus effect sizes with CIs — with focus-group N, effect size and direction carry the inference, not significance.

- **H1 (learning performance):** Flipped topics show higher normalized gain ⟨g⟩ than control topics. *(Supported by prior work — §5.A.)*
- **H2 (motivation):** Flipped topics report higher intrinsic motivation (IMI). *(Supported.)*
- **H3 (interaction):** Students rate teaching + social presence of the game-and-AI "teacher" (CoI, reworded) positively; explored for association with ⟨g⟩. *(Exploratory — no signed prior.)*
- **H4 (satisfaction):** **Exploratory / null-expected.** van Alten et al. (2019; 114 studies) found flip does **not** move satisfaction (g = 0.05, *p* = .73). Do **not** hypothesise a satisfaction gain; report it descriptively.

---

## 3. Measurement architecture — PRE vs POST

| Construct | Pre | Post | Why |
|-----------|:---:|:----:|-----|
| **Learning performance** | ✅ per-topic quiz | ✅ in-game assessment | Both ends → normalized gain |
| **Motivation** | ✅ short baseline | ✅ short-form | Reaction is post; baseline gives a delta |
| **Interaction (game + AI as "teacher")** | ❌ | ✅ only | Can't rate an experience not yet had |
| **Satisfaction** | ❌ | ✅ only | Post-only by definition |

### Measurement model — LOCKED (2026-06-22)

No more "pick one" / "optional". One instrument per construct, chosen and frozen. This is the answer to "still undecided on how to measure stuff": each construct now has exactly one hypothesis, one instrument, one measurement point, one analysis.

| # | Construct | Hypothesis | Locked instrument | When measured | Analysis |
|---|-----------|-----------|-------------------|---------------|----------|
| H1 | Learning performance | H1 | Per-topic concept-inventory MCQs, Form A (pre) / Form B (post), isomorphic | Pre **and** post, per topic | Hake ⟨g⟩; flip vs control within-subject (paired) |
| H2 | Motivation | H2 | **IMI** short form (interest/enjoyment, perceived competence, effort, value) | Post, per condition | Mean subscale; flip vs control |
| H3 | Interaction | H3 | **CoI** — Teaching + Social Presence subscales, **reworded** "instructor" → "the game and AI tutor" | Post only | Mean subscale; exploratory correlation with ⟨g⟩ |
| H4 | Satisfaction | H4 | **ARCS-Satisfaction** subscale + 2–3 global items | Post only | Descriptive mean; expected null |

**Bonus (not a construct hypothesis):** Paas single-item cognitive load (1×9-point per topic) — near-free, reported as context, not in the H-family.

**CoI construct-validity caveat (must disclose):** CoI was validated for human-instructor online courses (Arbaugh et al., 2008). Reattributing "instructor" to a game + AI tutor is a **non-validated adaptation** — the established factor structure and reliability do **not** transfer automatically. Treat H3 as exploratory; report item-level Cronbach's α from this sample and frame results as face-valid perceptions, not a validated CoI score. This is the honest cost of the "CoI reworded" decision and it goes in the limitations section verbatim.

---

## 4. The three artifacts

### 4.1 Reflection (short; open + Likert — captures the "why")

Qualitative layer to *explain* the numbers + metacognition. ~3 min, after the 3rd topic.

**3 open prompts** (2–3 sentences):
1. "Before the assessment, did playing the game change how ready you felt? How?" — *flip experience*
2. "When you used the AI tutor, what did it help with — or not?" — *AI interaction*
3. "One thing that clicked, and one thing still confusing." — *learning*

**4 self-perceived-learning Likert items** (1–5): understand the concept better than before; the game made it concrete; knew what to do next at each step; would learn this way again.

**Scoring:** open text → thematic coding (theme frequencies); Likert → mean. Supporting evidence, not a primary DV. **Log as `event_type: "reflection"`** (§8).

### 4.2 Small quiz = the learning-performance instrument (load-bearing)

Built like a mini **concept inventory** (Force Concept Inventory methodology — Hestenes et al., 1992).

- **A signup pre-test already exists** (`app/signup/page.tsx`): 5 MCQs across Fitts / Miller / Norman / Gestalt-proximity / Hick, stored as `preTestScore` and logged as `pre_test_complete`. It is a **coarse global baseline** (1 item / topic, 5 of 13 topics) — sufficient as a covariate, **not** sufficient for per-topic normalized gain. See gap #1 (§9).
- **Per chosen topic:** 4–5 MCQs, mixing recall + one application item.
- **Pre vs post must be isomorphic, not identical** (same concept, different surface/numbers) — reusing items measures memory, not learning. The single most common reviewer complaint.
- **Pre = Form A, Post = Form B** (`quiz-item-banks.md`), uniform conceptual MCQs across all 4 topics — because the in-game assessments differ in format (§0). The in-game assessment score is a **secondary DV**. Report item **difficulty (P)** and **discrimination (D**, top-27% minus bottom-27%) on your own sample.

**Scoring — Hake's normalized gain:**

```
g = (post% − pre%) / (100% − pre%)
```

Classed low `< 0.3` / medium `0.3–0.7` / high `> 0.7` (Hake, 1998).

### 4.3 Questionnaire (post battery — short forms only, ~30 items, ~8 min)

**Instruments are LOCKED (see §3 measurement model)** — no "pick one", no "optional". This is the frozen post battery:

| Construct | Instrument (LOCKED) | Items | Source |
|-----------|---------------------|:-----:|--------|
| **Motivation (H2)** | **IMI** (SDT) — interest/enjoyment, perceived competence, effort, value | ~12 | McAuley et al. (1989) |
| **Interaction (H3)** | **CoI** — Teaching + Social Presence, "instructor" → "the game and AI tutor" *(non-validated adaptation — see §3 caveat)* | ~8 | Arbaugh et al. (2008) |
| **Satisfaction (H4)** | **ARCS-Satisfaction** subscale + 2–3 global items | 5 | Keller / Loorbach et al. (2015) |
| **Cognitive load (bonus)** | **Paas** single-item, 9-point ("mental effort"), per topic | 1×4 | Paas (1992) |

**Dropped on purpose:** IMMS (redundant with IMI for motivation — IMI is the SDT-aligned choice and avoids double-counting satisfaction); standalone TAM/TAM3 (AI-tutor perception is folded into the CoI "teacher = game + AI" reframing rather than run as a separate scale); EGameFlow (engagement is out of scope for the four locked constructs). Recording these as deliberate cuts, not omissions.

All Likert **1–5** for comparability. Satisfaction is measured once (ARCS-S) — not double-counted.

> **Motivation recommendation:** for a *game* study use **IMI** — SDT-grounded, the
> standard in game-based learning, subscale reliabilities α = .85–.94. Pick **one**
> motivation instrument to keep the survey short.

---

## 5. Academic evidence dossier

### 5.A Intervention effect sizes (Literature Review)

| Ingredient | Effect on learning | Source |
|------------|--------------------|--------|
| Flipped classroom | Small-positive on outcomes; **no effect on satisfaction (g = 0.05, p = .73)**; 114 studies | van Alten et al. (2019) |
| Flipped (higher-ed, varies) | g = 0.98–1.22 in subject-specific metas — heterogeneity is real | Science/Math flipped meta (ERIC EJ1315589); 2025 second-order meta |
| Digital game-based learning | Overall **g = 0.54**, cognitive **g = 0.67** (2024) | Barz et al. (2024) |
| Serious games (seminal) | Cognitive + motivational gains; larger when collaborative | Wouters et al. (2013) |
| Intelligent tutoring systems | **+0.66 SD** (median, 50 controlled evals) | Kulik & Fletcher (2016) |
| AI chatbots / ChatGPT tutoring | **g = 0.67** (35 experiments, 2026); chatbots ≈ 1.02 in AI-in-ed meta | ChatGPT meta, *Nature HSSC* (2026) |

> **Heterogeneity caveat:** flipped effect sizes range g = 0.05 → 1.2 — cite the **range**, not one number.

### 5.B Validated instruments + psychometrics (Instrumentation section)

| Construct | Instrument | Psychometrics | Source |
|-----------|------------|---------------|--------|
| Learning performance | Concept inventory + normalized gain | 6,000+ students, 62 courses; FCI item P + D | Hake (1998); Hestenes et al. (1992) |
| Motivation (intrinsic) | **IMI** (SDT) | 6 subscales, 7-pt; α = .85–.94 | McAuley et al. (1989) |
| Motivation (reaction) | **IMMS** (ARCS) | 36 items / 4 subscales; 12-item SEM-validated short form | Loorbach et al. (2015) |
| Interaction | **CoI** | 34 items; validated across 4 institutions | Arbaugh et al. (2008) |
| AI tutor | **TAM/TAM3** | Perceived Usefulness = strongest predictor of chatbot use | TAM3 chatbot studies (2025) |
| Game engagement | **EGameFlow** | 8 dimensions, 42 items; validated n = 166 | Fu et al. (2009) |
| Cognitive load | **Paas** single-item | 9-point; reliable/valid for overall load | Paas (1992) |

### 5.C Methodology rigor

| Decision | What the literature requires | Source |
|----------|------------------------------|--------|
| Design | One-group pre/post is weak; within-subjects + counterbalancing, or a comparison group | Campbell & Stanley (1963) |
| Performance scoring | Normalized gain `⟨g⟩`, classed low/med/high | Hake (1998) |
| Quiz construction | Parallel/isomorphic forms; report difficulty + discrimination + reliability | Hestenes et al. (1992) |
| Survey reliability | Re-report Cronbach's α ≥ 0.70 per subscale on own sample | per scale's validation paper |
| Interaction → satisfaction | Interaction *mediates* satisfaction in flipped settings | Interactive Learning Environments (2021) |

---

## 6. Scoring summary

- **Performance:** normalized gain `⟨g⟩` per topic → flip vs control within-subject test. Plus assessment score / `duration_ms` / attempts.
- **Each subscale:** mean of items per student; report **Cronbach's α on your sample** (target > 0.70).
- **Motivation delta:** post minus pre baseline (overlapping dimensions only).
- **Interaction → satisfaction:** correlation / mediation if n allows.
- **Reflection:** thematic coding → theme frequencies, to interpret the quantitative results.

---

## 7. Decisions this evidence drives

1. **Use within-subjects counterbalanced** (Latin-square topic↔condition) — strongest design for a small class, and the platform already records the per-topic IV.
2. **Four co-equal constructs, exploratory framing, Holm–Bonferroni** — no single primary DV; the family of H1–H4 tests is multiplicity-corrected and effect sizes carry the inference (§2).
3. **One locked instrument per construct** (§3 measurement model): IMI (motivation), CoI-reworded (interaction, with disclosed validity caveat), ARCS-S (satisfaction), concept-inventory Form A/B (performance). IMMS, standalone TAM, EGameFlow dropped on purpose.
4. **Reframe satisfaction as null/exploratory** — flip does not reliably move satisfaction (van Alten, 114 studies).

### Focus group = formative validation (Stage 1 success criteria)

The focus group is **not** a hypothesis test in miniature — its job is to **validate the instruments and flow before the wide study**. With small N, the scales run as a **dry-run**, not a result. Success = the instruments and protocol are ready to scale, judged by:

- **Item validation:** every concept-inventory item discriminates (no floor/ceiling, P and D in range — see `quiz-item-banks.md` desk-review + pilot); Form A/B pairs behave isomorphically.
- **Scale function:** IMI / CoI-reworded / ARCS-S have acceptable item-level reliability on this sample (report Cronbach's α, especially for the non-validated CoI adaptation).
- **Flow + burden:** the intro→games→assessment→chatbot→reflection→questionnaire sequence completes within session budget without dropout; reflection prompts elicit usable text.
- **Qualitative themes:** thematic coding of reflections surfaces the *why* behind the numbers and any instrument confusion to fix before Stage 2.

Effect sizes/⟨g⟩ from the focus group are reported descriptively as feasibility signal — **not** as confirmatory evidence for H1–H4.

---

## 8. Mapping onto the existing COMPGame platform

The study reuses instrumentation that is **already built** — no schema migration needed.

> **Staging (decision 2026-06-22):** the new survey `event_type`s below are **Stage 2
> (wide rollout)** work. **Stage 1 is a focus group** — the pre/post quizzes (Form A/B)
> and the questionnaire are run **externally via Google Form / paper**, NOT wired into
> the app. Wire the in-app gates only when scaling to the next batch of students.

**Pre-test (exists):** `app/signup/page.tsx` → `preTestScore` / `preTestAnswers` in
`lib/user-store.ts`, plus `event_type: "pre_test_complete"`.

**Completion + IV (exists):** `lib/progress-context.tsx` `markGameComplete()` mirrors
every completion to the sink via `lib/research-log.ts`. `TopicProgress.playedUnderstandingFirst`
("KEY flip-learning metric for the paper") is the IV.

**The research sink (exists):** `backend/research_store.py` — append-only SQLite,
exposed at `POST /api/research/event`, CSV-exportable via `/api/export-data`.

```
events(participant_id, event_type, topic_id, mode, score,
       played_understanding_first, duration_ms, client_ts, server_ts, meta)
```

`participant_id` = SID. The **free-form `meta` JSON column absorbs any new
construct** — so the questionnaire/reflection data needs **no new columns**, just new
`event_type` values:

| New `event_type` | `meta` payload (example) | Emitted when |
|------------------|--------------------------|--------------|
| `topic_pretest` | `{ topic_id, form:"A", items:[...], score }` | start of each topic (Form A) |
| `topic_posttest` | `{ topic_id, form:"B", items:[...], score }` | end of each topic (Form B) |
| `reflection` | `{ topic_id, open:{q1,q2,q3}, likert:[..] }` | after 3rd topic |
| `motivation_imi` | `{ subscale_scores:{interest,competence,effort,value} }` | end of session |
| `interaction_survey` | `{ coi:{...}, tam:{pu,peou,sat} }` | end of session |
| `satisfaction_survey` | `{ items:[..], mean }` | end of session |
| `cognitive_load` | `{ topic_id, paas: 1-9 }` | after each topic |
| `chatbot_interaction` | `{ topic_id, n_queries }` | after AI-tutor step |

These POST through the existing `logResearchEvent({ event_type, topic_id, meta })`.

> **Data-integrity risk to disclose:** the sink is **best-effort, fire-and-forget,
> localhost-only** (`http://localhost:8080`, no retry). For a real study every
> participant's session must reach a running backend; the per-browser cookie export
> (`/api/export-data`) is the fallback. Confirm reachability before each session.

---

## 9. Gaps still to build

**Gap #1 — Per-topic pre/post items (DRAFTED).** Item banks for the 4 topics are in
`quiz-item-banks.md` (Form A pre / Form B post, 5 isomorphic pairs each, content-aligned
to the game code). Build them as a short **per-topic gate** at the start (Form A) and
end (Form B) of each topic, logged as `topic_pretest` / `topic_posttest`. **Still to
do:** pilot (n ≈ 5) to check wording and that A/B are equally difficult.

**Gap #2 — Post-test decision (resolved here).** The four in-game assessments use
**different formats** (Weber's is perceptual, not a knowledge quiz — §0), so they
cannot serve as a uniform post-test. **Use Form B as the post-test** across all 4
topics; treat the in-game assessment score as a **secondary DV** (Weber's in-game
score = a separate behavioral measure). *Optional:* a delayed retention test (Form B
re-administered ~1 week later) for a retention claim.

**Gap #3 — Motivation / interaction / satisfaction / reflection logging.** None are
logged yet. Add the `event_type`s in §8. Because the sink's `meta` column is free-form
JSON, this is **purely additive** — frontend survey components POST via
`logResearchEvent`; no backend schema change. Re-report Cronbach's α per subscale on
the collected data.

---

## References

*APA 7. Page numbers / volume-issue for 2021–2026 entries must be verified against the
source before submission; URLs are the retrieved ground truth.*

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
- **CoI reattribution is a non-validated adaptation.** CoI was validated for human-instructor online courses (Arbaugh et al., 2008); rewording "instructor" → "the game and AI tutor" breaks the assumption the factor structure/reliability rest on. H3 is therefore **exploratory** — report this sample's Cronbach's α and treat scores as face-valid perceptions, not a validated CoI measure. (Mirrors the §3 caveat — this is the disclosed cost of the "CoI reworded" decision.)
- **Four co-equal outcomes → multiplicity.** With no single primary DV, H1–H4 are corrected family-wise (Holm–Bonferroni) and framed exploratory; effect sizes with CIs carry the inference at focus-group N, not *p*-values (§2).
- The IMI and ARCS-S short forms are **recommended adaptations** for survey burden, **not** drop-in validated short forms — report exactly which items were kept.
- The 4 study topics' assessment formats and scoring were verified from the game code (§0). The pre/post item banks (`quiz-item-banks.md`) are content-aligned to that code and have passed a **desk review (self-pilot)** — one content-validity bug fixed (Weber A5). A **human pilot (n ≈ 5) protocol is documented and ready** in `quiz-item-banks.md`; run it to confirm difficulty/wording before the main study. The human pilot is the one step that genuinely needs participants and is not yet done.
- van Alten (2019) full text was 403-blocked; its figures (114 studies; satisfaction g = 0.05, p = .73) are from the publisher portal + secondary reports — verify the exact learning-outcome g against the PDF.
- Flipped-classroom effect sizes are highly heterogeneous (g = 0.05–1.2) — cite the range.
