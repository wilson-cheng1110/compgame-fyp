# Literature dossiers — the nine papers

Built 2026-09-19, one dossier per paper (generic academic queries only — no platform, institution,
or study specifics left the machine). Each `0X-*.md` file has the same four parts: **Seminal /
foundational** · **Recent & directly relevant** · **Gap this paper fills** · **Scoop / contradiction
watch**. This index is the curated read-across; open a file for the full reference list (~11–15 refs
each).

> **Verify before citing.** These reference lists were assembled from web search; treat DOIs, years,
> and author lists as *to-be-checked* — pull and read each load-bearing citation in full before it
> goes into a paper's related-work section.

## At a glance

| # | Paper (question) | Venue | Seminal anchor | Nearest recent result — the headwind | Verdict |
|---|---|---|---|---|---|
| **01** | Does the flip work? | Computers & Education | Kapur 2008; Hake 1998 (⟨g⟩) | **DeCaro 2026 (BJEP)** near-scoops the exact design; **Saba/Kapur/Roll 2025** — explore-first *lowers immediate* gain, wins transfer | Replication/extension — reposition, don't claim first |
| **02** | How the flip feels | Contemp. Educational Psychology | Ryan & Deci 2000; IMI/CoI/ARCS/Paas | **van Alten 2019** (no satisfaction effect) + **Deslauriers 2019 PNAS** (lower *felt* learning) | Contradiction on the "felt benefit" half — must engage |
| **03** | Reflection & help-seeking | Metacognition and Learning | Chi 1989; Aleven 2016 | **2025 ACM L@S RCT, N≈1,005** (Zengilowski et al.) — reflection prompt = null, hint use ≠ harm | Strong null precedent — cite head-on |
| **04** | How students take the tests | Journal of Learning Analytics | Wise & Kong 2005 (RTE) | **Aydin 2025** — process data alone only *moderate* vs score; **Goldhammer 2014** — RT sign flips | No scooper; frame as "adds some, not everything" |
| **05** | Transfer to master's students | British J. Educational Tech. | Knowles 1980; expertise-reversal | **Chen 2018** — near-null/negative grad subgroup (but ~4 studies); **Tetzlaff 2025** expertise reversal | Closest to a scoop; underpowered → question open |
| **06** | Running a real classroom RCT | ACM Learning @ Scale | Williams 2015 (L@S predecessor) | **Musabirov 2025** (LAK) consortium-scale; **Connolly 2018** — most ed-RCTs under-report | No scooper; defensive/method framing |
| **07** | The AI tutor | AIED / IJAIED | VanLehn 2011; Chi 2001 | **PNAS 2025** — no-guardrail AI *harms* retained skill (half-scoop) | Supports withhold-half; gap = the *understanding-detection* gate |
| **08** | Can a small local model run this? | COLM (alt EMNLP) | Zheng 2023 (LLM-as-judge) | No dual-role scooper; **quantization-degradation** (2504.04823) threatens "good enough locally" | No scooper; feasibility threats to measure |
| **09** | The game IS the experiment | Cognitive Science (alt npj SoL) | Kontra 2015; ICAP (Chi & Wylie 2014) | **ICBL 2025 Fitts chapter** — same paradigm/population, but engagement only, no clean learning split | Partial precedent; separate learning from engagement |

## The cross-cutting finding

**Nearly every hypothesis has a recent (2024–26) result pressing on it — and none is a clean kill.**
That is the single most useful thing this search bought: the portfolio should present itself as
**replication / extension-with-a-twist**, not first demonstration, and each paper should meet its
specific contradiction head-on rather than leave it for a reviewer.

- **Direct contradictions of the "positive" story:** 02 (felt-benefit null/negative), 03 (reflection
  null), 05 (grad subgroup near-null). Each is a *real* result the paper must cite and out-design,
  not out-argue.
- **Near-scoops (same design, different scope):** 01 (DeCaro 2026), 09 (ICBL 2025 Fitts). Differentiate
  on scale/within-subjects/multi-paradigm and on isolating learning from engagement.
- **Half-scoop that actually *helps*:** 07 (PNAS 2025 supports withholding the answer; our added
  novelty is the understanding-*detection* gate, which no found study tests).
- **No scooper — contribution is method/feasibility, not a novel effect:** 04, 06, 08. Frame these
  as bounded ("adds some, not everything"; "the reproducible recipe"; "where the small model breaks").

The recurring boundary condition across 01/09 is **immediate gain vs transfer** (Saba/Kapur/Roll
2025; Bjork desirable difficulties): our primary DV is an immediate post-test, so a flat immediate
result is anticipated, not a failure — see pre-reg `01` §8.

## What gets pre-registered

Confirmatory (lock before analysis): **01** (H1, primary), **02** (H2/H3 affective, if PI commits);
candidates **03** and **05** (05 HSESC-gated). Exploratory (do **not** pre-specify as hypotheses):
**04, 08, 09**. Method/design: **06, 07**. Drafts and the honest "analysis-before-analysis" status
are in `docs/pre-registration/`.

## Per-file pointers

- `01-flip-effectiveness.md` — multi-topic, within-subjects, per-topic-randomised ⟨g⟩ test; free of topic/cohort confounds.
- `02-motivation-experience.md` — IMI + CoI + ARCS + Paas measured *jointly* to adjudicate felt benefit net of effort.
- `03-reflection-help-seeking.md` — reflection depth × help-seeking style as two axes of one logged behaviour.
- `04-test-taking-behaviour.md` — RT + hesitation + rushing traces vs score, longitudinally within one course.
- `05-cross-population-transfer.md` — population as an explicit design factor (UG vs MSc), not an after-the-fact subgroup.
- `06-classroom-rct-methods.md` — the solo-researcher, one-course, blinded, attrition-bounded, CONSORT-shaped recipe.
- `07-ai-tutor-design.md` — Socratic-withhold-and-detect gate as a controlled variable within one tutor architecture.
- `08-small-local-model.md` — one sub-5B local model as *both* Socratic tutor and blind grader; dual-role failure modes.
- `09-game-psychophysics.md` — being the participant in a reconstructed classic paradigm (Stroop/Fitts/Weber/Hick) vs reading it.
