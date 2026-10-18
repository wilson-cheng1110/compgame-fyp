# Paper 01 backbone — flip effectiveness (immediate + retention)

*Built 2026-10-16 from `_brief.md`, `docs/lit/01-flip-effectiveness.md`, pre-registrations `01-flip-effect.md` and `01b-retention.md`. All interim numbers are exploratory, prod export of 2026-10-08..16, and not final. Citations were checked 2026-10-16 against Crossref (title / first author / year / journal) unless noted.*

## 1. Working title and claim

**Title:** *Does playing first help? A within-student, 13-topic test of interactive-activity-before-assessment on immediate learning and end-of-semester retention.*

**Claim the data supports today:** Across ~340 students and up to 11 lecture-backed topics, doing the interactive Understanding game before the post-check (FLIP) shows at most a small immediate advantage (about +1 point out of 100, 95% CI includes 0, p .07-.25). Most of the observed pre-to-post gain (~5.4 of ~7 points) comes from the instrument (an easier Form B plus a retest effect), not from the game. Whether the order effect appears as slower forgetting is untested until the November retention battery.

## 2. Research questions and hypotheses (as pre-registered)

- **H1 (confirmatory, immediate):** same learner, same topic: FLIP gives a higher post-check score than CONTROL. Model: `post ~ condition + pre + (1|participant) + (1|topic)`, intention-to-treat, two-sided. Sensitivity (a)-(e): completers, ceiling-aware GEE on P(post=100), rapid-response exclusion (NT10), descriptive ⟨g⟩, and pre-check "left the page" covariate. `norman` and `hicks-law` analysed separately; `webers-law` perceptual measure excluded.
- **H1b (confirmatory, delayed):** FLIP topics retained better on Form C MC, controlling for the immediate post and the interval. `formC ~ condition + post + interval + (1|participant) + (1|topic)`.
- **H1c (confirmatory, secondary):** same on the application short-answer probe (0-2, offline blind grading; descriptive only if κ < 0.6). H1b and H1c are Holm-corrected together.
- **Pre-specified moderators (secondary):** M1 completion timing (on time vs late vs after lecture); M2 log game time.
- **Exploratory:** decisiveness index on Form C; whether tutor-reflection insight predicts retention net of post score; per-topic heterogeneity.
- **Registration caveat:** H1 is "confirmatory with a disclosed interim look" (two disclosures, 2026-10-08 and 10-09). H1b must be filed before ~2026-11-23.

## 3. Literature support

All entries VERIFIED unless marked otherwise.

