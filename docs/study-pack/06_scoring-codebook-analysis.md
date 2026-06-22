# Scoring Keys · Codebook · Analysis Plan  — RESEARCHER ONLY

> **Do not give this file to participants — it contains the answer keys.**
> Covers: (A) one-group analysis framing + limitations, (B) H1 concept-inventory keys +
> isomorphism map + Hake gain, (C) questionnaire subscale maps + reverse items, (D) variable
> codebook, (E) full analysis plan.

---

## A. Design framing & honest limitations (carry into the paper)

Stage 1 is a **one-group pretest–posttest** (single condition: the flipped Understanding-first
sequence). There is **no control / counterfactual**. Consequences to state in the methods and
limitations sections:

- A pre→post gain cannot be cleanly attributed to the flip sequence — it is confounded with
  **testing/practice effects and maturation** (Campbell & Stanley, 1963, design 2).
- **Mitigated:** the *testing effect* specifically, by using **isomorphic** A/B forms (different
  surface, same concept) so the post-test is not a memory test of the pre-test.
- **Not mitigated:** maturation, history, the absence of a no-treatment baseline. So Stage 1
  reports ⟨g⟩ as a **feasibility signal**, not confirmatory evidence for H1.
- With focus-group N, **effect sizes with CIs carry the inference, not p-values.** Report both.
- H2/H3/H4 are **single post administrations → descriptive** (means, SD, reliability). They are
  not pre/post deltas at this stage.
- **CoI (H3) is a non-validated adaptation** ("instructor" → "the game and AI tutor"); report
  this sample's Cronbach's α and treat scores as face-valid perceptions, not a validated CoI
  score. This caveat is mandatory.

This diverges from `experiment-design.md` §2 (within-subjects 2-FLIP/2-CONTROL) by Wilson's
Stage-1 decision; see `00_README.md` addendum. The control arm returns at Stage 2.

---

## B. H1 — Concept-inventory answer keys

Score each item **1 = correct, 0 = incorrect**. Per form: `% = (correct / 6) × 100`.

### Weber's Law
| Form A | Key | Form B | Key |
|:------:|:---:|:------:|:---:|
| A1 | b | B1 | b |
| A2 | a | B2 | c |
| A3 | b | B3 | b |
| A4 | c | B4 | c |
| A5 | b | B5 | b |
| A6 | b | B6 | b |

### Problem Solving
| Form A | Key | Form B | Key |
|:------:|:---:|:------:|:---:|
| A1 | a | B1 | a |
| A2 | b | B2 | b |
| A3 | a | B3 | a |
| A4 | b | B4 | b |
| A5 | c | B5 | c |
| A6 | b | B6 | b |

### Gestalt Principles  *(options: a Similarity · b Proximity · c Continuity · d Symmetry · e Closure)*
| Form A | Key | Principle | Form B | Key | Principle |
|:------:|:---:|-----------|:------:|:---:|-----------|
| A1 | b | Proximity | B1 | b | Proximity |
| A2 | a | Similarity | B2 | a | Similarity |
| A3 | e | Closure | B3 | e | Closure |
| A4 | c | Continuity | B4 | c | Continuity |
| A5 | d | Symmetry | B5 | d | Symmetry |
| A6 | b | Proximity (application) | B6 | b | Proximity (application) |

### Miller's Law
| Form A | Key | Form B | Key |
|:------:|:---:|:------:|:---:|
| A1 | b | B1 | b |
| A2 | b | B2 | b |
| A3 | c | B3 | c |
| A4 | b | B4 | b |
| A5 | c | B5 | c |
| A6 | b | B6 | b |

### Isomorphism map (the concept each A↔B pair tests)
| Item | Weber | Problem Solving | Gestalt | Miller |
|:----:|-------|-----------------|---------|--------|
| 1 | ratio vs absolute change | means-end analysis | proximity (recognise) | capacity 7 ± 2 |
| 2 | ΔI / k meaning (the JND term) | working backwards | similarity (recognise) | chunking |
| 3 | Weber fraction value | analogical reasoning | closure | STM vs LTM |
| 4 | below-JND in UI (progress/hover) | problem-space trio | continuity | grouping for working memory |
| 5 | fraction across magnitudes | representation changes difficulty | symmetry | reduce load (sections/wizard) |
| 6 | ratio scaling in design (apply) | operators (identify by example) | proximity (apply) | STM duration (~15–30 s) |

> Item 6 is **new** for the 6-item upgrade. Weber A6/B6 and Gestalt A6/B6 are **application**
> items (use the concept, not just name it) — these add discrimination depth the desk review
> flagged as missing. Re-run the desk-review checks in `quiz-item-banks.md` on the four new pairs
> before locking, and include them in the n ≈ 5 human pilot.

### Hake normalized gain
```
g_topic = (post% − pre%) / (100% − pre%)        # per participant, per topic
g_overall = (mean_post% − mean_pre%) / (100 − mean_pre%)   # pooled across topics
```
Class: **low** g < 0.3 · **medium** 0.3–0.7 · **high** > 0.7 (Hake, 1998). If pre% = 100 for a
participant-topic, g is undefined (ceiling) — exclude that cell from the g mean and report how
many were dropped.

---

## C. Questionnaire subscale maps & reverse-scored items

All items on **1–5**. **Reverse-score first**, then average. Reverse formula on a 1–5 scale:
`reversed = 6 − raw`.

### IMI (H2) — `04_post-questionnaire.md` §1
| Subscale | Items | Reverse |
|----------|-------|---------|
| Interest / Enjoyment (IE) | M1, M5, M9 | **M9 (R)** |
| Perceived Competence (PC) | M2, M6, M10 | — |
| Effort / Importance (EI) | M3, M7, M11 | **M11 (R)** |
| Value / Usefulness (VU) | M4, M8, M12 | — |

