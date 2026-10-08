# Pre-registration — Does the flip help learning LAST? (H1b, delayed retention)

*Format: AsPredicted / OSF style. Companion to `01-flip-effect.md` (immediate H1). Instruments:
`docs/retention-item-banks.md` (Form C MC), `docs/retention-application-bank.md` (application
short answer), served by `backend/retention.py` / `backend/retention_probe.py` in the end-of-study
battery. Status: **DRAFT — must be filed before the battery window opens (~2026-11-23).***

> **This pre-registration is filed BEFORE any battery data exists.** The battery window is closed
> until each section's last lecture; no retention or application-probe response has been
> collected or examined.

---

**1. Have any data been collected for this study already?**

For this hypothesis, **no**: the end-of-study battery opens per section on its last lecture date
(MSC 2026-11-23 · A 11-24 · B 11-25 · C 11-26) and closes 14 days later; nothing has been
collected. The **immediate** pre/post data for the same topics HAS been collected and an interim
analysis of it was run on 2026-10-08 (disclosed in `01-flip-effect.md` §1: immediate FLIP effect
+1.17 / 100, p = .11). That interim, and four exploratory follow-up checks run on it (Form A/B
non-equivalence, game dose, game–item alignment, completion timing —
`docs/research-actions-2026-10-03.md`), are what motivated the moderators pre-specified in §8.
None of them used any retention data.

**2. What's the main question / hypothesis?**

**H1b (confirmatory):** For the same learner, topics completed in the FLIP condition
(Understanding game before the post-check) are retained better at the end of the study than
topics completed in the CONTROL condition, controlling for immediate post-check performance.
Directional in prediction (productive-failure / flipped-learning theory predicts the benefit shows
as slower decay, not higher immediate scores); tested two-sided.

**H1c (confirmatory, secondary):** The same comparison on **application** — a fresh design
scenario per topic, short answer, graded 0–2.

**3. Dependent variables and how measured.**

- **H1b DV:** Form C score (% correct) per participant × topic. 6 items per topic (8 for
  `experiment-design`), each targeting the same concept as A/B item N on new wording / scenarios.
  Options and question order are shuffled per participant (seeded from the participant secret);
  graded server-side, key never served. On the 9 topics hardened on 2026-09-26, Form C is
  deliberately harder than A/B, so it is analysed as a **standalone** score (never C − B).
- **H1c DV:** application probe score 0 / 1 / 2 per participant × topic, graded **offline and
  blind to condition** by `grade_batch.py --application` (`gemma4:e4b`, temperature 0), against the
  rubric in the application bank. A human-coded subsample (≥ 60 answers, stratified by topic)
  gives Cohen's κ; if κ < 0.6, H1c is reported as descriptive only.

**4. Conditions.**

Unchanged from H1: FLIP vs CONTROL, assigned per participant per topic at release time, recorded
server-side (`topic_pretest` meta `arm`; frozen arms for SID-canon-migrated accounts). Every
participant contributes both conditions. In both arms the Understanding game is played — before
the post-check in FLIP, after it in CONTROL — so the contrast is the ORDER, not the exposure.

**5. Analyses to test the hypotheses.**

H1b, linear mixed model on participant × topic rows:

```
formC_pt  ~  condition  +  post_pt  +  interval_pt  +  (1 | participant)  +  (1 | topic)
```

`post_pt` = that topic's immediate post-check score; `interval_pt` = weeks from post-check to the
retention attempt (topics released early sit longer). The fixed effect of condition is the test:
supported if positive with two-sided p < .05. Random slopes for condition by topic if the model
converges, otherwise intercepts only.

H1c: the same fixed and random structure on the 0–2 probe score, as an ordinal (cumulative logit)
mixed model; if it fails to converge, a linear mixed model on the 0–2 score.

**Family & correction:** H1b and H1c are corrected together with Holm–Bonferroni (α = .05).

**6. Outliers and exclusions.**

- Rows are participant × topic for topics the participant COMPLETED (the battery only offers
  completed topics). `norman` and `hicks-law` are analysed separately, as in H1.
- **Rapid responding:** Form C attempts below the same rapid-guess time floor used for H1 are
  flagged; the primary is reported with and without them.
- Withdrawn / disabled accounts excluded (export already applies this).
- **Non-response:** a participant who does not take the battery contributes nothing; because each
  participant has topics in both conditions, non-response removes both arms together. Response
  rate is reported overall, per section and per arm; a per-topic skipped attempt is treated as
  missing, not zero.

**7. Sample size.**

Fixed by enrolment (the cohort who completed at least one topic; ~330 accounts). No stopping rule:
analysis runs once, after the last section's window closes. Sensitivity: the minimum detectable
effect is reported from the realised N and intraclass correlations.

**8. Pre-specified moderators (registered so they are a fair test on NEW data).**

Each is suggested by the 2026-10-08 exploratory checks on immediate data; each is tested here on
retention data that did not exist when it was proposed.

- **M1 — Completion timing:** condition × timing (on time: pre-check more than 48 h before the
  lecture; late but before the lecture; after the lecture). Prediction: the FLIP benefit is
  largest when the unit was completed on time, i.e. genuinely before instruction (immediate data:
  on-time +2.11, after-lecture −2.01).
- **M2 — Game time:** condition × log(seconds in the Understanding game). Prediction: the FLIP
  benefit grows with time in the game (immediate data: +1.8 points per log-unit within FLIP).

Moderators are tested at α = .05 each, reported as **secondary** (not part of the Holm family),
and interpreted only if H1b's main effect and the moderator agree in direction.

**9. Anything else.**

- **Known instrument risk, declared now:** on the immediate check, some Form B items proved
  easier than their Form A partners (CONTROL rose +5.9 pp per item with nothing taught in between).
  Form C slots that mirror the worst A/B pairs were flagged for human desk-review before the
  window (`docs/retention-review-packet.md`). Any item changed in that review is changed BEFORE
  the window opens and listed here before filing.
- Either outcome is a finding. A null H1b alongside a null immediate H1 will be reported as
  evidence against a flip benefit in this setting, with the dose and alignment checks as
  context — not explained away.

---

*Status: DRAFT 2026-10-08 — for PI review. Before filing: (1) finish the Form C desk-review and
list any changed items in §9; (2) confirm the rapid-guess floor value; (3) file before
2026-11-23.*
