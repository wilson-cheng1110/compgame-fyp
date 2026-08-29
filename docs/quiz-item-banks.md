# Pre/Post Quiz Item Banks — 13 Topics

> Conceptual knowledge instrument for normalized-gain scoring across **all 13 topics** of
> the Stage-2 rollout. Topics 1-4 were authored and desk-reviewed for the Stage-1 focus
> group; topics 5-13 were added on **2026-08-30** so that every topic in
> `backend/topic_schedule.json` has a pre/post instrument and no topic silently runs its
> unit without one (`backend/checks.py` returns `None` for an unbanked topic, and the unit
> renders with no MC step — a missing measurement that looks like a design choice).
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

**A6.** You are designing a volume slider. For every step to *feel* like an equal change in loudness, each step should raise the level by…
 a) a fixed number of units, the same at every position  b) ✓ a roughly constant *percentage* of the current level  c) a bigger amount at low volumes and a smaller amount at high volumes  d) a random amount, since loudness is not predictable

*Answer key A: A1-b, A2-a, A3-b, A4-c, A5-b, A6-b*

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

**B6.** You are designing a "text size" control with several steps. For each step to *feel* like an equal jump in size, consecutive sizes should differ by…
 a) a fixed number of pixels at every step  b) ✓ a roughly constant *ratio* (percentage) between consecutive sizes  c) a bigger jump for small sizes and a smaller jump for large sizes  d) whatever values happen to look neat

*Answer key B: B1-b, B2-c, B3-b, B4-c, B5-b, B6-b*

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

**A6.** In the water-jug puzzle, "fill the 5-litre jug" and "pour the 5-litre jug into the 3-litre jug" are examples of the problem's…
 a) goal states  b) ✓ operators — the available actions that move you from one state to another  c) constraints  d) heuristics

*Answer key A: A1-a, A2-b, A3-a, A4-b, A5-c, A6-b*

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

**B6.** When solving a maze, the moves "go north", "go east", and "go back the way you came" are best described as the maze's…
 a) goal state  b) ✓ operators — the available actions you can take  c) initial state  d) search heuristics

*Answer key B: B1-a, B2-b, B3-a, B4-b, B5-c, B6-b*

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

**A6.** *(Apply it.)* You are designing a settings screen with many options. Without using colour, borders, or boxes, you want users to instantly see which options belong together. Which principle would you rely on? → ✓ **b) Proximity**

*Answer key A: A1-b, A2-a, A3-e, A4-c, A5-d, A6-b*

### Form B (post)
**B1.** Icons placed in tight clusters with clear gaps between clusters are seen as separate groups. → ✓ **b) Proximity**
**B2.** In a grid, items of the same *shape* are grouped together by the eye. → ✓ **a) Similarity**
**B3.** The IBM logo's horizontally-striped letters are still readable as letters despite the gaps. → ✓ **e) Closure**
**B4.** Dots arranged along a gentle curve are perceived as a single flowing path. → ✓ **c) Continuity**
**B5.** A logo with a clear left–right mirror axis is perceived as a single balanced whole. → ✓ **d) Symmetry**

**B6.** *(Apply it.)* You are laying out a navigation menu with many links. Without using colour or boxes, you want links on the same topic to read as one group. Which principle would you use? → ✓ **b) Proximity**

*Answer key B: B1-b, B2-a, B3-e, B4-c, B5-d, B6-b*

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

**A6.** Without rehearsal, about how long does information typically stay in short-term memory?
 a) a fraction of a second  b) ✓ about 15–30 seconds  c) several hours  d) permanently

*Answer key A: A1-b, A2-b, A3-c, A4-b, A5-c, A6-b*

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

**B6.** A one-time passcode fades from memory within about half a minute unless you keep repeating it. This reflects the limited ___ of short-term memory.
 a) capacity  b) ✓ duration (about 20–30 seconds)  c) accuracy  d) bandwidth

*Answer key B: B1-b, B2-b, B3-c, B4-b, B5-c, B6-b*

---

## 5. Principle of Consistency / Stroop (`stroop`)

**Game teaches:** stimulus–response compatibility; the player runs 5 *consistent* rounds
(green→GO, red→STOP) then 5 *inconsistent* rounds (red→GO, green→STOP) and compares their
own two reaction times; conventions as learned automatic responses; internal vs external
consistency. In-game assessment = a 10-round Stroop colour task under a 2.5 s deadline +
**5 conceptual MCQ → 0–100**.

> ⚠️ **Format note:** the in-game Stroop rounds are a *perceptual interference* measure, like
> Weber's. The MCQ half is the conceptual part. Use Form A/B below for the knowledge-gain
> measure; report the interference RT difference as a separate behavioural DV.

### Form A (pre)
**A1.** The word **BLUE** is printed in red ink. Naming the *ink colour* is slower than naming the colour of a coloured block. Why?
 a) ✓ Reading the word is automatic and interferes with the response the task actually requires  b) Red ink is physically harder to see  c) The eye cannot focus on coloured text  d) Blue and red are opposite on the colour wheel

**A2.** "Stimulus–response compatibility" means…
 a) The stimulus and the response happen at the same time  b) ✓ The mapping between a signal and the action it requires matches what the user has already learned to expect  c) The screen and the input device are made by the same vendor  d) Every stimulus produces exactly one possible response

**A3.** A driving simulator swaps the meaning of the traffic-light colours, so red means proceed. What does the research predict for trained drivers?
 a) No change — they know the new rule  b) Faster responses, because the novelty raises alertness  c) ✓ Slower responses and more errors, because the automatic learned response must be suppressed each time  d) Errors only on the first trial

**A4.** Which pair correctly separates *internal* from *external* consistency?
 a) Internal = follows the operating system; external = the app is self-consistent  b) They are two names for the same requirement  c) Internal = code quality; external = visual design  d) ✓ Internal = elements behave the same way throughout the product; external = the product follows conventions shared across other products

**A5.** Why does an inconsistent mapping hurt *most* when the user is rushed?
 a) ✓ Under time pressure people fall back on automatic responses, which is exactly what an inconsistent mapping requires them to override  b) Time pressure reduces the refresh rate  c) Rushing makes the screen harder to read  d) It does not — accuracy is unaffected by pressure

