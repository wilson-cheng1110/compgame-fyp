# Retention Item Bank — Form C (13 Topics)

> **STATUS: DRAFT, for researcher review only.** Not desk-reviewed against the
> `quiz-item-banks.md` checklist, not human-piloted, not wired into `backend/checks.py` or any
> live route. This file is a **standalone companion** to `docs/quiz-item-banks.md` — it does not
> modify that file, `backend/checks.py`, or `topic_schedule.json`, and nothing about the live
> pre/post-check path changes by this file existing. Zero risk to the running study.
>
> **Why a third form.** Stage 2 already runs Form A (pre-test, before the Understanding game) and
> Form B (post-test, after the Assessment game) per topic, scored as Hake normalized gain. An
> end-of-study **retention** test — re-testing a topic weeks after its unit closed — cannot reuse
> A or B: a student who scores well on Form B a second time may just remember *that item*, not the
> concept. **Form C** is a third form testing the same concepts with the same number of options as
> the corresponding A/B item, on fresh scenarios / wording / numbers, so recall of the exact A/B
> item cannot answer it. It was **originally** authored in the same difficulty band as A/B; a
> **2026-09-26 hardening pass** (note below) then deliberately raised the difficulty of the ceiling
> topics, so Form C is **no longer difficulty-isomorphic** to A/B on those topics — score them as a
> standalone retention `C%`, not as `C% − B%` (see analysis notes).
>
> **Structure mirrors `quiz-item-banks.md` exactly** — same 13 topics, same order, same per-topic
> layout. Gestalt keeps its **shared 5-option list** with the inline `stem → ✓ **x) Option**`
> format (Layout 2 in `backend/checks.py`); every other topic keeps the **per-item 4-option**
> layout with `✓` marking the correct option inline (Layout 1). Item **N** in Form C targets the
> same concept as item **N** in Forms A/B, **except** in `experiment-design`, where the source
> bank's own A4/B4 and A6/B6 are not concept-parallel to each other — see the per-topic note and
> the report at the end of this authoring pass for how Form C resolved that.
>
> **Parsing.** The `✓` marker, option lettering, and `*Answer key C: ...*` line are written in the
> exact syntax `backend/checks.py` already parses for Forms A/B (`_ITEM_RE`, `_OPT_RE`,
> `_parse_options`), so the same machinery could load Form C later with a small, deliberate
> extension (widening the `[AB]` character classes in `_ITEM_RE`/`_FORM_RE` to `[ABC]`) —
> **not done here, by design**, to keep the live pre/post path untouched.
> `scripts/validate_retention_bank.py` checks this file's syntax independently, importing
> `backend/checks.py`'s own `_parse_options` rather than re-implementing option parsing.
>
> **Correct-letter distribution.** Every 4-option topic below uses the rotation
> **a, b, c, d, a, b** across its six items (item 1's correct answer is (a), item 2's is (b), …),
> matching the anti-skew principle `quiz-item-banks.md`'s own addendum applies to topics 5-13
> (no letter should carry the correct answer more than ~40% of the time). Gestalt's letters follow
> its fixed 5-option vocabulary, so they land wherever the tested principle's own letter is — the
> same as Forms A/B.
>
> **Scoring (proposed only, not decided).** Retention gain relative to the original post-test,
> `r = C% − B%`, or `C%` alone as a standalone retention score, at whatever delay Wilson sets
> between a topic's Form B and the end-of-study session. This file supplies items only — it does
> not decide the delay, the administration protocol, or whether retention pools across FLIP/CONTROL
> the same way ⟨g⟩ does.
>
> **These items are a first-pass draft.** They were authored in one pass against the corresponding
> A/B items (which were themselves sourced from the games' own `game-client.tsx` question arrays
> and `game-debrief.tsx` principle text — see `quiz-item-banks.md`'s desk-review notes). Form C has
> **not** independently repeated that desk review (content validity / answer-leakage /
> distractor-plausibility / answer-key-correctness / correct-option-distribution checks), and has
> **not** been piloted. Treat every item as provisional until Wilson reviews it.
>
> ---
>
> **2026-09-26 difficulty-hardening pass.** A model-as-student difficulty probe (4 local LLMs ×
> OFF / deliberation / RAG arms over all 80 items; `scripts/probe_retention_difficulty*.py`) found
> the strong models scoring 94–96% overall — Form C was **ceiling'd** for a capable test-taker, the
> same failure the immediate MC post-test has. To give the delayed-retention DV real variance,
> **13 pure-recall items across the 9 ceiling topics** (`webers-law`, `problem-solving`, `memory`,
> `stroop`, `visual-perception`, `mental-model`, `language`, `ergonomics`, `experiment-design`)
> were rewritten from definitional recall into **application / discrimination** items — same
> concept, same option count, **same correct-letter position** (so the `Answer key C` lines are
> unchanged), **same item count** (difficulty, not length — length drives attrition on an
> unproctored delayed battery). The already-discriminating topics (`fitts-law`, `gestalt`,
> `norman`, `hicks-law`) were left untouched. Each rewritten item keeps a single defensible key
> with plausible near-miss distractors. **Still needs Wilson's human desk-review before the
> November window** — this pass raises difficulty; it does not substitute for content validation.

## 1. Weber's Law (`webers-law`)

*(Full game description: `quiz-item-banks.md` §1. The in-game assessment is a perceptual
spot-the-odd-one task, not a knowledge test — Form C, like Forms A/B, measures conceptual
retention of `ΔI/I = k`, not perceptual discrimination.)*

### Form C (retention)
**C1.** Turning a room's light up by one small notch is obvious in a dim room at night but goes unnoticed in a room already lit by midday sun. Why?
 a) ✓ The detectable difference depends on the *ratio* of change to the original brightness, not the absolute change  b) Bright light damages the eye's sensors  c) People go briefly blind at midday  d) The light bulb's colour temperature shifted

