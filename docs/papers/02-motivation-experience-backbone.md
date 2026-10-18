# Paper 02 backbone — motivation, community, satisfaction, effort (and straight-lining)

*Built 2026-10-16. Sources: `docs/papers/_brief.md`, `docs/lit/02-motivation-experience.md`,
`docs/pre-registration/02-affective-experience.md`, `docs/lit/arguments-for-against.md`,
`docs/lit/citation-verification.md`. All numbers from our data are INTERIM / EXPLORATORY (one
unregistered look, 185 participants, 766 per-topic batteries per instrument, disclosed in the
pre-reg revision of 2026-10-08). Citation checking: this session resolved every DOI below against
the CrossRef registry and compared title, authors, year, journal (details in section 3).*

## 1. Working title and one-sentence claim

**Working title:** *Does playing first make learning feel better? A within-student, per-topic
randomised test of motivation, community, satisfaction and effort in a flipped HCI course — and
what careless responding does to such measures.*

**Claim the data supports today:** Across 13 topics, putting the game before the post-check
(FLIP) produced at most tiny, uncorrected advantages in interest/enjoyment (+0.064) and
satisfaction (+0.065) and nothing on competence, effort, value, community, global ARCS or
perceived load — and none survives Holm correction; in the same data, most per-topic
questionnaire submissions are straight-lined (CoI 72%, ARCS 73%, IMI 41%), so the felt-experience
instruments are only weakly informative in this unproctored, repeated-measures setting.

## 2. Research questions / hypotheses (matching pre-reg `02`)

- **H2 (motivation):** FLIP raises intrinsic motivation (IMI subscales) vs CONTROL.
- **H3 (community):** FLIP raises sense of learning community (CoI reworded: "instructor" -> "game + AI tutor"; non-validated, exploratory within the bundle).
- **H4 (satisfaction):** FLIP raises ARCS-S satisfaction (null predicted a priori; reported as such).
- **Effort:** does any felt benefit survive the effort cost (Paas 9-point; outcome, and secondary covariate)?
- **Model (registered):** `score ~ condition + (1|participant) [+ (1|topic)]`; H2/H3 confirmatory, joined with H1 in one Holm-Bonferroni family.
- **Registered exclusion rule (2026-10-08):** flag a submission when long-string = item count (all items identical); run each primary twice (all vs flagged excluded); report flag rate per instrument and per condition; Paas cannot be flagged.
- **RQ-S (added, descriptive/exploratory — NOT in the registration, say so):** how prevalent is straight-lining, does it differ by condition, topic order, or instrument design (reverse-keyed items), and does excluding it change the condition estimates?

## 3. Literature support (verification ledger)

Method: DOI resolved via CrossRef API this session; **VERIFIED** = registry record's title, first
authors, year and journal match the citation. I did not read full texts; the "what it shows"
lines for the first twelve come from the existing dossier (`docs/lit/02-...md`), whose factual
claims (effect sizes) I did not re-derive. Corrections to the dossier are flagged.

**A. Theory and instruments**
1. Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist, 55*(1), 68-78. DOI 10.1037/0003-066X.55.1.68 — **VERIFIED**. SDT: autonomy/competence/relatedness underlie intrinsic motivation; predicts an H2 gain.
2. McAuley, E., Duncan, T., & Tammen, V. V. (1989). Psychometric properties of the Intrinsic Motivation Inventory in a competitive sport setting: A confirmatory factor analysis. *Research Quarterly for Exercise and Sport, 60*(1), 48-58. DOI 10.1080/02701367.1989.10607413 — **VERIFIED**. Validates IMI structure; note validation is in sport, and our use is per-topic in a short unproctored battery.
3. Garrison, D. R., Anderson, T., & Archer, W. (1999). Critical inquiry in a text-based environment: Computer conferencing in higher education. *The Internet and Higher Education, 2*(2-3), 87-105. DOI 10.1016/S1096-7516(00)00016-6 — **VERIFIED**. CoI framework. **Correction: year is 1999 (dossier says 2000).**
4. Arbaugh, J. B., et al. (2008). Developing a community of inquiry instrument: Testing a measure of the Community of Inquiry framework using a multi-institutional sample. *The Internet and Higher Education, 11*(3-4), 133-136. DOI 10.1016/j.iheduc.2008.06.003 — **VERIFIED**. The 34-item CoI survey we reworded; our reword voids its validity evidence (threat).
5. Keller, J. M. (1987). Development and use of the ARCS model of instructional design. *Journal of Instructional Development, 10*(3), 2-10. DOI 10.1007/BF02905780 — **VERIFIED**. ARCS model.
6. Paas, F. G. W. C. (1992). Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach. *Journal of Educational Psychology, 84*(4), 429-434. DOI 10.1037/0022-0663.84.4.429 — **VERIFIED**. Source of the 9-point effort item.