**A6.** *(Apply it.)* A hospital monitor shows critical alarms in blue and normal readings in orange. Staff keep misreading it under load. What is the strongest fix?
 a) Add a training session on the colour scheme  b) ✓ Re-map the colours to the convention staff already hold (critical = red), so no suppression is needed  c) Add a sound to every reading  d) Increase the size of the blue text

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** A list of colour names is printed in mismatched inks. Naming the inks takes longer than naming a row of plain colour swatches. What causes the delay?
 a) Mismatched ink is printed at lower contrast  b) The words are longer than the swatches are wide  c) ✓ Word reading runs automatically and competes with the colour-naming response  d) Colour names are harder to pronounce

**B2.** A control is *compatible* with its response when…
 a) It is the same colour as the thing it controls  b) It responds within 100 ms  c) It can only be operated in one way  d) ✓ The action it requires is the one the user's prior experience already predicts

**B3.** A lift control panel is rebuilt so the top button goes down and the bottom button goes up. What is predicted for regular users?
 a) ✓ Longer decision times and more wrong-button presses, because the spatial mapping they hold must be overridden  b) They adapt with no measurable cost  c) Improved accuracy from the extra attention required  d) An effect on new users only

**B4.** An app uses the same button placement on every one of its screens, but ignores the platform's standard save shortcut. Which kind of consistency does it have, and which does it lack?
 a) It lacks both  b) ✓ It has internal consistency but lacks external consistency  c) It has external consistency but lacks internal consistency  d) It has both

**B5.** Two groups use an interface with a reversed colour convention; one works at their own pace, the other against a timer. What is expected?
 a) Both groups perform identically  b) The timed group is more accurate, having concentrated harder  c) ✓ The timed group makes more errors, because haste favours the automatic response the interface contradicts  d) The self-paced group makes more errors

**B6.** *(Apply it.)* A cockpit display marks a failed subsystem in green and a healthy one in red. The vendor proposes bold text on the green items instead of changing the colours. Why is that the weaker fix?
 a) Bold text is not visible at a distance  b) It would need a firmware update  c) Bold text is reserved for warnings by regulation  d) ✓ It leaves the conflicting mapping in place, so pilots must still override a learned response under exactly the conditions where they cannot

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 6. Hick's Law (`hicks-law`)

**Game teaches:** `RT = a + b × log₂(n + 1)`; an interactive slider showing predicted RT for
n = 1…20; **diminishing returns** — 1→2 choices costs more than 9→10; fewest choices for
emergency interfaces. In-game assessment measures the player's *own* reaction time at
n = 2, 4, 8, 16 and regresses it on log₂(n + 1).

> ⚠️ **Format note:** the in-game Hick assessment is a **reaction-time measurement**, not a
> quiz — it produces a personal slope and intercept. Use Form A/B for the knowledge measure
> and report the measured RT/fit as a separate behavioural DV.

### Form A (pre)
**A1.** In `RT = a + b × log₂(n + 1)`, what is **n**?
 a) ✓ The number of equally likely choices on offer  b) The number of users tested  c) The time in milliseconds  d) The number of clicks required

**A2.** Which change adds *more* decision time: going from 2 options to 4, or from 16 options to 18?
 a) 16→18, because there are more options in total  b) ✓ 2→4, because the logarithm means each extra option costs less than the one before it  c) They add the same amount  d) Neither — decision time is unaffected by the number of options

**A3.** A user must first decide *which* of several icons to press, then move the pointer to it. Which law describes which part?
 a) Hick's Law covers both parts  b) Fitts' Law covers the decision; Hick's Law covers the movement  c) ✓ Hick's Law covers the decision among the options; Fitts' Law covers the movement to the chosen one  d) Neither law applies once there is more than one target

**A4.** Why do safety-critical interfaces deliberately offer very few controls?
 a) Fewer controls are cheaper to manufacture  b) Large controls are easier to see  c) Operators dislike complicated panels  d) ✓ Decision time rises with the number of alternatives, and a delay in an emergency is the cost being avoided

**A5.** A menu is cut from **16** items to **8**. Roughly how much of the decision-time component does that remove?
 a) ✓ About a fifth of it, because the term is log₂(n + 1) rather than n  b) Half of it  c) Three quarters of it  d) None — only the movement time changes

**A6.** *(Apply it.)* A flat menu of **15** commands is reorganised into **3** groups of **5**, so the user makes two decisions instead of one. What does Hick's Law alone predict for total decision time?
 a) Faster, because each menu the user faces is shorter  b) ✓ Slower overall, because two decisions cost log₂(4) + log₂(6) ≈ 4.6 bits against log₂(16) = 4.0 bits for the flat menu  c) Identical, because the same 15 commands are reachable either way  d) Hick's Law says nothing about nested menus

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** In `RT = a + b × log₂(n + 1)`, what does **a** represent?
 a) The number of alternatives  b) The accuracy of the response  c) ✓ A baseline that does not depend on the number of choices  d) The width of each option

**B2.** Which removal saves *more* decision time: cutting a menu from 3 items to 2, or from 20 items to 19?
 a) 20→19, because a longer menu is being shortened  b) The saving is identical in both cases  c) Neither — removing one item never changes decision time  d) ✓ 3→2, because the logarithm gives the earliest choices the largest weight

**B3.** A driver glances at a dashboard, decides which of six buttons to press, and reaches for it. Which law predicts which stage?
 a) ✓ Hick's Law predicts the time to decide among the six; Fitts' Law predicts the time to reach the one chosen  b) Fitts' Law predicts both stages  c) Hick's Law predicts the reach; Fitts' Law predicts the decision  d) Neither applies while driving

**B4.** An emergency stop screen is redesigned from nine options down to two. What is the primary justification?
 a) Two options fit better on a small screen  b) ✓ Reaction time grows with the number of alternatives, and reaction time is what matters in an emergency  c) Fewer options need less memory on the device  d) Two options are easier to translate

**B5.** A navigation bar drops from **12** links to **6**. Roughly what share of the decision-time component disappears?
 a) Half of it  b) All of it  c) ✓ About a quarter of it, since the term depends on log₂(n + 1)  d) None

