# Paper 09 backbone: game psychophysics (2026-10-16)

Status: EXPLORATORY by pre-registration policy (`docs/pre-registration/README.md`: 04/08/09 are not
registered as confirmatory; do not dress in hypothesis language). Reframed 2026-09-21 (Wilson): the
"living it vs reading about it" contrast is dropped because no reading-only arm exists; CONTROL is
game-AFTER the post-check, not game-never (`backend/schedule.py:28-29`).

## 1. Working title and claim
**Title:** "Classic psychophysics as teaching games: do Stroop, Fitts, Hick and Weber reproduce in a
classroom, and does playing before assessment change the behaviour?"

**Claim the data supports today (interim):** Two of four rebuilt paradigms behave like their textbook
originals in an unproctored class sample (Stroop interference ~650 ms; Weber JND measurable), one is
uninterpretable as built (Fitts, order-confounded), one shows no effect (Hick, no choice-count effect).
Whether game-first vs game-after changes per-trial behaviour is a small, exploratory contrast
(Weber JND FLIP 22.6% vs CONTROL 27.0%); there is no test here that the game teaches better than
text.

## 2. Research questions (exploratory, not pre-registered)
- RQ1 Replication: do the game-embedded Stroop (RT by block), Hick (RT x choices), Fitts (MT x ID) and
  Weber (JND, Weber fraction) reproduce the canonical effects, with what fidelity (effect size, noise)?
- RQ2 Ordering: does arm / `played_first` (FLIP = game before post-check, CONTROL = after) shift the
  per-trial measures? Same IV as H1, no new instrument.
- RQ3 Behavioural profile: games vs checks on pointer/interaction activity and tab-leaving
  (game vs no-game behaviour; shares telemetry with paper 04).
- Not asked: "game beats reading" (no such arm). State as a limitation, not a finding.

## 3. Literature support (all DOIs resolved via CrossRef 2026-10-16; effect sizes quoted from the
dossier `docs/lit/09-game-psychophysics.md`, not re-read from the papers)
1. Stroop, J. R. (1935). Studies of interference in serial verbal reactions. J Exp Psychol, 18(6),
   643-662. DOI 10.1037/h0054651. VERIFIED. The canonical interference effect; our RQ1 benchmark.
2. MacLeod, C. M. (1991). Half a century of research on the Stroop effect: an integrative review.
   Psychol Bull, 109(2), 163-203. DOI 10.1037/0033-2909.109.2.163. VERIFIED. Typical magnitude and
   robustness; lets us say whether ~650 ms is plausible for a keyboard/click version.
3. Fitts, P. M. (1954). The information capacity of the human motor system in controlling the
   amplitude of movement. J Exp Psychol, 47(6), 381-391. DOI 10.1037/h0055392. VERIFIED. MT ~ ID law;
   defines what a valid Fitts game must vary independently (our order confound violates this).
4. Hick, W. E. (1952). On the rate of gain of information. Q J Exp Psychol, 4(1), 11-26.
   DOI 10.1080/17470215208416600. VERIFIED. RT grows with log choices; our null needs explanation
   (comparison task design vs genuine non-replication).
5. Semmelmann, K., & Weigelt, S. (2017). Online psychophysics: reaction time effects in cognitive
   experiments. Behav Res Methods, 49, 1241-1260 (online 2016). DOI 10.3758/s13428-016-0783-4.
   VERIFIED (title/authors/year; page range from memory, check at write-up). Classic RT effects
   replicate online; supports RQ1 plausibility.
6. Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and
   HTML5/JavaScript web experiments. Behav Res Methods, 47, 309-327 (online 2014).
   DOI 10.3758/s13428-014-0471-1. VERIFIED (title/authors; year online 2014, issue year 2015 from
   memory). Browser timing error and device heterogeneity: threat to absolute RTs, not to differences.
7. Chi, M. T. H., & Wylie, R. (2014). The ICAP framework. Educ Psychol, 49(4), 219-243.
   DOI 10.1080/00461520.2014.965823. VERIFIED. Interactive > Constructive > Active > Passive; theory
   for why games might help; also vocabulary for a null.
8. Kontra, C., Lyons, D. J., Fischer, S. M., & Beilock, S. L. (2015). Physical experience enhances
   science learning. Psychol Sci, 26(6), 737-749. DOI 10.1177/0956797615569355. VERIFIED. Closest
   "do it yourself" precedent (physics); supports, but outside perception and with physical forces.
9. Mayer, R. E. (2004). Should there be a three-strikes rule against pure discovery learning? Am
   Psychol, 59(1), 14-19. DOI 10.1037/0003-066X.59.1.14. VERIFIED. Challenges: experience without
   guidance does not teach; our debrief/tutor scaffolding matters.