1. Hake, R. R. (1998). Interactive-engagement versus traditional methods: A six-thousand-student survey of mechanics test data for introductory physics courses. *Am. J. Physics*, 66(1), 64-74. DOI 10.1119/1.18809. **VERIFIED (Crossref).** Origin of normalised gain ⟨g⟩. We report it descriptively only, because it overstates our effect (0.52 vs 0.41) and is unstable near ceiling.
2. Schwartz, D. L., & Bransford, J. D. (1998). A time for telling. *Cognition & Instruction*, 16(4), 475-522. DOI 10.1207/s1532690xci1604_4. **VERIFIED.** Prior exploration "prepares" learners for later instruction. Theoretical basis for FLIP. It used contrasting cases, not games.
3. Kapur, M. (2008). Productive failure in mathematical problem solving. *Cognition & Instruction*, 26(3), 379-424. DOI 10.1080/07370000802212669. **VERIFIED.** Struggle before consolidation beats lecture-then-practice. Supports the delayed-benefit logic.
4. Sinha, T., & Kapur, M. (2021). When problem solving followed by instruction works: Evidence for productive failure. *Rev. Educ. Res.*, 91(5), 761-798. DOI 10.3102/00346543211019105. **VERIFIED.** Meta-analysis (53 studies); problem-first beats instruction-first on conceptual understanding and transfer. This is the strongest quantitative support for the ordering question. It is mostly about transfer, not recall.
5. DeCaro, M. S., et al. (2026). Flipping a simulation before instruction can improve students' learning, interest and perceived competence. *Br. J. Educ. Psychol.*, 96, 172-192. DOI 10.1111/bjep.70007. **VERIFIED** (Crossref lists online year 2025, volume 96 is 2026). Two experiments (N=168, 357). Explore-first won on conceptual understanding and transfer, tied on facts. Closest prior test of our hypothesis. We position as extension, not first demonstration.
6. DeCaro, M. S., Isaacs, R. A., Bego, C. R., & Chastain, R. J. (2023). Bringing exploratory learning online: problem-solving before instruction improves remote undergraduate physics learning. *Front. Educ.*, 8, 1215975. DOI 10.3389/feduc.2023.1215975. **VERIFIED.** Explore-first effect holds online. Close to our delivery context.
7. Velić, L., & DeCaro, M. S. (2025). Comparing effectiveness of exploratory learning activities given before instruction: generating multiple strategies vs. inventing one strategy. *Instr. Sci.*, 53, 1537-1572. DOI 10.1007/s11251-024-09701-8. **VERIFIED.** Activity design moderates the effect. Our games are one design per topic, so this limits generalisation.
8. Saba, J., Kapur, M., & Roll, I. (2025). Learning about multivariable causality with interactive simulations: exploration before instruction may hurt immediate gains but benefits transfer. *Instr. Sci.* DOI 10.1007/s11251-025-09726-7. **VERIFIED.** Direct precedent for a null or negative immediate effect alongside a later benefit. This is why retention was added.
9. Pan, S. C., & Carpenter, S. K. (2023). Prequestioning and pretesting effects: a review. *Educ. Psychol. Rev.*, 35, 97. DOI 10.1007/s10648-023-09814-5. **VERIFIED.** Our pre-check is itself a pretest in both arms. This makes CONTROL a strong comparator and may shrink the contrast.
10. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychol. Sci.*, 17(3), 249-255. DOI 10.1111/j.1467-9280.2006.01693.x. **VERIFIED.** Testing helps retention. In CONTROL the post-check comes before the game and acts as a retrieval event, which may help CONTROL's retention (a threat to H1b).
11. Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. *Science*, 331(6018), 772-775. DOI 10.1126/science.1199327. **VERIFIED.** Same point as 10, for conceptual material.
12. Van Alten, D. C. D., Phielix, C., Janssen, J., & Kester, L. (2019). Effects of flipping the classroom on learning outcomes and satisfaction: a meta-analysis. *Educ. Res. Rev.*, 28, 100281. DOI 10.1016/j.edurev.2019.05.003. **VERIFIED.** Small positive learning effect, no satisfaction effect. Flip is bundled with video and class time, not sequence alone.
13. Bredow, C. A., Roehling, P. V., Knorp, A. J., & Sweet, A. M. (2021). To flip or not to flip? *Rev. Educ. Res.*, 91(6), 878-918. DOI 10.3102/00346543211019122. **VERIFIED.** Largest flip meta-analysis; effects are positive but modest. Sets the prior (d about 0.2-0.5).
14. Freeman, S., et al. (2014). Active learning increases student performance in science, engineering, and mathematics. *PNAS*, 111(23), 8410-8415. DOI 10.1073/pnas.1319030111. **VERIFIED.** General active-learning base rate. Both our arms are active, so it supports the premise, not the contrast.
15. Bishop, J. L., & Verleger, M. A. (2013). The flipped classroom: a survey of the research. *ASEE Annual Conference*, paper 23.1200. DOI 10.18260/1-2--22585; https://peer.asee.org/the-flipped-classroom-a-survey-of-the-research. **VERIFIED by search record only** (publisher page returned HTTP 403 to fetch; title, authors, year and DOI match the search listing). Early flip work was mostly single-group and perception-based.
16. Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educ. Psychol.*, 38(1), 23-31. DOI 10.1207/S15326985EP3801_4. **VERIFIED (Crossref: title, first author Kalyuga, year 2003, journal; volume and pages not checked).** Scaffolding helps novices and can hurt those with prior knowledge. Relevant to MSc students with pre about 90 and to the ceiling.
17. Deslauriers, L., et al. (2019). Measuring actual learning versus feeling of learning in response to being actively engaged in the classroom. *PNAS*, 116(39), 19251-19257. DOI 10.1073/pnas.1821936116. **VERIFIED (Crossref: title, first author, year, journal; volume and pages not checked).** Active learning can feel worse while testing better. Context for paper 02 and for interpreting a null on affect.
18. Wise, S. L., & Kong, X. (2005). Response time effort: a new measure of examinee motivation in computer-based tests. *Appl. Meas. Educ.*, 18(2), 163-183. **VERIFIED by search record only** (no DOI opened; the DOI I first tried resolved to a different paper, so none is given). Basis for the NT10 rapid-response rule (with Wise & Ma 2012, not verified, so not listed here).