**B6.** *(Apply it.)* A settings screen with **9** options is restructured into **3** categories of **3**, so the user makes two choices. What does Hick's Law alone predict?
 a) Faster, because three options are quicker to scan than nine  b) The prediction depends only on how the categories are labelled  c) Exactly the same total time  d) ✓ Slower overall — log₂(4) + log₂(4) = 4.0 bits against log₂(10) ≈ 3.3 bits for the flat list

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 7. Fitts' Law (`fitts-law`)

**Game teaches:** `MT = a + b × log₂(A/W + 0.5)`; the index of difficulty **ID** in bits; two
fishing sub-games, one varying the *distance* to the fish (A) and one varying the fish's
*size* (W); "bigger and closer is easier". In-game assessment is a real pointing experiment —
9 scored trials spanning ID ≈ 1.0–3.7 bits, regressed to give the player's own slope and
index of performance.

> ⚠️ **Format note:** like Hick's, the in-game Fitts assessment **measures movement time**
> rather than asking questions. Form A/B below carry the conceptual measure; the fitted slope
> and R² are a separate behavioural DV.

### Form A (pre)
**A1.** Fitts' Law predicts how long a pointing movement takes. Which two properties of that movement does it use?
 a) ✓ How far the target is and how wide it is  b) The speed of the hand and the size of the screen  c) How many targets are on screen and how bright they are  d) The user's age and the input device

**A2.** In `ID = log₂(A/W + 0.5)`, what does **W** stand for?
 a) The number of windows open  b) ✓ The width of the target along the direction of approach  c) The weight given to the movement  d) The waiting time before the movement starts

**A3.** Two buttons sit the same distance from the pointer. One is 30 px wide, the other 120 px. Which has the higher index of difficulty?
 a) They are equal, because the distance is the same  b) The 120 px button, because it covers more area  c) ✓ The 30 px button, because a smaller W makes the ratio A/W larger  d) Neither — ID depends only on distance

**A4.** A paper reports a target's index of difficulty as **3.2**. Three point two *what*?
 a) Milliseconds  b) Pixels  c) Centimetres  d) ✓ Bits

**A5.** Doubling the distance to a target does **not** double the movement time. Why not?
 a) ✓ Distance enters through a logarithm, so doubling it adds a roughly fixed increment rather than doubling the total  b) The hand accelerates to compensate  c) Movement time does not depend on distance at all  d) The extra distance is offset by the target getting wider

**A6.** *(Apply it.)* A team can either **double the width** of a toolbar button or **halve the distance** the pointer has to travel to it. Using `ID = log₂(A/W + 0.5)`, which helps more?
 a) Doubling the width, because size matters more than distance  b) ✓ Neither — both change A/W by the same factor, so the index of difficulty falls by the same amount  c) Halving the distance, because travel dominates the movement  d) Neither has any effect, because ID depends on the pointing device

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** According to Fitts' Law, which pair of quantities determines how long it takes to tap a button on a phone?
 a) The brightness of the button and the colour of its label  b) The number of apps installed and the screen resolution  c) ✓ The distance the thumb must travel and the size of the button  d) The battery level and the refresh rate

**B2.** In `ID = log₂(A/W + 0.5)`, what does **A** stand for?
 a) The area of the target  b) A constant fitted to each user  c) The accuracy of the movement  d) ✓ The amplitude — the distance from the starting point to the target

**B3.** Two icons are equally far from the cursor. One is 16 px wide, the other 64 px. Which is the harder target?
 a) ✓ The 16 px icon, because the smaller width raises A/W  b) They are equally hard, being the same distance away  c) The 64 px icon, because it takes longer to cross  d) Neither — width does not enter the law

**B4.** A usability report says a tapping task had an index of difficulty of **2.5**. What is the unit?
 a) Seconds  b) ✓ Bits  c) Millimetres  d) Percent

**B5.** Making a button four times wider does **not** cut the movement time to a quarter. Why not?
 a) The pointer has a maximum speed  b) Width only affects errors, not time  c) ✓ Width enters through a logarithm, so a fourfold change subtracts a fixed amount rather than dividing the total  d) It does — movement time is inversely proportional to width

**B6.** *(Apply it.)* A mobile "Send" button can be made **twice as tall** in the direction the thumb approaches, or moved so the thumb travels **half as far**. Which reduces the index of difficulty more?
 a) Making it taller, because the thumb is imprecise  b) Moving it closer, because travel is the slower part  c) Neither, because thumbs are not modelled by Fitts' Law  d) ✓ Both equally — each halves the ratio A/W

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 8. Visual Perception (`visual-perception`)

**Game teaches:** the eye is not a camera; **rods** (periphery, low light, motion) vs **cones**
(fovea, colour, fine detail); ~8% of males / ~1% of females have red–green deficiency, so
colour must never be the only cue — redundant coding is the fix; **after-images** as evidence
of opponent processing; **monocular depth cues** (occlusion, relative size, motion parallax);
reading as **saccades and fixations**. In-game assessment = 6 conceptual MCQ → 0–100.

### Form A (pre)
**A1.** Which receptor type dominates the *periphery* of the retina, and what is it best at?
 a) ✓ Rods — low light and motion  b) Cones — colour and fine detail  c) Rods — colour discrimination  d) Cones — night vision

**A2.** Why should the state of a control never be carried by hue alone?
 a) Hue is expensive to render accurately  b) ✓ A substantial minority of users — around 8% of males — cannot reliably discriminate red from green  c) Screens vary too much in refresh rate  d) Colour is invisible in the periphery

**A3.** Staring at a bright shape and then seeing its opposite colour on a blank wall shows that…
 a) The display is retaining an image  b) The rods have been temporarily destroyed  c) ✓ Vision is constructed from contrast and opponent colour channels, not recorded like a photograph  d) The wall reflects the missing wavelengths

**A4.** One object partly covers another and is therefore judged to be nearer. What kind of depth cue is this?
 a) A binocular cue, because it needs two eyes  b) A cue that only works in motion  c) Not a depth cue at all  d) ✓ A monocular cue — it works with one eye and on a flat screen

**A5.** During reading, at what point is meaning actually extracted?
 a) ✓ Only during the fixations — the brief pauses between jumps  b) Continuously, as the eye sweeps smoothly along the line  c) Only during the jumps between words  d) After the whole line has been scanned

