# Short-answer grading rubric

The written rubric the LLM grades against, and the document a reviewer will ask to see.
`backend/grade.py` parses **this file** at load time — there is no generated JSON copy, for
the same reason `checks.py` parses `quiz-item-banks.md` directly: a second copy drifts from
the one a human edits, silently, and you find out during analysis.

Read `docs/revamp.md` Part 8.2 before changing anything here.

---

## What the levels mean

Three levels and a null. The null is not a fourth level — it is the absence of a datum.

| Level | Means | Analysis treatment |
|---|---|---|
| `full` | States the mechanism **and** applies it correctly. May be informal — "the bigger the thing already is, the more you gotta change it before I notice" is `full` for Weber. | data point |
| `partial` | Right territory, one load-bearing piece missing or wrong. Names the concept but can't apply it; or applies it but misstates why. | data point |
| `none` | A **real attempt** that misses. Confidently wrong, or a plausible-sounding restatement of the question. | data point |
| `null` | **Not enough signal to grade**: blank, a few words, "idk", off-topic, or a copy of the prompt. | **missing datum — excluded from the denominator, and the exclusion count is reported** |

The `none`/`null` split is the whole reason this is a four-way and not a three-way. A student
who tried and was wrong is evidence about the teaching. A student who typed "idk" is evidence
about their evening. Collapsing them into one bucket inflates the failure rate of the material
with data that is really about non-response, and you cannot separate them again afterwards.

**These grades never enter ⟨g⟩.** Part 8.1: the short answer feeds the teacher report and the
tutor, and is reported as descriptive colour. The primary DV is the fixed-key MC gain. An LLM
grade has no item statistics and drifts with model version; as the DV it invalidates H1.

## Grading rules the model is held to

1. **Grade only what is written.** No credit for what the student probably meant.
2. **Ignore spelling, grammar, register, and length.** A correct answer in three sloppy words
   outranks a fluent paragraph that says nothing. Most graders drift the other way, so this is
   stated first and repeated in the prompt.
3. **Everyday wording earns full credit.** These students have had one lecture. Requiring the
   textbook term measures vocabulary, not understanding — and vocabulary is exactly what the
   Part 9.2 corpus mismatch already showed this course is inconsistent about.
4. **Quote your evidence.** Every non-null grade cites a verbatim span from the answer. An
   unquotable grade is the model reasoning about a student it invented.
5. **`null` beats guessing.** If there is not enough there, say so.

## Blindness — non-negotiable

The prompt the model sees carries **no** participant id, **no** pre/post label, **no** score,
**no** other answer by the same student, and the batch is **shuffled** before grading. If the
model can tell it is grading a post-test it will grade it more generously, and that manufactures
exactly the pre→post gain the study exists to detect. `grade_batch.py` enforces this
structurally — the labels are removed before the prompts are built, not merely omitted from them.

`temperature=0`. The same answer must get the same grade on a re-run, or nothing here is auditable.

## Before any of this appears in the paper

Double-code **~60 answers by hand**, spread across topics and levels, and report **Cohen's κ**
against the machine grade (`grade_batch.py --kappa`). Below **κ ≈ 0.6** the LLM grade is
descriptive colour only and must be labelled as such. Half a day of work, and the difference
between a defensible measure and a decorative one.

---

# Per-topic rubric points

`rubric_hit` returns the keys below, so a report can say *"19 of 47 missed proportion"*
rather than *"many struggled"*. Topics with no section here are graded on the generic levels
alone — that is expected while the banks are still rolling (Part 8.4), not a gap to fix now.

## Weber's Law (`webers-law`)

**Probe.** *In your own words: why does adding 1 kg feel obvious when you're holding 2 kg, but
unnoticeable when you're holding 50 kg?*

- `proportion` — the noticeable change scales with the **starting magnitude**; it is a ratio,
  not a fixed amount. The single load-bearing idea.
- `jnd` — there is a **threshold** below which a change isn't detected at all.
- `constant` — the ratio is roughly constant for a given sense (the Weber fraction).
- `application` — connects it to a design or real case: progress bars, price framing, volume
  sliders, discount perception.

**Full** = `proportion` plus either `application` or a correct `jnd`. **Partial** = names a
threshold or the law but treats the JND as an absolute quantity. **The signature error** is
treating the JND as fixed ("you notice a 1 kg change") — that is `partial` at best, and it is
the misconception the tutorial should open on.

## Gestalt principles (`gestalt`)

**Probe.** *Look at the layout below. Why do you read it as three groups rather than nine
separate items — and what would you change to make it four groups?*

- `grouping` — the visual system imposes **structure**; grouping is perceived, not stated.
- `principle-named` — correctly identifies at least one operative principle (proximity,
  similarity, closure, continuity, common region).
- `mechanism` — says *what about the layout* drives it (spacing, shared colour, an enclosing box).
- `manipulation` — the second half: changes a real variable to change the grouping.

**Full** = `mechanism` plus `manipulation`. Naming the principle is **not** required — a student
who says "the ones closer together look like they belong" has `mechanism` and earns it.
**Partial** = names a principle but cannot say what drives it, or the reverse. Watch for the
inverse of the usual bias: the fluent answer that lists four principle names and never touches
the layout is `partial`, not `full`.

## Miller's 7±2 / working memory (`memory`)

**Probe.** *A form asks for a 12-digit reference number in one box. Why do people get it wrong,
and what would you change?*

- `capacity` — working memory holds a **small, limited** number of items.
- `chunking` — grouping raises effective capacity; the fix is to chunk the field.
- `misapplication` — **awarded for correctly resisting** the "magic number 7" as a hard UI law
  (menus need not have 7 items). Present in strong answers; its absence costs nothing.
- `application` — a concrete change: split the field, group the digits, allow paste.

**Full** = `capacity` plus `chunking` **or** a correct `application`. **Partial** = recites
"7±2" with no mechanism and no fix. Reciting the number alone is never `full` — it is the
clearest case in the whole rubric of vocabulary standing in for understanding.

## Problem solving (`problem-solving`)

**Probe.** *Describe a time an interface made a simple task hard. What was the gap between what
you were trying to do and what the system let you do?*

- `goal-state` — frames it as a distance between a current state and a goal state.
- `operator` — identifies the **available actions** and why they didn't compose.
- `fixedness` — notices being anchored on one approach (functional fixedness / set effect).
- `gulf` — maps it to execution vs evaluation (Norman) — credit if reached, never required
  here, since `norman` is its own topic and may not have been released yet.

**Full** = `goal-state` plus `operator`. **Partial** = a vivid, accurate story with no analytic
frame — common, and worth its own tutorial minute. Do **not** mark a story-only answer `none`;
it is a real attempt that missed the frame, and the distinction matters for the report.