Subscale score = mean of its 3 items (after reversing M9, M11). `imi_total` = mean of all 12
(reversed) — report subscales primarily; total only as a summary.

### CoI (H3) — `04_post-questionnaire.md` §2  *(no reverse items)*
| Subscale | Items |
|----------|-------|
| Teaching Presence (TP) | I1, I2, I3, I4 |
| Social Presence (SP) | I5, I6, I7, I8 |

### ARCS (H4) — `04_post-questionnaire.md` §3  *(no reverse items)*
| Score | Items |
|-------|-------|
| ARCS-Satisfaction (`arcs_s`) | S1, S2, S3, S4, S5 |
| Global satisfaction (`arcs_global`) | G1, G2, G3 |

### Reflection Likert — `05_reflection-and-load.md` §1  *(no reverse items)*
`rl_mean` = mean of RL1–RL4. Open items R-open-1/2/3 → thematic coding (see §E).

---

## D. Variable codebook

| Variable | Source item(s) | Type / values |
|----------|----------------|---------------|
| `participant_id` | assigned | string `P01`… |
| `age_band` | D1 | ordinal: 18-20/21-23/24-26/27+/NA |
| `gender` | D2 | categorical |
| `year` | D3 | ordinal 1–4+/other |
| `programme` | D4 | categorical |
| `hci_prior` | D5 | ordinal: none/little/full |
| `topic_familiarity` | D6 | ordinal 1–4 |
| `gaming_freq` | D7 | ordinal 1–5 |
| `ai_tool_freq` | D8 | ordinal 1–4 |
| `device` | D9 | categorical |
| `{topic}_A1…A6`, `{topic}_B1…B6` | concept inventory | binary 0/1 (correct) |
| `{topic}_pre_pct`, `{topic}_post_pct` | derived | 0–100 |
| `{topic}_g` | derived | normalized gain (may be NA at ceiling) |
| `overall_pre_pct`, `overall_post_pct`, `overall_g` | derived | pooled |
| `imi_ie`, `imi_pc`, `imi_ei`, `imi_vu`, `imi_total` | M-items (reversed) | 1–5 mean |
| `coi_tp`, `coi_sp` | I-items | 1–5 mean |
| `arcs_s`, `arcs_global` | S-/G-items | 1–5 mean |
| `rl_mean`, `RL1…RL4` | reflection Likert | 1–5 |
| `load_weber`, `load_ps`, `load_gestalt`, `load_miller` | Paas | 1–9 |
| `topic_order` | facilitator log | sequence the 4 topics were presented (for order checks) |
| `refl_open1/2/3` | reflection open | free text → coded themes |

`{topic}` ∈ `{weber, ps, gestalt, miller}`.

---

## E. Analysis plan

**Pre-checks**
1. Completeness / attention: drop or flag participants with >10% missing or straight-lining.
2. **Item analysis (H1):** per item, difficulty `P` (proportion correct) and discrimination `D`
   (point-biserial, or top-27% − bottom-27% if N allows). Flag `P < 0.20` (too hard),
   `P > 0.95` (ceiling), `D < 0.20` (weak). **A/B equivalence:** per topic, |mean Form A − mean
   Form B| should be ≤ ~15 pts at pre-exposure; if a pair diverges, rebalance before Stage 2.
3. **Reliability:** Cronbach's α per subscale (IMI ×4, CoI ×2, ARCS-S, reflection). Target
   **α ≥ 0.70**; report all, especially the non-validated CoI adaptation.

**H1 — learning performance (load-bearing)**
- Per topic and pooled: mean `pre_pct`, `post_pct`, mean `g` with class (low/med/high).
- Pre vs post: **Wilcoxon signed-rank** (default at small N) or paired-t if normality holds.
  Effect size: rank-biserial (Wilcoxon) or Cohen's `dz` (paired-t). **Report 95% CI**
  (bootstrap if N small).
- Plot per-participant pre→post slopes. Treat as **feasibility signal**, not proof (see §A).

**H2 — motivation (descriptive)**
- IMI subscale means ± SD; α per subscale. Exploratory one-sample test vs scale midpoint (3)
  with effect size, framed exploratory.

**H3 — interaction (exploratory)**
- CoI TP and SP means ± SD; α (flag the adaptation caveat in the same sentence).
- Exploratory **Spearman** correlation of `coi_tp` / `coi_sp` with `overall_g` — report ρ + CI,
  do not over-interpret at this N.

**H4 — satisfaction (descriptive, null-expected)**
- `arcs_s` and `arcs_global` means ± SD; α. Report descriptively; do **not** hypothesise a gain
  (van Alten et al., 2019: flip does not move satisfaction, g = 0.05, p = .73).

**Cognitive load (context)**
- Per-topic Paas mean ± SD; exploratory correlation with per-topic `g` and with `topic_order`
  (to check fatigue across position).

**Reflection (qualitative — explains the numbers)**
- Open items → **thematic coding**: two passes, inductive codes, report theme frequencies and
  representative quotes (anonymised). Use to interpret H1–H4 and to surface instrument confusion
  for Stage-2 revision.

**Multiplicity & reporting**
- Any inferential tests in the H1–H4 family → **Holm–Bonferroni** across the family; report raw
  **and** adjusted p alongside effect sizes + CIs. At focus-group N, lead with effect sizes.
- State exact item sets kept for each adapted short form (IMI, ARCS-S) and the IMI 7→5 scale
  change. Reproduce the CoI caveat verbatim in limitations.
