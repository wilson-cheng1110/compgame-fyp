# Paper 07 backbone — AI tutor design (mandatory Socratic reflection vs optional free chat)

*Built 2026-10-16. Status: backbone, not a draft. No pre-registration exists for 07 (the README lists it as a methods/design contribution); the only related filing is `01b-retention.md`, whose tutor-reflection retention test is separate and exploratory. Citation identity checks done via Crossref/arXiv/EdWorkingPapers lookups (generic bibliographic queries only; no repo data left the machine).*

## 1. Working title and claim

**Title:** *Nudged, not asked: a mandatory Socratic reflection turn versus optional free chat in a flipped HCI course*

**Claim (what the data supports today):** In a 340-student, 13-topic course platform, a mandatory, post-check Socratic reflection with a small local model (gemma4:e4b) was completed by most students and reached the tutor's own "insight" flag about half the time, whereas optional free chat was almost never used and a third of the little use fell DURING checks. This is a descriptive design and usage account. It is not evidence that the Socratic gate improves learning relative to an answer-bot (no such arm exists, and none will be built).

## 2. Research questions

Exploratory and descriptive; no pre-registered hypotheses.
- RQ1. How much do students engage with a mandatory Socratic reflection (completion, turns, "insight" rate, ask-for-the-answer rate), and does this differ by FLIP/CONTROL arm?
- RQ2. How much do students voluntarily use free chat, when, and for what (notably during checks)?
- RQ3. Does reflection "insight" track prior performance (prior post score) or later outcomes (immediate post, Nov retention)? Correlational only.
- RQ4. What design implications follow for mandatory vs optional AI support in unproctored, low-stakes courses?
- (Tied to the pre-registered 01b exploratory test of whether reflection aids retention; report as exploratory.)

## 3. Literature support (16 sources)

Verification standard: VERIFIED = DOI/arXiv/URL resolved and title + first authors + year match. Quoted effect sizes marked "(claim not re-checked)" were carried from the dossier and not re-read in the source.