**A6.** *(Apply it.)* A wide dashboard puts small but important status text at the far left and right edges, where the operator is never looking directly. Why will it be missed?
 a) Peripheral vision is colour-blind, so text cannot be seen there at all  b) ✓ Acuity for fine detail is concentrated at the fovea; the periphery resolves detail poorly, so small text there cannot be read without looking straight at it  c) The edges of a screen are dimmer  d) Text is only legible when it is moving

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** Which receptor type is packed most densely at the *fovea*, and what does it provide?
 a) Rods — motion detection  b) Rods — fine detail in dim light  c) ✓ Cones — colour and fine detail  d) Cones — peripheral awareness

**B2.** A form marks invalid fields by turning their borders red and valid ones green, with no other change. What is the accessibility problem?
 a) Red and green borders are too thin to see  b) There is no problem — the colours are conventional  c) Coloured borders slow down page rendering  d) ✓ Users with red–green deficiency, about 8% of males, cannot tell the two states apart because colour is the only carrier of the difference

**B3.** The Hermann grid makes grey blobs appear at crossings where nothing grey has been drawn. What does this demonstrate?
 a) ✓ That the visual system responds to contrast between neighbouring regions rather than reporting light faithfully  b) That black and white cannot be shown together  c) A rendering fault in the display  d) That the grid is printed at the wrong resolution

**B4.** Two identical shapes are drawn on a flat screen; the smaller one is judged farther away. Which class of depth cue is at work?
 a) Binocular disparity  b) ✓ A monocular cue — relative size, which needs only one eye  c) Accommodation of the lens  d) Stereopsis

**B5.** Which description of eye movement during reading is correct?
 a) The eye glides smoothly and evenly across each line  b) The eye takes in a whole paragraph in a single glance  c) ✓ The eye jumps (saccades) and pauses (fixations), taking in meaning during the pauses  d) The eye reads backwards and then forwards on every line

**B6.** *(Apply it.)* A notification badge is placed at the extreme corner of an ultrawide monitor while the user works in the centre. What does the structure of the retina predict?
 a) It will be noticed sooner there, because the periphery is more sensitive to detail  b) It will be read accurately without a glance, because peripheral vision handles text well  c) It will be invisible, because the periphery detects nothing  d) ✓ Movement or a large change there may draw attention, but its detail cannot be read until the eye is turned to it

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 9. Mental Models & Affordances (`mental-model`)

**Game teaches:** the user's **mental model** as a predictive internal account of the system;
**affordance** (what an object makes possible) vs **signifier** (the perceptible cue that
communicates it); a sort of five real UI elements into good/poor affordances; two
"which is faster to learn" mismatch pairs (folder metaphor vs tag system; typed time vs
drum-roll picker). In-game assessment = 5 conceptual MCQ + a 4-item affordance ranking → 0–100.

### Form A (pre)
**A1.** In Norman's terms, an **affordance** is…
 a) ✓ An action the object makes possible for the user  b) The label printed on a control  c) The colour scheme of an interface  d) The user's opinion of the design

**A2.** A **signifier** is…
 a) The name given to a feature in the documentation  b) ✓ The perceptible cue that tells the user the action is available  c) The underlying code that performs the action  d) A synonym for an affordance

**A3.** A **mental model** is best described as…
 a) A diagram the designer draws before building  b) The system's actual internal architecture  c) ✓ The user's internal account of how the system works, used to predict what it will do next  d) A record of everything the user has clicked

**A4.** A door has a flat plate on the side you push and a vertical handle on the side you pull. What is being done well?
 a) Nothing — the door should be automatic  b) Both sides afford the same action, so no error is possible  c) The door relies on the user's memory instead of a cue  d) ✓ Each side carries a signifier that matches the action it actually affords

**A5.** When a design conflicts with the user's mental model, the errors it produces are usually *systematic* rather than random. Why?
 a) ✓ Because users are acting on a consistent prediction — it is simply the wrong one, so they go wrong the same way every time  b) Because the system logs are biased  c) Because users copy each other's mistakes  d) Because random errors are impossible in software

**A6.** *(Apply it.)* A photo app hides "delete" behind a small unlabelled grey square with no hover state. Which change adds a *signifier* without changing what the control affords?
 a) Move the square to the top of the screen  b) ✓ Give it a recognisable icon or text label and a visible hover state, so users can perceive that it is clickable and what it does  c) Remove the control and use a keyboard shortcut instead  d) Make the square a brighter grey

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** Which statement describes an **affordance** rather than a signifier?
 a) The word "PULL" printed on the glass  b) The drop shadow under a button  c) ✓ The fact that a handle can be gripped and pulled  d) The tooltip that appears on hover

**B2.** Which of these is a **signifier**?
 a) The fact that a scrollbar can be dragged  b) The fact that a surface can be sat on  c) The database that stores the list order  d) ✓ The six-dot handle drawn on a list row to show it can be dragged

**B3.** Two people describe a thermostat: one says "set it high and the room heats faster", the other "set the target and it heats at one rate until it gets there". These two descriptions are their…
 a) ✓ Mental models — internal accounts used to predict the system's behaviour  b) Affordances  c) Signifiers  d) Usability heuristics

**B4.** A kettle's handle is on the opposite side from its spout, and it is the only part not made of metal. What does this achieve?
 a) It reduces manufacturing cost  b) ✓ The material and position act as signifiers pointing to the part that affords a safe grip  c) It makes the kettle symmetrical  d) It prevents the kettle from being lifted

**B5.** Users of a redesigned app all make the *same* mistake at the same step. What does that pattern suggest?
 a) A random distribution of user skill  b) A rendering bug on that screen only  c) ✓ A shared mental model that the design contradicts, so everyone predicts the same wrong outcome  d) That the sample was too small to interpret

**B6.** *(Apply it.)* A messaging app makes long-press the only way to reach "reply", with no visible indication anywhere. What is the least disruptive fix?
 a) Remove the reply feature  b) Add a tutorial video on first launch  c) Change long-press to a triple tap  d) ✓ Add a visible signifier — a reply control or an on-screen hint — so the existing capability becomes perceivable

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 10. Norman's Action Cycle (`norman`)

