# Paper 06 backbone — Running a within-student randomised experiment inside a live course

Status 2026-10-16. Point form. Interim, exploratory unless stated. Methods/feasibility paper: the claim is about the
machinery and its failure modes, not about the flip effect.

## 1. Working title + claim

**Title (working):** *What breaks when you randomise inside a live course: assignment by alternation, compliance,
bug-induced attrition, outages and unproctored measurement in a 13-topic within-student flipped-learning trial.*

**Claim (honest, today):** A single instructor-researcher team can run a server-side, per-topic, within-student randomised
trial in a live ~340-student course with near-perfect assignment compliance (99.7%) and a fully reconstructible
attrition record, but the trial's validity threats came from the *platform and context* (a navigation bug that
produced FLIP-only attrition, unproctored checks with external help, non-equivalent forms, outages), not from
randomisation itself; each is detectable from the sink and reportable in CONSORT-SPI shape. We do NOT claim a
"blinded" trial (blinding is partial) and we do NOT claim the recipe is general beyond one course.

## 2. Research questions / hypotheses

No dedicated pre-registration exists for paper 06 (methods paper; `docs/pre-registration/` holds 01, 01b, 02).
It inherits the H1 plan's design rules (`01-flip-effect.md`: ITT + covariate-adjusted primary, NT10 rapid-guess rule,
two disclosed interim looks 2026-10-08 and 2026-10-09). RQs are therefore descriptive and framed as such:
- RQ1 Fidelity: did deterministic alternation (`schedule.arm_for`: hash(SID) parity + topic index) deliver balanced,
  within-student-crossed arms, and did participants comply? (Target: report compliance with CI; arm-size drift.)
- RQ2 Attrition: how much, where, by arm, and what mechanism? Quantify bias via the WWC attrition model.
- RQ3 Integrity: how large are unproctored-context threats (external help, form non-equivalence, late completion)
  and how do they move the estimate?
- RQ4 Operations: which failures (identity migration, outages, bug) occurred and what detection/mitigation worked?
- RQ5 Governance: how were consent-gated recording, withdrawal vs disable, pre-registration and disclosed interim looks
  handled in a captive student population?
Flag: no confirmatory hypothesis; nothing here should be written as hypothesis-tested.

## 3. Literature support (26 sources; 15-26 added via Consensus)

Verification method: DOI resolved via CrossRef API (title, first authors, year, venue) 2026-10-16; arXiv abstract page
opened for Williams. "VERIFIED" = identifier resolved and title+authors+year match; print-year note where online year differs.

