"""The teacher's tutorial DECK — a runnable .pptx, not a brief to read.

    python generate_tutorial_deck.py --topic memory --section A
    python generate_tutorial_deck.py --topic memory --section A --llm

WHY A DECK AND NOT ANOTHER .md.

The .md brief (generate_tutorial_report.py) answers "what happened in the data".
It is a document you read at your desk. It is not something you can stand in front
of a class and run for fifty minutes -- and that is the hour the teacher actually
has to fill. So this produces the thing the teacher runs: slides, in order, with the
concept recap, PRELOADED discussion questions to put on the projector, and the answer
/ talking points sitting in the SPEAKER NOTES where only the teacher sees them.

The teaching is AUTHORED here, per topic, from the concept itself -- it does not wait
on the teacher to supply bullets and it does not need a model to be up. The DATA is
filled from the same Pass-1, code-only path the brief uses (generate_tutorial_report
.gather), so every number on a slide is counted in code, never by an LLM. --llm is
optional and only clusters the free-text short answers into a themes slide; with
Ollama down the deck is complete without it.

TWO INVARIANTS, both because this file gets PROJECTED to a room of students:

  BLIND. The slides never mention FLIP/CONTROL, sequence, or arm. A lecturer who
  learns which students saw the game first can teach to compensate, and differential
  instruction by condition is a confound on H1 that cannot be undone. Same rule as
  the lecturer copies of the brief (see generate_tutorial_report.render's docstring).

  NO SIDs. Nothing that identifies a student reaches a slide OR a speaker note -- the
  "who to call on" detail stays in the .md teacher brief, which is never projected.
  main() asserts this against the roster before writing, the same guard the brief
  runs on its anonymised copy.
"""

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

import generate_tutorial_report as report
import grade
import schedule

HERE = os.path.dirname(os.path.abspath(__file__))
REPORTS = os.environ.get("REPORTS_DIR", os.path.join(HERE, "..", "reports"))

# CUBIK palette, so the deck reads as the same product as the app the students used.
TEAL = RGBColor(0x00, 0x66, 0x66)
TEAL_DK = RGBColor(0x00, 0x4C, 0x4C)
INK = RGBColor(0x11, 0x18, 0x1F)
MUTE = RGBColor(0x5B, 0x6B, 0x73)
BAND = RGBColor(0xE9, 0xF1, 0xF1)   # pale teal wash
LINE = RGBColor(0xD3, 0xDA, 0xDD)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "Inter"                      # PowerPoint substitutes if absent; app font

EMU_W, EMU_H = Inches(13.333), Inches(7.5)
MARGIN = Inches(0.75)
CONTENT_W = EMU_W - 2 * MARGIN


# ── the authored teaching, one entry per topic ───────────────────────────────
#
# recap:    3 one-line concept reminders (the "in one minute" slide).
# questions: each is a slide. kind is the chip; `q` is projected big; `hint` is the
#            lighter nudge under it; `notes` is the teacher's talking points / answer,
#            which land in the speaker notes and are NEVER projected.
# apply:    one concrete case to open a working segment.
# extension: one harder question for a class that has clearly got it.

