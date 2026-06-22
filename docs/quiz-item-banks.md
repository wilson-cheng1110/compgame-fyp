# Pre/Post Quiz Item Banks — 4 Study Topics

> Conceptual knowledge instrument for normalized-gain scoring across the four study
> topics: **Weber's Law, Problem Solving, Gestalt Principles, Miller's Law**.
>
> **How to use:**
> - **Form A** = pre-test, administered *before* the topic's Understanding game.
> - **Form B** = post-test, administered *after* the topic's Assessment game.
> - A↔B items are **isomorphic**: same concept, different surface (scenario/numbers),
>   so the post-test is not a memory test of the pre-test, and the pre-test does not
>   pre-expose the in-game assessment's answers.
> - Score each form as % correct → Hake normalized gain `g = (B% − A%)/(100 − A%)`.
> - **The in-game assessment score is a *secondary* DV**, not the post-test, because
>   the four assessments use different formats (see note per topic).
> - All items are content-aligned to what each game actually teaches (verified from
>   the game code, not generic textbook knowledge).
>
> Log each form via the sink as `event_type: "topic_pretest"` (Form A) and
> `event_type: "topic_posttest"` (Form B), `meta: { topic_id, form, items, score }`.

---

## 1. Weber's Law (`webers-law`)

**Game teaches:** `ΔI / I = k`; JND; Weber fractions (size 10%, brightness 8%, count
14%); "the ratio matters, not the absolute change"; UI implications (progress bars,
hover darkening, error highlight contrast).

> ⚠️ **Format note:** the in-game Weber assessment is a **perceptual** spot-the-odd-one
> task (8 rounds, 0–100). It measures perceptual discrimination, **not** conceptual
> knowledge. Use Form A/B below for the knowledge-gain measure; report the in-game
> perceptual score as a **separate behavioral DV**, not as this post-test.

### Form A (pre)
**A1.** A 5-pixel increase is easy to notice on a 20px icon but invisible on a 400px banner. Why?
 a) Larger elements render more slowly  b) ✓ The detectable difference depends on the *ratio* of change to the original size, not the absolute change  c) Pixels behave differently at scale  d) The eye ignores large objects

**A2.** In Weber's Law `ΔI / I = k`, what does **ΔI** represent?
 a) ✓ The smallest change in the stimulus that can just be detected (the JND)  b) The total stimulus intensity  c) A constant for each sense  d) The background noise level

**A3.** If the Weber fraction for brightness is about **8%**, a brightness change is reliably noticed only when it is at least…
 a) 1% of the original  b) ✓ ~8% of the original brightness  c) 50% of the original  d) Any change at all is noticed

**A4.** A progress bar jumps from **95% to 96%**. Why do users barely notice?
 a) The colour is wrong  b) Progress bars don't update visually  c) ✓ The 1% change is far below the JND — the ratio is too small to perceive  d) 96% rounds down to 95%

**A5.** A circle grows **10px→14px** vs **100px→104px** (both +4px) — which change is easier to notice, and why?
 a) 100→104, it's a bigger circle overall  b) ✓ 10→14, because +4px is a larger *fraction* of the original size  c) Equal — both grew by 4px  d) Neither is noticeable

*Answer key A: A1-b, A2-a, A3-b, A4-c, A5-b*

### Form B (post)
**B1.** Adding 2 grams is obvious when holding a 10g letter but unnoticeable holding a 5kg bag. Why?
 a) Heavy objects deaden the senses  b) ✓ The detectable difference depends on the *ratio* of change to the original weight, not the absolute change  c) Grams aren't a real unit of feel  d) The hand adapts to weight instantly

**B2.** In Weber's Law `ΔI / I = k`, what does **k** represent?
 a) The just-noticeable difference  b) The original intensity  c) ✓ A constant fraction that stays roughly the same for a given sense  d) The reaction time

**B3.** If the Weber fraction for size is about **10%**, a size change is reliably noticed only when it exceeds about…
 a) 2% of the original  b) ✓ ~10% of the original size  c) 40% of the original  d) 100% of the original

