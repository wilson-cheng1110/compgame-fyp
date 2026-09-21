# Arguments for & against — the nine hypotheses

For each paper: **how well-studied** the field is (are we on trodden ground?), the **baseline** (the
claim we're actually testing), and a **For / Against** table — the strongest evidence *for* the
hypothesis beside the strongest evidence *against* it. Aim is ~5 a side; where the honest count is
lower it says so. Sourced from the dossiers in this folder (`0X-*.md`).

> Columns are two **independent** lists, not rebuttal-pairs — row *N* on the left is not a reply to
> row *N* on the right (though themes often line up). **Verify every citation before it enters a
> paper** — these refs are web-sourced (DOIs/years unchecked).

---

## 01 — Does the flip work? *(H1, confirmatory primary)*

**How well-studied:** MATURE. Multiple large meta-analyses on flip and on problem-solving-before-instruction; the exact design has a 2026 near-twin.
**Baseline:** Play/experience the concept first, *then* test → higher learning gain than test-first, for the same learner & topic.

| For the hypothesis | Against it / threat |
|---|---|
| **Productive-failure synthesis holds.** Sinha & Kapur 2021 meta (53 studies, 12k+): problem-solving-before-instruction beats instruction-first on understanding & transfer. | **Immediate gain can reverse.** Saba, Kapur & Roll 2025: explore-first *lowered* immediate post-test (converged later, won on transfer). Our primary DV is *immediate* → live risk. |
| **Closest direct test supports.** DeCaro et al. 2026 (BJEP, N=168 & 357): explore-first > instruct-first on conceptual understanding, transfer, interest. | **"Test-first" is not a weak strawman.** Prequestioning/pretesting (Pan & Carpenter 2023) and test-enhanced learning (Roediger & Karpicke 2006) give the control arm its own real benefit. |
| **Flip meta-analyses are positive.** Bredow 2021 (317 studies, d≈0.20–0.53 on 7/8 outcomes); van Alten 2019 small positive on learning. | **Activity *design* can erase the effect.** Velić & DeCaro 2025: "invent one strategy" exploration did *not* beat instruction-first — position alone isn't enough. |
| **Mechanism is grounded.** Schwartz & Bransford 1998 ("a time for telling") + Kapur 2008: prior exploration primes learners to absorb instruction. | **Near-scoop weakens novelty.** DeCaro 2026 already shows it → our contribution is scale/format (many topics, within-subjects), not the effect itself. |
| **Active-learning base rate is huge.** Freeman 2014 PNAS (225 studies): active learning raises exam scores, ~halves failure. | **Flip metas confound ordering with video + reduced class time** (van Alten, Bredow) — the *sequence-only* effect is less established than the bundled "flip." |

---

## 02 — How the flip feels *(H2/H3/H4, confirmatory if committed)*

**How well-studied:** MATURE for motivation; genuinely SPLIT for satisfaction (two metas disagree).
**Baseline:** The flip lifts motivation / community / satisfaction — *or* it costs more effort for no felt benefit.

| For the hypothesis | Against it / threat |
|---|---|
| **Motivation metas positive.** Zheng 2020 (95 studies) moderate on motivation; Wu 2025 (PE) improved intrinsic motivation & self-efficacy. | **Satisfaction null.** van Alten 2019: *no* significant satisfaction effect (g=0.05, p=.73) — directly undercuts the felt-benefit half. |
| **Satisfaction meta (positive side).** Strelan 2020 (53 studies, 8,429): weak–moderate positive on course & instructor satisfaction. | **Felt-learning can *drop*.** Deslauriers 2019 PNAS: active learning lowered *perceived* learning while raising actual — the "effort, no felt benefit" branch. |
| **Theory predicts it.** SDT (Ryan & Deci 2000): an autonomy/competence-supporting flip should raise intrinsic motivation. | **The literature is unsettled.** Strelan (positive) vs van Alten (null) disagree on the same outcome. |
| **CoI rises under flip.** Lee & Kim 2018: all three presences increased. | **Our CoI is a non-validated rewording** ("instructor"→"game + AI tutor") — a null could be an instrument artifact, not a real absence. |
| **Load can be productive.** de Leng & Pawelka 2020: well-designed flip = high germane, low extraneous load. | **Motivation ≠ learning.** Wouters 2013 (games meta): learning and motivation gains dissociate — a felt gain needn't track the H1 gain. |

---

## 03 — Reflection & help-seeking *(confirmatory candidate)*

**How well-studied:** ACTIVE — and carrying a strong recent preregistered NULL.
**Baseline:** Deeper reflection + less "just tell me" → more learning. *Or* grabbing the answer costs nothing.

| For the hypothesis | Against it / threat |
|---|---|
| **Self-explanation works.** Chi 1989 (good learners self-explain 5×); Bisra 2018 meta g=0.55 for self-explanation prompts. | **Big preregistered NULL.** 2025 ACM L@S RCT (N≈1,005, Zengilowski et al.): reflection prompt moved neither hint use nor post-test; hints didn't hurt. The sharpest threat. |
| **Executive help-seeking measurably costs.** Baker 2004 (gaming-the-system); Aleven 2016 (instrumental helps, executive doesn't). | **Rich LLM interaction ≠ learning.** Divekar 2025: richer, more self-aware LLM help produced no better outcomes than search. |
| **Metacognitive prompts help.** Guo 2022 meta g=0.40 on outcomes. | **Reflection can trade against satisfaction.** Choi 2025: higher-quality reflection *lowered* satisfaction with AI hints — a satisfaction≠learning confound. |
| **Desirable-difficulty theory.** Bjork & Bjork 2020: effortful reflection's short-term cost *is* the long-term mechanism. | **Shallow prompts do little.** Bisra 2018: prompts that only ask to state one's knowledge are weak — if our reflection reads shallow, expect no effect. |
| **Adaptive help-seeking helps.** Shields 2024: active > passive help-seeking, moderated by metacognition. | **"When difficulty helps" is conditional.** Pyke 2025: added difficulty helps simple tasks, harms complex — a mixed/null result is theory-consistent. |

---

## 04 — How students take the tests *(exploratory)*

**How well-studied:** MATURE psychometrics; the *multi-signal + engagement, within one course* combination is the gap.
**Baseline:** RT / hesitation / rushing / straight-lining predict performance & engagement. *Or* the traces add nothing over the score.

| For the hypothesis | Against it / threat |
|---|---|
| **RT-effort predicts performance.** Wise & Kong 2005 (RTE); Wise & DeMars 2006 (effort-moderated IRT improves fit). | **Ceiling.** Aydin 2025: process data *alone* only moderate; it adds to, doesn't replace, the score — the "adds nothing extra" arm. |
| **Pattern beats mean.** Tan & Bulut 2025 (TIMSS ~13,800): within-person RT variability predicts more than mean RT. | **RT is ambiguous.** Goldhammer 2014: time-on-task flips sign with difficulty/skill — slow ≠ engaged. |
| **Multi-signal beats RT-only.** Welling 2024: adding reread/revisit/answer-change improves the engagement model. | **Weak at the item level.** Stupple 2017: RT barely correlated with accuracy on a reflective test. |
| **Process + result is best.** Aydin 2025: combining traces with the score gives the best prediction. | **Effort-moderated scoring isn't universally robust.** Rios & Deng 2025: conditional under multidimensional rapid-guessing. |
| **The core technique is robust.** Rios & Deng 2021 meta: RT-threshold methods converge on which responses are rapid-guessed. | **Straight-lining ↔ quality is complex.** Kim 2019: the flag is not a clean data-quality signal. |

---

## 05 — Transfer to master's students *(confirmatory candidate, HSESC-gated)*

**How well-studied:** THIN for postgrad-specific flip; one underpowered counter-finding dominates.
**Baseline:** The flip advantage holds for PGs as for UGs (no condition × population interaction). *Or* it's population-specific.

| For the hypothesis (transfer holds) | Against it / threat (population-specific) |
|---|---|
| **The base effect is robust in UGs.** Freeman 2014, Bredow 2021 — the effect we ask to transfer is well established. | **The one prior PG test leans against.** Chen 2018: near-null/negative graduate subgroup. |
| **Adult-learner theory.** Knowles 1980: self-directed adults may do *well* with learn-first. | **Expertise reversal.** Kalyuga et al. 2003 + Tetzlaff 2025 meta (d=−0.43 for high-prior-knowledge under high assistance): a guided scaffold may transfer poorly to expert PGs. |
| **SRL predicts online achievement.** Broadbent & Poon 2015: PGs' stronger self-regulation could help in an unsupervised learn-first module. | **PG flip evidence is too heterogeneous.** Oliver & Luther 2020: can't settle the question either way. |
| **Method template exists.** Talsma 2023 (same venue): multi-group path analysis shows how to test generalization cleanly. | **Generalizability crisis.** Yarkoni 2022: UG-only results don't license a PG claim; our MSc N is small. |
| **The moderator was never resolved.** van Alten 2019 left education level open → the question is open, not closed against us. | *(Andragogy itself is weakly evidenced — Rachal 2002 — which cuts both ways: it undermines a confident "PGs differ" as much as a confident "they don't.")* |

---

## 06 — Running a real classroom RCT *(methods paper — feasibility, not an effect)*

**How well-studied:** The *machinery* is mature (web A/B, MOOC platforms); the *solo-researcher, one-course, blinded, CONSORT-shaped* packaging is the gap.
**Baseline (a claim, not a hypothesis):** A blinded, attrition-bounded RCT can be run inside one live course without harming teaching or data — here is the reproducible recipe.

| For — doable & valuable | Against — hard / not novel / risky |
|---|---|
| **Precedent exists.** Williams 2015 (L@S): in-vivo course experiments are established. | **Consortium-scale work exists.** Musabirov 2025, Baker 2022 — a single-course recipe may read as small. |
| **The field asks for it.** Reich 2015: platforms should do causal design, not just click analytics. | **Ethics of a captive cohort.** Benbunan-Fich 2017: consent/oversight seam must be closed convincingly. |
| **A documented gap to fill.** Connolly 2018: most ed-RCTs under-report randomization/blinding/attrition → clear contribution. | **Solo, single-course → limited power / external validity.** |
| **A reporting standard is ready.** CONSORT-SPI (Grant 2018): a checklist to satisfy. | **Blinding is only partial** — the instructor is also the researcher. |
| **Attrition can be bounded.** Deke & Chiang 2017: a defensible bias budget. | **The closest sibling missed the bar.** Gordillo 2024 (real, n=326) didn't report blinding/attrition — showing how easily the recipe is *not* followed. |

---

## 07 — The AI tutor *(design contribution)*

**How well-studied:** ACTIVE and crowded (2023–25 surge in LLM-tutor RCTs).
**Baseline:** A tutor that withholds the answer *and* detects understanding beats a plain answer-bot. *Or* students just want the answer and a Socratic gate frustrates them.

| For the hypothesis | Against it / threat |
|---|---|
| **Granularity is the lever.** VanLehn 2011: step-based ITS ≈ human tutor; answer-only far weaker. | **Near-scoop.** PNAS 2025 + scaffolding studies already show withhold > answer → our marginal novelty is only the *detection gate*. |
| **Withholding works.** Chi 2001: suppressing direct explanation and prompting construction didn't hurt learning. | **Students may just want the answer.** Unrestricted AI raises in-session satisfaction/scores (2508.06254) — the "gate frustrates them" half. |
| **Direct evidence for gating.** PNAS 2025: unrestricted answer-AI *harmed* retained skill vs hint-only. Strongest support. | **Best AI-tutor RCT isn't pure withholding.** Kestin 2024 mixes explanation + practice → isolating withhold-vs-answer is hard; effect may be small. |
| **Socratic beats plain chatbot.** Frontiers in Education 2025: Socratic prompting beat direct-answer on critical thinking. | **The detection gate is unproven** — no found study tests understanding-*detection* as the mechanism (and it leans on a small model — see 08). |
| **Hint abuse is real.** Aleven/Baker 2004: ~72% of help-seeking unproductive → gating is justified. | **Outcome mismatch.** The closest Socratic-vs-plain study measured critical thinking, not concept-inventory gain — our exact comparison is untested. |

---

## 08 — Can a small local model run this? *(exploratory / feasibility)*

**How well-studied:** EMERGING. Two separate literatures (small-model capability; LLM-as-grader) — neither on a small *local* model doing *both* roles.
**Baseline:** A sub-5B local (no-cloud) model is good enough to Socratic-tutor *and* blind-grade in a live study — and where it isn't, the failure modes are characterisable.

| For the hypothesis | Against it / threat |
|---|---|
| **SLMs are competitive on narrow tasks.** Gupta et al. 2025 survey; purpose-trained sub-billion can beat larger general models (MobileLLM-R1 2025). | **Quantization hits small models hardest.** 2504.04823: >60% relative drop on a 0.5B vs 2–3% on 7B — and local means quantized. Direct threat to "good enough locally." |
| **Autograding is viable (cloud).** EDM 2025: 91–95% agreement; MDPI 2026 r up to 0.98. | **Sub-billion reasoning floor.** MobileLLM-R1: small models unreliable on complex tasks. |
| **Socratic-tutor design patterns exist.** SocraticLM (Liu 2024), CLASS (Sonkar 2023). | **Reliability ≠ validity.** 2606.19544: high self-consistency can mask bias — a "consistent" small grader isn't proven valid. |
| **Answer-withholding tutors can match experts.** LearnLM 2024/25 (feasibility of the tutor role, at scale). | **All grader/judge precedent is frontier/cloud** (Zheng 2023, EDM 2025) → the small/local claim is genuinely unestablished. |
| **Failure modes are measurable.** 2603.29559 (confidence calibration) → the "where it isn't" clause is deliverable even if the model underperforms. | **Socratic LLMs can silently degrade** to generic scaffolding (2508.06583) — the tutor may look fine yet not tutor. |

---

## 09 — The game is the experiment *(speculative / exploratory)*

**How well-studied:** EMERGING. Embodiment/serious-games evidence is mixed; one close Fitts-game precedent (engagement only).
**Baseline:** *Living* a perceptual phenomenon (playing Stroop/Fitts/Weber/Hick) teaches the law better than reading it. *Or* the game is engaging but no deeper than a good explanation.

| For the hypothesis | Against it / threat |
|---|---|
| **Physical/enactive experience beats observation.** Kontra 2015 (Psych Science): experiencing forces improved learning. | **The close precedent measured engagement, not learning.** ICBL 2025 Fitts game (HCI students) didn't separate "taught" from "more fun" — our core ambiguity is unresolved and hard to resolve. |
| **Grounded-cognition theory.** Barsalou 2008; Glenberg 2004: being the perceiver/actor should help. | **Games aren't reliably more motivating.** Wouters 2013 meta: motivation gain n.s.; learning & motivation dissociate. |
| **Games beat non-game instruction.** Clark 2016 meta g=0.33 (augmented g=0.34). | **Physical vs virtual is a wash for adults.** Muilwijk & Lazonder 2023 (g=−0.14, n.s.) — "living it" may be no better than a good explanation (the null arm). |
| **ICAP predicts it.** Chi & Wylie 2014: Interactive > Active > Passive; game-as-experiment sits at Interactive. | **Pure discovery loses.** Mayer 2004; Alfieri 2011 meta: unassisted discovery underperforms explicit instruction — bare experience needs scaffolding to win. |
| **The nearest precedent trends positive.** ICBL 2025: the Fitts game raised (affective) engagement in the same population. | **Embodiment only helps when integrated.** Skulmowski & Rey 2018: non-integrated bodily engagement adds extraneous load and can *hurt*. |

---

*Read with `README.md` (the index + cross-cutting finding) and `../pre-registration/` (which registers,
per confirmatory paper, the specific "against" argument it must pre-address).*
