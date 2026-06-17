"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useProgress } from "@/lib/progress-context"
import { useBadges } from "@/lib/badge-context"

// ── Course-accurate content for each topic ────────────────────────────────────

export interface DebriefContent {
  topicTitle: string
  principle: string          // one-sentence plain-English summary
  formula?: string           // LaTeX-style display string if applicable
  examTip: string            // how this appears in COMP3423 exam questions
  examQuestion: string       // sample question
  examAnswer: string         // answer with reasoning
  nextGameId?: string        // if defined, show a "Now test yourself" CTA
  nextGameLabel?: string
  aiPrompt: string           // pre-filled question for the AI chat
}

export const DEBRIEF_CONTENT: Record<string, DebriefContent> = {
  "fitts-law-understanding": {
    topicTitle: "Fitts' Law",
    principle: "The time to acquire a target depends on both its distance and its size — the farther or smaller a target, the longer it takes.",
    formula: "T = a + b × log₂(A/W + 0.5)",
    examTip: "Exam questions often give you two UI designs and ask which is faster to click, or ask you to compute ID. Always use ID = log₂(A/W + 0.5) and remember: bigger and closer = easier.",
    examQuestion: "A button is 10px wide, 200px away. Using Fitts' Law, how does changing the button to 40px wide change difficulty?",
    examAnswer: "Original ID = log₂(200/10 + 0.5) = log₂(20.5) ≈ 4.36 bits. New ID = log₂(200/40 + 0.5) = log₂(5.5) ≈ 2.46 bits. The wider button is significantly easier to click. Fitts' Law predicts T decreases proportionally.",
    nextGameId: "fitts-law-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just played the Fitts' Law game. Explain the formula T = a + b × log₂(A/W + 0.5) and give me a COMP3423-style exam question about it.",
  },
  "fitts-law-assessment": {
    topicTitle: "Fitts' Law",
    principle: "Pointing time rises with the Index of Difficulty (ID = log₂(A/W + 0.5)) — far, small targets are slowest. Make frequent controls big and close, or park them at screen edges and corners (effectively infinite width).",
    formula: "ID = log₂(A/W + 0.5)  ·  T = a + b·ID",
    examTip: "Know both formulas. IP (Index of Performance) = 1/b. Mouse: a=1.03, b=0.096. The Shannon reformulation (Fitts, 1954) adds 0.5 to avoid log of zero.",
    examQuestion: "What is the Index of Performance for a mouse with movement time = 1.03 + 0.096 × ID seconds?",
    examAnswer: "IP = 1/b = 1/0.096 ≈ 10.4 bits/second. IP measures how efficiently a device translates intention into pointing accuracy.",
    aiPrompt: "I just completed the Fitts' Law assessment. Quiz me on Index of Difficulty and Index of Performance, then explain how Fitts' Law applies to touch screen button sizing.",
  },
  "gestalt-understanding": {
    topicTitle: "Gestalt Principles",
    principle: "The brain actively organises visual elements into groups based on rules — similarity, proximity, continuity, symmetry, and closure.",
    examTip: "Identify which principle explains a visual grouping. Closure means the brain completes incomplete shapes (IBM logo). Proximity means nearness creates grouping even without similarity.",
    examQuestion: "A form places labels closer to the field below them than above. Which Gestalt principle does this exploit, and why does it reduce errors?",
    examAnswer: "Proximity. Labels that are physically closer to their field are automatically perceived as belonging to it, reducing ambiguity and mapping errors for the user.",
    nextGameId: "gestalt-assessment",
    nextGameLabel: "Take the Quiz",
    aiPrompt: "I just explored the Gestalt principles. Explain closure vs continuity with examples from real UI design, then give me a COMP3423 exam question.",
  },
  "gestalt-assessment": {
    topicTitle: "Gestalt Principles",
    principle: "Five core principles explain how humans group visual elements: Similarity, Proximity, Continuity, Symmetry, Closure.",
    examTip: "Distinguish closure (brain fills gaps — IBM logo, Kanizsa triangle) from continuity (lines follow smoothest path — crossing diagonals). Symmetry groups shapes collectively even at a distance.",
    examQuestion: "The IBM logo uses horizontal stripes that break up letters. Which Gestalt principle allows us to still read 'IBM', and why?",
    examAnswer: "Closure. The brain ignores the horizontal gaps and automatically completes the letter shapes, perceiving the full letters even though they are fragmented.",
    aiPrompt: "I just took the Gestalt assessment. Explain all five Gestalt principles with a UI design example for each, then quiz me.",
  },
  "hicks-law-understanding": {
    topicTitle: "Hick's Law",
    principle: "Reaction time increases logarithmically with the number of choices. Every extra option adds cost — but the cost shrinks as the menu grows.",
    formula: "RT = a + b × log₂(n + 1)",
    examTip: "Know the formula and apply it: given n choices, compute log₂(n+1) to find the RT component. Fewer top-level menu items = faster decisions. Emergency UIs should have the fewest choices.",
    examQuestion: "A kiosk has 8 main menu options. A redesign proposes 4. Using Hick's Law, what is the relative reduction in decision-time component?",
    examAnswer: "With 8: b × log₂(9) ≈ 3.17b. With 4: b × log₂(5) ≈ 2.32b. Reduction = (3.17 − 2.32) / 3.17 ≈ 27%. Halving options does not halve decision time — the relationship is logarithmic.",
    nextGameId: "hicks-law-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored Hick's Law interactively. Explain the formula RT = a + b × log₂(n + 1) and how it applies to menu design and emergency UIs. Then give me a COMP3423 exam question.",
  },
  "hicks-law-assessment": {
    topicTitle: "Hick's Law",
    principle: "Reaction time increases logarithmically with the number of choices. Doubling options does not double reaction time — it adds a fixed amount.",
    formula: "RT = a + b × log₂(n + 1)",
    examTip: "In exams: given n items in a menu, compute RT using the formula. Key implication: long menus slow users down, but the penalty for each additional item decreases. Removing choices speeds decision time more than adding does.",
    examQuestion: "A navigation menu has 8 items. A designer proposes reducing it to 4. Using Hick's Law, estimate the relative speed improvement.",
    examAnswer: "With 8 items: RT includes b × log₂(9) ≈ 3.17b. With 4 items: b × log₂(5) ≈ 2.32b. The reduction in RT ∝ 3.17 − 2.32 = 0.85b. Speed improvement is logarithmic, not linear — halving items does not halve decision time.",
    aiPrompt: "I just played the Hick's Law reaction time game. Explain how this applies to menu design, navigation, and error dialogs in real software. Then quiz me.",
  },
  "memory-understanding": {
    topicTitle: "Miller's Law & Working Memory",
    principle: "Short-term memory holds 7 ± 2 chunks. Chunking — grouping raw items into meaningful units — multiplies effective STM capacity without changing its limit.",
    examTip: "Miller's Law (1956): the magic number is 7 ± 2 chunks, not items. A chunk is any meaningful unit. Phone numbers formatted as 123-4567-8901 are 3 chunks, not 11 digits. Group your UI controls into sets of ≤5 for lowest cognitive load.",
    examQuestion: "A user must remember an 8-digit OTP code shown once. Displaying it as '43829174' vs '4382-9174'. Which respects Miller's Law and why?",
    examAnswer: "Chunked form '4382-9174' creates 2 chunks vs 8 individual digits. 2 chunks is well within the 7±2 STM limit, making it easier to hold in working memory while typing.",
    nextGameId: "memory-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored Miller's Law and chunking. Explain STM vs LTM, the 7±2 rule, and give me two COMP3423-style exam questions about chunking in UI design.",
  },
  "memory-assessment": {
    topicTitle: "Miller's Law & Working Memory",
    principle: "Short-term memory holds 7 ± 2 items (chunks). Chunking — grouping items into meaningful units — extends effective capacity.",
    examTip: "Miller's Law (1956): STM capacity = 7 ± 2 chunks. A phone number 12345678901 is 11 digits but chunked as 123-4567-8901 becomes 3 chunks — within capacity. Design implication: group UI controls into sets of ≤5.",
    examQuestion: "A PIN code has 8 digits shown without spacing. A designer proposes showing it as XXXX-XXXX. Which cognitive principle justifies this, and why does it help?",
    examAnswer: "Miller's Law / Chunking. 8 individual digits exceeds easy STM encoding. Grouping into two 4-digit chunks reduces load to 2 items, well within the 7±2 limit, making the code easier to remember and transcribe.",
    aiPrompt: "I just played the working memory game. Explain Miller's Law, chunking, and STM vs LTM with UI design examples. Then give me a COMP3423 exam question.",
  },
  "stroop-understanding": {
    topicTitle: "Principle of Consistency",
    principle: "When a stimulus-response mapping conflicts with an established convention (red=go instead of red=stop), cognitive interference slows reaction time. Consistent conventions reduce errors and speed processing.",
    examTip: "COMP3423 often frames this as 'why should error messages be red and success messages be green?' The answer is convention-based stimulus-response compatibility — violating it forces users to suppress automatic responses, increasing error rates.",
    examQuestion: "A designer uses red to highlight successfully saved data and green to indicate a validation error. What HCI principle does this violate, and what measurable consequence would you predict?",
    examAnswer: "Principle of Consistency / Stimulus-Response Compatibility. Users have a hardwired expectation (convention): red = danger/error, green = success. Reversing this forces users to override their automatic response, increasing cognitive load, slowing reaction time, and raising error rates — especially under time pressure.",
    nextGameId: "stroop-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored the Stroop Effect and the Principle of Consistency. Explain stimulus-response compatibility with two COMP3423 UI design examples, then quiz me on consistency principles.",
  },
  "stroop-assessment": {
    topicTitle: "Principle of Consistency",
    principle: "Consistent mappings (green=success, Ctrl+Z=undo, back-swipe=navigate back) let users act automatically. Inconsistency forces deliberate thought — error rates rise, particularly under time pressure or novel contexts.",
    examTip: "Distinguish internal consistency (elements behave the same within a product) from external consistency (product follows platform-wide conventions). Both matter: internal consistency reduces within-app learning; external consistency leverages the user's existing mental model.",
    examQuestion: "Explain the difference between internal and external consistency in UI design. Give one example of each.",
    examAnswer: "Internal consistency: all buttons in the same app use the same style and placement (e.g., 'Cancel' always on the left). External consistency: the app follows OS-level conventions (e.g., Ctrl+S to save on Windows, ⌘+S on Mac). Internal reduces within-product confusion; external reduces cross-product transfer errors.",
    aiPrompt: "I just completed the Consistency / Stroop assessment. Explain internal vs external consistency, and give me a COMP3423 scenario question about UI consistency.",
  },
  "webers-law-understanding": {
    topicTitle: "Weber's Law",
    principle: "The smallest detectable change (JND — Just Noticeable Difference) is a constant fraction of the original stimulus. ΔI/I = k. If the baseline is 100px, you need to change by ~10px (10%) for the user to notice.",
    formula: "ΔI / I = k  (Weber fraction)",
    examTip: "In exams: if told the Weber fraction k = 0.10 and the current stimulus I = 50px, the minimum noticeable change is ΔI = k × I = 5px. Smaller stimuli require smaller absolute changes; larger stimuli require larger absolute changes — the ratio stays constant.",
    examQuestion: "A progress bar starts at 200px wide. The Weber fraction for length is 0.08. What is the minimum pixel increment a user will reliably notice?",
    examAnswer: "ΔI = k × I = 0.08 × 200 = 16px. Any increment below 16px will appear unchanged to the user, making the progress bar feel stuck. Design implication: progress updates must exceed the JND to provide perceptible feedback.",
    nextGameId: "webers-law-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored Weber's Law interactively. Explain the JND formula ΔI/I = k, give the Weber fractions for common stimuli, and explain how this applies to UI feedback design.",
  },
  "webers-law-assessment": {
    topicTitle: "Weber's Law",
    principle: "Perception is relative, not absolute. A change must exceed the JND threshold (a fixed fraction of the baseline) to be noticed. UI feedback that changes by less than the JND is effectively invisible.",
    formula: "ΔI / I = k  →  ΔI = k × I",
    examTip: "Apply Weber's Law to any perceptual feedback: colour change, size change, animation step. The fraction k varies by sense (~0.08 for brightness, ~0.10 for length, ~0.14 for number). If your animation step is below k×I, users won't perceive motion.",
    examQuestion: "An icon grows from 32px to 34px on hover. The Weber fraction for size is 0.10. Will the user notice this change? Show your working.",
    examAnswer: "JND = k × I = 0.10 × 32 = 3.2px. Actual change = 34 − 32 = 2px. Since 2px < 3.2px (JND), the change falls below the detection threshold — most users will not notice the hover state. The icon should grow to at least 32 + 3.2 = 35.2px ≈ 36px.",
    aiPrompt: "I just played the Weber's Law spot-the-difference game. Explain the JND formula and give me two UI design examples where Weber's Law determines whether feedback is perceptible.",
  },
  "norman-understanding": {
    topicTitle: "Norman's Action Cycle",
    principle: "Don Norman's 7 stages of action describe how users translate goals into system operations and back. The Gulf of Execution (can't figure out how) and Gulf of Evaluation (can't tell if it worked) are the two failure modes good UI design must bridge.",
    examTip: "COMP3423 exam questions often give you a scenario and ask which gulf is wider. Remember: Execution gulf = stages 2–4 (plan → specify → perform). Evaluation gulf = stages 5–7 (perceive → interpret → evaluate). If the user can't find the button, it's execution. If the button worked but they don't know it, it's evaluation.",
    examQuestion: "A user clicks 'Submit Order' on an e-commerce checkout. The page reloads with no confirmation, order number, or status message. Which gulf does this create, and which of Norman's 7 stages fails?",
    examAnswer: "Gulf of Evaluation. The action was performed (Stage 4 complete). But without any perceivable feedback, Stage 5 (Perceive State) fails — the user cannot determine what the system did. They cannot evaluate whether the goal (placing the order) was achieved.",
    nextGameId: "norman-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just walked through Norman's Action Cycle with a printing scenario. Explain all 7 stages, define the Gulf of Execution and Gulf of Evaluation with real UI examples, then give me a COMP3423 exam question.",
  },
  "norman-assessment": {
    topicTitle: "Norman's Action Cycle",
    principle: "Every UI failure maps to a specific stage in Norman's cycle. Execution failures leave users unable to act; evaluation failures leave users unable to know if they succeeded. Good design bridges both gulfs with visible affordances and immediate feedback.",
    examTip: "Exam strategy: first identify WHICH stage the user is stuck at (1–7), then determine which gulf that stage belongs to. Stages 1 = goal formation (neither gulf). 2–4 = execution side. 5–7 = evaluation side. Ambiguous feedback = Stage 6 (interpret), not Stage 5 (perceive).",
    examQuestion: "A user fills a long web form and clicks Submit. The button briefly greyed out then returned to normal. No other feedback appeared. Identify the failing stages and gulf.",
    examAnswer: "Stage 5 (Perceive): the brief grey state was barely perceivable. Stage 6 (Interpret): even if noticed, the user cannot interpret what 'greyed-out-then-normal' means — was it submitted or reset? Stage 7 (Evaluate): outcome cannot be compared to goal. All three evaluation-side stages fail → wide Gulf of Evaluation.",
    aiPrompt: "I just completed the Norman's Action Cycle assessment. Quiz me: give me three UI failure scenarios and ask me to identify the failing stage and gulf for each.",
  },
  "mental-model-understanding": {
    topicTitle: "Mental Models & Affordances",
    principle: "Users approach every interface with a mental model — an internal representation of how the system works. Affordances (properties that suggest actions) and signifiers (visible cues that communicate those affordances) must align with users' existing mental models to reduce errors and learning time.",
    examTip: "COMP3423 distinguishes affordance (the actual or perceived property of an object — a handle affords pulling) from signifier (the cue that communicates it — the word 'PULL' on the door). Affordances without signifiers are invisible. Signifiers that conflict with mental models cause errors.",
    examQuestion: "A recycling bin icon on desktop is replaced with a flame icon that performs the same delete-to-trash function. What HCI concept explains the increased error rate?",
    examAnswer: "Mental model mismatch. Users have a deeply learned mental model that 'recycle bin' = soft delete / recoverable. A flame icon activates a mental model of permanent destruction. Even if the underlying function is identical, users will hesitate or avoid it, or assume deletion is permanent — increasing errors and cognitive load.",
    nextGameId: "mental-model-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored Mental Models and Affordances. Explain the difference between affordance, signifier, and mental model with three UI examples. Then give me a COMP3423 exam question.",
  },
  "mental-model-assessment": {
    topicTitle: "Mental Models & Affordances",
    principle: "Affordances suggest possible actions; signifiers make those affordances visible. Both must match the user's existing mental model. When they don't, users make systematic errors — not random ones — because the system conflicts with the model they brought in.",
    examTip: "Exam questions often ask you to distinguish the three layers: the real affordance (what can be done), the perceived affordance (what the user thinks can be done), and the signifier (the cue). Norman's key insight: perceived affordances matter more than real ones, because users act on perception.",
    examQuestion: "A flat button with no border, no shadow, and no hover effect is placed in a form. A user ignores it and calls support instead. Explain this failure in terms of affordances and signifiers.",
    examAnswer: "The button has a real affordance (it can be clicked) but no perceived affordance — the flat style provides no signifier that it is interactive. Without visual cues (border, shadow, hover state), users perceive it as decorative text. The lack of signifiers makes the affordance invisible, so the user's mental model ('flat rectangles aren't clickable') takes over.",
    aiPrompt: "I just completed the Mental Models and Affordances assessment. Quiz me: give me two UI design scenarios and ask me to identify the affordance, signifier, and mental model issue in each.",
  },
  "problem-solving-understanding": {
    topicTitle: "Problem Solving",
    principle: "Humans solve problems by searching a 'problem space' — the set of states between the start and the goal. Means-end analysis repeatedly picks the operator that most reduces the difference between the current state and the goal.",
    examTip: "COMP3423 frames problem solving around the problem space (initial state, goal state, operators) and strategies: means-end analysis (reduce the gap), working backwards, and analogical reasoning (map a known solution onto a new problem). Know the three levels of problem representation: how the problem is stated, how the solver internally represents it, and the solution path.",
    examQuestion: "In the water-jug problem you must measure exactly 4 litres using a 5-litre and a 3-litre jug. Which problem-solving strategy fills the 5-litre jug, pours into the 3-litre, and reasons about the 2-litre remainder? Name it and explain why the representation matters.",
    examAnswer: "Means-end analysis: at each step you choose the operator (fill, empty, pour) that reduces the difference between the current jug contents and the 4-litre goal. The representation matters because choosing to track 'litres remaining in the 5-jug' rather than raw actions exposes the sub-goal (get 2 litres into the 3-jug, then top it up), shrinking the search space.",
    nextGameId: "problem-solving-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just solved a means-end-analysis puzzle. Explain the problem space, means-end analysis, working backwards, and analogical reasoning, then give me a COMP3423 exam question on problem representation.",
  },
  "problem-solving-assessment": {
    topicTitle: "Problem Solving",
    principle: "Effective problem solving depends on how the problem is represented. A good representation surfaces useful operators and sub-goals; a poor one hides them. Means-end analysis, working backwards, and analogy are the core strategies.",
    examTip: "Be able to identify the strategy from a scenario: means-end analysis = pick the operator that most reduces the gap to the goal; working backwards = start from the goal and reason toward the start (useful when the goal is well-defined); analogical reasoning = transfer the structure of a solved problem to a new one. Distinguish the three levels of representation (external statement, internal model, solution path).",
    examQuestion: "A user navigates a confusing settings menu to disable notifications. They start from 'notifications are off' (the goal) and ask 'what screen would let me turn them off?' working backward to the right menu. Which strategy is this, and when is it most effective?",
    examAnswer: "Working backwards. It is most effective when the goal state is clearly defined but the path from the start is ambiguous — the solver reasons from the desired end-state toward the current state, pruning irrelevant branches of the problem space.",
    aiPrompt: "I just completed the Problem Solving assessment. Quiz me on means-end analysis vs working backwards vs analogical reasoning, with an HCI example for each.",
  },
  "visual-perception-understanding": {
    topicTitle: "Visual Perception",
    principle: "The human visual system is not a camera — it actively constructs perception. Rods handle low light and motion; cones handle colour and detail. ~8% of males and ~1% of females have colour-vision deficiency, so colour must never be the sole carrier of meaning. Depth is inferred from cues like motion parallax, occlusion, and binocular disparity.",
    examTip: "Know the rod/cone division (rods = peripheral, low-light, motion; cones = central fovea, colour, acuity), the colour-blindness statistics (8% M / 1% F), and at least three depth cues (motion parallax, occlusion/interposition, binocular disparity, relative size). Be able to explain after-images and the Hermann grid as evidence that perception is constructed, not recorded.",
    examQuestion: "A dashboard shows system status using red and green dots only. Why is this an accessibility failure, and what is the minimal fix that keeps the colour coding?",
    examAnswer: "Because ~8% of males have red-green colour deficiency and cannot distinguish the two dots — colour is the sole differentiator. The minimal fix is a redundant non-colour signifier: add a shape or icon (e.g., ✓ vs ✗) or a text label, so meaning survives without colour discrimination.",
    nextGameId: "visual-perception-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored the human visual system. Explain rods vs cones, colour blindness, after-images, the Hermann grid, and depth cues, then give me a COMP3423 exam question on designing for colour-vision deficiency.",
  },
  "visual-perception-assessment": {
    topicTitle: "Visual Perception",
    principle: "Perception is constructed: the brain fills gaps, generates after-images, and infers depth from cues. Reading itself is visual pattern recognition driven by saccades (rapid jumps) and fixations (brief pauses), not a smooth sweep. Design must respect these mechanics — redundant coding for colour, sufficient contrast, and scannable layouts.",
    examTip: "Reading proceeds in saccades and fixations, not continuously — meaning is extracted only during fixations. Designs that demand smooth tracking (e.g., marquee text) fight the eye. Combine this with the colour-blindness rule (8% M / 1% F) and depth cues. After-images and the Hermann grid demonstrate that the retina/brain process contrast and edges, not raw light.",
    examQuestion: "Why does fast-scrolling marquee text increase reading errors, in terms of how the eye actually reads?",
    examAnswer: "Reading relies on saccades (jumps) and fixations (pauses), with comprehension occurring during fixations. Marquee text forces continuous smooth pursuit and removes the reader's control over fixation points, so the eye cannot land and dwell — reducing comprehension and raising error rates.",
    aiPrompt: "I just completed the Visual Perception assessment. Explain saccades and fixations, after-images, and depth cues, then quiz me on visual-system implications for UI design.",
  },
  "language-understanding": {
    topicTitle: "Language & Ambiguity",
    principle: "Natural language is processed at three levels: syntax (structure), semantics (literal meaning), and pragmatics (meaning in context). Ambiguity arises when one surface form maps to multiple structures or meanings — which is why human-language interfaces are hard for computers and why pragmatics (context, intent) matters as much as grammar.",
    examTip: "Distinguish the three layers with examples: syntax = 'is the sentence well-formed?'; semantics = 'what does it literally mean?'; pragmatics = 'what did the speaker intend in this context?'. Classic ambiguity examples: 'Time flies like an arrow' (multiple parses), 'I saw the man with the telescope' (attachment ambiguity). Coreference resolution (what does 'it' refer to?) is a core NLP challenge.",
    examQuestion: "The sentence 'I saw the man with the telescope' is ambiguous. Identify the two interpretations and state which level of language processing the ambiguity lives at.",
    examAnswer: "Interpretation 1: I used a telescope to see the man. Interpretation 2: I saw a man who had a telescope. This is a syntactic (structural) ambiguity — the prepositional phrase 'with the telescope' can attach to either the verb 'saw' or the noun 'man'. Resolving it requires semantic/pragmatic context.",
    nextGameId: "language-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored language ambiguity. Explain syntax vs semantics vs pragmatics, attachment ambiguity, and coreference resolution, then give me a COMP3423 exam question.",
  },
  "language-assessment": {
    topicTitle: "Language & Ambiguity",
    principle: "Because language is ambiguous at the syntactic, semantic, and pragmatic levels, conversational and voice interfaces must resolve intent from context. Coreference (resolving 'it', 'that one') and disambiguation are why natural-language UIs need clarification dialogues and context tracking.",
    examTip: "Be able to label an ambiguity by level and propose how an interface should resolve it: ask a clarifying question (pragmatic repair), use prior context (coreference), or constrain the grammar. Remember the scale of the problem — a single common word can have dozens of senses, producing an enormous space of possible meanings.",
    examQuestion: "A voice assistant hears 'Play the one I liked yesterday.' What two language-processing problems must it solve, and how?",
    examAnswer: "(1) Coreference / reference resolution: 'the one' must be resolved to a specific track using context (history of liked items). (2) Pragmatics: 'yesterday' and 'I liked' must be interpreted relative to the user and time context. The assistant resolves these from stored context, and if confidence is low it should issue a clarifying question rather than guess.",
    aiPrompt: "I just completed the Language & Ambiguity assessment. Quiz me on syntax/semantics/pragmatics and coreference resolution with conversational-UI examples.",
  },
  "ergonomics-understanding": {
    topicTitle: "Ergonomics & I/O Devices",
    principle: "Ergonomics (human factors) designs the human-machine system so it fits the human body and mind — optimising well-being and overall performance. Physical ergonomics covers posture, anthropometry, and repetitive-strain injuries (e.g., carpal tunnel syndrome); I/O devices are evaluated by how well they fit human perception and motor limits (Fitts' Law, haptic resolution).",
    examTip: "Know the definition (fitting the system to the human, not vice versa) and the physical hazards: neck/back bent >30° for >2 hours causes injury; awkward wrist postures (flexion >30°, extension >45°, ulnar deviation >30°) and repetitive motion cause musculoskeletal disorders like carpal tunnel syndrome (compression of the median nerve). Output devices include visual displays, printing, haptics (force/textural/thermal), and sound.",
    examQuestion: "An office worker types 8 hours a day and develops numbness on the thumb side of the hand. Name the likely disorder, its mechanism, and two ergonomic interventions.",
    examAnswer: "Carpal Tunnel Syndrome — compression of the median nerve in the carpal tunnel, causing numbness/tingling on the thumb side. Interventions: keep the wrist neutral (avoid flexion >30°/extension >45°/ulnar deviation) with a wrist rest and proper keyboard height, and vary posture / take micro-breaks to reduce repetitive loading.",
    nextGameId: "ergonomics-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored ergonomics and I/O devices. Explain physical vs cognitive ergonomics, carpal tunnel syndrome, safe posture angles, and haptic feedback types, then give me a COMP3423 exam question.",
  },
  "ergonomics-assessment": {
    topicTitle: "Ergonomics & I/O Devices",
    principle: "Good ergonomics matches devices and workspaces to human anatomy and perception. Input/output devices form the user interface; their quality is judged ergonomically — does the display suit the eye, does the control suit the hand, does haptic feedback land where the body can resolve it (the two-point threshold varies hugely across the body).",
    examTip: "Match the concept to the device: haptic feedback splits into force, textural, and thermal; haptic resolution (two-point threshold) is finest on the fingertips and coarsest on the back/calf — so wearables put detailed feedback on the fingers. Recall posture rules and the WWII/cockpit/space origins of ergonomics, and that 'system performance' means human + machine together.",
    examQuestion: "A VR glove designer wants users to feel fine texture detail. Where on the body should the densest haptic actuators go, and why — cite the relevant perceptual concept.",
    examAnswer: "On the fingertips. Haptic resolution is governed by the two-point threshold, which is smallest (most sensitive) on the fingertips and largest (least sensitive) on areas like the back or calf. Placing dense actuators where spatial resolution is highest lets users perceive fine texture; the same actuators on the forearm would be wasted.",
    aiPrompt: "I just completed the Ergonomics & I/O assessment. Quiz me on physical ergonomics hazards, haptic feedback types, and the two-point threshold with wearable-design examples.",
  },
  "experiment-design-understanding": {
    topicTitle: "HCI Experiment Design",
    principle: "HCI claims are tested with experiments: a hypothesis about how an independent variable (IV) affects a dependent variable (DV), measured under controlled conditions. Between-subjects designs split people across conditions; within-subjects designs expose each person to all conditions (introducing order effects). Confounds and order effects threaten validity and are controlled by randomisation and counter-balancing.",
    examTip: "Core vocabulary: IV (what you manipulate), DV (what you measure), H₀ (no effect) vs Hₐ (an effect). Between-subjects = different people per condition (more variance, no order effects); within-subjects = same people all conditions (less variance, but order effects). A confound is an uncontrolled variable that co-varies with the IV. Order effects (practice, fatigue) are controlled by counter-balancing (e.g., ABBA / Latin square); other confounds by randomisation.",
    examQuestion: "You test whether a new keyboard layout is faster than the old one, using the same 10 participants on both layouts. What design is this, what threat does it introduce, and how do you control it?",
    examAnswer: "It is a within-subjects design. The threat is order effects: whichever layout is tried first benefits from novelty or suffers fatigue, and the second benefits from practice (warm-up). Control it with counter-balancing — half the participants do old→new and half do new→old — so order effects distribute across both conditions rather than confounding the comparison.",
    nextGameId: "experiment-design-assessment",
    nextGameLabel: "Take the Assessment",
    aiPrompt: "I just explored HCI experiment design. Explain IV/DV, H₀ vs Hₐ, between- vs within-subjects, confounds, order effects, randomisation, and counter-balancing, then give me a COMP3423 exam question.",
  },
  "experiment-design-assessment": {
    topicTitle: "HCI Experiment Design",
    principle: "A valid HCI experiment isolates the IV's effect on the DV by controlling everything else. The biggest threats are confounds (an uncontrolled variable that tracks the IV) and order effects in within-subjects designs. Randomisation handles unknown confounds; counter-balancing handles order effects; a clear H₀/Hₐ and statistical test decide whether the effect is real.",
    examTip: "Be able to spot the confound in a scenario (e.g., one group is all experts), choose the right design, and name the control. Know that between-subjects avoids order effects but needs demographically matched groups; within-subjects is efficient but needs counter-balancing. 'Significant' means the difference is unlikely under H₀ — the researcher sets the threshold.",
    examQuestion: "A study compares an AR app vs a paper manual. The AR group is recruited from a robotics club; the paper group from a history class. Why is the result invalid, and which design principle was violated?",
    examAnswer: "It is confounded: technical aptitude co-varies with the condition (robotics-club members are more tech-savvy than history students), so any difference could be due to the people, not the interface. The violated principle is proper random assignment / group matching in a between-subjects design — groups must be demographically equivalent so the IV (AR vs paper) is the only systematic difference.",
    aiPrompt: "I just completed the HCI Experiment Design assessment. Quiz me on confounds, order effects, between- vs within-subjects, and counter-balancing with experiment scenarios to critique.",
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GameDebriefProps {
  gameId: string
  score?: number          // 0-100, optional
  totalQuestions?: number
  onAskAI?: (prompt: string) => void  // callback to open the AI chat widget
}

export default function GameDebrief({ gameId, score, totalQuestions, onAskAI }: GameDebriefProps) {
  const router = useRouter()
  const { markGameComplete } = useProgress()
  const { addBadge, refreshBadges } = useBadges()
  const content = DEBRIEF_CONTENT[gameId]
  const [showAnswer, setShowAnswer] = useState(false)
  const recordedRef = useRef(false)

  const isAssessment = gameId.endsWith("-assessment")

  // Record progress (and award a badge for assessments) once, on mount.
  // Centralised here so every game that ends in a debrief is wired uniformly.
  useEffect(() => {
    if (recordedRef.current || !content) return
    recordedRef.current = true
    markGameComplete(gameId, score)
    if (isAssessment) {
      const stars = score === undefined ? 3 : score >= 85 ? 5 : score >= 70 ? 4 : score >= 50 ? 3 : 2
      const name = `${content.topicTitle} (${"★".repeat(stars)}${"☆".repeat(5 - stars)})`
      addBadge(gameId, name, stars)
      setTimeout(refreshBadges, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!content) return null

  const passed = score !== undefined ? score >= 60 : null

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 space-y-4">
      {/* Score banner */}
      {score !== undefined && (
        <div
          className={`border-2 p-4 text-center font-press-start-2p text-sm ${
            passed
              ? "bg-green-100 border-green-600 text-green-800"
              : "bg-orange-100 border-orange-500 text-orange-800"
          }`}
        >
          {passed ? "✓ " : ""}
          {score}%{totalQuestions ? ` (${Math.round((score / 100) * totalQuestions)}/${totalQuestions} correct)` : ""}
          {passed ? " — Good work!" : " — Review below and try again."}
        </div>
      )}

      {/* Principle card */}
      <div className="bg-[#f8f6ee] border-2 border-black p-5">
        <h3 className="font-press-start-2p text-[#a16207] text-sm mb-3">What you just experienced</h3>
        <p className="font-pixelify-sans text-black text-sm leading-relaxed mb-3">{content.principle}</p>
        {content.formula && (
          <div className="bg-white border-2 border-black px-4 py-2 font-mono text-[#a16207] text-center text-sm">
            {content.formula}
          </div>
        )}
      </div>

      {/* Exam prep group (tip + practice question = 1 chunk) */}
      <div className="border-2 border-[#0099db] overflow-hidden">
        <div className="bg-[#dbeafe] p-5">
          <h3 className="font-press-start-2p text-[#005a81] text-[10px] uppercase tracking-wider mb-2">Exam Tip</h3>
          <p className="font-pixelify-sans text-gray-800 text-sm leading-relaxed">{content.examTip}</p>
        </div>
        <div className="bg-[#f8f6ee] border-t-2 border-[#0099db] p-5">
          <h3 className="font-press-start-2p text-black text-[10px] uppercase tracking-wider mb-2">Practice Question</h3>
        <p className="font-pixelify-sans text-black text-sm leading-relaxed mb-3">{content.examQuestion}</p>
        <button
          onClick={() => setShowAnswer(!showAnswer)}
          className="bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[9px] py-2 px-5 hover:bg-[#007cb2] transition-colors shadow-[2px_2px_0px_0px_#005a81]"
        >
          {showAnswer ? "Hide Answer" : "Show Answer"}
        </button>
        {showAnswer && (
          <div className="mt-3 bg-white border border-black p-3 font-pixelify-sans text-gray-800 text-sm leading-relaxed">
            {content.examAnswer}
          </div>
        )}
        </div>
      </div>

      {/* CTA row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {content.nextGameId && !isAssessment && (
          <button
            onClick={() => router.push(`/games/${content.nextGameId}`)}
            className="flex-1 bg-[#facc15] border-2 border-[#a16207] text-black font-press-start-2p text-[10px] py-3 px-4 hover:bg-[#fde047] transition-colors shadow-[3px_3px_0px_0px_#000]"
          >
            {content.nextGameLabel ?? "Next →"}
          </button>
        )}
        <button
          onClick={() => {
            if (onAskAI) {
              onAskAI(content.aiPrompt)
            } else {
              window.dispatchEvent(new CustomEvent("open-ai-chat", { detail: { prompt: content.aiPrompt } }))
            }
          }}
          className="flex-1 bg-[#0099db] border-2 border-black text-white font-press-start-2p text-[10px] py-3 px-4 hover:bg-[#007cb2] transition-colors shadow-[3px_3px_0px_0px_#005a81]"
        >
          Ask AI Tutor
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex-1 bg-white border-2 border-black text-black font-press-start-2p text-[10px] py-3 px-4 hover:bg-gray-100 transition-colors shadow-[3px_3px_0px_0px_#000]"
        >
          Dashboard
        </button>
      </div>
    </div>
  )
}