**B4.** A button darkens by only **3%** on hover and feels unresponsive. Why?
 a) 3% is an odd number  b) Hover states don't use colour  c) ✓ The change is below the brightness JND (~8%), so the state change can't be perceived  d) The button is disabled

**B5.** A **10-item** list growing to **12** vs a **100-item** list growing to **102** — which change is more noticeable?
 a) 100→102, more items overall  b) ✓ 10→12, because it's a larger fraction of the original count  c) Equal — both added 2  d) Neither, lists aren't perceived by count

*Answer key B: B1-b, B2-c, B3-b, B4-c, B5-b*

---

## 2. Problem Solving (`problem-solving`)

**Game teaches:** state, operator, **means-end analysis**, **working backwards**,
**analogical reasoning**; problem space = *initial state + goal state + operators*;
representation matters (water-jug 5L/3L→4L; mutilated-chessboard). In-game assessment
= 6 conceptual MCQ → 0–100 (clean conceptual post; Form A items below are deliberately
*different scenarios* from the assessment so the pre-test doesn't leak its answers).

### Form A (pre)
**A1.** At each step you choose the action that most reduces the distance between where you are and your goal. This strategy is…
 a) ✓ Means-end analysis  b) Working backwards  c) Analogical reasoning  d) Trial and error

**A2.** To plan a route you start from the destination and reason backward to your current location. This is…
 a) Means-end analysis  b) ✓ Working backwards  c) Hill climbing  d) Brute-force search

**A3.** Solving a new problem by recalling a *similar past problem* and mapping its solution across is…
 a) ✓ Analogical reasoning  b) Means-end analysis  c) Working backwards  d) Random restart

**A4.** A "problem space" is defined by which three components?
 a) Input, process, output  b) ✓ Initial state, goal state, and operators  c) Hypothesis, variable, result  d) Affordance, signifier, feedback

**A5.** Why can changing how a problem is *represented* make it dramatically easier?
 a) It's shorter to write  b) It guarantees the fewest moves  c) ✓ A good representation exposes useful sub-goals and shrinks the search space  d) Representation never affects difficulty

*Answer key A: A1-a, A2-b, A3-a, A4-b, A5-c*

### Form B (post)
**B1.** A chess player picks each move to most reduce the gap between the current board and checkmate. This is…
 a) ✓ Means-end analysis  b) Working backwards  c) Analogical reasoning  d) Trial and error

**B2.** A student wanting a finished essay starts from the conclusion and works back to the introduction. This is…
 a) Means-end analysis  b) ✓ Working backwards  c) Hill climbing  d) Brute-force search

**B3.** An engineer designs a new bridge by adapting a solution from a bridge they built before. This is…
 a) ✓ Analogical reasoning  b) Means-end analysis  c) Working backwards  d) Random restart

**B4.** Which trio describes the structure of a problem in problem-solving theory?
 a) Cause, effect, side-effect  b) ✓ Starting state, target state, and the available actions (operators)  c) Premise, rule, conclusion  d) Goal, reward, penalty

**B5.** The mutilated-chessboard puzzle becomes easy once you reason about *square colours* instead of positions. This shows that…
 a) Chess problems are always easy  b) Colours are decorative  c) ✓ Changing the representation can turn a hard problem into an easy one  d) Only visual problems have representations

*Answer key B: B1-a, B2-b, B3-a, B4-b, B5-c*

---

## 3. Gestalt Principles (`gestalt`)

**Game teaches exactly 5 principles:** similarity, proximity, continuity, symmetry,
closure (**not** common fate or figure-ground). In-game assessment = 10 SVG "identify
the principle" items → 0–100. Form A/B use *text-described* scenarios so they can run
in a plain form; all 5 answer options appear on every item (matching the in-game
5-button format).

**Options for every item below:** a) Similarity  b) Proximity  c) Continuity  d) Symmetry  e) Closure

