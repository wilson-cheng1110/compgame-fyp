# Reflection-depth / help-seeking coding codebook — CODER-FACING

> **For the two human coders double-coding the reflection transcripts. Read this file before
> opening a coding sheet.** Companion to `06_scoring-codebook-analysis.md` (that one is the
> short-answer probe rubric; this one is the reflection-dialog rubric — a different instrument,
> coded by hand, not by the LLM grader).

Scope and citations are locked in `docs/lit/paper-03-coding-scheme.md` — this file restates them
in the form a coder actually uses (operational definitions + short examples), and adds the
practical instructions for filling in the sheet `backend/code_batch.py` generates. It invents
nothing: every code below is the one already named in that scope document and the
pre-registration stub it quotes.

**What you are coding.** Each row of the sheet is one student's reflection-dialog session with
the AI tutor (or, for a small number of rows that carry no transcript, a session the student left
early). You are NOT grading correctness. You are coding *how* the student engaged, on two
independent axes.

---

## Axis A — Reflection depth

*Bisra, Liu, Nesbit, Salimi & Winne (2018), Educational Psychology Review 30(3); Chi, Bassok,
Lewis, Reimann & Glaser (1989), Cognitive Science 13(2).*

Code the transcript's **predominant** level — if the student produced even one genuinely
generative turn among several shallow ones, code `generative` (the higher category is what the
theory says predicts the learning benefit; a single instance of it is evidence the mechanism
fired, not diluted by the turns around it).

| Code | Definition | Example | Why this line |
|---|---|---|---|
| `none` | No substantive reflection turn to code — the transcript is empty (a `reflection_skipped` row), or every non-direct turn is off-topic / a "just tell me" exchange. | *(reflection_skipped — no transcript)* | Bookkeeping category, same convention as the `null`/`none` split in `docs/grading-rubric.md`: a missing datum is excluded from the analysis, not silently scored as the lowest real category. |
| `shallow` | A **metacognitive self-report** — a statement about the student's own state of knowing or feeling — with **no new content connection**. | "Oh okay, I get it now." · "I'm still a bit confused about this bit." · "That makes sense I guess." | Bisra et al. (2018): a meta-analysis of self-explanation prompting finds prompts (and responses) that stay at this level produce a **smaller** learning effect than ones that connect to content. This is the line the meta-analysis itself draws — adopted here as the `shallow`/`generative` boundary. |
| `generative` | The turn **constructs a content connection**: explains *why* a mechanism works, relates it to a different example or a prior misconception, or extends the tutor's explanation with a new inference — in the student's own words. | "So it's like Weber's law — the phone buzzing is only distracting in a quiet room because the *change* is big relative to the background, not because the buzz itself is loud." | Chi et al. (1989): good learners in the studied protocols produced far more self-generated explanations of exactly this kind (15.3 vs 2.8 per learner), and explanation **quality**, not just presence, predicted problem-solving success. This is why `generative` is a distinct, higher category rather than a synonym for "longer answer." |

**Not part of this axis:** a turn logged `direct: true` (the student pressed "Stuck? Just tell
me") is not a reflection turn at all — it is a request to be told, which is Axis B's job to
code. Do not code a `direct` turn's content for depth; look at the surrounding non-direct turns
instead. If a transcript is *entirely* direct turns, that reflection is `none` on this axis.

## Axis B — Help-seeking style

*Aleven, Roll, McLaren & Koedinger (2016), International Journal of Artificial Intelligence in
Education 26(1); the cost of the executive pattern specifically is Baker, Corbett, Koedinger &
Wagner (2004)'s "hint abuse" finding.*

Code the transcript's help-seeking behaviour — how the student asked for help, not whether they
needed it. Most transcripts will have no explicit help request at all (`none`); when one exists,
place it on this scale.

| Code | Definition | Example | Why this line |
|---|---|---|---|
| `none` | No help-seeking turn in this reflection — the student never asked for the answer or a hint. | *(a reflection that stayed a back-and-forth explanation, no request to be told anything)* | Bookkeeping category, same rationale as Axis A's `none`. |
| `instrumental` | The request is **aimed at learning** — asks for a hint, an analogy, or "why," in a way that reduces future dependence on the tutor. | "Can you give me a hint, not the whole answer?" · "Is there an everyday example of this?" · "Why does that happen though?" | Aleven et al. (2016): the instrumental category from their synthesis of a decade-plus of ITS help-seeking research, which **associates with achievement**. |
| `executive` | The request is **aimed at finishing the task** — a direct "just tell me the answer" ask, with minimal engagement with the reasoning. | "Just tell me the answer." · "I don't want to think about it, what's the answer?" (this is exactly what a `direct: true` turn logs — see the pre-filter note below) | Aleven et al. (2016)'s executive category, which does **not** associate with — and per the "hint abuse" literature (Baker et al. 2004) can **predict lower** — learning. |

**The `direct_answers_hint` column is a pre-filter, not the code.** `reflection-dialog.tsx` already
flags every "Stuck? Just tell me" turn (`direct: true`) and the sheet surfaces the count as
`direct_answers_hint` so you know which transcripts to look at closest on this axis. It is a raw
count of a UI button press, not a classification: a transcript with `direct_answers_hint: 0` can
still contain an instrumental request typed into the normal reply box ("can you give me a hint?"),
and you still have to read the transcript to place it. Treat the hint as "look here first," never
as "code this `executive`."

---

## How to code (practical instructions)

1. You will receive **your own copy** of the blind coding sheet (a `.csv` file) — a pseudonymised
   `tag` per row, the topic, the `direct_answers_hint`, the rendered `transcript`, and two blank
   columns: `reflection_depth(none/shallow/generative)` and
   `help_seeking_style(none/instrumental/executive)`, plus `notes`. **No participant id, SID, or
   FLIP/CONTROL label is in the file** — the sheet is generated by `grade.blind()`, the same
   blinding function the short-answer grader uses, so there is nothing to identify or infer from.
2. Fill in exactly one code per axis per row, lower-case, spelled as shown in the column header.
   Use `notes` for anything you want to flag (ambiguous case, transcript looks truncated, etc.) —
   notes are never scored, they are for the two of you to discuss *after* both sheets are in.
3. **Code independently.** Do not compare answers or discuss specific rows with the other coder
   until both completed sheets have been submitted — that is what makes the kappa a real
   agreement measure rather than a compliance check on whoever went second.
4. Once both sheets are in: `python backend/code_batch.py --kappa coder_a.csv coder_b.csv`. This
   reuses `grade.cohen_kappa()` (the same reliability function the short-answer rubric uses) and
   reports κ + the per-code distribution for each axis.
5. **κ ≥ 0.6 on an axis: usable as a measure.** Below 0.6, `docs/grading-rubric.md`'s own line
   applies here unchanged: report that axis as descriptive colour only, or refine this codebook
   and re-code, but do not quietly use it as a measure in the paper.

## What this is not

This is **not** an automated or LLM-assisted coding pass. `docs/lit/paper-03-coding-scheme.md`
names an LLM-assisted first pass as a possible *later* addition, explicitly deferred until this
two-human scheme is built and its own kappa is established — Aleven's and Bisra/Chi's methodologies
are human-coded qualitative schemes in the literature they come from, not machine-graded rubrics,
and this harness is the human-first instrument that grounds any later automation against.
