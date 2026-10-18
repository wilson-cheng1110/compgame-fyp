# Paper 03 backbone: reflection depth, help-seeking, and retention (2026-10-16)

Built from `docs/lit/03-reflection-help-seeking.md`, `docs/lit/paper-03-coding-scheme.md`,
`docs/lit/arguments-for-against.md`, `docs/lit/citation-verification.md`, `docs/lit/data-to-paper-fit.md`,
`docs/pre-registration/README.md` (stub 03) and `01b-retention.md`. Citations re-resolved 2026-10-16
against CrossRef (title, authors, year, venue) and arxiv.org abstract pages.

## 1. Working title and claim

**Working title:** "Reflect or just tell me? Socratic AI-tutor reflection, help-seeking style, and
delayed retention in a flipped HCI course."

**Claim the data supports today (interim, exploratory):** after a post-check, about half of AI-tutor
reflections reach the tutor's "insight" flag and about one in ten turns asks for the answer outright;
neither rate differs much by FLIP/CONTROL. Whether depth or help-seeking style predicts learning is
NOT yet testable: human depth coding is pending and the delayed retention data arrive after ~23 Nov 2026.

## 2. Research questions / hypotheses (match the pre-registration stub 03 and 01b)

- **H3a (stub 03, confirmatory candidate, only if PI commits):** within participant across topics, deeper
  reflection (generative vs shallow/metacognitive-only) and a lower rate of executive help-seeking predict
  higher learning gain. Model: gain ~ depth + help-seeking style + (1|participant) + (1|topic).
- **H3b (01b exploratory, registered 2026-10-13, before battery data):** Form C score ~ reached-insight
  + immediate post + interval + (1|participant) + (1|topic). Prediction: positive insight coefficient net
  of the post-check. "Completed vs skipped" is descriptive only (self-selection).
- **RQ (descriptive):** how common is each reflection depth and help-seeking style, and do they vary by
  arm, topic, prior score?
- Pre-registered precedent to pre-address (stub 03, Q8): a large preregistered null for a reflection prompt.
  The null is a live outcome, not a failure.

## 3. Literature support (15 sources)

Status key: VERIFIED = DOI/arXiv page opened 2026-10-16 and title+authors+year match.

1. VERIFIED. Chi, M. T. H., Bassok, M., Lewis, M. W., Reimann, P., & Glaser, R. (1989). Self-explanations:
   How students study and use examples in learning to solve problems. *Cognitive Science, 13*(2), 145-182.
   https://doi.org/10.1207/s15516709cog1302_1. Good learners self-explain far more; quality predicts
   success. Supports the "generative" end of the depth axis.
2. VERIFIED. Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation:
   A meta-analysis. *Educational Psychology Review, 30*(3), 703-725. https://doi.org/10.1007/s10648-018-9434-x.
   g = 0.55 overall; weaker for prompts that elicit only self-report. Source of the shallow/generative line;
   challenges us if our tutor's prompts read shallow.
3. VERIFIED. Aleven, V., Roll, I., McLaren, B. M., & Koedinger, K. R. (2016). Help helps, but only so much:
   Research on help seeking with intelligent tutoring systems. *IJAIED, 26*(1), 205-223.
   https://doi.org/10.1007/s40593-015-0089-1. Instrumental vs executive help-seeking; basis of Axis B.
4. VERIFIED. Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the
   cognitive tutor classroom: When students "game the system." *Proc. ACM CHI 2004*, 383-390.
   https://doi.org/10.1145/985692.985741. Gaming (answer extraction) is measurable and goes with lower
   learning. Supports "answer-grabbing costs something".
5. VERIFIED. Zengilowski, A., Schuetze, B., Siedahmed, S., Yan, V., & Heffernan, N. (2025). Encouraging
   metacognitive reflection through prompts in a computer-based learning platform: Failure to find a benefit
   in a large-scale randomized trial. *Proc. 12th ACM Conf. on Learning @ Scale.*
   https://doi.org/10.1145/3698205.3729547. Preregistered, N about 1,005; prompt changed neither hint use nor
   post-test. Strongest challenge; the dossier's "2024, authors withheld" is corrected here.