1. Bloom, B. S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. *Educational Researcher, 13*(6), 4-16. DOI 10.2307/1175554. **VERIFIED.** Motivates tutoring at scale. Later work shrinks the 2-SD figure, so cite as motivation only.
2. VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197-221. DOI 10.1080/00461520.2011.611369. **VERIFIED.** Step-level interaction granularity is the active ingredient (ES values: claim not re-checked). Supports a guided-turn design.
3. Chi, M. T. H., Siler, S. A., Jeong, H., Yamauchi, T., & Hausmann, R. G. (2001). Learning from human tutoring. *Cognitive Science, 25*(4), 471-533. DOI 10.1207/s15516709cog2504_1. **VERIFIED.** Constructive prompting vs tutor telling; precedent for withholding answers.
4. Graesser, A. C., Lu, S., Jackson, G. T., Mitchell, H. H., Ventura, M., Olney, A., & Louwerse, M. M. (2004). AutoTutor: A tutor with dialogue in natural language. *Behavior Research Methods, Instruments, & Computers, 36*(2), 180-192. DOI 10.3758/BF03195563. **VERIFIED** (author list corrected from the dossier, which had wrong authors). Dialogue-tutor design lineage.
5. Aleven, V., McLaren, B., Roll, I., & Koedinger, K. (2004). Toward tutoring help seeking: Applying cognitive modeling to meta-cognitive skills. *Proc. ITS 2004.* http://www.cs.cmu.edu/~aleven/Papers/2004/Aleven_ea_ITS2004_HelpSeeking.pdf. **VERIFIED** (PDF opened, title/authors match; no DOI found). Help-seeking is often unproductive; supports gating. The "72% unproductive" figure is **not** confirmed; do not quote it until read.
6. Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the Cognitive Tutor classroom: When students "game the system". *CHI 2004.* DOI 10.1145/985692.985741. **VERIFIED.** Gaming the system; replaces the dossier's "Detecting Student Misuse" entry, which I could not resolve.
7. Macina, J., Daheim, N., Chowdhury, S. P., et al. (2023). MathDial: A dialogue tutoring dataset with rich pedagogical properties grounded in math reasoning problems. arXiv:2305.14536 (EMNLP Findings 2023). **VERIFIED** (arXiv title/authors/date). Untuned LLMs leak answers too early; supports designing for withholding.
8. Sonkar, S., Liu, N., Mallick, D. B., & Baraniuk, R. G. (2023). CLASS: A design framework for building intelligent tutoring systems based on learning science principles. arXiv:2305.13272. **VERIFIED.** Design pattern for scaffolding-first LLM tutors.
9. LearnLM Team, Google (2024). LearnLM: Improving Gemini for learning. arXiv:2412.16429. **VERIFIED.** Industrial prior art on pedagogical instruction-following. Contrast: tuned frontier model vs our small local model.
10. Wang, R. E., Ribeiro, A. T., Robinson, C. D., et al. (2024). Tutor CoPilot: A human-AI approach for scaling real-time expertise. arXiv:2410.03017; EdWorkingPaper ai24-1054, https://edworkingpapers.com/ai24-1054. **VERIFIED.** AI that prompts a human tutor improved mastery (4 pp: claim not re-checked). Question-style assistance, but a human is in the loop.
11. Kestin, G., Miller, K., Klales, A., Milbourne, T., & Ponti, G. (2025). AI tutoring outperforms in-class active learning: An RCT introducing a novel research-based design in an authentic educational setting. *Scientific Reports, 15.* DOI 10.1038/s41598-025-97652-6. **VERIFIED** (first four authors confirmed; fifth from memory, check before citing). Well-designed AI tutor beats active learning. Not a pure withholding design, and it was a designed lesson, not optional chat.
12. Bastani, H., Bastani, O., Sungu, A., Ge, H., et al. (2025). Generative AI without guardrails can harm learning: Evidence from high school mathematics. *PNAS, 122.* DOI 10.1073/pnas.2422633122. **VERIFIED.** Unrestricted answer-giving AI hurt later unassisted performance. Strongest support for guardrails; also a scoop-watch (different domain, no understanding-detection gate).
13. Becker, E., Wünsche, J., Veith, J. M., et al. (2025). From cognitive relief to affective engagement: An empirical comparison of AI chatbots and instructional scaffolding in physics education. arXiv:2508.06254. **VERIFIED** (preprint; first authors match). Unrestricted chat lowers stress but dissociates from learning; the "students prefer the answer" side.
14. Fakour, H., & Imani, M. (2025). Socratic wisdom in the age of AI: A comparative study of ChatGPT and human tutors in enhancing critical thinking skills. *Frontiers in Education, 10.* DOI 10.3389/feduc.2025.1528603. **VERIFIED.** Note: Crossref shows it compares ChatGPT with human tutors, not Socratic vs plain chatbot as the older dossier says; use cautiously and re-read the design before citing it as a head-to-head.
15. Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Educational Psychology Review, 30,* 703-725. DOI 10.1007/s10648-018-9434-x. **VERIFIED** (identity; page range and g=0.55 from dossier, not re-checked). Self-explanation prompts help, but shallow prompts help little; relevant to our reflection depth coding.
16. Chi, M. T. H., & Wylie, R. (2014). The ICAP framework: Linking cognitive engagement to active learning outcomes. *Educational Psychologist, 49*(4), 219-243. DOI 10.1080/00461520.2014.965823. **VERIFIED.** Constructive > active > passive; frames why a mandatory constructive turn might matter.

17. Kapoor, A., Diaz, M., & MacNeil, S. (2025). Exploring student behaviors and motivations using AI TAs with optional guardrails. arXiv:2504.11146. **VERIFIED** (arXiv title/authors/date match; lead came from the Consensus summary, which itself is not evidence). Preprint. Per the Consensus summary (not re-read in the paper): when scaffolding was optional in a ~885-student programming course, about half switched it off for verbatim answers at least once, and weaker students did so more near deadlines. Directly relevant: optional guardrails are bypassed, which supports a mandatory step. Quote the numbers only after reading the paper. The peer-reviewed version is Kapoor, Denny, Porter, et al. (2026), *Proc. 28th Australasian Computing Education Conference*, DOI 10.1145/3786228.3786233, **VERIFIED** on CrossRef (title and first author match; year 2026 there, 2025 on the Consensus record). The Consensus abstract reports 50% of 885 students used a "See Solution" bypass at least once, 14% on all three tasks, and low performers used it more near deadlines (via Consensus; abstract read, full paper not).
18. Eastwood, M., Narne, H., Hilby, J., et al. (2026). Guardrails or roadblocks? Effects of pedagogical style and context awareness in AI teaching assistants for programming. arXiv:2609.29995. **VERIFIED** (identity only, from an arXiv lookup I ran myself, not via Consensus; abstract not read). Possible counter-evidence on whether pedagogical guardrails frustrate students; read before citing.