**B. The flip, motivation, satisfaction, load**
7. Abeysekera, L., & Dawson, P. (2015). Motivation and cognitive load in the flipped classroom: definition, rationale and a call for research. *Higher Education Research & Development, 34*(1), 1-14. DOI 10.1080/07294360.2014.934336 — **VERIFIED**. Frames the flip's motivation upside against load cost; this paper is an empirical answer to their call.
8. van Alten, D. C. D., Phielix, C., Janssen, J., & Kester, L. (2019). Effects of flipping the classroom on learning outcomes and satisfaction: A meta-analysis. *Educational Research Review, 28*, 100281. DOI 10.1016/j.edurev.2019.05.003 — **VERIFIED**. Small learning benefit, no satisfaction effect (g = 0.05, per dossier). Supports our null on H4.
9. Strelan, P., Osborn, A., & Palmer, E. (2020). Student satisfaction with courses and instructors in a flipped classroom: A meta-analysis. *Journal of Computer Assisted Learning, 36*(3), 295-314. DOI 10.1111/jcal.12421 — **VERIFIED**. Weak-moderate positive satisfaction effect (g = 0.36, per dossier); disagrees with #8. **Correction: pages are 295-314 (dossier says 378-399).**
10. Zheng, L., Bhagat, K. K., Zhen, Y., & Zhang, X. (2020). The effectiveness of the flipped classroom on students' learning achievement and learning motivation: A meta-analysis. *Educational Technology & Society, 23*(1), 1-15. No DOI located — **UNVERIFIED** (not resolved by me; the 2026-09-19 ledger reports it confirmed, but I did not open it). Moderate pooled motivation effect (per dossier).
11. Bredow, C. A., Roehling, P. V., Knorp, A. J., & Sweet, A. M. (2021). To flip or not to flip? A meta-analysis of the efficacy of flipped learning in higher education. *Review of Educational Research, 91*(6), 878-918. DOI 10.3102/00346543211019122 — **VERIFIED**. Large flip meta-analysis (cited in `arguments-for-against.md` for learning); context for "bundled flip" vs our sequence-only manipulation.
12. Wu, Q., Han, Z., Hao, Z., Chen, J., & Pan, Y. (2025). Impact of flipped classroom method in physical education on the intrinsic motivation, self-efficacy, and learning satisfaction: A meta-analysis. *PLOS ONE, 20*(5), e0324609. DOI 10.1371/journal.pone.0324609 — **VERIFIED**. Positive on motivation and satisfaction, PE only.
13. Lee, Y., & Kim, K. J. (2018). Enhancement of student perceptions of learner-centeredness and community of inquiry in flipped classrooms. *BMC Medical Education, 18*, 242. DOI 10.1186/s12909-018-1347-3 — **VERIFIED** (title/authors/year/journal; article number not shown in registry output). Single-group CoI gains; no control, which is the weakness our design fixes.
14. de Leng, B., & Pawelka, F. (2021). The cognitive load of the in-class phase of a flipped classroom course on radiology: Could computer support be of help? *Medical Teacher, 43*(2), 216-222. DOI 10.1080/0142159X.2020.1841890 — **VERIFIED**. Well-designed flip: high germane, low extraneous load. **Correction: 43(2), 216-222; registry year 2021 (online 2020); dossier's "43(3), 1-8" is wrong.**
15. Deslauriers, L., McCarty, L. S., Miller, K., Callaghan, K., & Kestin, G. (2019). Measuring actual learning versus feeling of learning in response to being actively engaged in the classroom. *PNAS, 116*(39), 19251-19257. DOI 10.1073/pnas.1821936116 — **VERIFIED**. More learning, lower felt learning under active learning; the "effort without felt benefit" branch.
16. Wouters, P., van Nimwegen, C., van Oostendorp, H., & van der Spek, E. D. (2013). A meta-analysis of the cognitive and motivational effects of serious games. *Journal of Educational Psychology, 105*(2), 249-265. DOI 10.1037/a0031311 — **VERIFIED**. Games help learning more than motivation (dossier: motivation gain n.s.); motivation and learning can dissociate.

