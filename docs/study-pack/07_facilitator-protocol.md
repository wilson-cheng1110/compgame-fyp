# Facilitator Protocol — Stage 1 Focus Group

> How to run one session, start to finish. One-group pretest–posttest; everyone does the flipped
> (Understanding-first) sequence. Run on paper or Google Form; the app provides the games only.

## Before the session — checklist

- [ ] COMPGame frontend reachable; the four study topics load (Weber's Law, Problem Solving,
      Gestalt, Miller's Law), both Understanding and Assessment games.
- [ ] RAG backend running on `:8080` with `gemma4:e4b` + `nomic-embed-text` pulled, so the AI
      tutor answers (see project `CLAUDE.md`). Warm it with one question first (~12 s cold).
- [ ] Printed packets **or** Google Forms ready: `01` consent, `02` demographics, `03` concept
      inventory (Form A + Form B per topic), `04` questionnaire battery, `05` reflection + load.
- [ ] **`06_scoring-codebook-analysis.md` is NOT accessible to the participant** (answer keys).
- [ ] Participant code assigned (`P01`, `P02`, …). Do **not** record names.
- [ ] **Topic presentation order randomised** for this participant (see below) and written on the
      packet so load/score can be read against position.

## Controlling order without a control condition

There is one condition, but topic **order** can still confound (fatigue, practice). Randomise or
counterbalance the order of the four topics across participants — e.g., a 4×4 Latin square so
each topic appears in each position equally across every 4 participants. Record the order as
`topic_order` (codebook). This is the one counterbalancing step that still applies at Stage 1.

## Session timeline (single session, ~50–60 min)

| Step | Activity | Materials | ~Time |
|------|----------|-----------|------:|
| 1 | Welcome; read/administer information sheet; collect consent | `01` | 3 min |
| 2 | Demographics | `02` | 3 min |
| 3 | **Topic 1** (per randomised order): Form A → Understanding game → Assessment game → Form B → Paas load | `03` (topic 1), app, `05` §2 | ~9 min |
| 4 | **Topic 2**: same sequence | `03` (topic 2), app, `05` §2 | ~9 min |
| — | **Break** (mandatory) | — | 3 min |
| 5 | **Topic 3**: same sequence | `03` (topic 3), app, `05` §2 | ~9 min |
| 6 | **Topic 4**: same sequence | `03` (topic 4), app, `05` §2 | ~9 min |
| 7 | AI-tutor step: ask participant to use the tutor on any topic for a few minutes | app | 4 min |
| 8 | Reflection (open + Likert) | `05` §1 | 3 min |
| 9 | Questionnaire battery: IMI + CoI + ARCS | `04` | 8 min |
| 10 | Debrief + thanks | — | 2 min |

> **Two-session option:** topics 1–2 in session 1, topics 3–4 + AI tutor + reflection +
> questionnaire in session 2 (2–7 days later). Lighter fatigue, and session 2 can re-administer
> a Form B for an optional delayed-retention read. Use if scheduling allows.

## Per-topic micro-script (repeat for each topic)

1. "Here is a short quiz on **[topic]**. Just answer what you can — it's measuring the materials,
   not you. Don't worry if some are unfamiliar." → hand **Form A** for that topic.
2. "Now play this short game that explains the idea." → open the **Understanding** game.
3. "Now this one tests it." → open the **Assessment** game.
4. "One more short quiz on the same idea." → hand **Form B** for that topic.
5. "Last, how much mental effort did learning this topic take, 1 to 9?" → **Paas** row, `05` §2.

Keep the four forms physically separated and labelled by topic so a participant never sees Form B
before doing that topic's games, and never sees the answer key.

## What to say / not say

- Do **not** reveal the hypothesis ("we think learning by playing first works better"). Say the
  study is "about how students learn HCI concepts with the platform."
- Do not coach answers or hint during quizzes or games. If asked whether an answer is right:
  "I can't say during the session — just give your best guess."
- The AI tutor is part of what's being studied; let the participant drive it.

## Data handling after the session

- Label every sheet / form response with the participant code only.
- Enter responses against the codebook (`06` §D). Keep raw sheets in a locked location or
  de-identified scans; destroy anything with identifying marks.
- For Google Form: export CSV, replace any auto-captured email/timestamp identifiers with the
  participant code before analysis. Confirm anonymity before sharing the dataset.
- Back up the dataset before scoring; score from a copy.

## Stage-1 success criteria (what "done" means here)

This focus group succeeds if the **instruments and flow are validated for Stage 2**, judged by:
the concept-inventory items discriminate and the A/B pairs behave isomorphically; IMI / CoI / ARCS
reach acceptable α on this sample; the full sequence finishes within budget without dropout; and
the reflection prompts yield usable text. Effect sizes are reported as feasibility signal, not as
a confirmatory test of H1–H4 (see `06` §A).