**C2.** A weight of 100 g must be increased by at least 2 g before the change can be felt. What is this observer's Weber fraction *k* for weight?
 a) 2 — the number of grams that had to be added  b) ✓ About 0.02 — the just-noticeable change divided by the baseline (2 ÷ 100)  c) 50 — the baseline divided by the change  d) 100 g — the baseline weight itself

**C3.** If the Weber fraction for count is about **14%**, a change in the number of items in a group is reliably noticed only when it is at least…
 a) 2% of the original count  b) 50% of the original count  c) ✓ ~14% of the original count  d) Any change in count at all

**C4.** A battery indicator's fill level moves from **60% to 61%**. Why do users barely notice?
 a) Battery indicators don't refresh in real time  b) 61% renders visually indistinguishable from 60% on the icon  c) The indicator's colour is misleading  d) ✓ The 1% change is far below the JND — the ratio is too small to perceive

**C5.** An observer's Weber fraction for brightness is **0.10** (a 10% change is the smallest noticeable one). A lamp at **50** units is raised to **56**; another at **200** units is raised to **210**. Which change is noticed?
 a) ✓ Only 50→56, because +6 on 50 is 12% (above the 10% threshold) while +10 on 200 is only 5%  b) Only 200→210, because +10 is the larger absolute increase  c) Both, because each brightness value increased  d) Neither, because both increases are too small to matter in practice

**C6.** *(Apply it.)* You are designing a map **zoom** control. For each zoom step to *feel* like an equal jump in scale, each step should multiply the current zoom level by…
 a) a fixed number of percentage points, the same at every zoom level  b) ✓ a roughly constant *factor* (percentage) of the current zoom level  c) a bigger multiplier when zoomed out and a smaller one when zoomed in  d) a random amount, since zoom perception is unpredictable

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 2. Problem Solving (`problem-solving`)

*(Full game description: `quiz-item-banks.md` §2.)*

### Form C (retention)
**C1.** A hiker, at every fork in the trail, picks the path that most reduces the remaining distance to the summit. This strategy is…
 a) ✓ Means-end analysis  b) Working backwards  c) Analogical reasoning  d) Trial and error

**C2.** A student plans a thesis by starting from the final submission date and repeatedly asking "what has to be finished just before this?", stepping back until she reaches today. Which strategy is this, and how does it differ from means–end analysis?
 a) Means–end analysis, because she keeps reducing the distance to her goal  b) ✓ Working backwards — she reasons from the goal state toward the start, whereas means–end analysis works forward, repeatedly shrinking the gap between the current state and the goal  c) Hill climbing, because every step improves her position  d) Trial and error, because she may revise the plan later

**C3.** A chef facing an unfamiliar dish recalls a similar recipe she has cooked before and adapts its technique. This is…
 a) Means-end analysis  b) Working backwards  c) ✓ Analogical reasoning  d) Random restart

**C4.** A navigation app plans a route. The user's current location, the chosen destination, and the set of "take this road" moves correspond — in that order — to which problem-space elements?
 a) Goal state, initial state, operators  b) Initial state, operators, goal state  c) Operators, initial state, goal state  d) ✓ Initial state, goal state, operators

**C5.** Sudoku becomes far easier once you track which numbers are still missing from each row, column and box, instead of scanning cell by cell. Why does this help?
 a) ✓ A better representation exposes useful sub-goals and shrinks the search space  b) It's faster to write down  c) It guarantees the fewest possible moves  d) Representation never actually affects difficulty

**C6.** *(Apply it.)* In the Tower of Hanoi puzzle, "move the top disc from peg A to peg B" (following the size rule) is an example of the puzzle's…
 a) goal state  b) ✓ operators — the available actions that move you from one state to another  c) constraints  d) heuristics

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 3. Gestalt Principles (`gestalt`)