**C. Careless / straight-lined responding (new for this paper)**
17. Meade, A. W., & Craig, S. B. (2012). Identifying careless responses in survey data. *Psychological Methods, 17*(3), 437-455. DOI 10.1037/a0028085 — **VERIFIED**. Long-string index among careless-response detectors; basis of our flag rule (pre-reg cites it).
18. Kim, Y., Dykema, J., Stevenson, J., Black, P., & Moberg, D. P. (2019; online 2018). Straightlining: Overview of measurement, comparison of indicators, and effects in mail-web mixed-mode surveys. *Social Science Computer Review, 37*(2), 214-233. DOI 10.1177/0894439317752406 — **VERIFIED** (registry lists Kim, Dykema, Stevenson, Black; full author list not checked). Straightlining indicators differ and the flag is not a clean quality signal; caution on exclusion.
19. Huang, J. L., Curran, P. G., Keeney, J., Poposki, E. M., & DeShon, R. P. (2012). Detecting and deterring insufficient effort responding to surveys. *Journal of Business and Psychology, 27*(1), 99-114. DOI 10.1007/s10869-011-9231-8 — **VERIFIED** (registry year 2011 online; issue 2012). Insufficient-effort responding is common and distorts relationships.
20. Krosnick, J. A. (1991). Response strategies for coping with the cognitive demands of attitude measures in surveys. *Applied Cognitive Psychology, 5*(3), 213-236. DOI 10.1002/acp.2350050305 — **VERIFIED**. Satisficing theory: low motivation, high burden, easy task -> shortcut responding; explains repeated per-topic batteries.

**D. Added via Consensus (2026-10-16; titles from Consensus, bibliographic details from CrossRef; Consensus summaries not used as evidence)**
21. Ward, M. K., & Meade, A. W. (2023). Dealing with careless responding in survey data: Prevention, identification, and recommended best practices. *Annual Review of Psychology, 74*(1), 577-596. DOI 10.1146/annurev-psych-040422-045007 — **VERIFIED** (via Consensus). Review of prevention and detection; supports our flag rule and the advice to report results with and without screening.
22. Aarø, L., Fismen, Wold, et al. (2022). Nordic adolescents responding to demanding survey scales in boring contexts: Examining straightlining. *Journal of Adolescence, 94*, 829-843. DOI 10.1002/jad.12066 — **VERIFIED** (via Consensus; author list beyond first three not checked). Consensus's key takeaway says straight-lining is not a general marker of poor data quality in this sample (abstract not read by me); challenges treating our flag as pure invalidity.
23. Gummer, T., Roßmann, J., & Silber, H. (2021; online 2018). Using instructed response items as attention checks in web surveys: Properties and implementation. *Sociological Methods & Research, 50*(1), 238-264. DOI 10.1177/0049124118769083 — **VERIFIED** (via Consensus). Reported finding (per Consensus, not re-read): inattentive respondents did not change substantive results; argues exclusion may not matter, and attention checks are a prevention option we did not build in.
24. Ertuna, L., Kaya-Uyanik, G., & Gençaslan, B. (2026). More than just noise: Careless responding and its systematic effects on reliability, validity, and measurement invariance. *Frontiers in Psychology, 17*. DOI 10.3389/fpsyg.2026.1815225 — **VERIFIED** (via Consensus; first names assumed from registry initials, family names checked). Reported opposite direction to #23: careless responding systematically distorts reliability and validity (per Consensus summary, abstract not read).
25. Jensen, J. L., Kummer, T. A., & Godoy, P. D. d. M. (2015). Improvements from a flipped classroom may simply be the fruits of active learning. *CBE—Life Sciences Education, 14*(1). DOI 10.1187/cbe.14-08-0129 — **VERIFIED** (via Consensus; family names match registry). Challenge: gains attributed to the flip may come from active learning generally; fits our sequence-only manipulation, where both arms play the game.
26. Alcalde, M., & Nagel, M. (2019). Why does peer instruction improve student satisfaction more than student performance? A randomized experiment. *International Review of Economics Education, 30*. DOI 10.1016/j.iree.2018.10.001 — **VERIFIED** (via Consensus; the registry also lists a 2015 SSRN version). Randomised evidence that active methods can raise satisfaction without raising performance; the reverse dissociation from #15.