10. Alfieri, L., Brooks, P. J., Aldrich, N. J., & Tenenbaum, H. R. (2011). Does discovery-based
    instruction enhance learning? J Educ Psychol, 103(1), 1-18. DOI 10.1037/a0021017. VERIFIED.
    Meta-analysis: assisted discovery beats explicit instruction, unassisted does not. Challenges/nuances.
11. Wouters, P., van Nimwegen, C., van Oostendorp, H., & van der Spek, E. D. (2013). A meta-analysis
    of the cognitive and motivational effects of serious games. J Educ Psychol, 105(2), 249-265.
    DOI 10.1037/a0031311. VERIFIED. Games help learning modestly (d~0.29 per dossier) but not
    motivation; keeps engagement and learning separate.
12. Clark, D. B., Tanner-Smith, E. E., & Killingsworth, S. S. (2016). Digital games, design, and
    learning. Rev Educ Res, 86(1), 79-122. DOI 10.3102/0034654315582065. VERIFIED. Base rate g~0.33
    for games vs non-game instruction; our effect size benchmark.
13. Skulmowski, A., & Rey, G. D. (2018). Embodied learning: a taxonomy based on bodily engagement and
    task integration. Cogn Res Princ Implic, 3:6. DOI 10.1186/s41235-018-0092-9. VERIFIED. Bodily
    action helps only when task-integrated; explains why the Fitts order confound is a design, not
    just analysis, problem.
14. Muilwijk, S. E., & Lazonder, A. W. (2023). Learning from physical and virtual investigation: a
    meta-analysis of conceptual knowledge acquisition. Front Educ, 8:1163024.
    DOI 10.3389/feduc.2023.1163024. VERIFIED (first author is Muilwijk, not Macrine; the dossier
    and arguments file are corrected). Virtual ~ physical for adults; a game need not be inferior.
15. Li, C., Tang, J. K. T., Jia, Y., Lu, Y., et al. (2025). Enhance learner engagement through
    experiential learning in a gamified simulation: a longitudinal study. In Blended Learning
    (ICBL 2025), LNCS, Springer. DOI 10.1007/978-981-96-8430-4_15. VERIFIED (CrossRef lists authors
    Li, Tang, Jia, Lu,...; dossier's "Ma et al." are the editors). Nearest prior art: Fitts game,
    HCI students, engagement outcome. Scoop watch: cite and differentiate (we have four paradigms
    and behavioural telemetry; they have engagement).
16. Proctor, R. W., & Schneider, D. W. (2018). Hick's law for choice reaction time: a review. Q J Exp
    Psychol, 71(6), 1281-1299. DOI 10.1080/17470218.2017.1322622. VERIFIED (via Consensus; CrossRef
    title/authors/year match; volume/pages from memory). Hick's law holds mainly with practised,
    compatible stimulus-response mappings; unpractised or arbitrary mappings, as in a short class game,
    can fail to show it. Challenges our Hick null being read as a bug.
17. Linnman, C., Carlbring, P., Ahman, A., et al. (2006). The Stroop effect on the internet. Comput Hum
    Behav, 22(3), 461-468. DOI 10.1016/j.chb.2004.09.010. VERIFIED (via Consensus; CrossRef match;
    volume/pages from memory). Online Stroop is slightly slower than lab but the effect is strong.
18. Seow, S. C. (2005). Information theoretic models of HCI: a comparison of the Hick-Hyman law and
    Fitts' law. Hum-Comput Interact, 20(3), 315-352. DOI 10.1207/s15327051hci2003_3. VERIFIED (via
    Consensus; CrossRef match). Teaching-relevant framing of both laws as HCI models.
19. Liu, W., Gori, J., Rioul, O., Beaudouin-Lafon, M., & Guiard, Y. (2020). How relevant is Hick's law
    for HCI? Proc. CHI 2020. DOI 10.1145/3313831.3376878. VERIFIED (via Consensus; CrossRef title,
    authors, year match). Argues Hick's law is often misapplied in HCI tasks; supports reading our
    Hick null as a task-design question.
20. DeCaro, M. S., McClellan, D. K., et al. (2025). Flipping a simulation before instruction can
    improve students' learning, interest and perceived competence. Br J Educ Psychol, 96. DOI
    10.1111/bjep.70007. VERIFIED (via Consensus; CrossRef title/first author/year match; further authors
    not captured). Randomised, N=168/357 first-year chemistry: simulation BEFORE lecture hurt
    conceptual scores with 15 min but helped with 20 min. Closest design analogue to our FLIP/CONTROL
    ordering; says the order effect depends on activity length and design.
21. Ashman, G., Kalyuga, S., & Sweller, J. (2020). Problem-solving or explicit instruction: which should
    go first when element interactivity is high? Educ Psychol Rev, 32, 229-247 (online 2019). DOI
    10.1007/s10648-019-09500-5. VERIFIED (via Consensus; CrossRef match; pages from memory). Two RCTs:
    instruction-first beat problem-first when material is high in element interactivity. Contrary
    evidence on ordering.