*(Full game description: `quiz-item-banks.md` §3. Same narrow-construct caveat applies to Form C
as to Forms A/B: 5-way "name the principle" classification, may be an easy ceiling.)*

**Options for every item below:** a) Similarity  b) Proximity  c) Continuity  d) Symmetry  e) Closure

### Form C (retention)
**C1.** In a contact list, each person's phone number is printed directly beneath their name, with a noticeably larger gap before the next entry begins. → ✓ **b) Proximity**
**C2.** In a toolbar, every destructive action (delete, remove, discard) is drawn as a red icon, while every safe action uses grey. → ✓ **a) Similarity**
**C3.** A loading indicator drawn as a ring of separated dots is still perceived as one complete circle. → ✓ **e) Closure**
**C4.** A gently S-curved progress trail in a game is read as one smooth path even where a tooltip box overlaps and hides part of it. → ✓ **c) Continuity**
**C5.** An icon with identical left and right wings, mirrored around a centre line, is perceived as one balanced shape. → ✓ **d) Symmetry**

**C6.** *(Apply it.)* You are designing a filter panel with many checkboxes. Without using colour or borders, you want users to instantly see which checkboxes belong to the same filter category. Which principle would you rely on? → ✓ **b) Proximity**

*Answer key C: C1-b, C2-a, C3-e, C4-c, C5-d, C6-b*

---

## 4. Miller's Law (`memory`)

*(Full game description: `quiz-item-banks.md` §4.)*

### Form C (retention)
**C1.** A designer invokes "Miller's 7 ± 2" to insist a navigation bar must never show more than 7 links. Why is this a misapplication of the law?
 a) ✓ 7 ± 2 describes how many items short-term memory can hold and recall at once, not a limit on how many always-visible choices a user can simply scan  b) The real capacity limit is 5 ± 2, so 7 links is already too many  c) Miller's number applies only to digits, never to words or links  d) A navigation bar relies on long-term memory, where the 7 ± 2 limit does not apply

**C2.** A card number shown as **4532 1198 7734 0021** rather than **4532119877340021** is easier to remember because of…
 a) Symmetry  b) ✓ Chunking (16 digits → 4 chunks)  c) Weber's Law  d) Sensory memory

**C3.** Which statement correctly contrasts short-term and long-term memory?
 a) STM is permanent; LTM is brief  b) Both hold about 7±2 items  c) ✓ STM holds a handful of items briefly (seconds); LTM stores knowledge with vast capacity, effectively permanently  d) LTM is always faster to retrieve than STM

**C4.** A dashboard shows **18 separate metrics** and users feel overwhelmed. Which redesign best applies Miller's Law, rather than just looking neater?
 a) Shrink the font so all 18 fit on screen without scrolling  b) Sort the 18 metrics alphabetically  c) Give each of the 18 metrics a different colour but keep one flat list  d) ✓ Group the 18 metrics into about 4–5 labelled clusters, so users hold a few chunks instead of 18 separate items

**C5.** A checkout form has **10 ungrouped fields** on one screen. Why would splitting them into 3 labelled sections of 3–4 fields each reduce perceived complexity?
 a) ✓ Each labelled section becomes a single chunk, lowering how many items STM must track at once  b) It uses less vertical screen space  c) Fewer fields means less data is collected  d) It hides fields the user doesn't need

**C6.** If you hear a departure gate number announced once and don't repeat it to yourself, you can usually recall it correctly a few seconds later but have often forgotten it within about half a minute. This reflects the limited ___ of short-term memory.
 a) capacity  b) ✓ duration (roughly 15–30 seconds)  c) accuracy  d) bandwidth

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 5. Principle of Consistency / Stroop (`stroop`)

*(Full game description: `quiz-item-banks.md` §5. In-game Stroop rounds are a perceptual
interference measure, like Weber's — Form C is the conceptual/knowledge half.)*

### Form C (retention)
**C1.** A voice says "left" at the same moment an arrow on screen points right, and users respond to the arrow's actual direction more slowly than when voice and arrow agree. Why?
 a) ✓ Processing the spoken word is automatic and interferes with the response the task actually requires  b) The arrow is rendered too small to see quickly  c) Audio and visual signals cannot be processed in the same trial  d) "Left" and "right" are opposite ends of a scale

**C2.** A stove has four burners arranged in a square but four control knobs set out in a straight row, and users keep turning the wrong knob. In terms of stimulus–response compatibility, what is the problem?
 a) The knobs and the burners were made by different manufacturers  b) ✓ The spatial arrangement of the knobs doesn't map onto the arrangement of the burners, so the control–effect correspondence users expect is broken  c) There are too many burners for the user to hold in memory  d) The knobs give no click or haptic feedback when they are turned