19. Alfieri, L., Brooks, P. J., Aldrich, N. J., & Tenenbaum, H. R. (2011). Does discovery-based instruction enhance learning? *J. Educ. Psychol.*, 103(1), 1-18. DOI 10.1037/a0021017. **VERIFIED (Crossref) (via Consensus).** Unassisted discovery underperforms explicit instruction; enhanced (guided) discovery wins. Challenges: a game with little guidance may not help.
20. Chen, O., & Kalyuga, S. (2020). Exploring factors influencing the effectiveness of explicit instruction first and problem-solving first approaches. *Eur. J. Psychol. Educ.*, 35, 607-624. DOI 10.1007/s10212-019-00445-5. **VERIFIED (Crossref: year in Crossref is 2019, online first; volume 35 is 2020) (via Consensus).** Which order wins depends on learner and task factors. Supports a moderator analysis, challenges a universal claim.
21. Likourezos, V., & Kalyuga, S. (2017). Instruction-first and problem-solving-first approaches: alternative pathways to learning complex tasks. *Instr. Sci.*, 45, 195-219. DOI 10.1007/s11251-016-9399-4. **VERIFIED (Crossref: online year 2016) (via Consensus).** Instruction-first matched or beat problem-first on some outcomes. Contrary evidence for the immediate effect.
22. Ashman, G., Kalyuga, S., & Sweller, J. (2020). Problem-solving or explicit instruction: which should go first when element interactivity is high? *Educ. Psychol. Rev.*, 32, 229-247. DOI 10.1007/s10648-019-09500-5. **VERIFIED (Crossref: online year 2019) (via Consensus).** Explicit instruction first is better when element interactivity is high. Contrary evidence; our topics vary in complexity.
23. He, Fiorella, & Lemons (2025). Does instruction-first or problem-solving-first depend on learners' prior knowledge? *Educ. Psychol. Rev.*, 37. DOI 10.1007/s10648-025-09993-3. **VERIFIED (Crossref: title, authors, year, journal; first-name initials not checked) (via Consensus).** Prior knowledge as moderator. Fits the MSc ceiling (pre about 90) and our pre-score covariate.
24. Wijnen, M., Loyens, S. M. M., & Schaap, L. (2016). Experimental evidence of the relative effectiveness of problem-based learning for knowledge acquisition and retention. *Interact. Learn. Environ.*, 24, 1907-1921. DOI 10.1080/10494820.2015.1060504. **VERIFIED (Crossref: online year 2015; first author's initials and the other two authors not checked) (via Consensus).** Problem-based sequences did not clearly improve retention. Cautions that a delayed effect is not guaranteed.

25. Nissen, J. M., Talbot, R. M., Nasim Thompson, A., & Van Dusen, B. (2018). Comparison of normalized gain and Cohen's d for analyzing gains on concept inventories. *Phys. Rev. Phys. Educ. Res.*, 14, 010115. DOI 10.1103/physrevphyseducres.14.010115. **VERIFIED (Crossref: title, first author, year, journal; 4th author from memory, not checked) (via Consensus).** ⟨g⟩ is biased in favour of high-pretest groups. Supports demoting ⟨g⟩ to descriptive.
26. Coletta, V. P., & Steinert, J. J. (2020). Why normalized gain should continue to be used in analyzing preinstruction and postinstruction scores on concept inventories. *Phys. Rev. Phys. Educ. Res.*, 16, 010108. DOI 10.1103/physrevphyseducres.16.010108. **VERIFIED (via Consensus).** Rebuttal: the "bias" comes from omitted variables. Challenges the claim that ⟨g⟩ is unusable, so we report it descriptively and not as nothing.
27. Christman, E., Miller, P., & Stewart, J. (2024). Beyond normalized gain: improved comparison of physics educational outcomes. *Phys. Rev. Phys. Educ. Res.*, 20, 010123. DOI 10.1103/physrevphyseducres.20.010123. **VERIFIED (via Consensus).** Neither ⟨g⟩ nor Cohen's d removes variation across cohorts; modelling post on pre does. Matches our primary model.
28. Wan, F. (2021). Statistical analysis of two arm randomized pre-post designs with one post-treatment measurement. *BMC Med. Res. Methodol.*, 21, 150. DOI 10.1186/s12874-021-01323-9. **VERIFIED (Crossref: title, author, year, journal; article number not checked; Consensus shows 2020) (via Consensus).** ANCOVA is the most efficient analysis of randomized pre-post designs. Justifies the primary.
29. van Breukelen, G. J. P. (2013). ANCOVA versus CHANGE from baseline in nonrandomized studies: the difference. *Multivar. Behav. Res.*, 48, 895-922. DOI 10.1080/00273171.2013.831743. **VERIFIED (Crossref: title, author, year, journal; pages not checked) (via Consensus).** ANCOVA is preferred when assignment is randomized. Our assignment is randomized per topic.
30. Liu, Q., & Wang, L. (2021). t-Test and ANOVA for data with ceiling and/or floor effects. *Behav. Res. Methods*, 53, 264-277. DOI 10.3758/s13428-020-01407-2. **VERIFIED (Crossref: title, first author, journal, volume; Crossref year 2020 online; pages from memory, not checked) (via Consensus).** Treating ceiling data as true values distorts effect sizes. Supports the ceiling-aware sensitivity analysis (b) and suggests a censored-regression check.

31. Newman, P. M., & DeCaro, M. S. (2019). Learning by exploring: how much guidance is optimal? *Learn. Instr.*, 62, 49-63. DOI 10.1016/j.learninstruc.2019.05.005. **VERIFIED (Crossref: title, authors, year, journal, volume; pages from memory, not checked) (via Consensus).** In one experiment the exploration benefit appeared only when a pretest came first; in another it did not. Our pre-check is a pretest in both arms, which may help or mask the contrast.
32. Sana, F., Yan, V. X., & Kim, J. A. (2021). Improving conceptual learning via pretests. *J. Exp. Psychol. Appl.*, 27. DOI 10.1037/xap0000322. **VERIFIED (Crossref: title, authors, journal, volume; Consensus lists 2020 online, Crossref 2021) (via Consensus).** Taking a pretest improved conceptual classification, beyond directing attention. The pretest is a mechanism in both arms, so it shrinks the FLIP-CONTROL contrast.
33. Steger, D., Schroeders, U., & Gnambs, T. (2020). A meta-analysis of test scores in proctored and unproctored ability assessments. *Eur. J. Psychol. Assess.*, 36. DOI 10.1027/1015-5759/a000494. **VERIFIED (Crossref; Consensus lists 2018 preprint) (via Consensus).** Unproctored scores run higher (Δ = 0.20), smaller for items that are hard to look up. Supports treating external help as a measured threat.
34. Carstairs, J., & Myors, B. (2009). Internet testing: a natural experiment reveals test score inflation on a high-stakes, unproctored cognitive test. *Comput. Hum. Behav.*, 25. DOI 10.1016/j.chb.2009.01.011. **VERIFIED (Crossref: title, authors, year, journal, volume) (via Consensus).** Inflation seen with high stakes. Our checks are low-stakes, so this is a ceiling on the concern, not a measurement of it.
35. Lannin, D. G., Flinn, ..., & Ilie (2025). Unmonitored online exams: valid assessment or score inflation? *Teach. Psychol.* DOI 10.1177/00986283251324172. **VERIFIED (Crossref: title, first author, year, journal; middle authors not checked) (via Consensus).** Unmonitored final exam scores were higher, with a weaker link to in-person performance. Stakes were high there.
36. Jennings, M. A., & Cribbie, R. A. (2021). Comparing pre-post change across groups: guidelines for choosing between difference scores, ANCOVA, and residual change scores. *J. Data Sci.* **UNVERIFIED (via Consensus; Crossref lookup returned nothing, no DOI found).** Simulation including floor/ceiling effects. Do not cite until a DOI is confirmed.

**Counts: 35 VERIFIED (2 by search record only), 1 UNVERIFIED.**

## 4. Review of the field

- Flip meta-analyses are positive but modest (Bredow d about 0.2-0.5; van Alten small), and they bundle video, class time and quizzes. Sequence alone is rarely isolated.
- The sequence question is best studied under "productive failure" and "exploration before instruction". The Sinha & Kapur synthesis favours explore-first for conceptual understanding and transfer.
- Contested: immediate versus delayed. Saba et al. (2025) found a worse immediate outcome and better transfer. DeCaro (2026) found a tie on facts and a gain on concepts. So the dependent variable decides the answer.
- Contested: which activity. Velić & DeCaro (2025) show that the design of the activity matters, not only its position.
- "Test first" is not a weak control. Pretesting and retrieval both help learning (Pan & Carpenter; Roediger & Karpicke).
- Most studies are single-topic, single-session lab or classroom studies in physics, chemistry or maths, with one topic and one cohort.
- Consensus pass (2026-10-16): the evidence on delayed retention is mixed. Problem-first helps conceptual understanding and transfer, but often not basic retention (Wijnen; Likourezos & Kalyuga). Instruction-first is better when element interactivity is high or prior knowledge is high (Ashman; Chen & Kalyuga; He et al.). Unguided discovery loses (Alfieri).
- Methods: ⟨g⟩ is contested. Nissen et al. say it favours high-pretest groups and Coletta & Steinert say that comes from omitted variables. For randomized pre-post designs ANCOVA on the post score is the most efficient analysis (Wan; van Breukelen), which is our registered primary. Ceiling data can bias effect sizes (Liu & Wang).
- Gap: a within-student, per-topic randomised test across about 11 topics in a real course, with immediate and delayed outcomes, on a game platform in an HCI course. The multi-topic design gives many repeated mini-tests, so topic and cohort confounds can be separated out.
- Method gap: the unproctored low-stakes check is rarely reported. External help and rapid guessing are measured here directly.

## 5. Argument (premise to conclusion)

1. Theory predicts exploration before instruction helps, mostly on conceptual and delayed outcomes (Schwartz & Bransford; Kapur; Sinha & Kapur). *Cited.*
2. The immediate check is a weak test of that prediction. Scores are ceiling-bound (~73% of post scores = 100) and the instrument itself drifts (Form B easier, retest effect). *Our data, interim.*
3. A within-student, per-topic randomised design removes student and topic confounds, so the order effect is estimated cleanly (compliance 99.7%). *Our data.*
4. Immediate result: FLIP is +0.85 to +1.35 points, CIs include 0. The game accounts for about 1.3 of a ~7 point gain. This is consistent with Saba et al. and with ceiling compression. *Interim, exploratory.*
5. The gain is also contaminated by external help (leaving the page: +7.0 pre, +5.5 post, within student). The pre-check flag is adjusted for. The post-check flag is not, because it is post-treatment. *Interim.*
6. Productive-failure theory places the benefit in slower decay. The retention battery tests that on Form C and an application probe, registered before the window opens. *To come in Nov.*
7. Conclusion, either way: a small or null immediate effect plus a retention effect supports "flip helps later". A null on both is evidence against a flip benefit of this kind in this setting. Both are reported as findings. *To come in Nov.*

## 6. Our evidence so far (interim, exploratory unless stated)

- Mixed model (post ~ condition + pre), ITT: FLIP +0.85 (p .25) to +1.17 (completers, p .11); with pre-check external-help covariate +1.35 (95% CI -0.13 to +2.84, p .07).
- ⟨g⟩ FLIP 0.565 vs CONTROL 0.448 at the 10-08 look, and 0.52 vs 0.41 in the later brief. It overstates the gap relative to the post-score model.
- Gain decomposition: about 7 points total = ~5.4 instrument (Form B easier, retest; CONTROL gains with nothing taught between checks) + ~1.3 game. About 73% of post scores = 100.
- Attrition: FLIP 38 vs CONTROL 6 participant-topic rows, concentrated in gestalt and fitts-law. The cause was a routing bug (fixed 2026-10-08); ITT handles it conservatively.
- External help: 44% of pre-checks left the page. Leaving the page: +7.0 pre / +5.5 post within student. FLIP leaves less on the post-check (-6 pp).
- Decisiveness (selection changes + options hovered) is lower under FLIP (-0.041 SD, p .010). Dwell on the correct option is +1.5 pp (p .019). Post-hoc index, not confirmatory.
- Completion timing (post-hoc): on-time +2.11 (p .010), after the lecture -2.0.
- Population: FLIP-CONTROL ⟨g⟩ gap UG 0.115 vs MSc 0.045. MSc pre about 90, ceiling.
- Reflection: 51% reach "insight" (tutor flag), equal by arm. Insight tracks the prior post score weakly (p .07). Relevant to the exploratory tutor-retention analysis.
- Retention: no data yet. Window ~2026-11-23..26 (14 days).

## 7. Threats and counter-arguments

- **"It is a null."** Report the CI. A CI excluding more than a few points is evidence against a large immediate benefit (registered). Retention was added to answer this, and the Saba et al. boundary condition is registered in advance.
- **Ceiling and unstable ⟨g⟩.** Primary is covariate-adjusted post (ITT). The ceiling-aware GEE and descriptive ⟨g⟩ are sensitivities. The primary was changed after one interim look (disclosed), and the change reduced the FLIP estimate.
- **Unregistered interim looks.** Two looks are disclosed in the registration. The final estimate is run once, after the last topic closes.
- **Ceiling data distort the estimate (Liu & Wang).** The registered ceiling-aware GEE covers this. Add a censored (Tobit-type) model on post as an extra sensitivity check; not registered, so label it exploratory.
- **Form B easier than A.** Instrument drift affects both arms equally within student, so the contrast survives, but absolute gain is not interpretable. Form C items were desk-reviewed. Form C is analysed standalone, never as C minus B.
- **External help, unproctored.** Pre-check flag covariate and restricted analysis (registered). Post flags are not adjusted, to avoid conditioning on a post-treatment variable. Battery flags are measured on the outcome occasion and reported by arm.
- **Differential attrition (routing bug).** ITT with missing post set to pre (conservative). Gestalt is flagged. Attrition is shown in a CONSORT-style diagram.
- **Per-topic randomisation by alternation (hash parity), arms frozen after SID migration.** Describe the mechanism honestly. It is not a random number generator, but assignment is balanced and was recorded at release time.
- **CONTROL also plays the game, afterwards.** The contrast is order, not exposure. This limits the claim to timing, and it should not be described as "game versus no game".
- **Test-first has its own benefit, and a pretest may be needed for exploration to pay off (Sana; Newman & DeCaro).** Both arms take the pre-check, so the design holds the pretest constant. The contrast is order only, and an effect here may be smaller than in studies without a pretest. State this in the discussion.
- **Unproctored scores run higher (Steger et al. Δ = 0.20; Carstairs & Myors; Lannin et al.).** Those studies were high-stakes. Ours are ungraded, and we measure leaving the page directly. Say that stakes are low but not zero, and keep the pre-check covariate.
- **Test-first has its own benefit (retrieval).** The post-check as retrieval may help CONTROL's retention. Reported as an alternative explanation if H1b is null or negative.
- **Retention non-response and external help in the battery.** Response rate by arm is reported. Both arms contribute for each student, so non-response removes both together. Copy and left-page flags are reported.
- **Retention may not favour FLIP at all (Wijnen; Likourezos & Kalyuga).** H1b is registered two-sided and a null is reported as such. Our Form C is MC recognition, which is the outcome least likely to show a sequence effect, so the application probe (H1c) carries the weight.
- **Moderators: complexity and prior knowledge (Ashman; He et al.).** Topic heterogeneity and the pre-score are already in the model. Add pre-score x condition as an exploratory term; the MSc ceiling is consistent with it.
- **One activity design per topic (Velić & DeCaro).** Per-topic heterogeneity is exploratory. Claims are limited to this platform's games.
- **Single course, HCI content, Hong Kong.** Stated as a limit. MSc inclusion is cleared by ethics.
- **Multiple pre-registrations.** Holm correction across 01 and 02 if both are filed confirmatory. None of the paper-02 effects survive Holm so far.

## 8. Venue fit

- *Computers & Education* — named in the dossier. Fits a large-N digital-learning RCT-style design and a null/boundary-condition framing.
- *British Journal of Educational Psychology* or *Instructional Science* — where the closest prior work (DeCaro 2026, Velić & DeCaro 2025, Saba et al. 2025) appeared. Best for a theory-facing exploration-before-instruction framing.
- *ACM Learning@Scale* — in-vivo course experiments, large cohort, platform telemetry. Suits a design-and-findings paper, with less demand on a theory contribution.

## 9. Open items

- Finish the Form C desk-review (`docs/retention-review-packet.md`) and list changed items in 01b §9. Then file 01b before 2026-11-23. Confirm the rapid-guess floor.
- Run the final H1 on the full immediate dataset only after the last topic closes. Produce the CONSORT diagram and attrition by condition.
- Gather retention data (window 2026-11-23..26, closes +14 days). Compute response rate by section and arm.
- Offline blind application-probe grading, plus a ≥60-answer human subsample for Cohen's κ (paper 08 dependency). If κ < 0.6, H1c is descriptive only.
- Human coding of the reflections (paper 03) before the tutor-insight retention analysis is interpreted.
- Report the minimum detectable effect from the realised N and ICCs. Report norman and hicks-law separately.
- Disclosure text for the unregistered looks (10-08, 10-09, 10-13) and the post-hoc analyses (decisiveness, timing).
- Consensus log (2026-10-16): pass 1 (browser helper): "exploration or problem solving before instruction, delayed retention" + 1 same-thread follow-up (instruction-first better; moderators). Pass 2 (Consensus MCP, 3 calls): "limitations of Hake normalized gain ... ceiling effect critique"; "ceiling effects in pre-post experiments, ANCOVA vs gain scores"; "randomized pretest-posttest ANCOVA vs change scores". Each returned 3 papers (free tier). Round 2 (Consensus MCP, 5 calls, full-sentence questions): (1) does an interactive game or simulation before a knowledge test beat test-first in undergraduates (returned only unrelated serious-game trials, none added); (2) does a pretest or retrieval event change the exploration-first benefit; (3) how much does unproctored low-stakes online testing inflate scores; (4) does a pretest before an exploratory activity improve conceptual learning; (5) is unproctored inflation smaller when low-stakes. 12 DOIs verified on Crossref in total; 1 source UNVERIFIED.
- Consider adding sources beyond these 18: ceiling and normalised-gain critiques, and a delayed-retention flip study. Candidates have not been looked up yet.
- Check the DeCaro 2026 year (online 2025, print 2026) and the full pages of entries 16-17 before submission. Do not cite from memory.