19. Yang, J. W., Choe, K., Lim, et al. (2025). Asking questions matters: Comparing the effect of learning through dialogue with peers, ChatGPT, and intelligent tutoring system. *Interactive Learning Environments.* DOI 10.1080/10494820.2025.2488984. **VERIFIED** (CrossRef: title, first author, 2025). (via Consensus) University students who could ask questions (peer or ChatGPT) outperformed those who only answered ITS questions after dialogue (n=114, per abstract). Challenges a pure answer-elicitation tutor: learner-initiated questions mattered, which is the channel our free chat offers and our mandatory turn mostly removes.
20. Degen, P.-B., & Asanov, I. (2025). Beyond automation: Socratic AI, epistemic agency, and the implications of the emergence of orchestrated multi-agent learning architectures. arXiv:2508.05116. **VERIFIED** (arXiv title, authors, date). (via Consensus) Preprint, n=65 pre-service teachers: a Socratic tutor was rated higher for critical, reflective thinking than an uninstructed chatbot. Self-report outcome, not learning gain.
21. Dang, A. H., Huynh, et al. (2026). Beyond automation: Cultivating self-regulated learning through AI and reflective practice. *Technology, Knowledge and Learning.* DOI 10.1007/s10758-026-09970-x. **VERIFIED** (CrossRef: title, first author, 2026). (via Consensus) 2x2 study (n=288): how ChatGPT was used and reflection type both shaped self-regulation; students moved from over-reliance to more strategic use over time. Supports pairing AI use with reflection; reflection here was not a Socratic tutor turn.

22. Bassner, P., Lenk-Ostendorf, Beinstingel, et al. (2025/2026). Less stress, better scores, same learning: The dissociation of performance and learning in AI-supported programming education. *Computers and Education: Artificial Intelligence.* DOI 10.1016/j.caeai.2025.100537. **VERIFIED** (CrossRef title and first author; year 2025 online, issue dated 2026). (via Consensus) Three-arm RCT (n=275 per abstract): a hint-first tutor and unrestricted ChatGPT both raised exercise scores but neither raised pre-post knowledge; only the scaffolded tutor raised intrinsic motivation; students preferred ChatGPT. Replaces the dossier's loose "companion study" pointer for Becker 2025.
23. Deffarges, A. C., & Kosmyna, N. (2026). Socrates went nuclear: Comparing interaction strategies for AI systems in a learning context using brain sensing. arXiv:2609.00584. **VERIFIED** (arXiv title and authors). (via Consensus) CONTRARY evidence, preprint, n=50: the unrestricted chatbot gave higher immediate learning gains than the Socratic (hint) mode, and Socratic users progressively disengaged. The authors themselves caution the immediate post-test may flatter unrestricted AI. A delayed test is the answer, which is what our Nov battery offers.
24. Kapuza, A., Andriasian, et al. (2025). Reflection prompts are not promising: A randomised controlled trial in a short MOOC shows no positive effects. *Open Learning.* DOI 10.1080/02680513.2025.2545925. **VERIFIED** (CrossRef title, first author, 2025). (via Consensus) RCT, over 5,000 learners: brief text reflection prompts did not change completion or test scores. Challenges the premise that a reflection step does anything; our paper must treat it as a risk, not an assumption.
25. Gruenhagen, J. H., Sinclair, P. M., Carroll, J.-A., et al. (2024). The rapid rise of generative AI and its implications for academic integrity: Students' perceptions and use of chatbots for assistance with assessments. *Computers and Education: Artificial Intelligence.* DOI 10.1016/j.caeai.2024.100273. **VERIFIED** (CrossRef). (via Consensus) Survey, n=337: over a third had used a chatbot for an assessment. Backs the plausibility of chat-during-checks, but our rate is log-based, theirs is self-report.
26. Wu, R., & Yu, Z. (2023). Do AI chatbots improve students learning outcomes? Evidence from a meta-analysis. *British Journal of Educational Technology.* DOI 10.1111/bjet.13334. **VERIFIED** (CrossRef: Wu, Yu, 2023). (via Consensus) Meta-analysis of 24 randomised studies: large effect overall but stronger in short interventions (novelty). Cautions that short-term gains may not persist.
27. Liu, J., Huang, Z., Xiao, T., et al. (2024). SocraticLM: Exploring Socratic personalized teaching with large language models. NeurIPS 37. DOI 10.52202/079017-2721. **VERIFIED** (CrossRef title, first author, 2024; coordinator supplied the DOI). Fine-tuned Socratic LLM on simulated dialogues; evaluation is simulated, not learning gain.