**C3.** A racing game swaps the accelerator and brake pedal mapping for a single bonus level. What does research on stimulus–response compatibility predict for experienced drivers?
 a) No change — they consciously know the new rule  b) Faster responses, because novelty raises alertness  c) ✓ Slower responses and more errors, because the automatic learned mapping must be suppressed on every input  d) Errors only on the very first input, then normal performance

**C4.** A note-taking app uses its own custom swipe gestures consistently on every one of its screens, but none of its icons resemble those in any other app its users know. What does it have, and what is it missing?
 a) It lacks both internal and external consistency  b) It has external consistency but lacks internal consistency  c) It has both  d) ✓ It has internal consistency but lacks external consistency

**C5.** Two groups of nurses use a monitor with reversed alarm colours (critical = blue, normal = orange): one group works a calm shift, the other an emergency surge. What is expected?
 a) ✓ The surge group makes more errors, because haste favours the automatic response the interface contradicts  b) Both groups perform identically, since the colours are the same for everyone  c) The surge group is more accurate, from concentrating harder under pressure  d) The calm group makes more errors, from being less alert

**C6.** *(Apply it.)* A factory control panel uses green for "stop" and red for "go", unlike every other machine in the plant, and operators keep hesitating. The vendor proposes adding a loud beep to the green button instead of changing its colour. Why is that the weaker fix?
 a) Beeps are not audible over factory noise  b) ✓ It leaves the conflicting colour mapping in place, so operators must still override a learned response under exactly the conditions where they're most likely to slip  c) Beeps are reserved for machine faults by convention  d) Adding sound requires new wiring

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 6. Hick's Law (`hicks-law`)

*(Full game description: `quiz-item-banks.md` §6. Extra topic — zero lecture-corpus coverage,
reported separately from H1 evidence per Wilson's 2026-08-30 decision; that applies to Form C too.)*

### Form C (retention)
**C1.** In `RT = a + b × log₂(n + 1)`, what does the coefficient **b** broadly capture?
 a) ✓ How much reaction time increases per added unit of choice complexity — the sensitivity of RT to the number of options  b) The number of options on offer  c) The user's baseline reaction time with no choice at all  d) The accuracy of the response

**C2.** Which adds more decision time: going from 4 options to 8, or from 32 options to 36?
 a) 32→36, because a longer menu is being shortened from  b) ✓ 4→8, because the logarithm means each extra option costs less than the one before it  c) They add exactly the same amount  d) Neither — decision time doesn't depend on the number of options

**C3.** A user scans a toolbar, decides which tool to use, then drags the cursor to click it. Which law accounts for which stage?
 a) Fitts' Law covers the decision; Hick's Law covers the drag  b) Hick's Law covers both stages  c) ✓ Hick's Law covers deciding among the tools; Fitts' Law covers the movement to the chosen one  d) Neither law applies once a drag is involved

**C4.** An aircraft's fire-suppression panel has only two buttons, while its non-critical panels have ten. What is the primary reason for the difference?
 a) Two buttons are cheaper to certify  b) Large buttons are easier to see in smoke  c) Pilots dislike complicated panels  d) ✓ Decision time rises with the number of alternatives, and a delay is the cost being avoided in an emergency

**C5.** A radial menu is cut from **20** items to **10**. Roughly how much of the decision-time component does that remove?
 a) ✓ About a fifth of it, because the term is log₂(n + 1) rather than n  b) About half of it  c) About three quarters of it  d) None — only movement time changes

**C6.** *(Apply it.)* A flat menu of **20** commands is reorganised into **4** groups of **5**, so the user makes two decisions instead of one. What does Hick's Law alone predict for total decision time?
 a) Faster, because each menu the user faces is shorter  b) ✓ Slower overall — log₂(5) + log₂(6) ≈ 4.9 bits against log₂(21) ≈ 4.4 bits for the flat menu  c) Identical, because the same 20 commands are reachable either way  d) Hick's Law says nothing about nested menus

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 7. Fitts' Law (`fitts-law`)

*(Full game description: `quiz-item-banks.md` §7. In-game assessment measures movement time,
not knowledge — Form C is the conceptual half.)*

### Form C (retention)
**C1.** Fitts' Law predicts how long it takes to drag a slider handle to a target position on it. Which two properties of that movement does it use?
 a) ✓ How far the handle must travel and how wide the target zone is  b) The colour of the slider track and the handle's shape  c) How many sliders are on screen and how bright they are  d) The user's age and the input device

**C2.** In `MT = a + b × log₂(A/W + 0.5)`, what does the constant **a** broadly represent?
 a) The width of the target  b) ✓ A baseline movement-time component that doesn't depend on how difficult the movement is  c) The amplitude of the movement  d) The user's error rate