6. VERIFIED. Guo, L. (2022). Using metacognitive prompts to enhance self-regulated learning and learning
   outcomes: A meta-analysis of experimental studies in computer-based learning environments. *J. Computer
   Assisted Learning, 38*(3), 811-832. https://doi.org/10.1111/jcal.12650. g about 0.40 on outcomes; effect-size
   benchmark. (Dossier's "Guo, X., et al." is wrong: sole author.)
7. VERIFIED. Choi, H., Phung, T., Wu, M., Singla, A., & Brooks, C. (2025). Reflection-satisfaction tradeoff:
   Investigating impact of reflection on student engagement with AI-generated programming hints.
   arXiv:2512.04630 (preprint). Higher-quality reflection went with lower satisfaction with AI hints.
   Warns against measuring satisfaction instead of learning.
8. VERIFIED. Divekar, R. R., Guerra, S., Gonzalez, L., & Boos, N. (2025). Exploring the interaction-outcome
   paradox: Seemingly richer and more self-aware interactions with LLMs may not yet lead to better learning.
   arXiv:2511.09458 (preprint). Richer LLM interaction, no better learning. Challenges equating articulate
   chat with reflection.
9. VERIFIED. Lane, H. C. (2026). AIED's unfinished mission: Centering agency and motivation in the age of
   effortless bypass. arXiv:2607.05557 (preprint; submitted 2026-07-06). Frames "effortless bypass" as the open
   problem; framing citation. Preprint status to be rechecked before submission.
10. VERIFIED. Bjork, R. A., & Bjork, E. L. (2020). Desirable difficulties in theory and practice. *J. Applied
    Research in Memory and Cognition, 9*(4), 475-479. https://doi.org/10.1016/j.jarmac.2020.09.003. Effortful
    processing costs now, pays later: the mechanism behind a delayed-retention prediction.
11. VERIFIED. Pyke, W., Lunau, J., & Javadi, A.-H. (2025 print; online 2024-12-24). Does difficulty moderate
    learning? A comparative analysis of the desirable difficulties framework and cognitive load theory. *Q. J.
    Experimental Psychology.* https://doi.org/10.1177/17470218241308143. Difficulty helps only under some task
    complexity; a null is theory-consistent.
12. VERIFIED. Shields, M., Calabro, G., & Selmeczy, D. (2024). Active help-seeking and metacognition interact
    in supporting children's retention of science facts. *J. Experimental Child Psychology, 237*, 105772.
    https://doi.org/10.1016/j.jecp.2023.105772. Active help-seeking aids retention, moderated by metacognition;
    child sample, so adult data is a gap.
13. VERIFIED. Hou, Kuhlmann, Greene, Bernacki, Hogan (2025). Process mining measures students' help-seeking
    transitions when completing assignments in an online learning and assessment platform. *Metacognition and
    Learning.* https://doi.org/10.1007/s11409-025-09442-0. Sequence-based help-seeking measures; method option
    and target-venue precedent. (Authors recovered from CrossRef; the dossier left them blank. Initials/title
    punctuation to be completed from the publisher page.)
14. VERIFIED. Nelson, T. O., & Narens, L. (1990). Metamemory: A theoretical framework and new findings.
    *Psychology of Learning and Motivation, 26*, 125-173. https://doi.org/10.1016/S0079-7421(08)60053-5.
    Monitoring and control can dissociate; justifies treating reflection and help-seeking as separate axes.
15. UNVERIFIED. Winne, P. H., & Hadwin, A. F. (1998). Studying as self-regulated learning. In Hacker, Dunlosky &
    Graesser (Eds.), *Metacognition in Educational Theory and Practice* (pp. 277-304). Erlbaum. No DOI; real
    book chapter per the dossier, but not opened. Framework: monitoring triggers control acts.

16. VERIFIED (via Consensus; DOI resolved on CrossRef, title/authors/year match). Roll, I., Baker, R. S. J. d.,
    Aleven, V., & Koedinger, K. R. (2014). On the benefits of seeking (and avoiding) help in online problem-solving
    environments. *J. Learning Sciences, 23*(4). https://doi.org/10.1080/10508406.2014.883977. Help on hard steps
    is productive, overuse is worse, and for some novices avoiding help while failing repeatedly went with better
    learning. Challenges a simple "less help-seeking is worse" story; supports separating style from timing.
17. VERIFIED (via Consensus). Almeda, M. V., Baker, R. S., & Corbett, A. (2017). Help avoidance: When students
    should seek help, and the consequences of failing to do so. *Teachers College Record, 119*(3).
    https://doi.org/10.1177/016146811711900303. Not seeking help when needed also costs learning; the "none"
    code is not neutral.
18. VERIFIED (via Consensus). Schulz, A., & Voermanek (2025). How do help-seeking and help-abuse affect learning
    achievement in an interactive learning environment? *Computers and Education Open.*
    https://doi.org/10.1016/j.caeo.2025.100247. Per Consensus, more help-seeking, especially step-by-step hints,
    went with lower achievement. Supports the cost of answer-grabbing; first-author initial and full author list
    to be completed from the publisher page.

19. VERIFIED (via Consensus; CrossRef title/authors/year match). Ryan, E., Koppenhofer, et al. (2022). Prompted
    self-explanations improve learning in statistics but not retention. *Teaching of Psychology.*
    https://doi.org/10.1177/00986283221114196. Prompts helped initial learning but not later retention (per its
    title). Directly relevant: immediate benefit need not persist, which bears on H3b. Initials/volume to complete.