**Game teaches:** the seven stages by name — Form a Goal, Plan, Specify Action, Perform Action,
Perceive State, Interpret State, Evaluate Outcome — walked through with a printing scenario;
the **Gulf of Execution** (stages 2–4, working out *how*) and the **Gulf of Evaluation**
(stages 5–7, working out *whether it worked*). In-game assessment = 5 scenario MCQ that name
the failing stage and its gulf → 0–100.

> ⚠️ **Wording note:** items below name the stages rather than numbering them. The stage
> *numbering* is a presentation convention of the game; the numbers appear in no lecture deck
> in the corpus, and an item that turns on recalling "Stage 5" would measure familiarity with
> the game's labelling rather than the concept. Same reasoning as the Weber/Gestalt naming
> caveat in the administration notes.

### Form A (pre)
**A1.** The **Gulf of Execution** is the gap between…
 a) ✓ What the user wants to do and the actions the system actually makes available  b) What the system does and what it reports  c) The user's expertise and the designer's expertise  d) The time an action takes and the time the user expects

**A2.** The **Gulf of Evaluation** is the gap between…
 a) The user's goal and their plan for reaching it  b) ✓ The state the system is in and the user's ability to perceive and make sense of that state  c) Two competing designs for the same task  d) The cost of a feature and its benefit

**A3.** A user knows exactly what they want to do but can find no control anywhere that does it. Which gulf is wide?
 a) Both equally  b) The Gulf of Evaluation  c) ✓ The Gulf of Execution  d) Neither — this is a goal-formation problem

**A4.** A microwave finishes, falls silent, and leaves its display blank. The user opens the door to check whether the food is done. Which gulf is this, and what narrows it?
 a) Execution — add more buttons  b) Execution — shorten the cooking time  c) Evaluation — remove the display entirely  d) ✓ Evaluation — give perceptible feedback that the cycle has ended

**A5.** A washing-machine app shows a spinning icon that never changes. The user can see it perfectly well but cannot tell what it means. Which part of the evaluation side has failed?
 a) ✓ Interpreting the system's state  b) Perceiving the system's state  c) Specifying the action  d) Forming the goal

**A6.** *(Apply it.)* You are designing a "Sync now" feature. Name the two design moves that narrow one gulf each.
 a) Add a keyboard shortcut, and log the result to a file  b) ✓ Make a clearly labelled sync control visible for the execution side, and show a result message afterwards for the evaluation side  c) Make the control larger, and make the font bolder  d) Hide the control until sync is needed, and run it silently

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** Which scenario describes a wide **Gulf of Execution**?
 a) A file copies successfully but no confirmation appears  b) A progress bar reaches 100% and then restarts  c) ✓ A user wants to rename a file but no menu, gesture or button appears to offer renaming  d) An error message uses unfamiliar jargon

**B2.** Which scenario describes a wide **Gulf of Evaluation**?
 a) A user cannot find the button that starts the export  b) A user does not know what they want to achieve  c) The export button is too small to click accurately  d) ✓ The export runs, but nothing on screen tells the user whether it finished or failed

**B3.** A ticket machine performs the action the user asked for, but the screen never changes, so the user has no idea whether it worked. Which gulf is wide?
 a) ✓ The Gulf of Evaluation  b) The Gulf of Execution  c) Both, equally  d) Neither — the action succeeded

**B4.** A car's electronic handbrake engages with no click, no light and no dashboard change. The driver tugs the lever again to be sure. Which gulf, and what narrows it?
 a) Execution — make the lever heavier  b) ✓ Evaluation — add a perceptible confirmation such as an indicator light  c) Execution — move the lever nearer the driver  d) Evaluation — remove the lever

**B5.** A phone's silent-mode switch moves with no sound, no vibration and no on-screen change at all. Which part of the evaluation side fails *first*?
 a) Interpreting the system's state  b) Evaluating the outcome against the goal  c) ✓ Perceiving the system's state — there is nothing to perceive  d) Planning the action

**B6.** *(Apply it.)* A checkout page is being redesigned. Which pair of changes addresses one gulf each?
 a) Reduce the number of form fields, and change the font  b) Add a progress bar, and remove the confirmation email  c) Move the button lower, and shorten the page  d) ✓ Make the "Place order" control obvious and clearly labelled, and follow it with an order confirmation the user can read

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 11. Language & Ambiguity (`language`)

**Game teaches:** three levels — **syntax** (is it well formed?), **semantics** (what does it
literally mean?), **pragmatics** (what did the speaker intend here?); four ambiguous sentences
the player disambiguates before being shown that *both* readings are valid; coreference; why
conversational interfaces need clarification. In-game assessment = 6 conceptual MCQ → 0–100.

### Form A (pre)
**A1.** Which level of language processing asks whether a sentence is structurally well formed?
 a) ✓ Syntax  b) Semantics  c) Pragmatics  d) Phonology

**A2.** "They are flying planes." The same words support two different structures. What kind of ambiguity is this?
 a) A spelling ambiguity  b) ✓ A syntactic (structural) ambiguity  c) A purely pragmatic ambiguity  d) No ambiguity — one reading is ungrammatical

**A3.** In "Put the cup on the shelf and wash it", working out what **it** refers to is…
 a) Tokenisation  b) Part-of-speech tagging  c) ✓ Coreference (reference) resolution  d) Spell checking

**A4.** "Can you open the window?" is literally a question about ability but functions as a request. Which level accounts for the difference?
 a) Syntax  b) Morphology  c) Phonetics  d) ✓ Pragmatics

**A5.** Why is an ambiguous command a bigger problem for a voice assistant than for a search box?
 a) ✓ The assistant has to commit to one reading and act on it, so a wrong choice does something wrong, while a search box can return results for several readings at once  b) Search boxes have no ambiguity  c) Speech recognition is always less accurate than typing  d) Voice assistants process language at fewer levels

**A6.** *(Apply it.)* A conversational interface finds that a third of user commands are ambiguous. Which change reduces ambiguity *at the source* rather than repairing it afterwards?
 a) Increase the microphone gain  b) ✓ Constrain the language the interface accepts, so fewer phrasings map to more than one meaning  c) Always take the most common reading  d) Log the ambiguous commands for later review

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** Which level of language processing asks what a sentence means *literally*, independently of who said it or when?
 a) Syntax  b) Pragmatics  c) ✓ Semantics  d) Orthography

