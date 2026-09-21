// The nine-paper research programme — a single in-app source of truth for the
// "scholarly artifact part" of each paper: hypothesis/DV, target venue, fit verdict,
// key measures, and (where the dossier has one) a for/against evidence table.
//
// PORTED, not authored: every field here is copied/condensed from
// `docs/lit/0X-*.md` (one dossier per paper) and `docs/lit/data-to-paper-fit.md`
// (the fit verdicts, the live-data-basis table, and Wilson's 2026-09-21 reframes of
// papers 07 and 09). Nothing here is invented — a field with no source material
// (e.g. a backup venue most papers were never given) is `null`, not guessed.
//
// Phase 1 (this file): structure only. `liveStatus` is the STATED status from the fit
// map's live-data-basis table — a string, not a live query. Phase 2 wires actual
// live queries into `/researcher/paper/[id]` via new `measures.py` functions +
// `researcher_api.py` endpoints (see the plan); this file does not change then, the
// page that reads it grows a live-data panel beside it.

export interface ForAgainst {
  /** Strongest evidence FOR the hypothesis, one paper dossier's `arguments-for-against.md` row per entry. */
  for: string[]
  /** Strongest evidence AGAINST it / the live threat — an independent list, not rebuttals to `for`. */
  against: string[]
}

export interface Paper {
  /** Matches the dossier filename stem (`docs/lit/{id}.md`) — traceable back to source. */
  id: string
  title: string
  venue: string
  /** An alternate target venue named in the dossier's own header. Most papers were never given
   *  one — `null` means "the dossier didn't name a backup", not "there isn't one". */
  backupVenue: string | null
  /** The paper's role in the pre-registration plan, from the fit map's own per-paper header
   *  (e.g. "H1 confirmatory primary", "exploratory"). */
  role: string
  /** The hypothesis and/or DV this paper tests, ported from the dossier's own "Hypothesis:" line
   *  and (where more precise) `data-to-paper-fit.md`'s "Hypothesis/DV:" line. For papers 07 and 09,
   *  this also carries Wilson's 2026-09-21 reframe verbatim — the original dossier framing is kept
   *  and marked superseded, not deleted, so the reasoning stays auditable. */
  hypothesisDV: string
  /** The fit map's own verdict string (verbatim, including any 2026-09-21 decision that overrides
   *  or annotates it) — a verdict on the PLUMBING (is the measure instrumented and live), not on
   *  the science. */
  fitVerdict: string
  /** The per-paper "Status" cell from the fit map's live-data-basis table — what the live panel
   *  will show once Phase 2 wires it. A placeholder badge in Phase 1; a real query in Phase 2. */
  liveStatus: string
  /** The measures/instruments this paper's DV is built on, each traceable to a fit-map row or a
   *  dossier's own description of its data. */
  keyMeasures: string[]
  /** The dossier's own for/against evidence table, where `docs/lit/arguments-for-against.md` has
   *  one (it covers all nine papers). */
  forAgainst?: ForAgainst
}

/** Loose heuristic over `liveStatus`'s own wording, for a badge tone — never a claim beyond what
 *  the string already says. "live" without a caveat reads green; a caveat ("pending", "unconfirmed",
 *  "iff", "FIX") reads amber; nothing else reads neutral. Phase 2's real endpoints replace this
 *  with an actual measured state. */
export function paperLiveTone(liveStatus: string): "live" | "caveat" | "pending" {
  const s = liveStatus.toLowerCase()
  const hasCaveat = /pending|unconfirmed|iff|fix:|not yet|blocker/.test(s)
  if (hasCaveat) return "caveat"
  if (s.startsWith("live")) return "live"
  return "pending"
}