20. VERIFIED (via Consensus). Kapuza, A., Andriasian, et al. (2025). Reflection prompts are not promising: A
    randomised controlled trial in a short MOOC shows no positive effects. *Open Learning, 41.*
    https://doi.org/10.1080/02680513.2025.2545925. A second preregistered-style null for reflection prompts
    (adult MOOC), alongside Zengilowski 2025.
21. VERIFIED (via Consensus). Choi, H., Jovanovic, J., Poquet, O., & Brooks, C. (2023). The benefit of reflection
    prompts for encouraging learning with hints in an online programming course. *Internet and Higher Education,
    58*, 100903. https://doi.org/10.1016/j.iheduc.2023.100903. Counter-evidence: reflecting before using hints
    helped in a programming course (contrasts with Zengilowski; same group as Choi 2025 preprint).
22. VERIFIED (via Consensus). Engelmann, K., Bannert, M., & Melzner, N. (2021). Do self-created metacognitive
    prompts promote short- and long-term effects in computer-based learning environments? *Research and Practice in
    Technology Enhanced Learning, 16.* https://doi.org/10.1186/s41039-021-00148-w. Short vs long-term effects of
    prompts; method precedent for a delayed outcome.

23. VERIFIED (via Consensus MCP; CrossRef match). Yan, L., Greiff, S., & Lodge, J. M. (2025). Distinguishing
    performance gains from learning when using generative AI. *Nature Reviews Psychology.*
    https://doi.org/10.1038/s44159-025-00467-5. AI use can lift performance without deep processing; frames why
    immediate scores may not equal learning and why delayed retention matters.
24. VERIFIED (via Consensus MCP). Kumar, H., Musabirov, I., Reza, M., et al. (2024). Guiding students in using LLMs
    in supported learning environments: Effects on interaction dynamics, learner performance, confidence, and
    trust. *PACM on Human-Computer Interaction.* https://doi.org/10.1145/3687038. Direct LLM answers marginally
    improved performance; structured guidance cut random queries and copy-pasting. Challenges "answer-grabbing
    always hurts" (at least short-term).