1. Kohavi, R., Longbotham, R., Sommerfield, D., & Henne, R. M. (2009). Controlled experiments on the web: survey and
   practical guide. *Data Mining and Knowledge Discovery, 18*(1), 140-181. https://doi.org/10.1007/s10618-008-0114-1
   — VERIFIED (CrossRef lists online year 2008; print 2009). Practical A/B machinery (unit of randomisation, pitfalls,
   Twyman's law). Supports: our design vocabulary; challenges: assumes traffic scale we lack.
2. Reich, J. (2015). Rebooting MOOC research. *Science, 347*(6217), 34-35. https://doi.org/10.1126/science.1261627
   — VERIFIED. Calls for causal design over click analytics on learning platforms. Supports the motivation.
3. Hrobjartsson, A., et al. (2012). Observer bias in randomised clinical trials with binary outcomes: systematic review
   of trials with both blinded and non-blinded outcome assessors. *BMJ, 344*, e1119. https://doi.org/10.1136/bmj.e1119
   — VERIFIED (title, Hrobjartsson/Thomsen/Emanuelsson/Tendal, BMJ 2012). Non-blinded assessors inflate effects
   (~29% reported in dossier; the 29% figure itself not re-checked). Supports blinded offline grading; challenges any
   "blinded" claim given the instructor-researcher overlap.
4. Williams, J. J., Ostrow, K., Xiong, X., Glassman, E., Kim, J., Maldonado, S. G., Li, N., Reich, J., & Heffernan, N.
   (2015). Using and designing platforms for in vivo education experiments. *Proc. 2nd ACM Conf. on Learning @ Scale*.
   arXiv:1502.04245. https://arxiv.org/abs/1502.04245 — VERIFIED (arXiv page opened; NB the dossier's author order
   [Kim second] differs from arXiv's [Ostrow, Xiong, Glassman, Kim ...]; L@S venue not independently opened). Nearest
   precedent at the target venue; assumes platform teams.
5. Connolly, P., Keenan, C., & Urbanska, K. (2018). The trials of evidence-based practice in education: a systematic
   review of randomised controlled trials in education research 1980-2016. *Educational Research, 60*(3), 276-291.
   https://doi.org/10.1080/00131881.2018.1493353 — VERIFIED. Documents weak design/reporting across ed-RCTs. Frames the gap.
6. Grant, S., Mayo-Wilson, E., Montgomery, P., et al. (2018). CONSORT-SPI 2018 explanation and elaboration: guidance for
   reporting social and psychological intervention trials. *Trials, 19*, 406. https://doi.org/10.1186/s13063-018-2735-z
   — VERIFIED. Reporting checklist the write-up should satisfy (flow diagram from `coverage` inputs).
7. Schulz, K. F., Altman, D. G., & Moher, D. (2010). CONSORT 2010 statement: updated guidelines for reporting parallel
   group randomised trials. *BMJ, 340*, c332. https://doi.org/10.1136/bmj.c332 — VERIFIED. Parent standard; for the
   flow-diagram and pre-specified-outcome items. (Added by this pass; not in the dossier.)
8. Deke, J., & Chiang, H. (2017). The WWC attrition standard: sensitivity to assumptions and opportunities for refining
   and adapting to new contexts. *Evaluation Review, 41*(2), 130-154. https://doi.org/10.1177/0193841X16670047
   — VERIFIED (CrossRef title "The WWC Attrition Standard", online 2016; print 2017). Gives a bias bound; our FLIP-only
   attrition is *differential by mechanism*, so tests the standard's limits (its model assumes attrition correlates with outcome).
9. Benbunan-Fich, R. (2017). The ethics of online research with unsuspecting users: from A/B testing to C/D
   experimentation. *Research Ethics, 13*(3-4), 200-218. https://doi.org/10.1177/1747016116680664 — VERIFIED (online 2016).
   Consent/oversight gaps; our consent-gated recording and HSESC amendment are the contrast (participants are informed).
10. Musabirov, I., et al. (2025). Platform-based adaptive experimental research in education: lessons learned from the
    Digital Learning Challenge. *Proc. LAK '25*. https://doi.org/10.1145/3706468.3706471 — VERIFIED (title, first author,
    LAK 2025). Consortium-scale lessons; benchmark for "what broke operationally".
11. Baker, R. S., Hutt, S., Mogessie, M., & Valayaputtar, H. (2022). Research using the MOOC Replication Framework and
    E-TRIALS. *2022 IEEE LWMOOCS*, 131-136. https://doi.org/10.1109/LWMOOCS53067.2022.9927934 — VERIFIED (title,
    authors, venue, year; pages not checked). Replication layer; we bound replication as future work.
12. Gordillo, A., & Lopez-Fernandez, D. (2024). Are educational escape rooms more effective than traditional lectures for
    teaching software engineering? A randomized controlled trial. *IEEE Trans. Education, 67*(5), 660-668.
    https://doi.org/10.1109/TE.2024.3403913 — VERIFIED via CrossRef (the dossier's ieeexplore URL was not opened; DOI
    used instead). Closest single-course sibling (n=326); benchmark for reporting.
13. Hernan, M. A., & Hernandez-Diaz, S. (2012). Beyond the intention-to-treat in comparative effectiveness research.
    *Clinical Trials, 9*(1), 48-55. https://doi.org/10.1177/1740774511420743 — VERIFIED for existence, authors, journal
    (CrossRef online year 2011; vol/issue/pages from memory: UNVERIFIED detail). Why ITT is the primary when attrition is
    arm-dependent and per-protocol is biased. (Added.)