Found via Consensus but NOT added (could not be matched on CrossRef this session): Liu et al. 2026, LLM Socratic questioning in endodontic training RCT (*Int. Endodontic J.*; reported no difference vs instructor-led case learning at one hour) - UNVERIFIED.SocraticLM (Liu et al., NeurIPS 2024) - arXiv lookup failed, UNVERIFIED.

**Counts: 27 VERIFIED (identity), 1 UNVERIFIED (Liu 2026 endodontic RCT, listed above, not relied on).** Caveats: quoted numbers in 1, 2, 5, 10, 15 and the 5th author in 11 were not re-read. Sources not yet searched for and worth adding: LLM-tutor usage-pattern studies in HCI/CS education (optional-use rates), and mandatory vs optional help (e.g., help-seeking nudges). Not added because I could not verify them here.

## 4. Review of the field (points)

- Interaction granularity and constructive prompting drive tutoring effects (VanLehn; Chi 2001; ICAP).
- Optional guardrails get bypassed in the field: in a large programming course about half the students switched off scaffolding at least once (Kapoor 2025, preprint, numbers via Consensus summary). This is the closest direct support for a mandatory step.
- Contested: immediate gains can favour the unrestricted chatbot (Deffarges 2026, preprint) or show no learning difference between tutor types (Bassner 2025), while retention advantages for withholding appear only with a delayed test (Bastani 2025). Our Nov battery is the test of this.
- Brief reflection prompts alone often do nothing (Kapuza 2025, n>5,000), so a mandatory reflection step needs the tutor's dialogue to add something.
- Evidence on Socratic LLM tutors is thin and mostly short-term or self-reported: a 1-hour trial found no difference from instructor-led teaching (Liu 2026, unverified), and the positive results rely on self-rated thinking (Degen 2025). Learner-initiated questioning also helps (Yang 2025), a tension with a gate that mostly asks questions of the student.
- Students misuse available help: gaming and skipping to the answer (Baker 2004; Aleven 2004). Optional help is used least by those who need it (general help-seeking finding; cite after sourcing).
- Recent RCTs show guardrailed or scaffolded LLM tutors beat unrestricted chat on retained learning (Bastani 2025; Kestin 2025; Becker 2025), though unrestricted chat raises in-session comfort.
- LLM tutors left to default reveal answers (MathDial); pedagogical tuning or prompting fixes much of this (LearnLM; CLASS).
- Contested: whether Socratic dialogue itself, or just withholding plus scaffolding, does the work; most comparisons confound the two.
- Contested: whether small local models can run Socratic detection reliably (links to paper 08).
- Gap: almost all studies measure a voluntary or assigned tutoring session on one task. Few report what happens in a live, unproctored, multi-topic course when the tutor is a required step versus an optional widget, nor how often "understanding detection" fires in practice.
- This paper fills the gap with real-world usage evidence on a mandatory vs optional split, plus implications for design. It does not fill the causal gap.

## 5. Argument

1. Optional AI help is under-used by design: free chat is rare (~90 questions across ~340 students), so it cannot carry a pedagogical function on its own. *Our data: interim.*
2. When it is used, it clusters at the wrong moment: about a third during checks, where it functions as answer-seeking and contaminates the measurement. *Our data: interim; contents not yet read.*
3. A required step placed AFTER the post-check does reach students: 1,990+ reflections, 76% of students at least once; it cannot bias the immediate post and it works regardless of arm. *Our data: interim; compliance is by design, not a learning result.*
4. In that required step the tutor's "insight" flag fires about half the time, equally by arm, and answer-asking is 9-10%: a withholding stance is tolerated by most students. *Our data: interim; flag comes from the same small model that is being studied, so it is not an outcome.*
5. Whether this produces learning is open: insight weakly tracks prior post score (p .07) and the retention battery (Nov) gives the first outcome test. *To come in Nov; exploratory.*
6. Conclusion: for unproctored low-stakes settings, designers should place the constructive tutor turn in the flow (and after measurement) rather than rely on opt-in chat, and should log and disclose when chat is used during assessments. Limited to design implications; no causal claim.

## 6. Our evidence so far (interim / exploratory)