25. VERIFIED (via Consensus MCP). Yang, S., Zhao, H., Xu, Y., et al. (2024). Debugging with an AI tutor:
    Investigating novice help-seeking behaviors and perceived learning. *Proc. ACM ICER 2024 (Vol. 1).*
    https://doi.org/10.1145/3632620.3671092. Students self-label chatbot use as "learning-oriented" vs "non-ideal";
    qualitative support for an instrumental/executive split with an LLM tutor.
26. VERIFIED (via Consensus MCP). Pallant, J., Blijlevens, J., Campbell, A., et al. (2025). Mastering knowledge: the
    impact of generative AI on student learning outcomes. *Studies in Higher Education.*
    https://doi.org/10.1080/03075079.2025.2487570. Content analysis of 192 reflections: using GenAI to construct
    and augment knowledge (mastery) went with higher-level learning than procedural use. Precedent for coding
    reflection depth from text; small quasi-experimental scale.

27. VERIFIED (via Consensus; CrossRef match). Modrek, A. S., & Lombrozo, T. (2024). Allow me to explain: Benefits of
    explaining extend to distal academic performance. *Cognitive Science.* https://doi.org/10.1111/cogs.13496.
    Explanation quality predicted standardized test scores a year later, controlling for prior scores (children,
    N = 127 and 20,384). Supports the depth to later-outcome link; age group differs from ours.
28. VERIFIED (via Consensus). Zhang, E. (2025). Unravelling the quality of processes of learning from errors: Insights
    from students' written error reflections in factoring tasks. *Learning and Instruction.*
    https://doi.org/10.1016/j.learninstruc.2025.102199. Depth-coded written reflections (low depth common) cluster
    into patterns linked to achievement; a coding-scheme precedent, but cross-sectional.
29. VERIFIED (via Consensus). Janssen, L., Schick, K., Neurohr, et al. (2024). Reflect to interact: fostering medical
    students' communication through reflection-focused e-learning. *BMC Medical Education.*
    https://doi.org/10.1186/s12909-024-05368-4. Reflection scores correlated positively with text length: a
    warning that "depth" can be length in disguise.
30. VERIFIED (via Consensus). Liu, X.-E., Zambrano, A. F., Baker, R. S., et al. (2025). Qualitative coding with GPT-4:
    Where it works better. *Journal of Learning Analytics.* https://doi.org/10.18608/jla.2025.8575. GPT-4
    agreement with humans varies by construct; it struggles where humans do. Bears on the deferred LLM-coder tier.
31. VERIFIED (via Consensus). Bassner, P., Lenk-Ostendorf, et al. (2026; online 2025). Less stress, better scores,
    same learning: The dissociation of performance and learning in AI-supported programming education. *Computers and
    Education: AI.* https://doi.org/10.1016/j.caeai.2025.100537. RCT N = 275: both AI arms scored higher but
    learned no more; a hint-first tutor kept motivation up while the unrestricted one did not. Fits the
    performance-versus-learning argument for a delayed test.

Counts: 30 VERIFIED, 1 UNVERIFIED (16 added via Consensus). Only titles and CrossRef metadata of 19-22 were checked, not their full texts; findings are as stated in titles/Consensus takeaways and must be read before citing. Weaknesses: only the Bisra/Chi/Aleven/Baker core is from before 2020;
four sources are preprints or very recent. No source tests reflection plus help-seeking jointly in an LLM
tutor (the gap).

## 4. Review of the field

1. Self-explanation and prompted reflection help on average, modestly (g about 0.55 and 0.40), and
   self-report-only prompts help least (Bisra 2018; Guo 2022).
2. Help-seeking splits into instrumental (learning-aimed) and executive (task-finishing); the executive
   kind and "gaming" go with weaker learning in ITS (Aleven 2016; Baker 2004).
3. Contested: a large preregistered RCT found a reflection prompt moved neither hint use nor post-test, and
   hint use did not hurt (Zengilowski 2025). Effects depend on prompt quality, prior knowledge, task.
4. Contested: LLM help is richer and more self-aware but not clearly better for learning (Divekar 2025);
   quality reflection can lower satisfaction (Choi 2025).