22. Zambrano, J., Narvaez-Rivera, et al. (2026). When to inquire and when to
    instruct: prior knowledge and element interactivity in medical learning. Learn Instr, 104. DOI
    10.1016/j.learninstruc.2026.102392. VERIFIED (via Consensus; CrossRef match; author list to be checked at write-up). Sequence effect moderated by prior knowledge:
    explicit-first helps low-prior, inquiry-first helps high-prior. Prior-knowledge moderator for our
    ordering analysis (pre-check as covariate/interaction).
23. Elliott, L. J., Rice, S., Trafimow, D., et al. (2010). Research participation versus classroom
    lecture: a comparison of student learning. Teach Psychol, 37(2). DOI 10.1080/00986281003626862.
    VERIFIED (via Consensus; CrossRef match; issue from memory). Participating in an experiment taught
    a concept about as well as a lecture on it, though students preferred participating. Direct
    evidence on "being the participant"; supports the null/"no deeper than explanation" reading.
24. Zimrot, R., & Ashkenazi, G. (2007). Interactive lecture demonstrations: a tool for exploring and
    enhancing conceptual change. Chem Educ Res Pract, 8(2), 197-211. DOI 10.1039/b6rp90030e. VERIFIED
    (via Consensus; CrossRef match). Observing a demonstration without predicting and discussing
    reduced recall of the outcome; interactivity/prediction is the active ingredient. Supports adding
    prediction/debrief around the game.
25. Ninaus, M., Cortez, et al. (2023). The added value of game elements: better training
    performance but comparable learning gains. Educ Technol Res Dev. DOI 10.1007/s11423-023-10263-8.
    VERIFIED (via Consensus; CrossRef title/first author/year match; co-authors not captured).
    Game elements improved training performance, not learning gains: engagement is not learning.
UNVERIFIED (via Consensus, no usable DOI match, not used as support): Chakraborty & Yadav review of
Fitts' law on touchscreens; Yadav et al. (2021) "Children's interaction with touchscreen devices:
performance and validity of Fitts' law" (Hum Behav Emerg Technol) -- ID-MT correlation weak in
children; Zhang (2025) amplitude-dominated Fitts refinement for large touchscreens (PACM HCI).

Dropped from the dossier for this paper (still verified, available): Barsalou 2008, Glenberg 2004,
Fiorella & Mayer 2016, Hake 1998, Kougioumtzis 2026 (CrossRef volume is 11, not 14).

## 4. Review of the field
- Classic effects (Stroop, Fitts, Hick) are among the most replicated in psychology, and replicate
  online with browser timing noise (Semmelmann & Weigelt; Reimers & Stewart).
- Embodied/enactive learning shows benefits when the action is integrated with the concept
  (Kontra; Skulmowski & Rey) but the field is fragmented and mechanism claims are loose.
- Serious-game meta-analyses give modest learning gains and no reliable motivation gain
  (Wouters; Clark); effect sizes depend heavily on comparison condition.
- Guidance matters: unassisted discovery underperforms (Mayer; Alfieri); a game as the "experiment"
  needs a debrief.
- Physical vs virtual investigation is a wash for adults (Muilwijk & Lazonder): digital stand-ins are
  not inherently worse.
- Contested: whether Hick's and Fitts' laws survive transfer to HCI tasks and touch devices (Proctor &
  Schneider; Hick/Fitts HCI critiques unverified); whether "being the participant" beats a good explanation. Almost no direct test with
  classic paradigms and conceptual outcomes.
- Gap we can fill honestly: a four-paradigm, large-N, classroom-scale account of fidelity (do the
  games reproduce the effects when played unproctored on student devices) plus an ordering contrast
  from within-student randomisation. Not the learning-vs-reading claim.

## 5. Argument (numbered)
1. Teaching games that embed classic paradigms are only credible if they reproduce the textbook effect
   (premise; Stroop/MacLeod, Fitts, Hick). Evidence: our per-trial data.
2. Stroop reproduces (~650 ms interference, interim, in-hand). Weber yields measurable JND. [our data]
3. Fitts does not currently test the law: easy target caught first confounds distance/size with
   order; Hick shows no choice-count effect. Both are design findings about how to build such games
   (a contribution: fidelity depends on trial design, not only on the paradigm). [our data]
4. Playing before vs after the post-check (within student, randomised) shows small differences at
   most (Weber JND 22.6% vs 27.0%); effect sizes and CIs to come in Nov with full N. [interim]
5. Games produce ~2x the pointer activity of checks and less tab-leaving (13-21% of sessions vs 40%
   of checks), i.e. they are higher-engagement behaviourally. [our data, shared with paper 04]