### Form A (pre)
**A1.** Form fields where each label sits close to its own input box are read as belonging together. → ✓ **b) Proximity**
**A2.** Buttons sharing the same colour are perceived as the same category of action. → ✓ **a) Similarity**
**A3.** You perceive a complete circle even though its outline is dashed with gaps. → ✓ **e) Closure**
**A4.** Two crossing lines are seen as each flowing smoothly *through* the intersection, not as four separate segments. → ✓ **c) Continuity**
**A5.** Two mirror-image shapes are perceived as one unified, balanced object. → ✓ **d) Symmetry**

*Answer key A: A1-b, A2-a, A3-e, A4-c, A5-d*

### Form B (post)
**B1.** Icons placed in tight clusters with clear gaps between clusters are seen as separate groups. → ✓ **b) Proximity**
**B2.** In a grid, items of the same *shape* are grouped together by the eye. → ✓ **a) Similarity**
**B3.** The IBM logo's horizontally-striped letters are still readable as letters despite the gaps. → ✓ **e) Closure**
**B4.** Dots arranged along a gentle curve are perceived as a single flowing path. → ✓ **c) Continuity**
**B5.** A logo with a clear left–right mirror axis is perceived as a single balanced whole. → ✓ **d) Symmetry**

*Answer key B: B1-b, B2-a, B3-e, B4-c, B5-d*

---

## 4. Miller's Law (`memory`)

**Game teaches:** STM holds **7 ± 2 chunks** (Miller, 1956); **chunking**; STM (~20s,
limited) vs LTM (unlimited, durable); UI implications (group into labelled sections,
keep wizards ≤7 steps, progress indicators). In-game assessment = digit-span (5 rounds,
experiential, *not scored*) + **5 conceptual MCQ → 0–100**. Form A items use different
examples from the assessment so the pre-test doesn't leak answers.

### Form A (pre)
**A1.** Miller's Law says short-term memory holds about how many chunks?
 a) 3 ± 1  b) ✓ 7 ± 2  c) 12 ± 3  d) 20 ± 5

**A2.** A phone number shown as **123-4567-8901** instead of **12345678901** is easier to remember because of…
 a) Closure  b) ✓ Chunking (11 digits → 3 chunks)  c) Fitts' Law  d) Sensory memory

**A3.** What best distinguishes short-term memory (STM) from long-term memory (LTM)?
 a) STM is slower to retrieve  b) LTM is limited to 7±2 items  c) ✓ STM holds ~7±2 items briefly (~20s); LTM stores knowledge effectively permanently  d) They have the same capacity

**A4.** Which menu design best respects working-memory limits?
 a) 20 ungrouped options  b) ✓ 5 labelled categories of 3–4 options each  c) 15 options in alphabetical order  d) One long unlabelled list

**A5.** Why does grouping controls into labelled sections reduce perceived complexity?
 a) It uses less screen space  b) Colours distract the user  c) ✓ Each labelled group becomes a single chunk, lowering the number of items STM must track  d) It hides options from the user

*Answer key A: A1-b, A2-b, A3-c, A4-b, A5-c*

### Form B (post)
**B1.** According to Miller (1956), roughly how many *meaningful units* can working memory hold at once?
 a) 3 ± 1  b) ✓ 7 ± 2  c) 10 ± 2  d) Unlimited with practice

**B2.** A software licence key shown as **ABCD-EFGH-IJKL** rather than **ABCDEFGHIJKL** is easier to recall because of…
 a) Symmetry  b) ✓ Chunking (12 characters → 3 chunks)  c) Hick's Law  d) Long-term memory

**B3.** Which statement about STM vs LTM is correct?
 a) STM is permanent; LTM is brief  b) Both are limited to 7±2 items  c) ✓ STM holds a few items briefly; LTM stores knowledge permanently and with vast capacity  d) LTM is faster to access than STM