**C3.** Two icons sit the same distance from the pointer. One is 40 px wide, the other 160 px. Which has the higher index of difficulty?
 a) They are equal, because the distance is the same  b) The 160 px icon, because it covers more area  c) ✓ The 40 px icon, because a smaller W makes the ratio A/W larger  d) Neither — ID depends only on distance

**C4.** A usability report gives a target's index of difficulty as **1.8**. One point eight *what*?
 a) Milliseconds  b) Centimetres  c) Pixels  d) ✓ Bits

**C5.** Making a target three times farther away does **not** triple the pointing time. Why not?
 a) ✓ Distance enters through a logarithm, so tripling it adds a roughly fixed increment rather than tripling the total  b) The hand accelerates to compensate exactly  c) Movement time doesn't depend on distance at all  d) The extra distance is offset by the target getting wider

**C6.** *(Apply it.)* A designer can either make a checkbox target **3× larger**, or move it so the cursor travels **a third as far**. Using `ID = log₂(A/W + 0.5)`, which helps more?
 a) Making it larger, because size matters more than distance  b) ✓ Neither — both change A/W by the same factor, so the index of difficulty falls by the same amount  c) Moving it closer, because travel dominates the movement  d) Neither has any effect, because ID depends on the pointing device

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 8. Visual Perception (`visual-perception`)

*(Full game description: `quiz-item-banks.md` §8.)*

### Form C (retention)
**C1.** A night-shift guard needs an on-screen alert they will catch in peripheral vision without looking straight at it. Which design best fits how the dark-adapted, rod-rich periphery works?
 a) ✓ A flashing, high-contrast moving shape — peripheral rod vision is sensitive to motion and contrast in low light but poor at colour and fine detail  b) A small block of red text, because red stays the most visible colour in the dark  c) A finely detailed icon, because the periphery resolves detail as sharply as the fovea  d) A slow fade between two pastel colours, because the periphery tracks colour best

**C2.** A stock ticker shows gains in green text and losses in red text, with no icon or +/- sign anywhere. What accessibility problem does this create?
 a) Green and red text render at different sizes  b) ✓ About 8% of males have red–green colour deficiency and cannot reliably tell gains from losses when colour is the only cue  c) Ticker text updates too quickly to read  d) There is no problem — the colours follow convention

**C3.** Staring at a colour-inverted (negative) photo for 30 seconds, then looking at a plain grey wall, briefly makes the wall look like the photo's normal colours. What does this show?
 a) The eye retains a literal copy of the image  b) The grey wall reflects the missing wavelengths  c) ✓ Vision is constructed from contrast and opponent colour channels, not recorded like a photograph  d) Photo negatives contain hidden colour information

**C4.** Nearby trees streak past a train window while distant hills barely move. A designer wants to mimic this depth on a flat 2-D web page. What should they do, and why does it read as depth even on one screen viewed with a single eye?
 a) Render near objects larger than far ones; it works because size is a binocular cue  b) Blur the distant layer; it works because focus blur needs stereo vision  c) Add drop shadows to each layer; it works because shadows are a motion cue  d) ✓ Scroll near layers faster than far layers; it works because motion parallax is a monocular depth cue — relative motion alone signals depth, needing only one eye

**C5.** Eye-tracking during reading shows the eye does not glide smoothly along a line of text. What pattern does it actually show, and when is meaning extracted?
 a) ✓ The eye jumps (saccades) and pauses (fixations); meaning is extracted during the pauses  b) The eye moves at constant speed and extracts meaning continuously  c) The eye takes in a whole paragraph in one glance  d) The eye reads each line backwards then forwards

**C6.** *(Apply it.)* A racing game displays the current lap time in tiny text at the extreme corner of the screen, while the player's eyes stay fixed on the track ahead. What does the structure of the retina predict?
 a) The lap time will be read accurately without a glance, since peripheral vision handles text well  b) ✓ Its detail can't be read without turning the eyes toward it, though a large change or motion there might draw attention  c) It will be invisible, since the periphery detects nothing at all  d) It will be noticed sooner there, since the periphery is more sensitive to detail

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 9. Mental Models & Affordances (`mental-model`)

*(Full game description: `quiz-item-banks.md` §9.)*

### Form C (retention)
**C1.** A door has a flat metal push-plate and no handle. In Norman's later terms (affordance vs signifier), which statement is correct?
 a) ✓ The door affords pushing and the plate signifies "push" — good design aligns the signifier with the real affordance  b) The plate is the affordance and the pushing is the signifier  c) The plate is neither an affordance nor a signifier, just decoration  d) "Affordance" and "signifier" mean the same thing in this case