**B2.** "The old men and women left early." Whether *old* applies to the women as well depends on the sentence's structure. This is…
 a) A pronunciation problem  b) A punctuation error  c) Purely a matter of speaker intent  d) ✓ A syntactic (structural) ambiguity

**B3.** A user says "Book the earlier one." Determining which of two flights **the earlier one** picks out is…
 a) ✓ Coreference (reference) resolution  b) Grammar checking  c) Phoneme recognition  d) Sentiment analysis

**B4.** Saying "It's cold in here" to get someone to shut the door is explained at which level?
 a) Syntax  b) ✓ Pragmatics  c) Semantics  d) Morphology

**B5.** Why does the cost of a mis-resolved ambiguity differ between a chatbot that answers questions and one that controls a smart home?
 a) It does not differ — both simply return text  b) Smart homes use a different grammar  c) ✓ The smart-home assistant performs a physical action, so a wrong reading has a real-world consequence that cannot be scrolled past  d) Chatbots resolve ambiguity perfectly

**B6.** *(Apply it.)* A voice interface for a medical device must almost never act on the wrong reading. Which design choice best fits that requirement?
 a) Always act on the first interpretation to stay responsive  b) Accept any phrasing the user offers  c) Silently ignore commands it is unsure about  d) ✓ Restrict the accepted commands to a small unambiguous set, and ask for confirmation whenever confidence is low

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 12. Ergonomics & I/O Devices (`ergonomics`)

**Game teaches:** ergonomics fits the *system* — human and machine together — to the human;
a workstation hazard hunt (neck bent past ~30° for over two hours a day; screen top at eye
level about an arm's length away; wrist flexion past 30°, extension past 45°, ulnar deviation
past 30°; feet flat with knees level with the hips); and the **two-point threshold** across
the body (fingertip ~2 mm, palm ~10 mm, forearm ~35 mm, back/calf ~42 mm) with haptic
feedback split into force, textural and thermal. In-game assessment = 6 conceptual MCQ → 0–100.

### Form A (pre)
**A1.** Physical ergonomics is chiefly concerned with…
 a) ✓ Posture, body dimensions and the strain of repeated movement  b) The visual style of the interface  c) The user's motivation to complete a task  d) The cost of the equipment

**A2.** Where should the top of a monitor sit to keep the neck in a neutral position?
 a) Well below eye level, so the user looks down  b) ✓ At about eye level, roughly an arm's length away  c) As close to the face as is comfortable  d) Above the head, so the user looks up

**A3.** The **two-point threshold** measures…
 a) How hard a surface must be pressed before it is felt  b) The delay between a touch and the sensation of it  c) ✓ The smallest separation at which two simultaneous touches are still felt as two rather than one  d) The number of fingers needed to operate a control

**A4.** On which region of the body is the two-point threshold **largest** — that is, where is touch least able to resolve detail?
 a) The fingertip  b) The palm  c) It is the same everywhere on the skin  d) ✓ The back or the calf

**A5.** Which of the following is one of the haptic feedback types?
 a) ✓ Thermal  b) Auditory  c) Olfactory  d) Gustatory

**A6.** *(Apply it.)* An assembly worker leans forward over a low bench for six hours a day and reports neck and upper-back pain. Which single change most directly reduces the risk, and why?
 a) Give them a louder machine alarm, so they look up more often  b) ✓ Raise the work surface so the neck and back stay within about 30° of neutral, since sustained flexion beyond that for hours a day is what causes the strain  c) Shorten the shift by ten minutes  d) Provide a wrist rest, since the wrists take the load

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** "Fit the technology to the human, not the human to the technology" summarises which field?
 a) Software engineering  b) Graphic design  c) ✓ Ergonomics (human factors)  d) Project management

**B2.** Which seated posture is recommended at a workstation?
 a) Feet crossed under the chair, knees above the hips  b) Feet dangling, with the chair as high as it goes  c) Legs fully extended in front of the body  d) ✓ Feet flat on the floor with the knees roughly level with the hips

**B3.** Two haptic actuators are placed 5 mm apart. On which body region are they most likely to be felt as **two separate** sensations?
 a) ✓ The fingertip  b) The back  c) The forearm  d) The calf

**B4.** Roughly how does the resolution of touch vary across the body?
 a) It is constant everywhere  b) ✓ It is finest at the fingertips and gets coarser towards the forearm, back and calf  c) It is finest on the back and coarsest on the hands  d) It depends only on how hard the touch is

**B5.** Which of these is **not** a form of haptic feedback?
 a) Force feedback  b) Textural feedback  c) ✓ Olfactory feedback  d) Thermal feedback

**B6.** *(Apply it.)* A smartwatch tries to convey a spatial pattern by buzzing two points a centimetre apart on the wrist, and users report feeling only one buzz. What explains it, and what would work better?
 a) The motors are too weak; increase the amplitude  b) The wrist cannot feel vibration at all; use sound instead  c) Vibration is not haptic feedback; use a visual cue  d) ✓ The forearm's two-point threshold is around 35 mm, so cues that close merge — either separate them further or move fine spatial feedback to the fingertips

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## 13. HCI Experiment Design (`experiment-design`)

**Game teaches:** independent and dependent variables, H₀ vs Hₐ, **between-subjects** vs
**within-subjects**, **order effects**, **counter-balancing**, **confounds**, and random vs
convenience assignment — the player builds an experiment by choosing a design, an order
control and an assignment method, then sees whether the result is valid or threatened.
In-game assessment = 6 conceptual MCQ → 0–100.

> Note for the study team: this is the one topic whose content is the study's own method.
> A participant scoring it is reasoning about the design they are inside. That is not a
> confound for the gain measure — both conditions sit inside the same design — but it is
> worth a line in the limitations section.

### Form A (pre)
**A1.** The variable the experimenter deliberately **manipulates** is called the…
 a) ✓ Independent variable  b) Dependent variable  c) Confounding variable  d) Control variable

**A2.** Group 1 uses a touchscreen, Group 2 uses a mouse, and nobody uses both. What design is this?
 a) Within-subjects  b) ✓ Between-subjects  c) A case study  d) A longitudinal study