**E. Added via Consensus, round 2 (2026-10-16; CrossRef-checked by title, first author, year, journal)**
27. Taghizade, A., Azimi, E., & Mahmoodian, H. (2023). Integrating Community of Inquiry framework principles with flipped classroom pedagogy to enhance students' perceived presence sense, self-regulated learning, and learning performance in preservice teacher education. *IRRODL, 24*(4), 154-173. DOI 10.19173/irrodl.v24i4.7005 — **VERIFIED** (via Consensus). This is the IRRODL paper the dossier flagged; quasi-experiment (n = 64, Iran) with validated CoI survey reports between-group presence gains, but the intervention is a CoI-designed flip, not sequence alone; between-course, not within-student.
28. Ay, K., & Dağhan, G. (2023). The effect of the flipped learning approach designed with community of inquiry model to the development of students' critical thinking strategies and social, teaching and cognitive presences. *Education and Information Technologies, 28*(11), 15267-15299. DOI 10.1007/s10639-023-11809-2 — **VERIFIED** (via Consensus; author list inferred from registry family names). Repeated-measures, n = 35, CoI rises when the pre-class phase is built on CoI; single group, so same weakness as #13.
29. le Roux, I., & Nagel, L. (2018). Seeking the best blend for deep learning in a flipped classroom: viewing student perceptions through the Community of Inquiry lens. *International Journal of Educational Technology in Higher Education, 15*(1). DOI 10.1186/s41239-018-0098-x — **VERIFIED** (via Consensus). Case study: social presence was the weakest presence in a flipped course (per Consensus-provided abstract); suggests H3 is the least likely construct to move.
30. Walck-Shannon, E. M., Barton, & Rowell (2025). Students don't learn the way they think they do in a large, active-learning genetics course. *CBE—Life Sciences Education, 24*(2). DOI 10.1187/cbe.24-10-0251 — **VERIFIED** (via Consensus; family names and first author checked). Within-subjects: perceived helpfulness misaligned with learning gains; supports treating affect and learning as separable.
31. Stosic, M. D., Murphy, B. A., Duong, F., et al. (2024). Careless responding: Why many findings are spurious or spuriously inflated. *Advances in Methods and Practices in Psychological Science, 7*. DOI 10.1177/25152459241231581 — **VERIFIED** (via Consensus; first names unchecked). Not screening can inflate effects, so our two nominal positives need the flag-excluded check as much as the nulls do.
32. Maniaci, M. R., & Rogge, R. D. (2014). Caring about carelessness: Participant inattention and its effects on research. *Journal of Research in Personality, 48*, 61-83. DOI 10.1016/j.jrp.2013.09.008 — **VERIFIED** (via Consensus). Reports 3-9% highly inattentive respondents, and that inattention can obscure experimental manipulation effects; our rates are far higher, and the mechanism implies bias toward null in a randomised contrast.
33. Bowling, N. A., Gibson, A. M., & DeSimone, J. A. (2022). Stop with the questions already! Does data quality suffer for scales positioned near the end of a lengthy questionnaire? *Journal of Business and Psychology, 37*. DOI 10.1007/s10869-021-09787-8 — **VERIFIED** (via Consensus). Two experiments found no position effect; challenges the assumption that fatigue explains our straight-lining. Our burden is across 13 separate sessions, not one long form, so it is not a direct test.
34. Eisele, G., Vachon, H., Lafit, G., et al. (2020). The effects of sampling frequency and questionnaire length on perceived burden, compliance, and careless responding in experience sampling data in a student population. *Assessment*. Consensus lists the journal version; CrossRef returned only the OSF preprint (DOI 10.31234/osf.io/zf4nm) — **UNVERIFIED** as the journal article (preprint title/authors/year match). Longer questionnaires, but not higher sampling frequency, worsened burden and data quality (per Consensus abstract).