14. Nosek, B. A., Ebersole, C. R., DeHaven, A. C., & Mellor, D. T. (2018). The preregistration revolution. *PNAS, 115*(11),
    2600-2606. https://doi.org/10.1073/pnas.1708274114 — VERIFIED for title, authors, PNAS, 2018 (volume/pages from
    memory: UNVERIFIED detail). Supports pre-registering plus transparent disclosure of deviations. (Added.)

15. Valentine, J. C., & McHugh, C. M. (2007). The effects of attrition on baseline comparability in randomized experiments in
    education: a meta-analysis. *Psychological Methods, 12*(3), 268-282. https://doi.org/10.1037/1082-989X.12.3.268 —
    VERIFIED (CrossRef title/authors/year/journal; pages from CrossRef DOI suffix, not separately checked). (via Consensus)
    Attrition often did not break baseline comparability on average; CHALLENGES alarm about attrition, but is about
    average, not mechanism-driven (arm-specific bug) attrition.
16. Weidmann, B., & Miratrix, L. (2021). Missing, presumed different: quantifying the risk of attrition bias in education
    evaluations. *J. Royal Statistical Society A, 184*(2). https://doi.org/10.1111/rssa.12677 — VERIFIED (title, authors, year,
    journal; volume/issue UNVERIFIED). (via Consensus) Attrition bias in education evaluations is typically limited;
    recommends sensitivity analysis. Supports the ITT + sensitivity design; challenges the severity of our gestalt case.