TUTORIAL_CONTENT = {
    "fitts-law": {
        "title": "Fitts's Law — Pointing, Targets & Reach",
        "recap": [
            "Time to hit a target grows with distance and shrinks with size: ID = log2(2D/W).",
            "Screen edges and corners are effectively infinite targets — you can't overshoot them.",
            "Design pulls: big frequent buttons, short travel, and put critical controls at edges.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "Why is the macOS menu bar (pinned to the very top) faster to hit than an identical menu 5 px below it?",
             "hint": "Think about what happens when you slam the cursor upward.",
             "notes": "The screen edge stops the cursor — the target has infinite height, so you can flick without aiming. W is effectively infinite, ID drops. Same reason the Start button lives in a corner (two infinite edges)."},
            {"kind": "Discuss",
             "q": "Right-click menus appear AT the cursor (D≈0). So why don't we replace every fixed toolbar with a context menu?",
             "hint": "Who wins, who loses — novices vs. experts?",
             "notes": "D≈0 is unbeatable for travel, but a fixed toolbar builds spatial muscle memory (experts hit it without looking) and is discoverable. Context menus cost a click to open and hide their contents. Trade travel time against learnability and discoverability."},
            {"kind": "Discuss",
             "q": "On phones, primary actions sit at the BOTTOM; on desktop they sit at the TOP. Both claim to be 'Fitts-optimal'. How?",
             "hint": "Where does the pointer physically start from?",
             "notes": "Fitts is about the pointer's start point and reach. On a phone the thumb rests low, so bottom = short D and inside the reachable arc. On desktop the mouse and eye track top-left menus; the edge helps. Same law, different body."},
        ],
        "apply": {"q": "Critique this form: a 24×24 px 'Submit' button in the top-right, with the last field at the bottom-left.",
                  "notes": "Small W and huge D — worst case. Move Submit near the last field, make it large, ideally full-width (edge-to-edge = wide target)."},
        "extension": "Does Fitts's Law still hold for gaze pointing, or for mid-air gestures? Where does the model break?",
    },
    "gestalt": {
        "title": "Gestalt Principles — How the Eye Groups",
        "recap": [
            "We perceive wholes, not parts: proximity, similarity, closure, continuity, common fate, figure/ground.",
            "Proximity is the strongest grouping cue — near things are read as belonging together.",
            "Layout communicates structure BEFORE any label is read.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "A form label sits equidistant between two input fields. Which field will users bind it to, and which principle decides?",
             "hint": "Nudge it 4 px closer to one field.",
             "notes": "Proximity — the label binds to whichever field is closer. Classic accessibility bug: labels spaced evenly read as ambiguous. Fix by tightening the gap to the correct field."},
            {"kind": "Discuss",
             "q": "A dashboard puts three unrelated controls tightly together and scatters three related ones across the screen. What breaks, and how do you feel it before you read a word?",
             "hint": "You'll 'sense' the wrong grouping instantly.",
             "notes": "Proximity is fighting the information architecture. The eye groups the physically-near controls as one unit regardless of function. Regroup by meaning; use whitespace as the divider, not lines."},
            {"kind": "Discuss",
             "q": "Loading spinners and many logos are incomplete shapes, yet we 'see' the whole. Which principles, and why is that useful in UI?",
             "hint": "Closure and continuity.",
             "notes": "Closure fills the gap; continuity makes us follow a line/arc. Lets designers imply structure with fewer marks (less clutter) and makes motion read as one object."},
        ],
        "apply": {"q": "Redesign a cramped pricing table using only proximity and similarity — no new borders.",
                  "notes": "Group each plan's features with tight spacing; use consistent type/colour (similarity) to link comparable rows across plans. Whitespace separates plans."},
        "extension": "When two Gestalt principles conflict (e.g. proximity says one group, similarity says another) — which wins, and can you design the tie?",
    },
    "hicks-law": {
        "title": "Hick's Law — Choice & Decision Time",
        "recap": [
            "Decision time grows with the log of the number of choices: RT = a + b·log2(n+1).",
            "Categorising choices cuts the EFFECTIVE n — 6 groups beat 60 flat items.",
            "It's about deliberation, so it bites novices far harder than experts.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "A menu with 6 labelled sections 'feels' faster than the same 60 dishes in one flat list. Why, by the law?",
             "hint": "log2 of what?",
             "notes": "You decide among 6 first, then among ~10 — two small logs instead of one big one. Hierarchy lowers effective n at each step. This is why IA/categorisation matters."},
            {"kind": "Discuss",
             "q": "Hick says 'fewer choices'; Fitts says 'bigger targets, so fewer fit'. Design a TV remote — where do they fight?",
             "hint": "A remote with 40 tiny buttons vs. 6 big ones.",
             "notes": "Fewer big buttons (Hick + Fitts happy) but now common functions need modes/menus (adds Hick depth elsewhere). The tension is real; resolve by frequency — surface the few things done constantly, bury the rest."},
            {"kind": "Discuss",
             "q": "Does Hick's Law apply to an expert who uses the same 40-item menu daily? What changed?",
             "hint": "Do they still 'decide'?",
             "notes": "Largely no — with practice they RECOGNISE/recall the target location (automaticity), bypassing deliberation. Hick models search among unfamiliar equiprobable choices. Design for both: discoverable for novices, fast-path (shortcuts) for experts."},
        ],
        "apply": {"q": "Critique a settings screen with 40 toggles in one flat scroll. What does Hick predict, and what's the fix?",
                  "notes": "Long deliberation + can't-find. Group into labelled sections, add search, surface the 3–4 most-changed at top. Progressive disclosure for the rest."},
        "extension": "Progressive disclosure hides options behind 'Advanced'. Does that truly reduce Hick cost, or just relocate it?",
    },
    "memory": {
        "title": "Miller's Law — Chunking & Working Memory",
        "recap": [
            "Working memory holds only a handful of chunks (~4, per Cowan; Miller's '7±2' is the older figure).",
            "Chunking regroups items so a few chunks carry a lot — a phone number in 3-4-4.",
            "Recognition beats recall: showing options is easier than making users remember them.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "Why do we write phone numbers as 2846 3355 and not 28463355? What is that doing to memory?",
             "hint": "Count the 'things' you have to hold.",
             "notes": "Chunking: two 4-digit chunks instead of eight digits. Fewer WM slots used. Same trick behind grouping IDs, card numbers, licence keys."},
            {"kind": "Discuss",
             "q": "A command line makes you RECALL the command; a menu lets you RECOGNISE it. When is each the right choice?",
             "hint": "Novice vs. power user again.",
             "notes": "Recognition (menus, autocomplete) wins for novices and infrequent tasks — no memory load. Recall (CLI, shortcuts) wins for experts doing high-frequency tasks fast. Good tools offer both: menu with the shortcut shown beside it (teaches recall)."},
            {"kind": "Discuss",
             "q": "'Never put more than 7 items in a menu' — is that a correct application of Miller's Law? Argue it.",
             "hint": "What did Miller actually measure?",
             "notes": "Common myth. Miller measured working-memory span for items you must HOLD, not options you can SEE. A visible menu of 15 doesn't tax WM — you're not memorising it. The real limits on menu length are scanning/Hick, not Miller. Good chance to correct a 'fact' they've all heard."},
        ],
        "apply": {"q": "A 4-step checkout makes you remember your order across steps vs. one that pins an order summary. Which respects WM, and why?",
                  "notes": "The pinned summary — it converts recall into recognition and removes the WM load of carrying details across steps. Show, don't make them hold."},
        "extension": "A chess master 'sees' the board in a few chunks a novice can't. What does expertise do to chunk size, and what does that imply for pro tools?",
    },
    "stroop": {
        "title": "The Stroop Effect — Consistency & Interference",
        "recap": [
            "Automatic processing interferes with conflicting signals (reading the word 'red' printed in blue is hard).",
            "In UI, conflicting cues (colour vs. meaning vs. position) create the same friction and errors.",
            "Consistency and natural mapping remove interference; violating a strong convention creates it.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "A dialog shows a GREEN 'Delete' and a RED 'Cancel'. Why is this dangerous, in Stroop terms?",
             "hint": "What does green 'mean' to everyone?",
             "notes": "Colour semantics (green=go/safe, red=stop/danger) conflict with the action. Users act on the automatic colour cue before reading — a Stroop-style interference that causes destructive mis-clicks. Match colour to meaning."},
            {"kind": "Discuss",
             "q": "When is it right to BREAK a platform convention (e.g. put navigation somewhere unusual), given consistency reduces interference?",
             "hint": "External vs. internal consistency.",
             "notes": "Rarely — external consistency (platform norms) leverages habits users already have. Break it only when the convention genuinely fails the task, and then be internally consistent and signal the change clearly. Novelty for its own sake = interference."},
            {"kind": "Discuss",
             "q": "Norman's stove: four burners in a square, four knobs in a row. Why do people turn the wrong knob, and what fixes it with zero labels?",
             "hint": "Natural mapping.",
             "notes": "The spatial layout of controls doesn't map to the layout of what they control — the user must translate, and translation errors. Arrange the knobs in the same square as the burners: natural mapping, no interference, no labels needed."},
        ],
        "apply": {"q": "A form marks required fields in green AND shows errors in green. Diagnose the interference and fix it.",
                  "notes": "Same signal (green) carries two opposite meanings — the user can't tell 'good' from 'bad' pre-attentively. Give error its own distinct channel (colour + icon + text)."},
        "extension": "Can interference ever be USEFUL — e.g. deliberately making a destructive action a little harder? Where's the line before it's just bad design?",
    },
    "webers-law": {
        "title": "Weber's Law — Perceiving Change Is Relative",
        "recap": [
            "The just-noticeable difference is proportional to the base magnitude: ΔI / I = k.",
            "We perceive change relative to what's already there, not in absolute units.",
            "Bites pricing, progress bars, animation, and any 'did it change?' judgement.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "$5 off a $20 shirt feels like a great deal; $5 off a $500 laptop feels like nothing. Same $5. Why?",
             "hint": "Ratio, not difference.",
             "notes": "Weber — the noticed change scales with the base. $5/$20 = 25%, $5/$500 = 1%. This is why stores show % off on cheap items and $ off on expensive ones."},
            {"kind": "Discuss",
             "q": "Why does the last 10% of a progress bar feel so much slower than the first 10%, and how would you design perceived progress?",
             "hint": "What's the base magnitude late in the bar?",
             "notes": "Late in the bar, a fixed pixel gain is a small RATIO of what's done, so change is below the JND — it feels stuck. Techniques: non-linear pacing (fast at the end), meaningful step labels, or an indeterminate spinner when you can't estimate."},
            {"kind": "Discuss",
             "q": "How much must you change a font size or line spacing before users NOTICE? How does Weber shape a type scale?",
             "hint": "1 px on 12 vs. 1 px on 48.",
             "notes": "The JND scales with the base size, so type scales are typically multiplicative (a ratio like 1.25×), not additive — each step is a noticeable proportion bigger. Additive steps look identical at the top end."},
        ],
        "apply": {"q": "A sale can show '25% off' or '$5 off'. Give the rule for which to use, from Weber.",
                  "notes": "Show whichever LOOKS bigger relative to the base: % on low-priced items (big ratio), absolute $ on high-priced items (small ratio hides behind a big number). Same discount, framed to clear the JND."},
        "extension": "Weber is a log law. Does it hold everywhere (loudness, brightness, price)? Where do Fechner/Stevens say it bends?",
    },
    "norman": {
        "title": "Norman's Action Cycle — The Two Gulfs",
        "recap": [
            "Acting is a 7-stage cycle: goal → plan → specify → perform → perceive → interpret → evaluate.",
            "Gulf of Execution: can I tell HOW to do it? Gulf of Evaluation: can I tell if it WORKED?",
            "Affordances, signifiers, feedback, mapping and constraints bridge the gulfs.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "A door with a flat plate that you must PULL. Which gulf fails, and what would fix it with no sign?",
             "hint": "The Norman door.",
             "notes": "Gulf of Execution — the signifier (flat push-plate) tells you the wrong action. Fix: a handle you can only pull affords pulling; a plate affords pushing. The shape should signify the action."},
            {"kind": "Discuss",
             "q": "You tap 'Pay' and… nothing visibly happens for 3 seconds. Which gulf is open, and what's the cost of leaving it?",
             "hint": "Did it work?",
             "notes": "Gulf of Evaluation — no feedback, so the user can't tell if the action succeeded. They re-tap → double payment, or abandon. Feedback (spinner, state change, confirmation) closes it. Feedback is not optional polish."},
            {"kind": "Discuss",
             "q": "Flat design stripped shadows and borders. What did we lose in Norman's terms, and was it worth it?",
             "hint": "Affordance vs. signifier.",
             "notes": "We kept affordances (things ARE clickable) but lost SIGNIFIERS (the visual cues that SHOW they're clickable). 'Is that a button or a label?' is a signifier failure. Trade aesthetic minimalism against discoverability — usually needs at least subtle signifiers back."},
        ],
        "apply": {"q": "Pick a real task in an app and walk it through all 7 stages. Where does it break — execution or evaluation?",
                  "notes": "Make them locate the exact stage. Most breakages are 'specify the action' (unclear controls) or 'interpret the feedback' (ambiguous result). Naming the stage points to the fix."},
        "extension": "Voice assistants have no visible affordances at all. How do the two gulfs change, and how do you signify what's possible?",
    },
    "mental-model": {
        "title": "Mental Models — User, Designer, System Image",
        "recap": [
            "Users act on their MODEL of the system, not the system itself.",
            "The designer's model reaches the user only through the SYSTEM IMAGE (what the UI shows/says).",
            "A mismatch between the two is where errors and confusion live.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "People crank the thermostat to 30° to heat a room FASTER. What wrong mental model is that, and where did the UI let it form?",
             "hint": "Valve vs. threshold.",
             "notes": "They model the thermostat as a valve ('more = faster') when it's a threshold (on until target, then off). The dial affords a 'more/less' reading. The system image never taught the real model — a better display (target vs. current temp, 'heating' state) repairs it."},
            {"kind": "Discuss",
             "q": "Files-and-folders vs. cloud/tags/search. Does the folder metaphor help users, or trap them?",
             "hint": "A file 'in two places'.",
             "notes": "Metaphors bootstrap a model fast (folders = physical filing) but constrain it (a file lives in ONE folder; tags let it live in many). When the real system is richer than the metaphor, the metaphor becomes a cage. Know when to drop the training wheels."},
            {"kind": "Discuss",
             "q": "Users keep misusing one feature the same way. How do you REPAIR a wrong mental model through the interface itself?",
             "hint": "You can't email everyone the manual.",
             "notes": "Through the system image: make the real behaviour VISIBLE (state, feedback), align labels/metaphors with it, use constraints so the wrong action isn't possible, and show the consequence immediately so the model self-corrects."},
        ],
        "apply": {"q": "Name a feature users consistently misunderstand. Diagnose it as a model mismatch — whose model, and what does the system image imply instead?",
                  "notes": "Push them past 'users are dumb' to 'the system image implies a different model than the truth'. That reframing is the whole lesson."},
        "extension": "Skeuomorphism (fake leather, page-turns) scaffolds a familiar model. When does that training wheel start to hurt more than it helps?",
    },
    "problem-solving": {
        "title": "Problem Solving — Search, Insight & Fixedness",
        "recap": [
            "Problems get solved by search (step-by-step, means-ends) or by insight (sudden restructuring).",
            "Functional fixedness: we fail to see an object/feature used in a new way.",
            "UI can scaffold sub-goals — or block solving by hiding the path or over-constraining.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "The candle problem: given a candle, matches and a box of tacks, fix the candle to the wall. Why do people struggle, and what's the UI parallel?",
             "hint": "What is the box 'for'?",
             "notes": "Functional fixedness — they see the box as a container, not a shelf you tack to the wall. UI parallel: users don't see that a feature affords a second use (e.g. a search box that also runs commands). Signpost alternate uses; don't rely on discovery."},
            {"kind": "Discuss",
             "q": "Should software PREVENT errors, or let users explore and recover (undo)? When does each serve problem-solving?",
             "hint": "Exploration is how people learn a system.",
             "notes": "Prevent the irreversible/dangerous (constraints, confirmations). Everywhere else, cheap reversibility (undo) turns errors into exploration — the main way users build a working model. Over-preventing kills learning and transfer."},
            {"kind": "Discuss",
             "q": "Means-ends analysis reduces a big goal to sub-goals. When is a step-by-step WIZARD the right scaffold, and when does it get in the way?",
             "hint": "Linear vs. exploratory tasks.",
             "notes": "Wizards suit rare, linear, high-stakes tasks (setup, tax filing) — they externalise the sub-goal structure. They frustrate frequent or non-linear tasks where users want direct access. Match the scaffold to how often and how freely the task is done."},
        ],
        "apply": {"q": "Users get stuck at one step of a task. Is it a SEARCH problem (they can't find the path) or an INSIGHT problem (they're framing it wrong)? What scaffolding fits each?",
                  "notes": "Search → clearer sub-goals, breadcrumbs, defaults. Insight → reframe the task, examples, remove the fixedness (show the alternate use). Different diagnosis, opposite fix."},
        "extension": "Too much guidance can stop users from ever learning the system. Where's the line between helpful scaffolding and over-scaffolding that blocks transfer?",
    },
    "visual-perception": {
        "title": "Visual Perception — Pre-attentive Search & Attention",
        "recap": [
            "Some features (colour, orientation, size, motion) 'pop out' pre-attentively — found in parallel, instantly.",
            "Search for a COMBINATION of features is serial and slow (conjunction search).",
            "Visual hierarchy and contrast steer the eye before conscious reading.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "One red dot among blue dots is spotted instantly. A red CIRCLE among red squares and blue circles is slow. Why the difference?",
             "hint": "One feature vs. two.",
             "notes": "Single-feature pop-out (colour) is pre-attentive/parallel. A conjunction (red AND circle) forces serial search — the visual system can't parallel-search two dimensions at once. Design important targets to differ on ONE strong feature."},
            {"kind": "Discuss",
             "q": "A chart uses colour as the ONLY way to tell series apart. What's the failure, and who does it hit?",
             "hint": "~8% of men.",
             "notes": "Colour-only encoding fails colour-blind users and greyscale printing, and even for others it's weaker than colour+shape. Redundant encoding (colour + shape/label/position) is the fix — and it also strengthens pop-out for everyone."},
            {"kind": "Discuss",
             "q": "A page has 12 equally-bold elements. Where does the eye go, and how do pre-attentive cues fix a flat hierarchy?",
             "hint": "If everything shouts, nothing does.",
             "notes": "With no salience differences the eye has no guide — it wanders (often to reading order or the biggest blob). Establish hierarchy with ONE dominant cue per level (size, weight, colour, whitespace) so the most important thing pops first."},
        ],
        "apply": {"q": "Redesign a system alert so the critical action pops out PRE-ATTENTIVELY, not just because it's labelled 'important'.",
                  "notes": "Give it a unique single feature the rest of the screen lacks — a distinct colour/size/position — plus redundant text. Don't bury it in a wall of equally-styled controls."},
        "extension": "Change blindness: users miss updates that aren't pre-attentively salient. How do you make a quiet state change actually get noticed?",
    },
    "language": {
        "title": "Language in UI — Wording, Readability & Errors",
        "recap": [
            "Speak the user's language, not the system's — match their vocabulary and mental model.",
            "A good error message DIAGNOSES the problem and GUIDES the next step.",
            "People scan, they don't read — front-load meaning (the 'F-shape' pattern).",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "'Error 0x80070057' vs. 'We couldn't save your file — check your connection and try again.' Which, and what three jobs does a good error do?",
             "hint": "Say what, why, and what next.",
             "notes": "The second. A good error: (1) says what happened in plain terms, (2) says why / what's likely wrong, (3) offers the next action. Codes are for logs, not users (keep them, but secondary)."},
            {"kind": "Discuss",
             "q": "Jargon: precise for experts, opaque for novices. How do you write one interface for both without dumbing it down?",
             "hint": "Layer the language.",
             "notes": "Lead with plain language; make the precise term available (tooltip, secondary line, progressive disclosure). Don't strip domain terms experts need — layer them. Audience and frequency decide the default surface."},
            {"kind": "Discuss",
             "q": "Friendly, chatty microcopy builds warmth — but can it ever REDUCE trust? Where?",
             "hint": "Banking. A medical result.",
             "notes": "In high-stakes or serious contexts (finance, health, errors, legal) jokey copy reads as unserious and erodes trust. Tone must match the stakes; warmth is for low-stakes moments. Voice is contextual, not a constant."},
        ],
        "apply": {"q": "Rewrite a confusing confirmation dialog ('Are you sure you want to proceed?') so the button says what it DOES.",
                  "notes": "Name the action on the button ('Delete 3 files' / 'Keep files'), not 'OK/Cancel'. State the consequence and its reversibility. The dialog should be readable by the button alone."},
        "extension": "LLM chat interfaces let users type anything. Does natural-language input remove the need for good information architecture, or just hide it?",
    },
    "ergonomics": {
        "title": "Ergonomics — Fitting the System to the Body",
        "recap": [
            "Fit the tool to the human, not the reverse: posture, reach, strain, fatigue.",
            "Every input device trades speed, precision, learnability and physical cost.",
            "Design for a RANGE of bodies (5th–95th percentile) and for situational limits.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "Keyboard shortcuts cut physical effort for power users but hurt something. What, and how do you get both?",
             "hint": "How does a novice find them?",
             "notes": "They kill discoverability — nobody finds a shortcut they can't see. Show the shortcut next to the menu item so users learn it in place. Fast path for experts, visible path for everyone."},
            {"kind": "Discuss",
             "q": "Touch, mouse, and voice each have a physical COST. Compare them for a 20-minute task, one-handed on a phone.",
             "hint": "'Gorilla arm', thumb reach, fatigue.",
             "notes": "Mouse: precise, low fatigue, needs a surface. Touch: direct but imprecise, thumb reach limits one-handed use, vertical touchscreens cause 'gorilla arm'. Voice: hands-free, low physical cost, but errors and privacy/social cost. Match device to duration and context."},
            {"kind": "Discuss",
             "q": "Design for SITUATIONAL impairment — a user walking, in bright sun, with one hand full. What changes?",
             "hint": "Everyone is 'disabled' sometimes.",
             "notes": "Bigger targets (shaky, one-handed), high contrast (sun), forgiving input, voice/one-tap options, no fine gestures. Situational impairment shows accessibility is for everyone, not a minority feature."},
        ],
        "apply": {"q": "Critique a self-service kiosk's screen height and reach for a wheelchair user and a tall standing user at once.",
                  "notes": "A fixed height fails one or both. Anthropometrics: design the reachable zone for the 5th–95th percentile; tilt/adjustable screens; keep critical controls in the shared reach band."},
        "extension": "AR glasses and wearables bring NEW ergonomic constraints (neck load, gorilla arm, eye strain). What old rules stop applying?",
    },
    "experiment-design": {
        "title": "Experiment Design — Evaluating HCI Claims",
        "recap": [
            "An experiment manipulates an independent variable (IV) and measures a dependent variable (DV).",
            "Within-subjects (everyone does all conditions) vs. between-subjects (each does one) — different threats.",
            "Confounds ruin causal claims; counterbalancing and controls defend against them.",
        ],
        "questions": [
            {"kind": "Quick check",
             "q": "Within-subjects vs. between-subjects: give ONE strength and ONE weakness of each.",
             "hint": "Order effects vs. individual differences.",
             "notes": "Within: powerful, controls for individual differences, fewer participants — BUT order/learning/fatigue effects. Between: no order effects — BUT individual differences add noise and it needs more participants. Counterbalancing rescues within-subjects."},
            {"kind": "Discuss",
             "q": "A study finds 'users were faster in the afternoon condition.' Name a confound and how counterbalancing would remove it.",
             "hint": "What ELSE changed with time?",
             "notes": "Practice/learning is confounded with time-of-day (they'd done the morning task first). Counterbalance the ORDER of conditions across participants so learning is spread evenly and can't masquerade as the effect."},
            {"kind": "Discuss",
             "q": "This very platform ran a pre-test → activity → post-test on you. What does that design control, and what can it NOT rule out?",
             "hint": "You're the participants.",
             "notes": "Pre/post within-subjects controls individual differences and measures change (normalized gain). It CANNOT rule out testing effects, maturation, or 'they'd have improved anyway' without a control group / counterbalanced arms — which is exactly why a control condition exists. Great meta moment: they are the study."},
        ],
        "apply": {"q": "Design a quick experiment to test whether bigger buttons speed up a tapping task. State IV, DV, and one control.",
                  "notes": "IV = button size (levels). DV = time-to-tap (and error rate). Control: same distance/position (hold Fitts's D constant), counterbalance order, same device. Ties straight back to Fitts's Law."},
        "extension": "Lab control vs. field realism (ecological validity). When is a messy real-world study worth more than a clean lab one?",
    },
}