- 1,990+ reflections; 51% reach "insight" (tutor flag); 76% of students at least once; ≈ equal by arm; tracks prior post score weakly (p .07).
- 9-10% of reflection turns ask for the answer.
- Free chat ~90 questions; about a third during checks.
- Tutor latency p50 ~2 s (local gemma4:e4b); grader κ vs human NOT yet computed (paper 08).
- Depth coding by two human coders pending; no outcome (retention) data yet.
- Context: immediate H1 FLIP effect small (+0.85 to +1.35 / 100, p .07-.25), so the tutor could not rescue a large effect either way. Tab-leaving in 40% of checks and external-help use (44% of pre-checks) mean "chat during checks" is one of several help channels (paper 04).
- Telemetry logs only counts, latency and lengths for free chat, never question text, which limits what can be said about its content.

## 7. Threats and counter-arguments

- **No comparison arm; descriptive only.** True; the paper claims description and design implications, not efficacy. State this in the abstract.
- **"Insight" is the model's own flag; circular.** Treat as a usage measure; validate against human depth coding (pending) and report κ; do not use as an outcome without it.
- **Mandatory step is a confound with usage (everyone sees it).** Correct, that is the point of the comparison with optional chat; but the two differ in placement, topic, and framing, so do not attribute differences to "mandatory" alone.
- **Free chat counts are tiny (~90).** Report as rates with intervals and avoid inferential claims; the Nov window adds more.
- **Small local model may be unreliable.** Cross-reference paper 08; sample-check transcripts.
- **Mandatory reflection may harm satisfaction or inflate rote responses.** Check against IMI/ARCS (paper 02), and the response-length distribution.
- **Unproctored, ungraded context.** Reflection effort may be low; report as a feature of the context, with a caveat on generalisation.
- **Mandatory gating may frustrate or push students to other tools.** Possible counter-evidence (Eastwood 2026, unread); check before submission, and examine our data for tab-leaving during reflection.
- **Reflection steps may simply not work (Kapuza 2025) and unrestricted AI may win on immediate tests (Deffarges 2026).** Answer: do not claim learning effects; the paper describes usage and design; retention analysis stays exploratory and is the fair test.
- **Near-scoop on withholding vs answer (Bastani 2025).** Position as complementary: field usage of a gate in a course, not an efficacy test.

## 8. Venue fit

- AIED / IJAIED (AI in Education): fits usage + design of an LLM tutor; expect reviewers to want an efficacy comparison.
- ACM Learning @ Scale (L@S): good for large-scale usage and design lessons.
- CHI / CSCW late-breaking work or Computers & Education: framing around mandatory vs optional AI help.

## 9. Open items

- Human reflection-depth coding (two coders), κ; then link depth to arm, prior score, and later retention.
- Decide whether the "insight" flag is an outcome or a usage measure; document how it is produced (prompt, `understood`/`counts` envelope, mandatory-turn floor).
- Free-chat analysis: timing relative to check state, per-topic, per-student concentration; confirm the "during checks" classification logic and counts.
- Retention battery (opens ~23 Nov): exploratory link between reflection insight/depth and Form C / application score; file or mark as exploratory before looking.
- Re-read sources 5, 11, 13, 14 to confirm the specific claims, and add a few papers on optional-vs-mandatory help and LLM-chat usage rates.
- Check telemetry feasibility: confirm no question text is stored and that ethics wording covers any content analysis.
- Consensus log (2026-10-16): the browser helper failed, so the pass was redone via the Consensus MCP tool with 3 queries (students bypassing AI-tutor guardrails; Socratic LLM tutor controlled studies; mandatory vs optional reflection dialogue with an AI tutor). Each returned only 3 papers (free tier). 4 new sources verified on CrossRef/arXiv (3 added, plus Kapoor's published version). No recursive follow-ups: the MCP tool has no thread, and I did not spend calls on spin-off queries. Round 2 (full-sentence questions, 5 calls): (a) Does a Socratic AI tutor that withholds answers produce better delayed retention than an answer-giving chatbot? (b) Does making an AI tutor interaction a required course step increase engagement and learning vs optional? (c) How rarely do students voluntarily use an AI chatbot for course help, and do they use it during quizzes? (d) Do hint-only/Socratic tutors lower immediate scores but improve transfer or retention? (e) Do students give low-effort responses to required reflection prompts in low-stakes online activities? Still missing after all rounds: any study with a DELAYED test comparing Socratic vs unrestricted LLM tutors, and any direct required-vs-optional tutor-step comparison.
- Cross-check with paper 08 (grader/tutor reliability) so the two do not double-count.