**C2.** Which of these is a **signifier**?
 a) The fact that a file can be dropped onto a folder icon  b) ✓ A dashed outline that appears around a folder icon to show a dragged file can be released there  c) The database field that records where a file is stored  d) The fact that a folder can hold many files

**C3.** Two drivers describe a car's cruise control differently — one believes it brakes automatically for a car ahead, the other believes it only holds a set speed and never brakes. These are their different…
 a) Affordances  b) Signifiers  c) ✓ Mental models — internal accounts used to predict what the system will do  d) Usability heuristics

**C4.** A pair of scissors has two differently-shaped finger holes, so it can only be gripped comfortably one way round. What is being done well?
 a) Nothing — scissors should be ambidextrous  b) The holes afford the same grip either way, so no error is possible  c) The design relies on the user's memory instead of a physical cue  d) ✓ The hole shapes act as signifiers that match the grip the scissors actually afford

**C5.** After a software update, most users still try to close a dialog by clicking outside it — which used to work — but it no longer does, and nearly everyone gets stuck the same way. What does this pattern suggest?
 a) ✓ A shared mental model that the new design contradicts, so users predict the same wrong outcome  b) A rendering bug affecting only some users  c) A random distribution of user skill  d) That the sample of users was too small to interpret

**C6.** *(Apply it.)* A spreadsheet lets users resize a column by dragging its right edge, but nothing on screen shows this is possible — only a few power users have found it by accident. Which change adds a signifier without changing what the column already affords?
 a) Make columns impossible to resize, to remove the confusion  b) ✓ Show a cursor change and a subtle drag-handle cue on hover, so the existing capability becomes perceivable  c) Move column resizing into a settings menu instead  d) Add a tutorial video on first launch

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 10. Norman's Action Cycle (`norman`)

*(Full game description: `quiz-item-banks.md` §10. Extra topic — zero lecture-corpus coverage,
reported separately from H1 evidence. Same wording caveat as A/B: items name the stages, never
number them, since the numbering is the game's own presentation convention, not lecture content.)*

### Form C (retention)
**C1.** A user wants to mute a video call but there is no visible mute button anywhere in the interface — only a hidden keyboard shortcut nobody told them about. Which gulf is wide here?
 a) ✓ The Gulf of Execution  b) The Gulf of Evaluation  c) Both, equally  d) Neither — this is a goal-formation problem

**C2.** A user presses "Save" on a document and the screen looks exactly the same as before — no confirmation, spinner, or error of any kind. Which gulf is wide here?
 a) The Gulf of Execution  b) ✓ The Gulf of Evaluation  c) Both, equally  d) Neither — the save succeeded

**C3.** A user wants to duplicate a slide in a presentation app, but there is no menu item, shortcut, or right-click option anywhere that does it. Which gulf is wide?
 a) The Gulf of Evaluation  b) Both, equally  c) ✓ The Gulf of Execution  d) Neither — this is a goal-formation problem

**C4.** A dishwasher finishes its cycle silently, with no light, sound or display change, so the user opens the door unsure whether it's done. Which gulf is this, and what narrows it?
 a) Execution — add more wash settings  b) Execution — shorten the cycle  c) Evaluation — remove the display entirely  d) ✓ Evaluation — give perceptible feedback that the cycle has ended

**C5.** A router's status light blinks in different colours and patterns depending on the problem. The user can clearly see it blinking but has no idea what any pattern means. Which part of the evaluation side has failed?
 a) ✓ Interpreting the system's state  b) Perceiving the system's state  c) Specifying the action  d) Forming the goal

**C6.** *(Apply it.)* You are designing a "Submit assignment" feature for a student portal. Which pair of changes addresses one gulf each?
 a) Add a keyboard shortcut, and log the submission to a file only admins can see  b) ✓ Make the submit control clearly visible and labelled for the execution side, and show a confirmation receipt afterwards for the evaluation side  c) Make the button bigger, and make its font bolder  d) Hide the button until the due date, and submit silently in the background

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 11. Language & Ambiguity (`language`)

*(Full game description: `quiz-item-banks.md` §11.)*

### Form C (retention)
**C1.** A user says to a smart-home assistant, "It's freezing in here," meaning it to turn the heating up. Recognising that this works as a *request*, not just a statement about temperature, is a matter of which level of language?
 a) ✓ Pragmatics — meaning in context, including the speaker's intended effect  b) Syntax — the grammatical structure of the sentence  c) Semantics — the literal meaning of the words  d) Phonology — the pattern of speech sounds

**C2.** "Visiting relatives can be boring." The same words support two different structures — either the relatives who visit are boring, or the act of visiting them is. What kind of ambiguity is this?
 a) A spelling ambiguity  b) ✓ A syntactic (structural) ambiguity  c) A purely pragmatic ambiguity  d) No ambiguity — one reading is ungrammatical