export const PAPERS: Paper[] = [
  {
    id: "01-flip-effectiveness",
    title: "Does the flip work?",
    venue: "Computers & Education",
    backupVenue: null,
    role: "H1 confirmatory primary",
    hypothesisDV:
      "FLIP (Understanding-then-Assessment) produces higher normalised gain ⟨g⟩ on a uniform " +
      "pre/post concept inventory than CONTROL, within participant, within topic. Dossier framing: " +
      "learning a concept by playing/experiencing it first, then testing, produces higher learning " +
      "gains than testing first — a null result would challenge a popular teaching fashion.",
    fitVerdict:
      "STRONG. The entire IV→DV pipeline (assignment, compliance derivation, the concept inventory, " +
      "and an effort/rapid-guess classifier) is built, live, and self-diagnosing. Five topics already " +
      "carry 130–207 determinable pairs at ~100% compliance — enough for an honest interim H1 read " +
      "today; the full pre-registered N needs the remaining eight topics to release.",
    liveStatus: "live now (short-answer probe via grade_batch = secondary, pending)",
    keyMeasures: [
      "IV: condition ASSIGNED per topic per participant (schedule.py arm_for, deterministic, server-side)",
      "IV: condition OBSERVED + compliance check (measures.py, derives played_first / complied from the sink)",
      "Primary DV: normalised gain ⟨g⟩ from Form A (pre) / Form B (post), 6 isomorphic items each (checks.py)",
      "Secondary: in-game assessment score, duration_ms, attempts (research_store.py)",
      "Pre-specified rapid-response/effort flag on pre/post checks (measures.py effort()/_classify())",
    ],
    forAgainst: {
      for: [
        "Productive-failure synthesis holds — Sinha & Kapur 2021 meta (53 studies, 12k+): problem-solving-before-instruction beats instruction-first on understanding & transfer.",
        "Closest direct test supports — DeCaro et al. 2026 (BJEP, N=168 & 357): explore-first > instruct-first on conceptual understanding, transfer, interest.",
        "Flip meta-analyses are positive — Bredow 2021 (317 studies, d≈0.20–0.53 on 7/8 outcomes); van Alten 2019 small positive on learning.",
        "Mechanism is grounded — Schwartz & Bransford 1998 (\"a time for telling\") + Kapur 2008: prior exploration primes learners to absorb instruction.",
        "Active-learning base rate is huge — Freeman 2014 PNAS (225 studies): active learning raises exam scores, ~halves failure.",
      ],
      against: [
        "Immediate gain can reverse — Saba, Kapur & Roll 2025: explore-first lowered immediate post-test (converged later, won on transfer). Our primary DV is immediate → live risk.",
        "\"Test-first\" is not a weak strawman — prequestioning/pretesting (Pan & Carpenter 2023) and test-enhanced learning (Roediger & Karpicke 2006) give the control arm its own real benefit.",
        "Activity design can erase the effect — Velić & DeCaro 2025: \"invent one strategy\" exploration did not beat instruction-first — position alone isn't enough.",
        "Near-scoop weakens novelty — DeCaro 2026 already shows it → our contribution is scale/format (many topics, within-subjects), not the effect itself.",
        "Flip metas confound ordering with video + reduced class time (van Alten, Bredow) — the sequence-only effect is less established than the bundled \"flip.\"",
      ],
    },
  },
  {
    id: "02-motivation-experience",
    title: "How the flip feels",
    venue: "Contemporary Educational Psychology",
    backupVenue: null,
    role: "H2/H3/H4 confirmatory-if-committed",
    hypothesisDV:
      "FLIP raises IMI motivation (H2) and CoI-reworded interaction (H3); ARCS-S satisfaction (H4) " +
      "is confirmatory-null; Paas cognitive load is a co-equal bonus outcome. Dossier framing: the " +
      "flip lifts motivation, sense of learning community, and satisfaction — not just scores. Or it " +
      "costs more effort for no felt benefit.",
    fitVerdict:
      "STRONG (instrumentation) / unverified-by-arm (this session). All four instruments are wired, " +
      "consent-gated, and live-collecting at N=157 — roughly half the active cohort has already " +
      "completed the full post-battery. This is writable on an interim basis; the condition-level " +
      "split needs the export step this run deliberately skipped.",
    liveStatus: "live — answers are in the sink",
    keyMeasures: [
      "IMI, 4 subscales (interest/enjoyment, perceived competence, effort, pressure/tension), reverse-scored M9/M11 (questionnaires.json, 12 items)",
      "CoI reworded (\"instructor\"→\"game + AI tutor\"), teaching/social presence subscales (8 items, flagged non-validated adaptation)",
      "ARCS-S + global satisfaction items (8 items)",
      "Paas single-item cognitive-load rating, per topic",
      "Delivery: consent-gated, one submission per instrument, condition-keyed (questionnaire_api.py)",
    ],
    forAgainst: {
      for: [
        "Motivation metas positive — Zheng 2020 (95 studies) moderate on motivation; Wu 2025 (PE) improved intrinsic motivation & self-efficacy.",
        "Satisfaction meta, positive side — Strelan 2020 (53 studies, 8,429): weak–moderate positive on course & instructor satisfaction.",
        "Theory predicts it — SDT (Ryan & Deci 2000): an autonomy/competence-supporting flip should raise intrinsic motivation.",
        "CoI rises under flip — Lee & Kim 2018: all three presences increased.",
        "Load can be productive — de Leng & Pawelka 2020: well-designed flip = high germane, low extraneous load.",
      ],
      against: [
        "Satisfaction null — van Alten 2019: no significant satisfaction effect (g=0.05, p=.73) — directly undercuts the felt-benefit half.",
        "Felt-learning can drop — Deslauriers 2019 PNAS: active learning lowered perceived learning while raising actual — the \"effort, no felt benefit\" branch.",
        "The literature is unsettled — Strelan (positive) vs van Alten (null) disagree on the same outcome.",
        "Our CoI is a non-validated rewording (\"instructor\"→\"game + AI tutor\") — a null could be an instrument artifact, not a real absence.",
        "Motivation ≠ learning — Wouters 2013 (games meta): learning and motivation gains dissociate — a felt gain needn't track the H1 gain.",
      ],
    },
  },
  {
    id: "03-reflection-help-seeking",
    title: "Reflection & help-seeking",
    venue: "Metacognition and Learning",
    backupVenue: null,
    role: "confirmatory candidate",
    hypothesisDV:
      "Reflection depth × help-seeking style (instrumental vs executive) predict learning gain, " +
      "coded from the mandatory post-test reflection and tutor logs. Dossier framing: students who " +
      "reflect more deeply — and reach for \"just tell me the answer\" less — learn more. Or " +
      "grabbing the answer costs nothing.",
    fitVerdict:
      "THIN — unchanged by the 2026-09-21 decision below. The logging exists to eventually support " +
      "this paper, but neither of its two DVs has a coding scheme yet, and this session could not " +
      "confirm how much reflection data has even accumulated. Confirmatory status is realistic only " +
      "after the coding scheme is built and inter-rater checked — currently a research-methods " +
      "prerequisite, not a data problem. Decision (2026-09-21, Wilson): BUILD. The coding scheme is " +
      "going to be built, not deferred indefinitely — scoped in docs/lit/paper-03-coding-scheme.md, " +
      "grounded in Bisra et al. 2018 / Chi et al. 1989 (depth) and Aleven et al. 2016 (help-seeking " +
      "style), mirroring grade_batch.py's blind + --kappa pattern. The THIN verdict stands until that " +
      "harness is actually built and run — this is a scope document, not a status change.",
    liveStatus: "live proxy now; coded depth via code_batch = pending (human coders)",
    keyMeasures: [
      "Raw reflection transcript + turn-level signal (reflection_complete event: turns, countedTurns, insight, endReason, transcript, turnQuality, directAnswers)",
      "Reflection-depth coding (generative vs shallow, Bisra/Chi scheme) — NOT instrumented, scoped not built",
      "Help-seeking style coding (instrumental vs executive, Aleven 2016 scheme) — NOT instrumented, scoped not built",
      "directAnswers count — the nearest existing proxy, a count rather than the instrumental/executive classification the paper needs",
    ],
    forAgainst: {
      for: [
        "Self-explanation works — Chi 1989 (good learners self-explain 5×); Bisra 2018 meta g=0.55 for self-explanation prompts.",
        "Executive help-seeking measurably costs — Baker 2004 (gaming-the-system); Aleven 2016 (instrumental helps, executive doesn't).",
        "Metacognitive prompts help — Guo 2022 meta g=0.40 on outcomes.",
        "Desirable-difficulty theory — Bjork & Bjork 2020: effortful reflection's short-term cost is the long-term mechanism.",
        "Adaptive help-seeking helps — Shields 2024: active > passive help-seeking, moderated by metacognition.",
      ],
      against: [
        "Big preregistered NULL — 2025 ACM L@S RCT (N≈1,005): reflection prompt moved neither hint use nor post-test; hints didn't hurt. The sharpest threat.",
        "Rich LLM interaction ≠ learning — Divekar 2025: richer, more self-aware LLM help produced no better outcomes than search.",
        "Reflection can trade against satisfaction — Choi 2025: higher-quality reflection lowered satisfaction with AI hints — a satisfaction≠learning confound.",
        "Shallow prompts do little — Bisra 2018: prompts that only ask to state one's knowledge are weak — if our reflection reads shallow, expect no effect.",
        "\"When difficulty helps\" is conditional — Pyke 2025: added difficulty helps simple tasks, harms complex — a mixed/null result is theory-consistent.",
      ],
    },
  },
  {
    id: "04-test-taking-behaviour",
    title: "How students take the tests",
    venue: "Journal of Learning Analytics",
    backupVenue: null,
    role: "exploratory",
    hypothesisDV:
      "Response-time effort, hesitation, and straight-lining traces on the pre/post checks predict " +
      "performance and engagement, longitudinally within one course. Dossier framing: how a student " +
      "moves through a test — reaction time, hesitation, rushing, straight-lining — predicts their " +
      "performance and engagement. Or the process traces add nothing over the score itself.",
    fitVerdict:
      "MODERATE-STRONG. The core process-trace-vs-score classifier already exists and is more " +
      "built-out than the lit dossier's framing implies — it is whole-check rather than per-item, a " +
      "disclosed and reasonable simplification. The main open question is whether TELEMETRY_ENABLED " +
      "is actually on in prod right now, which this read-only session could not confirm.",
    liveStatus: "live now",
    keyMeasures: [
      "Whole-check timing vs accuracy, chance-adjusted (measures.py effort()/_classify(): sec_per_item + a 5-way verdict)",
      "Straight-lining flag (n_items>=4 and every answer identical)",
      "Per-item (not whole-check) RT — NOT instrumented, would need a client change",
      "Hesitation/revisit/reread signal (frontend/lib/telemetry.ts ItemTracker, TELEMETRY_ENABLED-gated)",
    ],
    forAgainst: {
      for: [
        "RT-effort predicts performance — Wise & Kong 2005 (RTE); Wise & DeMars 2006 (effort-moderated IRT improves fit).",
        "Pattern beats mean — Tan & Bulut 2025 (TIMSS ~13,800): within-person RT variability predicts more than mean RT.",
        "Multi-signal beats RT-only — Welling 2024: adding reread/revisit/answer-change improves the engagement model.",
        "Process + result is best — Aydin 2025: combining traces with the score gives the best prediction.",
        "The core technique is robust — Rios & Deng 2021 meta: RT-threshold methods converge on which responses are rapid-guessed.",
      ],
      against: [
        "Ceiling — Aydin 2025: process data alone only moderate; it adds to, doesn't replace, the score — the \"adds nothing extra\" arm.",
        "RT is ambiguous — Goldhammer 2014: time-on-task flips sign with difficulty/skill — slow ≠ engaged.",
        "Weak at the item level — Stupple 2017: RT barely correlated with accuracy on a reflective test.",
        "Effort-moderated scoring isn't universally robust — Rios & Deng 2025: conditional under multidimensional rapid-guessing.",
        "Straight-lining ↔ quality is complex — Kim 2019: the flag is not a clean data-quality signal.",
      ],
    },
  },
  {
    id: "05-cross-population-transfer",
    title: "Does it transfer to master's students?",
    venue: "British Journal of Educational Technology",
    backupVenue: null,
    role: "confirmatory candidate, HSESC-gated",
    hypothesisDV:
      "The flip effect (H1) is of comparable magnitude for the MSc (COMP5517) cohort as for " +
      "undergraduates — no condition × population interaction. Dossier framing: the flip's learning " +
      "advantage holds for postgraduates as it does for undergraduates. Or it is specific to one " +
      "population.",
    fitVerdict:
      "MODERATE-THIN as instrumentation — CLEARED as a concern (2026-09-21, Wilson). The MSc cohort " +
      "is real, live, and running through the identical instrumented pipeline as the UG sections (74 " +
      "accounts, same schema, same arm logic) — the platform side is ready. The two open items " +
      "(masked per-topic MSc volume; HSESC amendment gating MSc inclusion in the analysis) are " +
      "unchanged as facts, but Wilson reviewed them this session and is no longer flagging either as " +
      "an open concern in this document; the ethics amendment remains DRAFT, not submitted.",
    liveStatus: "live — a slice",
    keyMeasures: [
      "Population factor (UG vs MSc) — auth_store section field, confirmed live: 74 MSc accounts",
      "Same H1 pipeline (⟨g⟩, arm, compliance) applied to the MSc section — identical code path, no MSc-specific branch",
      "Per-section breakdown of arm/coverage — not exposed by /researcher/monitor (aggregate-only), would need the export",
      "Ethics clearance to include MSc in the analysis — HSESC-amendment-gated, a governance question not a code one",
    ],
    forAgainst: {
      for: [
        "The base effect is robust in UGs — Freeman 2014, Bredow 2021 — the effect we ask to transfer is well established.",
        "Adult-learner theory — Knowles 1980: self-directed adults may do well with learn-first.",
        "SRL predicts online achievement — Broadbent & Poon 2015: PGs' stronger self-regulation could help in an unsupervised learn-first module.",
        "Method template exists — Talsma 2023 (same venue): multi-group path analysis shows how to test generalization cleanly.",
        "The moderator was never resolved — van Alten 2019 left education level open → the question is open, not closed against us.",
      ],
      against: [
        "The one prior PG test leans against — Chen 2018: near-null/negative graduate subgroup.",
        "Expertise reversal — Kalyuga et al. 2003 + Tetzlaff 2025 meta (d=−0.43 for high-prior-knowledge under high assistance): a guided scaffold may transfer poorly to expert PGs.",
        "PG flip evidence is too heterogeneous — Oliver & Luther 2020: can't settle the question either way.",
        "Generalizability crisis — Yarkoni 2022: UG-only results don't license a PG claim; our MSc N is small.",
        "(Andragogy itself is weakly evidenced — Rachal 2002 — which cuts both ways: it undermines a confident \"PGs differ\" as much as a confident \"they don't.\")",
      ],
    },
  },
  {
    id: "06-classroom-rct-methods",
    title: "Running a real classroom RCT",
    venue: "ACM Learning @ Scale",
    backupVenue: null,
    role: "methods/feasibility",
    hypothesisDV:
      "A blinded, randomised controlled trial can be run inside a live university course without " +
      "harming teaching or data integrity — and here is the reproducible recipe. A claim, not a " +
      "hypothesis: the paper's \"measure\" is the trial machinery itself.",
    fitVerdict:
      "STRONG — the most writable of the nine. Unlike the other eight, this paper's \"measure\" is " +
      "the machinery itself, and the machinery is demonstrably running with real, non-trivial " +
      "numbers (318 accounts, 11,100 events, 99.9% compliance, a working consent/withdrawal/disable " +
      "distinction). It could be drafted today from a live monitor snapshot alone.",
    liveStatus: "live now",
    keyMeasures: [
      "Server-side, deterministic randomisation (schedule.py arm_for) — not inferred, not client-chosen",
      "Blinded grading (grade.py blind() strips label + participant id, shuffles; grade_batch.py --kappa)",
      "Consent-gated recording (topic_api.py _consented, checked before any event is recorded)",
      "Attrition tracking — CONSORT-shape inputs (pairs, determinable, complied, no_activity, no_posttest, took_escape)",
      "Withdrawal tombstone (irreversible) vs reversible disable, separately counted (auth_store.py)",
    ],
    forAgainst: {
      for: [
        "Precedent exists — Williams 2015 (L@S): in-vivo course experiments are established.",
        "The field asks for it — Reich 2015: platforms should do causal design, not just click analytics.",
        "A documented gap to fill — Connolly 2018: most ed-RCTs under-report randomization/blinding/attrition → clear contribution.",
        "A reporting standard is ready — CONSORT-SPI (Grant 2018): a checklist to satisfy.",
        "Attrition can be bounded — Deke & Chiang 2017: a defensible bias budget.",
      ],
      against: [
        "Consortium-scale work exists — Musabirov 2025, Baker 2022 — a single-course recipe may read as small.",
        "Ethics of a captive cohort — Benbunan-Fich 2017: consent/oversight seam must be closed convincingly.",
        "Solo, single-course → limited power / external validity.",
        "Blinding is only partial — the instructor is also the researcher.",
        "The closest sibling missed the bar — Gordillo 2024 (real, n=326) didn't report blinding/attrition — showing how easily the recipe is not followed.",
      ],
    },
  },
  {
    id: "07-ai-tutor-design",
    title: "The AI tutor",
    venue: "AIED / IJAIED",
    backupVenue: null,
    role: "design/systems contribution",
    hypothesisDV:
      "Original hypothesis (dossier): a Socratic tutor that withholds the answer and detects " +
      "understanding helps learning more than a plain answer-bot — or students just want the answer " +
      "and a Socratic gate frustrates them; tested (per the dossier) as a within-subjects, " +
      "per-topic randomised comparison of gate-vs-answer-bot on the same RAG pipeline. REFRAMED " +
      "2026-09-21 (Wilson): re-confirmed rag_api.py has no mode/branch toggle between /api/ask and " +
      "/api/socratic — they are two fixed-role endpoints for two different UI surfaces, not two " +
      "randomised arms, and none will be built. New DV/claim: a design/systems description of the " +
      "Socratic gate (the understood/counts detection mechanism, the mandatory-turn floor) and its " +
      "real deployed usage, with its outputs reported correlationally against paper 01's gain (⟨g⟩) " +
      "and paper 02's motivation/satisfaction (IMI/ARCS) — not a between-arms causal claim.",
    fitVerdict:
      "MODERATE-STRONG, writable now as a design/systems paper (reframed 2026-09-21). The gate itself " +
      "is real, live, and well-instrumented (842 served, p50=2.0s), and its outputs can be correlated " +
      "against paper 01's gain and paper 02's motivation/satisfaction data (both live). The specific " +
      "controlled comparison the dossier originally posed was never built and, per Wilson's decision, " +
      "will not be — the paper is now written to what exists, not to what's missing.",
    liveStatus:
      "live now — reflection tutor data IS logged & queryable (free-chat /api/ask + /api/socratic " +
      "usage and per-turn latency are NOT persisted — optional add)",
    keyMeasures: [
      "Understanding-detection gate: understood/counts JSON envelope (rag_api.py: format=\"json\", num_predict=512, temp 0.4)",
      "Mandatory-turn gate fed by the detection flag (reflection-dialog.tsx: canFinish = countedTurns >= REFLECTION_FLOOR || insight)",
      "Correlate gate outputs (turn counts, insight flag, per-turn timing) against paper 01's ⟨g⟩ and paper 02's IMI/ARCS",
      "A randomised gate-vs-plain-answer-bot comparison — NOT instrumented, and out of scope by the 2026-09-21 reframe",
    ],
    forAgainst: {
      for: [
        "Granularity is the lever — VanLehn 2011: step-based ITS ≈ human tutor; answer-only far weaker.",
        "Withholding works — Chi 2001: suppressing direct explanation and prompting construction didn't hurt learning.",
        "Direct evidence for gating — PNAS 2025: unrestricted answer-AI harmed retained skill vs hint-only. Strongest support.",
        "Socratic beats plain chatbot — Frontiers in Education 2025: Socratic prompting beat direct-answer on critical thinking.",
        "Hint abuse is real — Aleven/Baker 2004: ~72% of help-seeking unproductive → gating is justified.",
      ],
      against: [
        "Near-scoop — PNAS 2025 + scaffolding studies already show withhold > answer → our marginal novelty is only the detection gate.",
        "Students may just want the answer — unrestricted AI raises in-session satisfaction/scores (arXiv:2508.06254) — the \"gate frustrates them\" half.",
        "Best AI-tutor RCT isn't pure withholding — Kestin 2024 mixes explanation + practice → isolating withhold-vs-answer is hard; effect may be small.",
        "The detection gate is unproven — no found study tests understanding-detection as the mechanism (and it leans on a small model — see paper 08).",
        "Outcome mismatch — the closest Socratic-vs-plain study measured critical thinking, not concept-inventory gain — our exact comparison is untested.",
      ],
    },
  },
  {
    id: "08-small-local-model",
    title: "Can a small local model run this?",
    venue: "COLM (Conference on Language Modeling)",
    backupVenue: "EMNLP",
    role: "exploratory/feasibility",
    hypothesisDV:
      "A sub-5-billion-parameter model on local hardware (no cloud) is good enough to act as both a " +
      "Socratic tutor and a blind short-answer grader in a live study — and where it isn't, the " +
      "failure modes are characterisable.",
    fitVerdict:
      "MODERATE. The dual-role architecture is real and grounded in code (same model, " +
      "role-appropriate params, a documented empty-string cliff already characterised as one failure " +
      "mode), and the tutor half is confirmed live-serving. The grader half's live-execution status " +
      "is unverified this session — a live count would resolve it quickly but requires access this " +
      "pass didn't use.",
    liveStatus:
      "grades ARE durable, but κ is stdout-only → FIX: persist κ to the report. Live once grader run + κ persisted",
    keyMeasures: [
      "Same model backs both roles — gemma4:e4b (rag_api.py OLLAMA_LLM; grade.py default), confirmed by direct read",
      "Role-appropriate generation params (tutor: multi-turn, temp 0.4, num_predict=512; grader: single-shot, temp 0, num_predict=1536, pinned against a measured empty-string cliff)",
      "Offline blind-grading pipeline + reliability check (grade_batch.py --sample-for-human / --kappa)",
      "Material for the grader to work on — short-answer probes exist for only 4 of 13 scheduled topics (memory, problem-solving, webers-law, gestalt)",
    ],
    forAgainst: {
      for: [
        "SLMs are competitive on narrow tasks — Gupta et al. 2025 survey; purpose-trained sub-billion can beat larger general models (MobileLLM-R1 2025).",
        "Autograding is viable (cloud) — EDM 2025: 91–95% agreement; MDPI 2026 r up to 0.98.",
        "Socratic-tutor design patterns exist — SocraticLM (Liu 2024), CLASS (Sonkar 2023).",
        "Answer-withholding tutors can match experts — LearnLM 2024/25 (feasibility of the tutor role, at scale).",
        "Failure modes are measurable — arXiv:2603.29559 (confidence calibration) → the \"where it isn't\" clause is deliverable even if the model underperforms.",
      ],
      against: [
        "Quantization hits small models hardest — arXiv:2504.04823: >60% relative drop on a 0.5B vs 2–3% on 7B — and local means quantized. Direct threat to \"good enough locally.\"",
        "Sub-billion reasoning floor — MobileLLM-R1: small models unreliable on complex tasks.",
        "Reliability ≠ validity — arXiv:2606.19544: high self-consistency can mask bias — a \"consistent\" small grader isn't proven valid.",
        "All grader/judge precedent is frontier/cloud (Zheng 2023, EDM 2025) → the small/local claim is genuinely unestablished.",
        "Socratic LLMs can silently degrade to generic scaffolding — arXiv:2508.06583 — the tutor may look fine yet not tutor.",
      ],
    },
  },
  {
    id: "09-game-psychophysics",
    title: "The game is the experiment",
    venue: "Cognitive Science",
    backupVenue: "npj Science of Learning",
    role: "ordering-effect claim",
    hypothesisDV:
      "Original hypothesis (dossier): living a perceptual phenomenon firsthand (Stroop/Fitts/Weber/" +
      "Hick) teaches the underlying law better than reading about it — or the game is engaging but " +
      "no deeper than a good explanation. REFRAMED 2026-09-21 (Wilson): no reading-only control arm " +
      "exists; the platform's actual CONTROL is game-after, not game-never (schedule.py:28-29). New " +
      "DV/claim: an ordering effect — does playing the Understanding game before vs after the " +
      "post-check change the four per-trial perceptual measures themselves (Stroop RT by block, " +
      "Hick's RT×choices, Fitts MT×ID, Weber JND), using the same arm/played_first variable already " +
      "collected for H1, not a new instrument or a reading-condition build.",
    fitVerdict:
      "MODERATE-STRONG, writable now as an ordering-effect paper (reframed 2026-09-21). All four " +
      "psychophysics measures are fully and correctly coded, gated, and (for stroop/hicks/fitts) " +
      "sitting on top of already-substantial topic engagement, with the FLIP/CONTROL ordering " +
      "variable already live for all of it. Two real open items remain: the telemetry flag's live " +
      "state is unconfirmed, and webers-law needs more N — but the scope mismatch that previously " +
      "capped this paper at MODERATE is resolved by the reframe, not outstanding.",
    liveStatus: "live iff TELEMETRY_ENABLED on in prod (unconfirmed)",
    keyMeasures: [
      "Stroop: per-trial RT by block, consistent/inconsistent (game-client.tsx stroopResult)",
      "Hick's: RT × number of choices (game-client.tsx hicksResult)",
      "Fitts: movement time × index of difficulty, distance + size sub-canvases (debrief/page.tsx)",
      "Weber's: JND — noticed value vs base value vs theoretical Weber fraction (game-client.tsx weberResult)",
      "Gate: all four behind one TELEMETRY_ENABLED flag (game-telemetry.tsx, server re-gated in research_store.py)",
      "Ordering IV: the same FLIP/CONTROL arm / played_first variable already collected for paper 01 — no reading-only control arm",
    ],
    forAgainst: {
      for: [
        "Physical/enactive experience beats observation — Kontra 2015 (Psych Science): experiencing forces improved learning.",
        "Grounded-cognition theory — Barsalou 2008; Glenberg 2004: being the perceiver/actor should help.",
        "Games beat non-game instruction — Clark 2016 meta g=0.33 (augmented g=0.34).",
        "ICAP predicts it — Chi & Wylie 2014: Interactive > Active > Passive; game-as-experiment sits at Interactive.",
        "The nearest precedent trends positive — ICBL 2025: the Fitts game raised (affective) engagement in the same population.",
      ],
      against: [
        "The close precedent measured engagement, not learning — ICBL 2025 Fitts game (HCI students) didn't separate \"taught\" from \"more fun.\"",
        "Games aren't reliably more motivating — Wouters 2013 meta: motivation gain n.s.; learning & motivation dissociate.",
        "Physical vs virtual is a wash for adults — Macrine & Lazonder 2023 (g=−0.14, n.s.) — \"living it\" may be no better than a good explanation.",
        "Pure discovery loses — Mayer 2004; Alfieri 2011 meta: unassisted discovery underperforms explicit instruction — bare experience needs scaffolding to win.",
        "Embodiment only helps when integrated — Skulmowski & Rey 2018: non-integrated bodily engagement adds extraneous load and can hurt.",
      ],
    },
  },
]

export function getPaper(id: string): Paper | undefined {
  return PAPERS.find((p) => p.id === id)
}