**Tally: 32 VERIFIED, 2 UNVERIFIED (Zheng 2020, Eisele 2020 journal version).** (19 original + 6 Consensus round 1 + 7 round 2.) Zheng 2020 was seen in Consensus with matching title/authors/year/journal and 95 studies / 15,386 participants, but I found no DOI, so it stays UNVERIFIED by the rule. First names in several entries abbreviated where only family names were checked. Not used because unchecked: the IRRODL CoI + flipped + SRL paper flagged in the dossier (must be found and read before related work is written).

## 4. Review of the field (points)

- Flip meta-analyses agree on a small-to-moderate learning benefit (#8, #11) but are bundles of video, reduced class time and activity; the sequence-only contribution to felt experience is rarely isolated.
- Satisfaction is genuinely split: null (#8, g ~ 0.05) vs weak-moderate positive (#9, g ~ 0.36). Differences in inclusion rules and outcome definitions are plausible, not yet resolved.
- Motivation looks positive in pooled work (#10, #12), though #12 is PE-only and primary studies are mostly between-course, single-construct, self-report.
- Theory predicts a motivation gain via SDT (#1) but a load cost via CLT (#7); #14 shows the cost is conditional on design.
- Active learning can raise learning while lowering felt learning (#15); felt experience is not a proxy for learning, and games show the same dissociation (#16).
- CoI evidence for flip is mostly single-group pre/post (#13) using the instrument validated in #4; reworded versions have no validity evidence.
- Self-report instruments have well-known weaknesses under burden: satisficing and straight-lining (#17-#20). Educational flip studies rarely report careless-response rates, and the straight-lining flag is itself contested (#18).
- **Gap:** no located study measures IMI + CoI + ARCS + Paas jointly, within-student, randomised per topic across many topics, **and** reports how much of the self-report data is careless. This paper does both.

## 5. Argument (premise to conclusion)

1. Whether a flip changes how learning feels is contested (split satisfaction metas; felt-learning dissociation). — Cited (#8, #9, #15).
2. Prior tests are single-construct, between-course or single-group, so the dissociation between motivation, community, satisfaction and effort cannot be read off them. — Cited (#13; dossier gap section).
3. Our design (within-student, per-topic randomised, four constructs, 13 topics) removes stable person differences and ordering-by-cohort confounds. — Design; compliance 99.7% (paper 06).
4. Under that design, FLIP shows at most small advantages on interest/enjoyment (+0.064) and ARCS satisfaction (+0.065); nothing on other subscales or Paas; none survive Holm. — Our interim data (exploratory); final numbers after last topic.
5. This is consistent with the null-satisfaction meta (#8) and does not support a large felt benefit; the effort branch (Paas FLIP ~6.5 vs ~6.7; model -0.04, p .58) shows no cost either. — Interim.
6. But the instruments are heavily straight-lined (CoI 72%, ARCS 73%, IMI 41%); on IMI, whose reverse-keyed items (M9, M11) make an all-same pattern contradictory, the rate is a lower bound on invalid responding. — Our data; #17, #19, #20.
7. Therefore a flat result is ambiguous: no effect, or measurement too noisy to see one. Reporting both all-data and flag-excluded estimates, with flag rate by condition, separates the readings. — Pre-registered rule; analysis to come.
8. Conclusion (provisional): the flip's felt-experience effect, if any, is small relative to what unproctored per-topic self-report can detect; the methodological lesson (burden-driven straight-lining across 13 repeated batteries) is itself a finding that generalises to in-vivo education experiments. — To come in Nov (final data, flag analysis, retention link).

## 6. Our evidence so far (interim, exploratory)

- Interim look 2026-10-08: 185 participants, 766 batteries per instrument; within-student mixed models.
- IMI interest/enjoyment +0.064 (95% CI +0.009 to +0.119, p .022); ARCS-S +0.065 (+0.007 to +0.124, p .028).
- No effect on IMI competence, effort, value; CoI teaching/social presence; ARCS global; Paas (-0.04, p .58). Raw Paas means FLIP 6.5 vs CONTROL 6.7.
- Nine uncorrected tests; neither positive result survives Holm.
- Straight-lined share of submissions: IMI 41%, CoI 72%, ARCS 73%. Flag rate by condition not yet reported in our brief; must be computed.
- This look was unregistered and preceded analysis lock; the pre-reg discloses it. Final estimates are to be computed once after the last topic.
- Context from other papers: paper 01 immediate gain is small and mostly instrument (Form B easier + retest), so a felt benefit, if present, has little learning difference to ride on; paper 04 shows 40% tab-leaving on checks and median 16 s/item (low-effort setting, same population).

## 7. Threats and counter-arguments

- **"Straight-lining is just uniform agreement, not carelessness."** For all-positive CoI/ARCS items, agreement can be real or acquiescence. Answer: IMI's reverse-keyed items give a floor of invalid responding; report all-vs-excluded; cite #18 on indicator ambiguity; add a secondary long-string threshold (e.g. >=80% identical) as sensitivity only, labelled exploratory.
- **Contrary evidence on whether screening matters (via Consensus; #22-#24).** Aarø 2022 and Gummer 2021 point to straight-lining/inattention not necessarily harming substantive results, while Ertuna 2026 reports systematic distortion. Answer: the literature is split, which is why both estimates are reported; do not claim the 41-73% rate invalidates the data, only that it limits what a null can mean.
- **Fatigue may not be the cause of straight-lining (#33 vs #34).** One experiment found no end-of-questionnaire effect; another found length matters. Answer: do not assert fatigue; test flag ~ topic order and time-on-battery, and report as descriptive.
- **Careless responding biases toward null in randomised contrasts but toward spurious positives elsewhere (#31, #32).** Answer: this is why the two nominal positives and the many nulls are each read under both samples, and why a flat result is called ambiguous, not evidence of absence.
- **Social presence is the weakest CoI presence in flipped courses (#29) and CoI gains elsewhere come from CoI-designed flips (#27, #28).** Answer: expect little on H3 in a sequence-only manipulation; the reworded instrument remains exploratory.
- **"Any effect is the flip's active learning, not the sequence" (#25) and "satisfaction can move without performance" (#26).** Answer: both arms play the same game, so only ordering differs; state this scope explicitly and avoid generalising to flip as a bundle.
- **Excluding flagged responses conditions on a post-randomisation variable** and could break balance if flagging differs by arm. Answer: pre-registered to report flag rate by condition; analyse both ways; treat all-data ITT as primary-of-record unless flagging is balanced.
- **Per-topic repeated batteries cause fatigue (satisficing, #20)**, so rate rises with topic index. Answer: model flag ~ topic order and condition; test whether effects concentrate in early topics.
- **Reworded CoI is non-validated.** A CoI null could be instrument artefact. Answer: labelled exploratory; report reliability (alpha/omega) on non-flagged data; no validity claim.
- **Multiplicity and the unregistered look.** Answer: full disclosure of nine tests, Holm family with H1, effect sizes with CIs; final analysis computed once, not by peeking.
- **Ceiling and tiny effects are practically meaningless (+0.06 on a 1-7 scale).** Answer: present equivalence/smallest-effect framing; do not narrate p .02 results as findings.
- **Unproctored, low-stakes setting; external help common (paper 04).** Answer: limitation; affect measures are less help-sensitive than scores but equally burden-sensitive.
- **Per-topic randomisation by hash parity and the Gestalt routing bug (differential attrition).** Answer: cross-reference paper 06; sensitivity excluding affected topic.
- **Motivation need not track learning (#16, #15).** Answer: this is the paper's point; correlate affect with H1 gain exploratorily only.

## 8. Venue fit

- **Contemporary Educational Psychology** (dossier target) — fits the four-construct motivation/load framing; wants preregistration and effect-size honesty.
- **Computers & Education** or **Internet and Higher Education** — flip + CoI audience; fits the in-vivo design and instrument-quality angle.
- **Learning and Individual Differences / Educational Psychology Review-style methods note** or an educational-measurement venue — alternative if the straight-lining analysis becomes the lead contribution.

(Venue details not web-checked; confirm scope and article types before choosing.)

## 9. Open items before writing

- Consensus log (2026-10-16), 4 calls: (1) "flipped classroom effect on student motivation and satisfaction" returned a wrong page with no papers, not retried on that topic; (2) "straight-lining careless responding in repeated student surveys" (paper list was truncated by me); (2b) follow-up in that thread on whether excluding careless responders changes group comparisons -> #21-#24; (3) "does active learning before instruction reduce felt learning or satisfaction" -> #25-#26. Round 2 (mcp__consensus__search, 5 calls, full-sentence questions, only the top 3 hits each): (a) "Does a flipped classroom increase students' intrinsic motivation compared with traditional instruction in higher education, and which moderators explain variation in the effect?" (returned Zheng 2020 plus two small quasi-experiments, not added); (b) "Does the flipped classroom change students' sense of community of inquiry (social, cognitive and teaching presence) compared with a control condition?" -> #27-#29; (c) "Does removing careless or straight-lining respondents bias estimates of treatment effects in randomized experiments that use self-report questionnaires?" -> #31-#32; (d) "Why do students report lower perceived learning but higher actual learning under active learning, and does greater cognitive effort explain lower satisfaction ratings?" -> #30; (e) "Does survey fatigue from repeated questionnaires over a semester increase careless responding in students, and does it vary with questionnaire position or length?" -> #33-#34.

- Wait for the final topic, then run the registered models once: all submissions and flag-excluded, per construct, with Holm across the 01+02 family.
- Compute flag rate by condition, by topic order, by section, by device class, and by instrument; include reliability on non-flagged data.
- Resolve the dossier inconsistencies: Garrison year (1999), Strelan pages, de Leng volume/pages; find a DOI or stable URL for Zheng 2020 or drop it.
- IRRODL CoI/flipped/SRL paper identified as Taghizade et al. 2023 (#27, DOI verified); still read it in full before related work is finalised.
- Decide with the PI whether H2/H3 are committed as confirmatory (pre-reg status is DRAFT) and file the pre-reg with the 2026-10-08 disclosure.
- Add the straight-lining analyses (RQ-S) as an explicitly post-hoc/exploratory registration addendum.
- Link affect to H1 gain and to retention (opens ~23 Nov) as exploratory only.
- Check the Paas mean difference (6.5 vs 6.7) against the model estimate (-0.04) so both are stated on the same scale.
- Confirm that the questionnaire N per instrument is reported and that the flagged-share definition in `measures.questionnaire_subscales()` matches the paper's text.