**C3.** "Turn off the lamp near the window if it's broken." Working out what **it** refers to — the lamp or the window — is…
 a) Tokenisation  b) Part-of-speech tagging  c) ✓ Coreference (reference) resolution  d) Spell checking

**C4.** "Do you know what time it is?" is literally a question about someone's knowledge, but functions as a request to be told the time. Which level accounts for the difference?
 a) Syntax  b) Morphology  c) Phonetics  d) ✓ Pragmatics

**C5.** Why is an ambiguous instruction riskier for a robotic surgical assistant than for a text-to-speech reader?
 a) ✓ The surgical assistant must commit to one reading and physically act on it, so a wrong choice causes real harm; a reader can just voice back what's written  b) Surgical assistants process language at fewer levels  c) Speech recognition is always less accurate than text input  d) Readers have no ambiguity to resolve

**C6.** *(Apply it.)* A chatbot ordering system finds many orders are ambiguous ("the usual", "the same as last time"). Which change reduces ambiguity *at the source* rather than repairing it afterwards?
 a) Always guess the most common past order  b) ✓ Guide the input toward a small set of unambiguous phrasings (e.g. structured quick-reply options), so fewer ambiguous orders occur  c) Log the ambiguous orders for later review  d) Increase the chatbot's response speed

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 12. Ergonomics & I/O Devices (`ergonomics`)

*(Full game description: `quiz-item-banks.md` §12.)*

### Form C (retention)
**C1.** A team calls improving a warehouse app's *menu wording* a "physical ergonomics" fix. Why is that the wrong label?
 a) ✓ Physical ergonomics is about the fit between the body and physical demands — posture, force, movement — whereas menu wording is a cognitive / interface concern  b) Menu wording actually belongs to organisational ergonomics  c) Wording counts as physical ergonomics only when the text is enlarged  d) The distinction doesn't exist — all interface work is physical ergonomics

**C2.** Which wrist posture at a keyboard best avoids repetitive strain?
 a) Sustained flexion (bent down) past 30°  b) ✓ A neutral, roughly straight wrist  c) Sustained extension (bent up) past 45°  d) Sustained sideways (ulnar) deviation past 30°

**C3.** A test that touches the skin at two points simultaneously and asks whether it feels like one touch or two is measuring…
 a) How hard a surface must be pressed before it's felt  b) The delay between a touch and the sensation of it  c) ✓ The two-point threshold — the smallest separation still felt as two distinct touches  d) The number of fingers needed to operate a control

**C4.** Which body region would need the **widest** spacing between two vibration points before a user could feel them as separate touches?
 a) The fingertip  b) The palm  c) The forearm  d) ✓ The back or the calf

**C5.** A VR glove lets a user feel the rough surface of a virtual brick as they run a finger across it. Which feedback category is this, and why is it not simply "visual"?
 a) ✓ Textural (haptic) feedback — it conveys surface qualities through the skin's touch receptors, independently of what is drawn on screen  b) Visual feedback, because the brick is also shown on screen  c) Olfactory feedback, because fine texture involves smell  d) Auditory feedback, because rough surfaces make a scraping sound

**C6.** *(Apply it.)* A cashier stands at a checkout where the barcode scanner is mounted low, forcing them to bend their wrist upward (extension) past 45° hundreds of times a shift, and reports wrist pain. Which single change most directly reduces the risk, and why?
 a) Give them a louder scanner beep, so they check less often  b) ✓ Reposition the scanner so the wrist can stay closer to neutral, since sustained extension beyond ~45° repeated hundreds of times causes the strain  c) Shorten breaks between shifts  d) Provide a footrest, since the feet bear the load

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b*

---

## 13. HCI Experiment Design (`experiment-design`)

*(Full game description: `quiz-item-banks.md` §13. **Note for the human reviewer:** in the source
bank, item 4 tests different concepts between forms — A4 defines a *confound*, B4 checks the
H₀/Hₐ pair — and item 6 does too — A6 is a small-N design choice, B6 is a confound-diagnosis
scenario. Form C below follows **A4's and A6's** concepts (confound; small-N design choice), so
it is isomorphic to Form A on those two items but not to Form B. **RESOLVED (Wilson 2026-09-22):
add bonus items** — C7 (H₀/Hₐ) and C8 (confound-diagnosis) below cover the orphaned Form-B-side
concepts, so this topic uniquely has **8** Form C items (the other 12 topics keep 6).)*

### Form C (retention)
**C1.** Researchers vary checkout-button colour (blue vs green), measure how many purchases complete, and keep the page layout identical for both groups. Which is the **independent variable**?
 a) ✓ Button colour — the factor the researchers deliberately manipulate between conditions  b) Completed purchases — the outcome being measured  c) Page layout — deliberately held constant across the conditions  d) The number of participants in each group