17. Clark, L., Coleman, R., & Deniz, [?] (2025). Does attrition introduce bias in randomised trials: a methodological review.
    *Oxford Review of Education*. https://doi.org/10.1080/03054985.2025.2493124 — VERIFIED for title, first authors Clark/Coleman/Deniz,
    year, journal (third author's initials not recorded). (via Consensus) Finds no pre-test heterogeneity from attrition; contrary evidence.
18. Bell, M. L., Kenward, M. G., Fairclough, D. L., & Horton, N. J. (2013). Differential dropout and bias in randomised
    controlled trials: when it matters and when it may not. *BMJ, 346*, e8668. https://doi.org/10.1136/bmj.e8668 — VERIFIED
    (title, Bell/Kenward/Fairclough, BMJ 2013; fourth author, volume from memory/UNVERIFIED). (via Consensus) Bias depends on
    the missingness mechanism, not rates; direct support for treating bug-induced, engagement-linked exit as informative.
19. Ladyshewsky, R. K. (2015). Post-graduate student performance in 'supervised in-class' vs. 'unsupervised online' multiple
    choice tests: implications for cheating and test security. *Assessment & Evaluation in Higher Education, 40*(7), 883-897.
    https://doi.org/10.1080/02602938.2014.956683 — VERIFIED for title, author, journal (online 2014); volume/pages UNVERIFIED.
    (via Consensus) Unsupervised MC scores comparable to supervised: CONTRARY to a big external-help inflation worry.
20. Lannin, D. G., Flinn, [?], Ilie, [?] et al. (2025). Unmonitored online exams: valid assessment or score inflation?
    *Teaching of Psychology*. https://doi.org/10.1177/00986283251324172 — VERIFIED (title, first three authors, year, journal).
    (via Consensus) Unmonitored exams inflate scores; supports taking our +5.5 to +7 external-help estimate seriously.

21. Ghanem, D., Hirshleifer, S., & Ortiz-Becerra, K. (2023). Testing attrition bias in field experiments. *Journal of Human
    Resources*. https://doi.org/10.3368/jhr.0920-11190r2 — VERIFIED (CrossRef title/authors/year/journal). (via Consensus) Shows
    the commonly used completers-baseline-balance test is not in general a test of internal validity. Changes our plan: do not rely on
    baseline balance among completers to clear the gestalt attrition.
22. Lakens, D. (2024). When and how to deviate from a preregistration. *Collabra: Psychology*.
    https://doi.org/10.1525/collabra.117094 — VERIFIED (CrossRef). (via Consensus) Deviations are not all fatal; report them with their effect
    on test severity. Supports our disclosed-interim-looks framing.
23. Willroth, E. C., & Atherton, O. E. (2024). Best laid plans: a guide to reporting preregistration deviations. *Advances in Methods
    and Practices in Psychological Science*. UNVERIFIED as published: only the 2023 PsyArXiv preprint (https://doi.org/10.31234/osf.io/dwx69)
    resolved on CrossRef (title and first authors match). (via Consensus) A template for the deviation ledger.
24. Gehlbach, H., & Robinson, C. D. (2018). Mitigating illusory results through preregistration in education. *J. Research on
    Educational Effectiveness*. UNVERIFIED as published: only the SSRN version (https://doi.org/10.2139/ssrn.3025214, 2017) resolved
    (title and authors match). (via Consensus) Education-specific case for pre-registration.
25. Schulz, K. F., & Grimes, D. A. (2002). Allocation concealment in randomised trials: defending against deciphering. *The Lancet,
    359*(9306). https://doi.org/10.1016/S0140-6736(02)07750-4 — VERIFIED for title, authors, year, journal (volume/issue from memory, UNVERIFIED).
    (via Consensus) Inadequate concealment inflates effects; our alternation is deterministic from SID, so anyone who knows the rule can
    predict arms (threat, though students cannot see the hash).
26. Corbett, M. S., et al. (2015). Randomization methods in emergency setting trials: a descriptive review. *Research Synthesis Methods*.
    https://doi.org/10.1002/jrsm.1163 — VERIFIED for title and DOI (author list/year per Consensus; CrossRef author field not returned).
    (via Consensus) No consistent evidence that quasi-randomisation yields more baseline imbalance than true randomisation; contrary-to-worry support
    for alternation, but small sample of trials.

## 4. Review of the field

- Platform-scale experimentation is mature (Kohavi; Williams; Musabirov; Baker): infrastructure, adaptive allocation, replication.
- Single-course classroom RCTs are common but under-reported on randomisation unit, blinding, attrition (Connolly).
- Reporting standards exist (CONSORT 2010, CONSORT-SPI) but are rarely applied to ed-tech in-course trials; sibling RCTs
  (Gordillo) often omit blinding/attrition bounds.
- Contested: how much "blinding" is possible when the instructor is the researcher and students can see their arm
  (visible sequence of activities); contested whether low-stakes unproctored measures are valid at all.
- Attrition standards (WWC) assume attrition is outcome-related; platform-bug-induced, arm-specific exit is a case the
  standards do not directly model — a gap we can document with a worked example.
- Ethics of experimenting on students (Benbunan-Fich) is debated mainly for unconsenting A/B; consented in-course
  within-student designs are under-discussed.
- Within-student crossover over many topics (13) is rarely reported; carryover and topic-by-condition crossing are the open issues.
- Contested (Consensus pass): attrition-bias syntheses in education find the *average* bias small (Valentine & McHugh; Weidmann
  & Miratrix; Clark et al.), whereas methodological work says bias hinges on mechanism not rate (Bell et al.). Unproctored
  evidence is split: inflation (Lannin) vs comparable scores (Ladyshewsky), with time-on-task as the discriminator.
- Contested (Consensus round 2): quasi-randomisation is not reliably worse than true randomisation (Corbett), but allocation
  concealment failures inflate effects (Schulz & Grimes); completers-baseline-balance tests do not establish internal validity (Ghanem
  et al.); deviations from pre-registration are tolerable if reported with their effect on severity (Lakens; Willroth & Atherton).
- Gap: no *failure-mode ledger* — a worked account of what went wrong in one real deployment and how it was detected.
  That, not the "recipe", is the defensible contribution (the dossier's "recipe" framing oversells).

## 5. Argument (premise to conclusion)

1. In-course randomisation is wanted but under-practised and under-reported (Reich; Connolly). [cited]
2. Server-side deterministic assignment removes the commonest implementation failures (client choice, completion-order
   inference). Alternation by hash parity gives within-student balance (7/6 across 13) and topic-by-arm crossing with no
   stored state, surviving reloads and devices. [code: `arm_for`; compliance 1,689/1,692 at 10-03, 99.7%]
3. But alternation is *not* a random draw: it is pseudo-random on SID hash parity; the paper must state what that
   assumes (no SID/arm correlation) and test it (arm sizes per topic; baseline balance; observed drift: mental-model 42/66,
   norman 63/38 on opening, evened out later). [interim; test to come]
4. Randomisation protects assignment, not exposure or measurement. Three non-assignment threats dominated:
   (a) navigation bug dropping `?unit=`, skipping the post-check for the more-engaged FLIP students; (b) unproctored
   checks with external help (tab-leave 40% of checks; +5.5 to +7 pts within student); (c) non-equivalent forms. [our data]
5. The bug is a documented case of design-induced differential attrition: FLIP 38 vs CONTROL 6 before the post-check
   at the 10-08 interim (gestalt 20/106 vs 0/81); fixed 2026-10-08, so the fix date is the analytical boundary. Handled by ITT
   primary + per-protocol as sensitivity (Hernan; Deke). [our data + cited]
6. Operations are part of the internal validity story: SID check-letter migration froze arms until canonicalised;
   outages (Windows Update reboot, tunnel) were absorbed by keep-alive/watchdog, backup unscheduled for a period. [our
   records; need dated incident list]
7. Transparency substitutes for what a solo team cannot buy: pre-registration, disclosed interim looks, ITT, an
   append-only event sink, blind offline grading (Nosek; CONSORT). [pre-reg files]
8. Conclusion: a failure-mode ledger plus detection recipe (compliance, no-activity, arm-specific exit, tab-leave, form-gap
   checks) lets a single teaching team run a within-student trial credibly; it does not make the effect estimate
   unbiased, and what it cannot do (blind the teacher, proctor) is stated.

## 6. Our evidence so far (all interim/exploratory)

- Cohort ~335-340 accounts; sink 21,366 events at 10-03; coverage: 1,689/1,692 determinable pairs complied (99.7%);
  no-activity 162, no-post-check 27, escape 106 (10-03). Withdrawn 12 (11 net after reinstatement of one).
- Randomisation: alternation, 7/6 arms within student; arm sizes drift on newly opened topics, then even out.
- Attrition: before post-check FLIP 38 vs CONTROL 6 (10-08); gestalt FLIP 20/106 vs CONTROL 0/81; 18 of 19 gestalt FLIP rows went
  `understanding_complete` to `assessment_complete` (routing bug); bare gestalt links in sub-games; fixed 10-08; other 12 games scanned clean;
  fitts FLIP 7 unexplained.
- ITT H1 (disclosed look): +0.85/100, p .25; completers +1.17, CI [-0.28, +2.63], p .11. ⟨g⟩ overstates (0.565 vs 0.448).
- Form non-equivalence: CONTROL gains +5.9 pp with nothing between checks; per-item rise correlates 0.74 across arms.
- External help: left page 43.8% pre, 36.8% post; FLIP leaves less on post (-6 pp, p<.001).
- Timing: 21% of completed units after the lecture (balanced); on-time FLIP effect +2.11 (post hoc).
- Reliability infrastructure: blind offline grading (`grade.blind()`), two registered pre-reg looks disclosed (10-08, 10-09).
- Ops: Windows Update reboot, tunnel funnel failure, backup not automated (health `ok:false`, 58-174 h) until code fix 10-08.

## 7. Threats and counter-arguments

- "It's not randomised, it's alternation." -> Concede: quasi-random systematic assignment. Show balance diagnostics; argue
  sha256 parity is unrelated to ability; limitation if SID parity correlates with section/cohort entry year.
- "Alternation by SID hash is predictable / not concealed." -> Concede (Schulz & Grimes): arm is a pure function of SID and topic index, so
  anyone who knows the rule can predict it; argue students never see the rule and could not choose their SID, and report balance, noting
  Corbett finds no systematic penalty for quasi-randomisation.
- "Not blinded." -> Correct: students see which activity comes first; teacher is researcher. Claim only grading blindness
  and pre-specified analysis; teacher-by-arm blindness exists on the researcher panel (teacher /admin cannot see arms).
- "A bug that removed FLIP students invalidates the trial for gestalt." -> Treat as the paper's case study; ITT primary,
  exclude-gestalt and bound sensitivity; boundary at the fix date. Honest: pre-fix per-protocol is biased.
- "Attrition is usually harmless in education RCTs." -> Ghanem et al. add that "completers look balanced at baseline" would not clear it, so the plan is bounds/sensitivity (not baseline tests). Average-case syntheses (sources 15-17) do not cover a known routing bug that
  removes the more-engaged arm members; Bell et al. says mechanism matters. Concede that overall attrition bias may be small and
  report gestalt-excluded sensitivity before claiming bias.
- "Unproctored checks are fine." / "are hopelessly inflated." -> Literature split (19 vs 20); we measure leaving-the-page and time directly.
- "Interim looks compromise confirmatory status." -> Disclosed in-registration; final analysis run once at end; report
  with and without the looked-at data. Peeking is exploratory-labelled.
- "Single course, solo team: no generalisability/power." -> Position as a documented case and failure ledger, not a
  proof; offer checklist; replication is future work (Baker).
- "Unproctored external help makes the measures meaningless." -> It is a measured, symmetric-ish confound with a
  within-student estimate; present as a limitation and a sensitivity (left-page covariate), not a defect hidden.
- "Consent/ethics in a class you teach." -> Consent gate before any recording, withdrawal tombstone distinct from disable,
  HSESC amendment (draft); acknowledge power asymmetry (Benbunan-Fich); data-erasure of 12 withdrawn still pending in the sink.
- "Methods papers with null effects are not interesting." -> The failure-mode ledger is the contribution; the H1 effect is a separate paper.

## 8. Venue fit

- ACM Learning @ Scale (dossier target): methods/at-scale experimentation; fit moderate because we are one course, not scale.
- Journal of Learning Analytics (or LAK short/practitioner track): applied methods and lessons-learned; good for ops ledger.
- Educational Technology Research & Development / Computers & Education (methods or "practice" section), or the
  *Research Ethics*/open-science venues if the governance angle is leaned on. (Venue acceptance not checked.)

## 9. Open items before writing

- Consensus pass 2026-10-16: 2 searches (attrition bias in education RCTs; unproctored online assessment inflation) + 2 same-thread follow-ups (contradicting evidence; specific proctored vs unproctored studies); DOIs checked on CrossRef. Not run: in-course experiment ethics, alternation vs randomisation. A 3rd Fendler (2024) paper could not be CrossRef-resolved: left out.
- Consensus round 2 (mcp search, 5 questions): (1) can alternation across many topics stand in for randomisation; (2) how to handle bug-induced arm-specific skipping of an outcome under ITT/sensitivity; (3) effect of disclosed interim looks/deviations on pre-registration credibility; (4) is quasi-random allocation by identifier hash equivalent, and concealment risks; (5) why baseline comparison of completers is insufficient and which bounds to report. Cornelisz 2019 (Lee bounds) and Goldberg 2021 (MNAR sensitivity) surfaced but were not added (preprint-only / not CrossRef-resolved).

- Pull the exact CONSORT-SPI flow numbers from the final export after the last topic closes (assigned, allocated,
  post-check reached, analysed, by arm and topic); the 933/1,689 figures are snapshots.
- Compute the WWC attrition bound for overall and gestalt-only (Deke & Chiang), and an ITT with stated missing-post rule.
- Balance diagnostics: baseline pre by arm per topic; test SID-parity vs section; check whether `arm_for` assignments
  correlate with any enrolment attribute.
- Dated incident ledger (SID migration freeze, Windows Update reboot, tunnel funnel, backup gap, the 12 withdrawn pending
  forget, fitts 7 unexplained exits) with detection source and time-to-detect; check against git/log.
- Decide the primary framing: failure-ledger/lessons (recommended) vs "reproducible recipe".
- Fill one UNVERIFIED detail: confirm vol/pages for Hernan & Hernandez-Diaz and Nosek et al.; confirm L@S venue page for
  Williams and the "29%" in Hrobjartsson; open ieeexplore for Gordillo.
- Obtain advisor view on whether alternation can be labelled "randomised" in the title; consider "systematic allocation".
- Write ethics/consent section from `docs/ethics-amendment-stage2.md` (check HSESC status; the draft was awaiting answers).
- Rerun the 10-08 numbers on the final export; keep interim vs final labelled; November retention (Form C) is a separate paper.