def _content(topic: str) -> dict:
    """Authored teaching for a topic, or a safe generic scaffold for an unbanked one."""
    if topic in TUTORIAL_CONTENT:
        return TUTORIAL_CONTENT[topic]
    nice = topic.replace("-", " ").title()
    return {
        "title": nice,
        "recap": [
            f"Recap the core idea of {nice} from this week's lecture in one or two lines.",
            "State why it matters for design — the decision it should change.",
            "Give the one worked example the class will remember.",
        ],
        "questions": [
            {"kind": "Discuss", "q": f"Where have you seen {nice} done WELL in software you use? Why does it work?",
             "hint": "Concrete product, concrete moment.", "notes": "Elicit examples; steer toward the mechanism, not the surface."},
            {"kind": "Discuss", "q": f"Where does {nice} get IGNORED, and what's the cost to the user?",
             "hint": "A frustration they've actually hit.", "notes": "Turn the complaint into the principle."},
            {"kind": "Discuss", "q": f"If you had to teach {nice} in one sentence, what would it be?",
             "hint": "Force the compression.", "notes": "Their one-liners reveal misconceptions worth correcting."},
        ],
        "apply": {"q": f"Critique one screen through the lens of {nice}. What would you change first?",
                  "notes": "Push for the single highest-impact change and the reason."},
        "extension": f"Where does {nice} stop applying, or conflict with another principle you've learned?",
    }