6. Therefore: games can carry classic effects with variable fidelity, and ordering is a weak
   modulator; whether they teach more than text is untested here and the literature (Mayer, Alfieri,
   Wouters, Muilwijk) predicts guidance, not exposure, is what matters. [conclusion, hedged]

## 6. Our evidence so far (interim / exploratory)
- Stroop interference ~650 ms; replicates. Per dossier fit map, ~157 determinable stroop pairs.
- Weber JND: FLIP 22.6% vs CONTROL 27.0% (the fit map showed only 3 determinable pairs on
  2026-09-21; recheck N now, thin topic).
- Fitts: order-confounded (easy target first); MT x ID not interpretable until trial order is
  analysed or fixed.
- Hick: no choice-count effect.
- Games ~2x pointer activity vs checks; tab leaving 13-21% of game sessions vs 40% of checks.
- Telemetry flag state on prod was unconfirmed in the fit map; confirm.
- Data come only from Understanding games (assessment clients send no per-trial result).

## 7. Threats and counter-arguments
- No reading-only control: cannot claim game > text. Answer: claim is fidelity + ordering only.
- Unproctored devices: RT noise, frame rate, input device differ (Reimers & Stewart). Answer: report
  within-student contrasts and effect sizes, device class (logged), exclude timed-out trials; Stroop
  magnitude shows signal survives.
- Fitts confound: fix by modelling trial order or report as design failure; do not over-interpret.
- Hick null: Proctor & Schneider (2018) say the law depends on practice and S-R compatibility, so a
  short unpractised game may legitimately not show it; the null may be expected, not a failure. Also could be a comparison-task design, not non-replication; show design vs canonical
  paradigm (Hick 1952) honestly.
- Ordering is not obviously positive: DeCaro 2025 (explore-first helps only with enough time), Ashman
  2020 and Zambrano 2026 (instruction-first wins for complex material / low prior knowledge). Model
  the arm x pre-check interaction; expect the sign to depend on topic complexity.
- Participation may teach no more than a lecture (Elliott 2010) and engagement may not convert into
  learning (Ninaus 2023): keep the claim at fidelity + ordering.
- Fitts fit is device-dependent (touchscreen studies, unverified): record device class per trial.
- Selection: students who play are compliant ones; ITT and arm balance from paper 06; attrition by
  condition (Gestalt routing bug) documented there.
- Multiplicity and forking paths: exploratory by policy; label so, report all four paradigms, no
  selective reporting.
- Practice and carry-over: CONTROL players have already seen the post-check; ordering can act through
  learning of the items, not the perceptual task.
- Stroop word-reading language (English/Chinese bilingual class) alters magnitude; report language
  background if collected (demographics).
- Scoop (Li et al. 2025): differentiate by paradigms, telemetry and fidelity focus.

## 8. Venue fit
- Cognitive Science (dossier target): fits fidelity + embodiment framing; may want more theory.
- Behavior Research Methods: fits "classic effects in unproctored classroom/online games", timing and
  fidelity; probably the best fit for the reframed claim.
- Computers & Education or Int. J. of Human-Computer Studies / CHI Play: game design and HCI
  education angle; fidelity and ordering results suit a shorter empirical report.
- (npj Science of Learning was the dossier alternative; weaker fit without a learning-vs-reading arm.)

## 9. Open items
- Full export in Nov: per-trial `game_result` for all four games with arm, device class, language;
  confirm `TELEMETRY_ENABLED` was on throughout (otherwise trial counts are lower than pair counts).
- Weber N is thin; check count before any inferential claim.
- Decide Fitts handling: analyse trial order as covariate or report as design failure; document the
  fix if the game is changed (do not mid-study change without versioning).
- Pre-specify (in a dated analysis plan, labelled exploratory) the four RQ1 benchmark effects and the
  ordering contrasts before unblinding in Nov.
- Verify page numbers noted above (Semmelmann & Weigelt, Reimers & Stewart, Stroop, Fitts, Hick) and
  read effect-size claims in the original papers; dossier numbers are secondary.
- Search again near submission per paradigm (e.g. classroom Stroop/Fitts/Hick/Weber simulation
  learning outcomes) for new scoops.
- Consensus log (2026-10-16): 1 search + 1 same-thread follow-up on online replication of classic RT
  effects; Round 2 (mcp consensus search, 5 questions): (a) does personally experiencing a classic
  psychology/perception effect beat reading/lecture; (b) does order of simulation vs
  instruction/assessment change outcomes (productive failure); (c) do students performing Stroop/RT
  tasks in class learn more than readers; (d) do web/touch pointing data reproduce Fitts' law and how do
  device and order matter; (e) do engaging games produce more conceptual learning or do motivation and
  learning dissociate. Not yet asked: Weber-specific teaching evidence.
- Coordinate with paper 04 on shared telemetry (tab-leaving, pointer activity) so numbers match.