**C2.** Every participant tries both a keyboard-shortcut method and a mouse-click method for the same task, in some order. What design is this?
 a) Between-subjects  b) ✓ Within-subjects  c) A case study  d) A longitudinal study

**C3.** In a taste test, participants rate the second sample as more pleasant simply because their palate has adjusted after the first sample. What is this an example of?
 a) A confound in sampling  b) A ceiling effect  c) ✓ An order effect  d) Measurement error

**C4.** A **confound** is best understood as…
 a) A participant who drops out before the study ends  b) A result that just misses statistical significance  c) The planned difference between the two conditions being compared  d) ✓ An uncontrolled variable that varies along with the independent variable, so their effects can't be separated

**C5.** A researcher worries that some participants are simply more tech-savvy than others, quite apart from which interface they're given. Which control most directly addresses this?
 a) ✓ Random assignment to conditions  b) Counter-balancing the order of conditions  c) Running more trials per participant  d) Switching to a within-subjects design

**C6.** *(Apply it.)* A team has only 10 participants available and needs to compare two voice-assistant wake phrases. Which design would you choose, and what must you add to keep it valid?
 a) Between-subjects, five people per phrase, no further control  b) ✓ Within-subjects, so all 10 give data on both phrases — with counter-balancing so practice and fatigue don't favour whichever phrase came first  c) Within-subjects, with everyone trying phrase A first for consistency  d) Between-subjects, letting each participant pick whichever phrase they prefer

**C7.** *(Bonus — covers the Form-B-side concept B4 tests, which the A-isomorphic C4 does not: H₀/Hₐ.)* In a study comparing two designs, which pair correctly states the null (H₀) and alternative (Hₐ) hypotheses?
 a) H₀: design A is better; Hₐ: design B is better  b) H₀: the sample is large enough; Hₐ: the sample is too small  c) ✓ H₀: there is no difference between the designs; Hₐ: there is a difference  d) H₀: the result is significant; Hₐ: the result is not significant

**C8.** *(Bonus — covers the Form-B-side concept B6 tests: diagnosing a confound.)* A team finds interface X beat interface Y — but every X participant was tested first thing in the morning and every Y participant late at night. Why can't they conclude X is the better design?
 a) The sample was too small to compare  b) They should have used a within-subjects design from the start  c) The dependent variable was measured incorrectly  d) ✓ Time of day is confounded with the interface — tiredness, not the design, could explain the difference

*Answer key C: C1-a, C2-b, C3-c, C4-d, C5-a, C6-b, C7-c, C8-d*

---

## Administration & analysis notes (draft)

- **6 items × 13 topics = 78 items.** Same per-topic option counts as Forms A/B (4 options for
  every topic except Gestalt's shared 5).
- **Not yet piloted or desk-reviewed.** Run the same checklist `quiz-item-banks.md` used for its
  own desk review — content validity against game source, answer-leakage vs. the in-game
  assessment, distractor plausibility, answer-key correctness, correct-option distribution — before
  any human pilot. `scripts/validate_retention_bank.py` only checks structural well-formedness
  (item count, single correct answer, option count parity with A/B); it does not check content.
- **Difficulty is deliberately no longer A/B-isomorphic on 9 topics (2026-09-26 hardening pass —
  see the note at the top).** On `webers-law`, `problem-solving`, `memory`, `stroop`,
  `visual-perception`, `mental-model`, `language`, `ergonomics`, `experiment-design`, Form C is
  harder than the corresponding A/B item by design (to escape the post-test ceiling). **Do not
  compute retention as `C% − B%` on these topics** — that difference conflates decay with the
  difficulty step. Score them as a **standalone retention `C%`**. The four untouched topics
  (`fitts-law`, `gestalt`, `norman`, `hicks-law`) remain difficulty-comparable to A/B.
- **`norman` and `hicks-law`** carry the same zero-lecture-corpus-coverage caveat as their A/B
  banks (Wilson's 2026-08-30 decision) — their retention gain, if measured, should be reported
  separately from the primary H1 evidence, same as their ⟨g⟩.
- **`experiment-design`** had non-concept-parallel source items 4 and 6 (A4 confound / B4 H₀-Hₐ;
  A6 small-N design / B6 confound-diagnosis). **RESOLVED (Wilson 2026-09-22): bonus items added** —
  C1-C6 follow the A-side, and **C7 (H₀/Hₐ) + C8 (confound-diagnosis)** cover the orphaned B-side,
  so this topic has 8 Form C items where every other topic has 6. Scoring may treat C7/C8 as a
  separate bonus block or fold them in — an analysis decision, not fixed here.
- **Retention delay is undefined here.** This file supplies the items only; how many weeks after
  a topic's Form B the retention test runs, and whether it is administered per-topic or in one
  end-of-study batch, is a study-design decision for Wilson, not something this file assumes.