# ── slide construction ────────────────────────────────────────────────────────

def _blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def _box(slide, left, top, width, height):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    return tf


def _run(para, text, size, color=INK, bold=False, italic=False):
    r = para.add_run()
    r.text = text
    f = r.font
    f.size = Pt(size)
    f.name = FONT
    f.color.rgb = color
    f.bold = bold
    f.italic = italic
    return r


def _rect(slide, left, top, width, height, fill, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(1)
    sh.shadow.inherit = False
    return sh


def _notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def _kicker(slide, text, color=TEAL):
    tf = _box(slide, MARGIN, Inches(0.55), CONTENT_W, Inches(0.4))
    _run(tf.paragraphs[0], text.upper(), 13, color, bold=True)
    # crude letter-spacing feel via the caps + colour; python-pptx has no tracking


def _title(slide, text, top=Inches(0.95), size=34, color=INK, width=None):
    tf = _box(slide, MARGIN, top, width or CONTENT_W, Inches(1.3))
    p = tf.paragraphs[0]
    _run(p, text, size, color, bold=True)
    return tf


# ── individual slides ─────────────────────────────────────────────────────────

def slide_title(prs, content, data, stamp):
    s = _blank(prs)
    _rect(s, 0, 0, EMU_W, Inches(2.6), TEAL)
    tf = _box(s, MARGIN, Inches(0.7), CONTENT_W, Inches(0.5))
    _run(tf.paragraphs[0], "HCI PLAYGROUND · TUTORIAL", 15, WHITE, bold=True)
    tf = _box(s, MARGIN, Inches(1.15), CONTENT_W, Inches(1.4))
    _run(tf.paragraphs[0], content["title"], 40, WHITE, bold=True)

    who = (f"n = {data['post_n']} of {data['roster_n']}" if data["roster_credible"]
           else f"n = {data['post_n']} completed")
    tf = _box(s, MARGIN, Inches(3.1), CONTENT_W, Inches(0.6))
    _run(tf.paragraphs[0], f"Section {data['section']}  ·  {who}  ·  {stamp}", 18, MUTE)

    tf = _box(s, MARGIN, Inches(5.9), CONTENT_W, Inches(1.0))
    p = tf.paragraphs[0]
    _run(p, "Consolidation hour — they've already met the concept in the game and self-tested.",
         15, MUTE, italic=True)
    p2 = tf.add_paragraph()
    _run(p2, "This deck runs the discussion. Answers & talking points are in the speaker notes.",
         13, MUTE, italic=True)
    _notes(s, "This is the flipped-learning tutorial. Students have played the Understanding "
              "game and sat pre/post checks online. Your job this hour is to consolidate and "
              "stretch — not to lecture the basics again. The next slide shows how the class "
              "actually did; everything after is yours to run.")
    return s


def _stat_tile(slide, left, top, width, big, label, sub=None):
    _rect(slide, left, top, width, Inches(2.0), BAND)
    tf = _box(slide, left + Inches(0.2), top + Inches(0.25), width - Inches(0.4), Inches(1.6))
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    _run(p, big, 44, TEAL, bold=True)
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    _run(p2, label, 14, INK, bold=True)
    if sub:
        p3 = tf.add_paragraph()
        p3.alignment = PP_ALIGN.CENTER
        _run(p3, sub, 12, MUTE)


def slide_landing(prs, content, data):
    s = _blank(prs)
    _kicker(s, "Where the class landed")
    _title(s, "How they did — before the room fills", size=30)

    pre, post, g = data["pre_pct"], data["post_pct"], data["hake_g"]
    part = data.get("participation") or []
    no_act = [m for m in part if m["played_first_basis"] == "activity never recorded"]
    recorded = len(part) - len(no_act)

    gap = Inches(0.4)
    tile_w = (CONTENT_W - 2 * gap) / 3
    top = Inches(2.4)
    _stat_tile(s, MARGIN, top, tile_w,
               f"{post:.0f}%" if post is not None else "—",
               "Post-check score",
               (f"up from {pre:.0f}%" if (pre is not None and post is not None) else
                ("short answer only" if post is None else None)))
    _stat_tile(s, MARGIN + tile_w + gap, top, tile_w,
               f"{g:.2f}" if g is not None else "—",
               "Normalized gain ⟨g⟩",
               (f"n = {data['both_n']} sat both" if data["both_n"] else "—"))
    _stat_tile(s, MARGIN + 2 * (tile_w + gap), top, tile_w,
               f"{recorded}/{len(part)}" if part else "—",
               "Did the activity",
               "have the game recorded" if part else None)

    # one-line read for the teacher, on the slide (blind-safe, aggregate)
    tf = _box(s, MARGIN, Inches(4.9), CONTENT_W, Inches(1.6))
    p = tf.paragraphs[0]
    read = _landing_read(data, recorded, len(part))
    _run(p, read, 18, INK)

    _notes(s, "A high post-score with a high gain means the concept landed — don't re-teach it, "
              "spend the hour on the DISCUSSION slides that stretch past the multiple-choice. "
              "A flat gain with low activity means they never really did the game — that's a "
              "different hour (get them to play it, then discuss). Read the gain and the "
              "activity count TOGETHER.")
    return s


def _landing_read(data, recorded, total):
    post, g = data["post_pct"], data["hake_g"]
    if total and recorded / max(total, 1) < 0.6:
        return ("Many haven't got the activity recorded — check the game landed before you lean "
                "on the gain. This may be an hour for getting them to play it, then discuss.")
    if g is not None and g >= 0.5 and (post is None or post >= 80):
        return ("The concept landed — they aced the check. Don't re-teach it: use the discussion "
                "slides to push the subtle cases the multiple-choice never tested.")
    if g is not None and g < 0.2:
        return ("Little movement pre→post. Worth re-grounding the core idea briefly, then using "
                "the apply-it case to rebuild it from an example.")
    return ("Solid but not saturated. Open with a quick recap, then spend the bulk of the hour on "
            "the discussion questions.")


def slide_recap(prs, content):
    s = _blank(prs)
    _kicker(s, "The concept in one minute")
    _title(s, content["title"], size=30)
    tf = _box(s, MARGIN, Inches(2.5), CONTENT_W, Inches(4.0))
    for i, b in enumerate(content["recap"]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(18)
        _run(p, "→  ", 22, TEAL, bold=True)
        _run(p, b, 22, INK)
    _notes(s, "Sixty seconds, no more — this is a reminder, not a lecture. They met this in the "
              "game. Then move to the questions.")
    return s


def slide_question(prs, q, n, total):
    s = _blank(prs)
    kind = q.get("kind", "Discuss")
    _kicker(s, f"{kind}  ·  question {n} of {total}",
            TEAL if kind == "Discuss" else TEAL_DK)
    tf = _box(s, MARGIN, Inches(1.4), CONTENT_W, Inches(3.2))
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    _run(tf.paragraphs[0], q["q"], 32, INK, bold=True)
    if q.get("hint"):
        tf = _box(s, MARGIN, Inches(5.1), CONTENT_W, Inches(1.2))
        p = tf.paragraphs[0]
        _run(p, "Nudge:  ", 18, TEAL, bold=True)
        _run(p, q["hint"], 18, MUTE, italic=True)
    _notes(s, "TALKING POINTS (not shown to the class):\n\n" + q.get("notes", ""))
    return s


def slide_apply(prs, content):
    s = _blank(prs)
    _kicker(s, "Now apply it")
    tf = _box(s, MARGIN, Inches(1.6), CONTENT_W, Inches(3.0))
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    _run(tf.paragraphs[0], content["apply"]["q"], 30, INK, bold=True)
    tf = _box(s, MARGIN, Inches(5.0), CONTENT_W, Inches(1.2))
    _run(tf.paragraphs[0], "Give them two minutes in pairs, then take three answers.", 16, MUTE, italic=True)
    _notes(s, "TALKING POINTS:\n\n" + content["apply"].get("notes", ""))
    return s


def slide_answers(prs, content, data, sa, llm):
    """What the class's own answers / items showed. Blind, aggregate, no SIDs."""
    s = _blank(prs)
    _kicker(s, "What their answers showed")
    _title(s, "Straight from this class", size=28)
    tf = _box(s, MARGIN, Inches(2.2), CONTENT_W, Inches(4.4))
    first = True

    def line(text, color=INK, size=18, bold=False, bullet=True):
        nonlocal first
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_after = Pt(10)
        if bullet:
            _run(p, "•  ", size, TEAL, bold=True)
        _run(p, text, size, color, bold=bold)

    used = False
    if llm and "_error" not in llm and (llm.get("got") or llm.get("broke")):
        used = True
        for g in (llm.get("got") or [])[:2]:
            line(g)
        for b in (llm.get("broke") or [])[:2]:
            line("Watch: " + b, color=TEAL_DK)
    else:
        # code-only fallback: the item everyone missed, aggregate short-answer shape
        worst = sorted(((w, seen, i) for i, (w, seen) in data["item_error"].items() if seen),
                       reverse=True)
        top = [t for t in worst if t[0] > 0][:2]
        if top:
            used = True
            for w, seen, i in top:
                line(f"Item {i}: {w} of {seen} missed it on the post-check — worth a probe.")
        elif data["item_error"]:
            used = True
            line("Every item was answered correctly by essentially everyone — push depth, not breadth.")
        gn = sa.get("graded_n", 0)
        if gn:
            lv = sa["levels"]
            used = True
            line(f"Short answers: {lv['full']} full · {lv['partial']} partial · {lv['none']} off-target "
                 f"(of {gn} graded).", size=16, color=MUTE)
        elif sa["levels"].get("not yet graded"):
            line(f"{sa['levels']['not yet graded']} short answers await the blind grader "
                 f"(grade_batch.py) — run it for a themes read here.", size=15, color=MUTE)

    if not used:
        line("No per-item or short-answer signal yet for this class — lead with the concept "
             "and the discussion questions.", color=MUTE)

    _notes(s, "This slide is your evidence for WHERE to push. If one item was widely missed, open "
              "the matching discussion question with it. If everyone aced everything, that's your "
              "cue to run the extension, not to re-drill. Run --llm (Ollama up) to cluster the "
              "short answers into themes here.")
    return s


def slide_wrap(prs, content, data):
    s = _blank(prs)
    _rect(s, 0, 0, EMU_W, EMU_H, TEAL)
    tf = _box(s, MARGIN, Inches(0.7), CONTENT_W, Inches(0.5))
    _run(tf.paragraphs[0], "TO CLOSE", 15, WHITE, bold=True)

    eff = data.get("effort") or []
    strug = sum(1 for e in eff if e["verdict"] == "struggling")
    rapid = sum(1 for e in eff if e["verdict"] == "rapid guess")
    tf = _box(s, MARGIN, Inches(1.5), CONTENT_W, Inches(2.2))
    if strug:
        msg = (f"{strug} took their time and still missed the post-check — the quiet room, not "
               f"the fast one. Draw them out before you move on.")
    elif rapid:
        msg = (f"{rapid} clicked through the post-check fast — a nudge on effort, not on the "
               f"concept, is what they need.")
    else:
        msg = "The class is solid on this one. Spend any spare minutes on the extension."
    _run(tf.paragraphs[0], msg, 22, WHITE, bold=True)

    tf = _box(s, MARGIN, Inches(4.1), CONTENT_W, Inches(0.5))
    _run(tf.paragraphs[0], "IF THERE'S TIME — EXTENSION", 14, RGBColor(0xBF, 0xE3, 0xE3), bold=True)
    tf = _box(s, MARGIN, Inches(4.7), CONTENT_W, Inches(1.8))
    _run(tf.paragraphs[0], content["extension"], 24, WHITE)

    _notes(s, "The effort read is aggregate and carries NO names — the SID-level 'who to call on' "
              "list lives in the .md teacher brief, which is never projected. Close on the "
              "extension if the class is strong.")
    return s


def build(topic: str, section: str, data: dict, sa: dict, llm, stamp: str) -> Presentation:
    content = _content(topic)
    prs = Presentation()
    prs.slide_width, prs.slide_height = EMU_W, EMU_H

    slide_title(prs, content, data, stamp)
    slide_landing(prs, content, data)
    slide_recap(prs, content)
    qs = content["questions"]
    for i, q in enumerate(qs, 1):
        slide_question(prs, q, i, len(qs))
    slide_apply(prs, content)
    slide_answers(prs, content, data, sa, llm)
    slide_wrap(prs, content, data)
    return prs


def _all_text(prs) -> str:
    """Every string in the deck, slides AND notes — for the no-SID assertion."""
    chunks = []
    for s in prs.slides:
        for sh in s.shapes:
            if sh.has_text_frame:
                chunks.append(sh.text_frame.text)
        if s.has_notes_slide:
            chunks.append(s.notes_slide.notes_text_frame.text)
    return "\n".join(chunks)


def generate(topic: str, section: str, cohort: str = "COMP3423",
             use_llm: bool = False, out: str | None = None) -> dict:
    """Build one deck to disk. Returns {ok, path, slides, llm_error} on success, or
    {ok: False, reason} for the expected 'nothing to do' cases — no exceptions for
    an unknown section, a topic with no data yet, or a deck that would carry a SID.
    This is the single code path the CLI, the /admin button and the scheduled
    generator all go through, so the no-SID and blinding guards can't be skipped."""
    section = (section or "").strip().upper()
    if section not in schedule.sections():
        return {"ok": False, "reason": "unknown_section"}
    data = report.gather(topic, section)
    if data["started_n"] == 0:
        return {"ok": False, "reason": "no_data"}

    sa = report.short_answer_counts(data)
    llm = report.pass_two(data, sa) if use_llm else None
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prs = build(topic, section, data, sa, llm, stamp)

    # NO SIDs REACH A PROJECTED FILE — same guard the .md brief runs on its anonymised
    # copy. A student who typed their own SID into a short answer could otherwise ride
    # an LLM quote onto the projector.
    leaked = [sid for sid in report._roster() if sid and sid in _all_text(prs)]
    if leaked:
        return {"ok": False, "reason": "would_leak_sid", "leaked": len(leaked)}

    if out:
        out_path = out
    else:
        out_dir = os.path.join(REPORTS, cohort, f"section-{section}")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{topic}-{stamp}-tutorial.pptx")
    prs.save(out_path)
    return {"ok": True, "path": out_path, "slides": len(prs.slides),
            "llm_error": (llm or {}).get("_error") if isinstance(llm, dict) else None}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--section", required=True)
    ap.add_argument("--cohort", default=os.environ.get("COHORT", "COMP3423"))
    ap.add_argument("--llm", action="store_true",
                    help="cluster short answers into a themes slide (needs Ollama)")
    ap.add_argument("--out", help="output .pptx path (default: reports/<cohort>/section-<S>/)")
    args = ap.parse_args()

    res = generate(args.topic, args.section, args.cohort, args.llm, args.out)
    if not res["ok"]:
        msg = {
            "unknown_section": f"  section not one this cohort runs. Valid: {', '.join(schedule.sections())}",
            "no_data": f"  no events for {args.topic} / section {args.section.strip().upper()}.",
            "would_leak_sid": f"  ABORT: {res.get('leaked')} SID(s) would appear in the deck — "
                              f"not writing a projectable file with names in it.",
        }.get(res["reason"], f"  could not generate: {res['reason']}")
        print(msg)
        return 2 if res["reason"] == "would_leak_sid" else 1

    print(f"  -> {res['path']}  ({res['slides']} slides)")
    if res.get("llm_error"):
        print(f"  themes slide fell back to code-only: {res['llm_error']}")
    print("  Safe to project: blind to condition, no SIDs. Talking points are in the speaker notes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