5. Desirable-difficulty theory predicts costs now, benefits later, so immediate tests can miss them
   (Bjork & Bjork 2020), but difficulty can overload on complex material (Pyke 2025).
6. Help-seeking effects are conditional on metacognitive skill (Shields 2024, children).
7. Measurement is unsettled: counts of hints vs sequence/process measures (Hou 2025) vs human coding.
8. Gap: no joint within-student account of reflection depth and help-seeking style, coded from the same
   logged AI-tutor dialogues, in a flipped design with a delayed retention outcome in university students.

## 5. Argument (premise to conclusion)

1. Reflection and help-seeking are separable control acts after monitoring (Nelson & Narens; Winne & Hadwin).
   Evidence: theory (cited). Our design logs both in one dialogue.
2. Depth (generative vs shallow) and style (instrumental vs executive) can be coded reliably by humans, with
   a kappa at or above 0.6 on both axes. Evidence: to come (coding pending; harness `backend/code_batch.py`
   built, 58 tests). If kappa is under 0.6 the axis is descriptive only.
3. The tutor's own flags (insight, direct-answer count) are a proxy for the codes. Evidence: not validated;
   compare with human codes as a validity check.
4. The reflection follows the post-check, so it cannot affect immediate scores; any learning effect must be
   seen in delayed retention. Evidence: design fact; retention data to come in Nov.
5. Immediate association of depth/style with post score reflects prior knowledge (insight tracks prior post
   score weakly, p .07). Hence retention models must hold the post-check fixed. Evidence: our interim data.
6. If depth predicts retention net of post-check, reflection is doing something beyond what the student knew
   (supports Bjork, Chi/Bisra); if not, it matches Zengilowski 2025. Evidence: to come in Nov.
7. Conclusion: either outcome is publishable as a joint depth x style account in an LLM tutor; the paper
   does not claim causation, because depth is not randomised.

## 6. Our evidence so far (interim, exploratory; prod data as of 2026-10-13/16)

- 1,990+ reflections logged; 51% reach the tutor's "insight" flag; 76% of students at least once.
- Insight about equal by arm; reflection follows the post-check in both arms.
- Insight tracks a higher prior post score (95.2 vs 88.0; within-student trend p = .071), so insight partly
  reflects prior knowledge.
- 9-10% of turns ask for the answer (tutor/`directAnswers` proxy, not a validated executive code).
- Free chat rare (about 90 questions; a third asked DURING checks, an external-help channel).
- Reflection step is mandatory since 2026-09-19 (PI decision), after the post-test; dialogue counts turns
  even when the model is down; `reflection_skipped` logged for the escape path.
- Not yet available: human depth/style codes, kappa, any retention outcome.
- Data notes: multiple reflection rows per participant-topic are possible (game replay), so the unit of
  analysis must be fixed before coding; `reflection_complete` is invisible to the live monitor.

## 7. Threats and counter-arguments

- **Null is likely (Zengilowski 2025).** Answer: pre-registered as live; the contribution is the joint coding
  and delayed outcome, valid either way. Report equivalence bounds, not just p.
- **Confounding by prior knowledge** (strong students reflect better). Answer: control immediate post and
  pre; within-student random intercepts; call results associational.
- **Tutor flags are not validity evidence.** Answer: human double coding first, kappa reported, flags
  compared to codes; no LLM coder before its own kappa.
- **Low kappa / small coded sample.** Answer: pre-commit the 0.6 rule (descriptive otherwise); code a
  stratified subsample, not all 1,990+.
- **Unproctored external help** contaminates help-seeking (tab-leaving 40% of checks; free chat during
  checks). Answer: use leave-page covariate from paper 04; separate in-tutor from out-of-tutor help.
- **Mandatory reflection** removes natural variation in whether to reflect and may induce "tell me"
  behaviour. Answer: state it; depth is measured among compelled reflections; skip rate is descriptive.
- **Chat with a small local model (gemma4:e4b) may differ from frontier tutors.** Answer: limitation; the
  design measures student behaviour with a fixed tutor, not tutor quality.