**A3.** In a study where everyone tries both interfaces, participants are faster on the second one simply because they have warmed up. What is this threat called?
 a) A confound in sampling  b) A ceiling effect  c) ✓ An order effect  d) Measurement error

**A4.** A **confound** is best defined as…
 a) A result that fails to reach significance  b) A participant who does not follow instructions  c) The difference between the two conditions being tested  d) ✓ An uncontrolled variable that varies along with the independent variable, so their effects cannot be told apart

**A5.** Which control is aimed at **unknown, unmeasured** differences between people, rather than at order?
 a) ✓ Random assignment to conditions  b) Counter-balancing  c) Increasing the number of trials  d) Using a within-subjects design

**A6.** *(Apply it.)* You can recruit only 12 participants and must compare two interfaces. Which design would you choose, and what must you add to keep it valid?
 a) Between-subjects, with six people per group and no further control  b) ✓ Within-subjects, so all 12 give data on both interfaces — with counter-balancing so practice and fatigue do not favour whichever came first  c) Within-subjects, with everyone doing interface A first for consistency  d) Between-subjects, assigning people to whichever group they prefer

*Answer key A: A1-a, A2-b, A3-c, A4-d, A5-a, A6-b*

### Form B (post)
**B1.** The outcome the experimenter **measures** is called the…
 a) Independent variable  b) Confounding variable  c) ✓ Dependent variable  d) Hypothesis

**B2.** Every participant tries both the voice interface and the touch interface, in some order. What design is this?
 a) Between-subjects  b) A survey  c) An observational study  d) ✓ Within-subjects

**B3.** In a study where everyone completes both conditions, participants are slower on the second one because they are tired by then. What is this an example of?
 a) ✓ An order effect  b) A sampling bias  c) A floor effect  d) An invalid dependent variable

**B4.** Which pair of hypotheses is stated correctly?
 a) H₀ predicts an effect; Hₐ predicts no effect  b) ✓ H₀ predicts no difference; Hₐ predicts there is one  c) Both predict a difference of a stated size  d) H₀ names the independent variable; Hₐ names the dependent one

**B5.** Which control is aimed specifically at **order effects** rather than at unknown group differences?
 a) Random assignment  b) Increasing the sample size  c) ✓ Counter-balancing the order across participants  d) Using a between-subjects design with volunteers

**B6.** *(Apply it.)* A team compares a new dashboard against the old one by giving the new one to the analytics department and the old one to the sales department. What is wrong, and what is the minimum fix?
 a) Nothing is wrong — the groups are the same size  b) The dependent variable is measured in seconds; use clicks instead  c) The study needs a third condition before it can be analysed  d) ✓ Department tracks the condition, so data skill is confounded with the interface — assign people to the two interfaces at random across both departments

*Answer key B: B1-c, B2-d, B3-a, B4-b, B5-c, B6-d*

---

## Administration & analysis notes

- **6 items × 2 forms × 13 topics = 156 items.** Under Stage 2 a student never sits all of them at once: each topic is its own unit, so the burden is **6 items (~90 s) before the game and 6 after**. *(Item 6 of every form is the application/transfer item; in topics 5-13 it is Stroop convention-remap, Hick breadth-vs-depth, Fitts equal-ratio, Visual peripheral-acuity, Mental-model signifier-fix, Norman two-gulf design, Language constrain-the-grammar, Ergonomics bench-height, Experiment-design confound-fix.)*
- ~~**Counterbalance** topic↔condition across participants (Latin square): each student does 4 topics, **2 FLIP** and **2 CONTROL**.~~
  **SUPERSEDED 2026-08-16 (`docs/revamp.md` Part 0):** 13 topics, FLIP/CONTROL **randomised per topic
  per participant** (~half each), counterbalanced across the cohort and assigned server-side. The
  principle is unchanged — each topic must appear in both conditions across the sample — only the
  mechanism and the topic count differ.
- **Re-word the Weber's Law and Gestalt banks before any pilot** (`revamp.md` §9.2). The lectures teach
  these as **"just noticeable difference"** and **"pattern recognition / similarity / proximity /
  surroundedness"**; the words "Weber" and "Gestalt" appear in **zero** chunks of the lecture corpus.
  Items using only the textbook name measure textbook familiarity, and a pre→post gain would partly
  reflect students learning the *word* from COMPGame.
- **Per-topic normalized gain** `g = (B% − A%)/(100 − A%)`; compare FLIP vs CONTROL topics within-subject (Wilcoxon signed-rank / paired-t).
- **Report item difficulty (P) and discrimination (D)** on your sample; drop items with D < 0.2 before final analysis.
- **Validity caveats:** items are content-aligned to the current game code but **not yet piloted** — run a small pilot (n ≈ 5) to catch ambiguous wording and check the A/B forms are equally difficult before the main study.
- **Burden:** *(Stage 1)* 4 topics pushed the full session to ~90–100 min, resolved via the **two-session protocol** in `experiment-design.md` §1. *(Stage 2)* the instrument is spread across 13 separate units over a teaching semester, so the two-session protocol no longer applies — the per-sitting burden is one topic's 6 + 6 items.

---

## Desk review (self-pilot) — completed

A desk review of all items was run before any human pilot (originally 40; the instrument was later upgraded to **48** — a 6th item per form. The eight new item-6s were desk-reviewed again on **2026-06-28**; see the addendum below.). Checks and outcomes:

| Check | Outcome |
|-------|---------|
| **Content validity** — every item maps to content the game actually teaches | ✅ after fix. **1 bug fixed:** Weber A5 originally used an *auditory* example; the game teaches only size/brightness/count, so it was rewritten to the size domain. |
| **Isomorphism** — each A↔B pair tests the same concept, different surface | ✅ all 24 pairs (Weber ratio/formula/fraction/UI/scaling/**design-ratio**; Problem-Solving 3 strategies + problem-space + representation + **operators**; Gestalt 5 principles + **proximity-apply**; Miller capacity/chunking/STM-LTM/grouping/wizard + **STM-duration**). |
| **Answer-leakage** vs the in-game assessment | ✅ Form A avoids the assessment's exact scenarios (no water-jug, notifications, caching-bug, credit-card, or breadcrumb items). |
| **Distractor plausibility** — wrong options are non-trivial | ✅ distractors are real competing concepts, not filler. |
| **Answer-key correctness** | ✅ re-checked against game explanations. |

**Known limitations carried into the human pilot:**
1. **Gestalt construct is narrow** — it is a 5-way "name the principle" classification, so Form A/B and the in-game assessment overlap heavily and items may be *too easy* (low discrimination). Consider adding 1–2 **application** items ("which principle would you *use* to group related form fields?") to add depth. **→ ADDRESSED (2026-06-28):** item 6 is now an application/transfer item on every topic; Gestalt A6/B6 are proximity-*apply* scenarios (settings-screen / nav-menu). They were reworded to (a) drop the spatial-mechanism giveaway ("with clear space" / "by spacing close together" named the answer) and (b) stop duplicating A1's form-fields surface — ruling out colour/borders forces a genuine Proximity-vs-Similarity choice. Re-desk-reviewed; still **not human-piloted** — carry into the n≈5 pilot for P/D.
2. **Some pre-test priming** of the in-game assessment is unavoidable for narrow constructs (Gestalt, Miller capacity). This is **controlled** — it affects all conditions equally — but note it.
3. **Capacity items (Miller A1/B1)** are near-identical recall ("7±2") and may show a ceiling. Keep, but expect low discrimination.

## Desk review addendum — the nine banks added 2026-08-30

Topics 5-13 (`stroop`, `hicks-law`, `fitts-law`, `visual-perception`, `mental-model`,
`norman`, `language`, `ergonomics`, `experiment-design`) were authored in one pass so that
every topic the schedule releases has a pre/post instrument. Same checks as the original
desk review, plus one the original did not run.

| Check | Outcome |
|-------|---------|
| **Content validity** — items map to what the game actually teaches | ✅ Each bank was written from the game's own source: the `const` question/scenario arrays in `app/games/<topic>-*/game-client.tsx` and the per-game `principle` / `formula` / `examTip` entries in `components/game-debrief.tsx`, which is the text a student sees after playing. No item rests on textbook knowledge the games never present. |
| **Answer-leakage** vs the in-game assessment | ✅ Every in-game MCQ was read first and its scenarios avoided. Nine topics' assessments were checked item by item; where a concept has only one natural application (Norman's gulfs, redundant colour coding) the *surface* differs — see the known limitations below. |
| **Isomorphism** — each A↔B pair tests one concept on a different surface | ✅ 54 pairs. Where the original banks flip the interrogated half between forms (Weber A2 asks ΔI, B2 asks k), these do the same: Fitts A2/B2 ask W then A; Norman A5/B5 ask the interpret side then the perceive side. |
| **Distractor plausibility** | ✅ Distractors are competing concepts from the same course (Fitts vs Hick, affordance vs signifier, perceive vs interpret, order effects vs confounds), not filler. |
| **Answer-key correctness** | ✅ Machine-checked, not eyeballed: `test_checks.py` now parses every ✓ and compares it against the printed `*Answer key*` line for all 156 items. The parser previously checked only the item *count* against that line, so a ✓ on the wrong option would have parsed cleanly and mis-scored every submission indefinitely. |
| **Correct-option distribution** — NEW CHECK | ⚠️ **fixed.** As first authored, 78 of 156 correct answers sat on (b) and 60 on (c). A student answering (b) to everything would have scored **50%** on an instrument whose nominal chance level is 25% — inflating every pre-test and depressing every normalized gain. Topics 5-13 were re-lettered to spread the key across a-d (Form A targets a,b,c,d,a,b; Form B c,d,a,b,c,d), which also means no A↔B pair shares a letter. `test_checks.py` now fails if any single letter carries more than 40% of items. |

**Topics 1-4 were deliberately NOT re-lettered.** The Stage-1 focus group already sat them on
paper and in Google Forms; silently changing their option order would break comparability with
data already collected. Their residual skew (26 of 48 on (b)) is the reason the guard threshold
is 40% rather than 30%, and it should be corrected the next time those four are revised — at
which point the threshold can come down.

**Known limitations carried into the human pilot:**
1. **`norman` and `hicks-law` have zero lecture-corpus coverage.** `check_corpus_coverage.py`
   finds nothing for either under any naming, because the vector store is built from the 2023
   decks. Their games were authored from general HCI knowledge, not from a COMP3423 slide. By
   Wilson's decision (2026-08-30) they are kept as **extra topics**: their ⟨g⟩ is not pooled
   with the rest as H1 evidence. The banks exist so the units are complete and measured, not so
   the numbers join the primary analysis.
2. **Norman items name the stages instead of numbering them.** The game labels them "Stage 1"
   … "Stage 7"; that numbering is the game's presentation convention and appears in no lecture
   deck, so an item turning on "which stage is 5?" would measure familiarity with the game's
   labelling rather than the concept. Same reasoning as the Weber/Gestalt naming caveat above.
3. **Narrow-construct overlap is unavoidable on three topics.** `visual-perception` (rods/cones,
   the 8% figure), `mental-model` (affordance vs signifier) and `experiment-design` (IV/DV) each
   have a small fixed vocabulary that the in-game assessment also tests. Surfaces differ, but the
   priming is real. It is **controlled** — it applies equally in both arms — and it should be
   noted, not designed away.
4. **`experiment-design` is the study's own method.** A participant answering it is reasoning
   about the design they are inside. Not a confound for the gain measure (both arms sit in the
   same design) but it belongs in the limitations section of the paper.
5. **Not human-piloted.** Like topics 1-4, these are desk-reviewed only. Run the n ≈ 5 protocol
   above and report P and D per item before the banks are locked.

## Human pilot protocol (ready to run — closes gap #1)

Run with **n ≈ 5** non-participants before the main study:
1. Administer Form A then Form B for all 4 topics (no games — just the items).
2. Record per item: **% correct (difficulty P)** and time-to-answer; collect a "was anything confusing?" free-text note per topic.
3. **Flag for revision:** any item with P < 0.20 (too hard) or P > 0.95 (too easy/ceiling), discrimination D < 0.20, or ≥ 2 pilots marking it confusing.
4. **Check A/B equivalence:** the two forms should have similar mean difficulty per topic — if Form A and Form B differ by > ~15 percentage points on a topic, rebalance that pair.
5. Revise flagged items, then lock the banks for the main study.