**B4.** A settings page has **20 ungrouped options**. The best fix for cognitive load is to…
 a) Sort them alphabetically  b) ✓ Group them into ~5 labelled sections  c) Add more colour  d) Show them all on one scroll

**B5.** A sign-up wizard has **12 steps**. How can it best respect Miller's limit?
 a) Show all 12 at once  b) Remove the progress bar  c) ✓ Break it into a few grouped stages with progress indicators, so each stage is one chunk  d) Add 8 more steps for clarity

*Answer key B: B1-b, B2-b, B3-c, B4-b, B5-c*

---

## Administration & analysis notes

- **5 items × 2 forms × 4 topics = 40 items.** Form A (pre) ≈ 20 items / ~5 min; Form B (post) ≈ 20 items / ~5 min.
- **Counterbalance** topic↔condition across participants (Latin square): each student does 4 topics, **2 FLIP** (Understanding→Assessment) and **2 CONTROL** (Assessment-first), so each topic appears in both conditions across the sample.
- **Per-topic normalized gain** `g = (B% − A%)/(100 − A%)`; compare FLIP vs CONTROL topics within-subject (Wilcoxon signed-rank / paired-t).
- **Report item difficulty (P) and discrimination (D)** on your sample; drop items with D < 0.2 before final analysis.
- **Validity caveats:** items are content-aligned to the current game code but **not yet piloted** — run a small pilot (n ≈ 5) to catch ambiguous wording and check the A/B forms are equally difficult before the main study.
- **Burden:** 4 topics pushes the full session to ~90–100 min. Resolved via the **two-session protocol** in `experiment-design.md` §1.

---

## Desk review (self-pilot) — completed

A desk review of all 40 items was run before any human pilot. Checks and outcomes:

| Check | Outcome |
|-------|---------|
| **Content validity** — every item maps to content the game actually teaches | ✅ after fix. **1 bug fixed:** Weber A5 originally used an *auditory* example; the game teaches only size/brightness/count, so it was rewritten to the size domain. |
| **Isomorphism** — each A↔B pair tests the same concept, different surface | ✅ all 20 pairs (Weber ratio/formula/fraction/UI/scaling; Problem-Solving 3 strategies + problem-space + representation; Gestalt 5 principles; Miller capacity/chunking/STM-LTM/grouping/wizard). |
| **Answer-leakage** vs the in-game assessment | ✅ Form A avoids the assessment's exact scenarios (no water-jug, notifications, caching-bug, credit-card, or breadcrumb items). |
| **Distractor plausibility** — wrong options are non-trivial | ✅ distractors are real competing concepts, not filler. |
| **Answer-key correctness** | ✅ re-checked against game explanations. |

**Known limitations carried into the human pilot:**
1. **Gestalt construct is narrow** — it is a 5-way "name the principle" classification, so Form A/B and the in-game assessment overlap heavily and items may be *too easy* (low discrimination). Consider adding 1–2 **application** items ("which principle would you *use* to group related form fields?") to add depth.
2. **Some pre-test priming** of the in-game assessment is unavoidable for narrow constructs (Gestalt, Miller capacity). This is **controlled** — it affects all conditions equally — but note it.
3. **Capacity items (Miller A1/B1)** are near-identical recall ("7±2") and may show a ceiling. Keep, but expect low discrimination.

## Human pilot protocol (ready to run — closes gap #1)

Run with **n ≈ 5** non-participants before the main study:
1. Administer Form A then Form B for all 4 topics (no games — just the items).
2. Record per item: **% correct (difficulty P)** and time-to-answer; collect a "was anything confusing?" free-text note per topic.
3. **Flag for revision:** any item with P < 0.20 (too hard) or P > 0.95 (too easy/ceiling), discrimination D < 0.20, or ≥ 2 pilots marking it confusing.
4. **Check A/B equivalence:** the two forms should have similar mean difficulty per topic — if Form A and Form B differ by > ~15 percentage points on a topic, rebalance that pair.
5. Revise flagged items, then lock the banks for the main study.