- **More nulls and a retention gap.** Kapuza 2025 (MOOC RCT, no effect) and Ryan 2022 (gain in learning but not
  retention) point the same way as Zengilowski 2025; Choi 2023 and Engelmann 2021 show benefits can exist.
  Answer: H3b is a delayed test by design; expect and pre-accept a null; engage these in the Discussion.
- **Direct LLM answers may not hurt short-term.** Kumar 2024: direct answers marginally improved performance;
  Yan 2025 and Pallant 2025: gains in performance differ from learning, and mastery use beats procedural use.
  Answer: the DV is delayed retention, not in-session performance; code HOW the answer is used (procedural vs
  knowledge-augmenting), not only whether it was requested.
- **"Depth" may be length.** Janssen 2024 found reflection scores correlated with text length. Answer: record
  word count per turn, code blind to length, and include length as a covariate in the depth models.
- **LLM coders are construct-dependent.** Liu 2025: GPT-4 fails where humans disagree. Answer: keep the human-first
  scheme; any gemma4:e4b scale-up must clear its own kappa per axis.
- **Help-seeking cuts both ways.** Roll 2014 and Almeda 2017: some help avoidance is productive for some novices,
  other avoidance is costly, so a low help rate is not automatically good. Answer: code style AND timing/need
  (instrumental, executive, none-when-stuck), and do not predict a monotone effect of `directAnswers`.
- **Multiple comparisons / forking paths** (two axes x many cuts). Answer: Holm within the registered
  family; everything else labelled exploratory.

## 8. Venue fit

- *Metacognition and Learning* (dossier target): fits depth/help-seeking constructs; Hou 2025 appeared there.
- *International Journal of AI in Education* or *AIED conference*: LLM-tutor framing, Aleven lineage.
- *Learning @ Scale / Journal of Learning Analytics*: fits large logged dialogue data and the null-result
  conversation with Zengilowski 2025.

## 9. Open items before writing

1. PI decision: commit stub 03 as confirmatory or keep exploratory; complete the pre-registration (Q8 text
   already drafted) BEFORE any coding against outcomes.
2. Fix the unit of analysis (first vs all reflections per participant-topic) before the coding sheet.
3. Run `code_batch.py --sheet`; two human coders; run `--kappa` on both axes; report honestly if under 0.6.
4. Compare the tutor's insight flag and `directAnswers` with the human codes (validity).
5. Wait for Form C and application-probe data (window opens ~23 Nov 2026); then run H3b as registered.
6. Pull the reflection rows via direct `research_store.fetch_all()` or the pseudonymised export (the monitor
   does not show them); never place transcripts in web queries or LLM calls off the box.
7. Complete citation 13's author initials; open Winne & Hadwin (15) or drop it; recheck preprints 7-9 for
   publication status; apply the Guo and Zengilowski corrections at source in `docs/lit/03-*.md`.
9. Consensus log (2026-10-16): browser helper pass (help-seeking style in ITS; contradiction follow-up; reflection and
   self-explanation prompts vs retention) plus Consensus MCP passes. Round 1 (keyword): delayed retention of
   reflection prompts; LLM tutor help-seeking; generative vs shallow reflection coding. Round 2 (full-sentence
   questions): (a) does depth/quality of written explanations or reflections predict later learning after controlling
   prior knowledge; (b) can LLMs code reflection quality or help requests reliably vs humans; (c) does mandatory
   reflection change reflection quality vs voluntary; (d) is response length a confound when coding explanation
   depth; (e) does a Socratic answer-withholding AI tutor give better delayed retention than a direct-answer tutor.
   Free tier gives 3 results/query and no DOIs (found via CrossRef). Question (c) returned only weak evidence (a
   survey of doctors on mandatory reflection, Payton 2021 abstract; not added): the mandatory-reflection effect on
   quality is still an uncited gap.
8. Decide how to handle the confound with paper 04's external-help covariate and with paper 07 (tutor design)
   to avoid overlapping claims.
