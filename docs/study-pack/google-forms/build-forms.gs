/**
 * COMPGame Stage-1 study pack → Google Forms builder.
 *
 * HOW TO RUN
 *   1. Go to https://script.google.com  →  New project.
 *   2. Paste this whole file in, Save.
 *   3. Run  →  main  (authorise when prompted: it needs Forms + Drive).
 *   4. Read the Execution log (View → Logs): it prints the edit + live URL of every form created.
 *
 * WHAT IT BUILDS (11 forms, matching docs/study-pack/)
 *   - Consent + Demographics                                  (01 + 02)
 *   - 8 concept-inventory forms: Form A/B × 4 topics          (03)  ← QUIZ, auto-graded
 *   - Post questionnaire battery: IMI + CoI + ARCS            (04)
 *   - Reflection + cognitive load                             (05)
 *
 * NOTES
 *   - Concept forms are Google Forms QUIZZES with the answer keys baked in (1 pt/item) → H1
 *     auto-scores. Keys are in code only; respondents never see them (feedback set to hidden).
 *   - Email collection is OFF (anonymity). Participant code is asked as a short-answer item.
 *   - All Likert items use a 1–5 grid; Paas load uses a 1–9 scale. Matches the paper docs.
 *   - Per-topic forms keep the protocol's per-topic gating (Form A before a topic, Form B after).
 *     If you'd rather have one combined pre + one combined post form, set SEPARATE_TOPIC_FORMS=false.
 */

var SEPARATE_TOPIC_FORMS = true;
var LIKERT5 = ['1 Strongly disagree', '2 Disagree', '3 Neither', '4 Agree', '5 Strongly agree'];

// ---------- helpers ----------

function newForm(title, description, isQuiz) {
  var f = FormApp.create(title);
  f.setDescription(description || '');
  f.setCollectEmail(false);
  f.setProgressBar(true);
  if (isQuiz) { f.setIsQuiz(true); }
  return f;
}

function addParticipantCode(f) {
  f.addTextItem().setTitle('Participant code (assigned by facilitator, e.g. P01)').setRequired(true);
}

// MCQ for a quiz: options is array of strings, correct is the 0-based index.
function addQuizMCQ(f, title, options, correct) {
  var item = f.addMultipleChoiceItem();
  var choices = options.map(function (opt, i) { return item.createChoice(opt, i === correct); });
  item.setTitle(title).setChoices(choices).setPoints(1).setRequired(true);
}

// Plain single-choice (non-graded), e.g. demographics.
function addChoice(f, title, options, required) {
  f.addMultipleChoiceItem().setTitle(title)
    .setChoiceValues(options).setRequired(required !== false);
}

// 1–5 Likert grid. rows = array of statement strings.
function addLikertGrid(f, title, rows) {
  f.addGridItem().setTitle(title).setRows(rows).setColumns(LIKERT5).setRequired(true);
}

// ---------- concept-inventory item banks (keys baked in) ----------
// Each item: [questionText, [options...], correctIndex]

var GESTALT_OPTS = ['Similarity', 'Proximity', 'Continuity', 'Symmetry', 'Closure'];

var TOPICS = {
  weber: {
    name: "Weber's Law",
    A: [
      ['A 5-pixel increase is easy to notice on a 20px icon but invisible on a 400px banner. Why?',
        ['Larger elements render more slowly',
         'The detectable difference depends on the ratio of the change to the original size, not the absolute change',
         'Pixels behave differently at large scales',
         'The eye ignores large objects'], 1],
      ['In Weber’s Law ΔI / I = k, what does ΔI represent?',
        ['The smallest change in the stimulus that can just be detected (the JND)',
         'The total stimulus intensity',
         'A constant that is the same for every sense',
         'The background noise level'], 0],
      ['If the Weber fraction for brightness is about 8%, a brightness change is reliably noticed only when it is at least about…',
        ['1% of the original', '8% of the original brightness', '50% of the original', 'any change at all is noticed'], 1],
      ['A progress bar moves from 95% to 96%. Why do users barely notice?',
        ['The colour is wrong', 'Progress bars don’t update visually',
         'The 1% change is far below the just-noticeable difference — the ratio is too small to perceive',
         '96% rounds down to 95%'], 2],
      ['A circle grows 10px → 14px versus 100px → 104px (both +4px). Which change is easier to notice, and why?',
        ['100 → 104, because it is a bigger circle overall',
         '10 → 14, because +4px is a larger fraction of the original size',
         'Equal — both grew by 4px', 'Neither is noticeable'], 1],
      ['You are designing a volume slider. For every step to feel like an equal change in loudness, each step should raise the level by…',
        ['a fixed number of units, the same at every position',
         'a roughly constant percentage of the current level',
         'a bigger amount at low volumes and a smaller amount at high volumes',
         'a random amount, since loudness is not predictable'], 1]
    ],
    B: [
      ['Adding 2 grams is obvious when holding a 10g letter but unnoticeable when holding a 5kg bag. Why?',
        ['Heavy objects deaden the senses',
         'The detectable difference depends on the ratio of the change to the original weight, not the absolute change',
         'Grams are not a real unit of felt weight', 'The hand adapts to weight instantly'], 1],
      ['In Weber’s Law ΔI / I = k, what does k represent?',
        ['The just-noticeable difference', 'The original intensity',
         'A constant fraction that stays roughly the same for a given sense', 'The reaction time'], 2],
      ['If the Weber fraction for size is about 10%, a size change is reliably noticed only when it exceeds about…',
        ['2% of the original', '10% of the original size', '40% of the original', '100% of the original'], 1],
      ['A button darkens by only 3% on hover and feels unresponsive. Why?',
        ['3% is an odd number', 'Hover states do not use colour',
         'The change is below the brightness JND (about 8%), so the state change cannot be perceived',
         'The button is disabled'], 2],
      ['A 10-item list growing to 12 versus a 100-item list growing to 102 — which change is more noticeable?',
        ['100 → 102, because there are more items overall',
         '10 → 12, because it is a larger fraction of the original count',
         'Equal — both added 2', 'Neither, lists are not perceived by count'], 1],
      ['You are designing a "text size" control with several steps. For each step to feel like an equal jump in size, consecutive sizes should differ by…',
        ['a fixed number of pixels at every step',
         'a roughly constant ratio (percentage) between consecutive sizes',
         'a bigger jump for small sizes and a smaller jump for large sizes',
         'whatever values happen to look neat'], 1]
    ]
  },
  ps: {
    name: 'Problem Solving',
    A: [
      ['At each step you choose the action that most reduces the distance between where you are now and your goal. This strategy is…',
        ['Means-end analysis', 'Working backwards', 'Analogical reasoning', 'Trial and error'], 0],
      ['To plan a route, you start from the destination and reason backward to your current location. This is…',
        ['Means-end analysis', 'Working backwards', 'Hill climbing', 'Brute-force search'], 1],
      ['Solving a new problem by recalling a similar past problem and mapping its solution across is…',
        ['Analogical reasoning', 'Means-end analysis', 'Working backwards', 'Random restart'], 0],
      ['A "problem space" is defined by which three components?',
        ['Input, process, output', 'Initial state, goal state, and operators',
         'Hypothesis, variable, result', 'Affordance, signifier, feedback'], 1],
      ['Why can changing how a problem is represented make it dramatically easier?',
        ['It is shorter to write down', 'It guarantees the fewest possible moves',
         'A good representation exposes useful sub-goals and shrinks the search space',
         'Representation never affects difficulty'], 2],
      ['In the water-jug puzzle, "fill the 5-litre jug" and "pour the 5-litre jug into the 3-litre jug" are examples of the problem’s…',
        ['goal states', 'operators — the available actions that move you from one state to another',
         'constraints', 'heuristics'], 1]
    ],
    B: [
      ['A chess player picks each move to most reduce the gap between the current board and checkmate. This is…',
        ['Means-end analysis', 'Working backwards', 'Analogical reasoning', 'Trial and error'], 0],
      ['A student wanting a finished essay starts from the conclusion and works back to the introduction. This is…',
        ['Means-end analysis', 'Working backwards', 'Hill climbing', 'Brute-force search'], 1],
      ['An engineer designs a new bridge by adapting a solution from a bridge they built before. This is…',
        ['Analogical reasoning', 'Means-end analysis', 'Working backwards', 'Random restart'], 0],
      ['Which trio describes the structure of a problem in problem-solving theory?',
        ['Cause, effect, side-effect', 'Starting state, target state, and the available actions (operators)',
         'Premise, rule, conclusion', 'Goal, reward, penalty'], 1],
      ['The mutilated-chessboard puzzle becomes easy once you reason about square colours instead of positions. This shows that…',
        ['Chess problems are always easy', 'Colours are purely decorative',
         'Changing the representation can turn a hard problem into an easy one',
         'Only visual problems have representations'], 2],
      ['When solving a maze, the moves "go north", "go east", and "go back the way you came" are best described as the maze’s…',
        ['goal state', 'operators — the available actions you can take', 'initial state', 'search heuristics'], 1]
    ]
  },
  gestalt: {
    name: 'Gestalt Principles',
    A: [
      ['Form fields where each label sits close to its own input box are read as belonging together.', GESTALT_OPTS, 1],
      ['Buttons that share the same colour are perceived as the same category of action.', GESTALT_OPTS, 0],
      ['You perceive a complete circle even though its outline is dashed with gaps.', GESTALT_OPTS, 4],
      ['Two crossing lines are seen as each flowing smoothly through the intersection, not as four separate segments.', GESTALT_OPTS, 2],
      ['Two mirror-image shapes are perceived as one unified, balanced object.', GESTALT_OPTS, 3],
      ['You want a form’s related fields (a label and its input) to read as belonging together, with clear space separating unrelated fields. Which principle would you rely on?', GESTALT_OPTS, 1]
    ],
    B: [
      ['Icons placed in tight clusters with clear gaps between the clusters are seen as separate groups.', GESTALT_OPTS, 1],
      ['In a grid, items of the same shape are grouped together by the eye.', GESTALT_OPTS, 0],
      ['The IBM logo’s horizontally-striped letters are still readable as letters despite the gaps.', GESTALT_OPTS, 4],
      ['Dots arranged along a gentle curve are perceived as a single flowing path.', GESTALT_OPTS, 2],
      ['A logo with a clear left–right mirror axis is perceived as a single balanced whole.', GESTALT_OPTS, 3],
      ['You want a toolbar’s related tools to read as one group, set apart from other tools. Which principle would you use by spacing the related tools close together with gaps between groups?', GESTALT_OPTS, 1]
    ]
  },
  miller: {
    name: "Miller's Law",
    A: [
      ['Miller’s Law says short-term memory holds about how many chunks?',
        ['3 ± 1', '7 ± 2', '12 ± 3', '20 ± 5'], 1],
      ['A phone number shown as 123-4567-8901 instead of 12345678901 is easier to remember because of…',
        ['Closure', 'Chunking (11 digits grouped into 3 chunks)', 'Fitts’ Law', 'Sensory memory'], 1],
      ['What best distinguishes short-term memory (STM) from long-term memory (LTM)?',
        ['STM is slower to retrieve', 'LTM is limited to 7 ± 2 items',
         'STM holds about 7 ± 2 items briefly; LTM stores knowledge effectively permanently',
         'They have the same capacity'], 2],
      ['Which menu design best respects working-memory limits?',
        ['20 ungrouped options', '5 labelled categories of 3–4 options each',
         '15 options in alphabetical order', 'One long unlabelled list'], 1],
      ['Why does grouping controls into labelled sections reduce perceived complexity?',
        ['It uses less screen space', 'Colours distract the user',
         'Each labelled group becomes a single chunk, lowering the number of items STM must track',
         'It hides options from the user'], 2],
      ['Without rehearsal, about how long does information typically stay in short-term memory?',
        ['a fraction of a second', 'about 15–30 seconds', 'several hours', 'permanently'], 1]
    ],
    B: [
      ['According to Miller (1956), roughly how many meaningful units can working memory hold at once?',
        ['3 ± 1', '7 ± 2', '10 ± 2', 'unlimited with practice'], 1],
      ['A software licence key shown as ABCD-EFGH-IJKL rather than ABCDEFGHIJKL is easier to recall because of…',
        ['Symmetry', 'Chunking (12 characters grouped into 3 chunks)', 'Hick’s Law', 'Long-term memory'], 1],
      ['Which statement about STM versus LTM is correct?',
        ['STM is permanent; LTM is brief', 'Both are limited to 7 ± 2 items',
         'STM holds a few items briefly; LTM stores knowledge permanently and with vast capacity',
         'LTM is faster to access than STM'], 2],
      ['A settings page has 20 ungrouped options. The best fix for cognitive load is to…',
        ['sort them alphabetically', 'group them into about 5 labelled sections',
         'add more colour', 'show them all on one scroll'], 1],
      ['A sign-up wizard has 12 steps. How can it best respect Miller’s limit?',
        ['Show all 12 steps at once', 'Remove the progress bar',
         'Break it into a few grouped stages with progress indicators, so each stage is one chunk',
         'Add 8 more steps for clarity'], 2],
      ['A one-time passcode fades from memory within about half a minute unless you keep repeating it. This reflects the limited ___ of short-term memory.',
        ['capacity', 'duration (about 20–30 seconds)', 'accuracy', 'bandwidth'], 1]
    ]
  }
};
var TOPIC_ORDER = ['weber', 'ps', 'gestalt', 'miller'];

// ---------- builders ----------

function buildConsentDemographics() {
  var f = newForm('COMPGame Study — Consent & Background',
    'Thank you for taking part. This first form covers consent and a few background questions. ' +
    'Participation is voluntary, responses are anonymous, and the quizzes do not affect your course marks. ' +
    'You may stop at any time.');
  addParticipantCode(f);
  // Consent (each required yes)
  var consent = [
    'I have read and understood the participant information, and had the chance to ask questions.',
    'I understand participation is voluntary and I may withdraw at any time without penalty.',
    'I understand the quizzes do not affect my course marks or standing.',
    'I understand my responses are anonymous, stored securely, and used only for this research.',
    'I agree to take part in this study under the conditions described.'
  ];
  consent.forEach(function (c) { addChoice(f, c, ['Yes, I agree'], true); });
  addChoice(f, 'I confirm I am 18 or older.', ['Yes'], true);
  // Demographics
  addChoice(f, 'D1. Age range', ['18–20', '21–23', '24–26', '27 or older', 'Prefer not to say']);
  addChoice(f, 'D2. Gender', ['Female', 'Male', 'Non-binary / other', 'Prefer not to say']);
  addChoice(f, 'D3. Current year of study', ['Year 1', 'Year 2', 'Year 3', 'Year 4 or above', 'Other']);
  addChoice(f, 'D4. Programme / major',
    ['Computing / Computer Science', 'Other engineering or science', 'Business', 'Design', 'Other']);
  addChoice(f, 'D5. Have you formally studied HCI before (e.g. COMP3423 or similar)?',
    ['No, never', 'A little (some lectures / self-study)', 'Yes, a full course']);
  addChoice(f, 'D6. Before today, how familiar were you with the four topics (Weber, Problem Solving, Gestalt, Miller)?',
    ['Not at all familiar', 'Slightly familiar', 'Moderately familiar', 'Very familiar']);
  addChoice(f, 'D7. How often do you play video games (any kind)?',
    ['Never', 'A few times a year', 'A few times a month', 'A few times a week', 'Daily']);
  addChoice(f, 'D8. How often have you used an AI chatbot/tutor (e.g. ChatGPT) to study?',
    ['Never', 'Once or twice', 'Occasionally', 'Regularly']);
  addChoice(f, 'D9. What device are you using for this session?', ['Laptop', 'Desktop', 'Tablet', 'Phone']);
  logForm('Consent + Demographics', f);
}

function buildConceptForm(topicKey, formLabel) {
  var t = TOPICS[topicKey];
  var items = t[formLabel];
  var pre = (formLabel === 'A');
  var f = newForm('COMPGame — ' + t.name + ' — ' + (pre ? 'Quiz (before)' : 'Quiz (after)'),
    'Short ' + items.length + '-question quiz on ' + t.name + '. Pick the single best answer. ' +
    'This measures the materials, not you — just give your best guess.', true);
  addParticipantCode(f);
  items.forEach(function (it, i) {
    addQuizMCQ(f, (pre ? 'A' : 'B') + (i + 1) + '. ' + it[0], it[1], it[2]);
  });
  // hide per-question correctness from respondent
  f.setPublishingSummary(false);
  logForm(t.name + ' Form ' + formLabel, f);
}

function buildCombinedConcept(formLabel) {
  var pre = (formLabel === 'A');
  var f = newForm('COMPGame — Concept ' + (pre ? 'Pre-test (Form A)' : 'Post-test (Form B)'),
    'Pick the single best answer for each item. Measures the materials, not you.', true);
  addParticipantCode(f);
  TOPIC_ORDER.forEach(function (k) {
    var t = TOPICS[k];
    f.addSectionHeaderItem().setTitle(t.name);
    t[formLabel].forEach(function (it, i) {
      addQuizMCQ(f, t.name + ' — ' + (pre ? 'A' : 'B') + (i + 1) + '. ' + it[0], it[1], it[2]);
    });
  });
  f.setPublishingSummary(false);
  logForm('Combined ' + (pre ? 'Pre-test' : 'Post-test'), f);
}

function buildPostBattery() {
  var f = newForm('COMPGame — Post-Session Questionnaire',
    'For every statement, choose how much you agree (1 = strongly disagree … 5 = strongly agree). ' +
    'There are no right answers — we want your honest impression. "The activities" means the whole ' +
    'COMPGame experience today (games, quizzes, and the AI tutor).');
  addParticipantCode(f);
  addLikertGrid(f, 'Motivation (IMI)', [
    'M1. I enjoyed playing the COMPGame activities very much.',
    'M2. I think I did pretty well at these activities.',
    'M3. I put a lot of effort into the activities.',
    'M4. I believe these activities are useful for learning HCI concepts.',
    'M5. The activities were fun to do.',
    'M6. After working through the activities, I felt fairly competent with the topics.',
    'M7. It was important to me to do well at these activities.',
    'M8. I think doing these activities could help me in my studies.',
    'M9. I found the activities boring.',
    'M10. I was satisfied with how I performed in the games and quizzes.',
    'M11. I didn’t try very hard to do well at these activities.',
    'M12. I would be willing to learn this way again because it has value for me.'
  ]);
  addLikertGrid(f, 'The game and AI tutor as your "teacher" (CoI)', [
    'I1. The game and AI tutor clearly communicated what each topic was about and what I was meant to learn.',
    'I2. The game and AI tutor gave clear instructions on how to take part in each activity.',
    'I3. The game and AI tutor helped keep me focused and on-task while I was learning.',
    'I4. The feedback from the game and AI tutor helped me see what I understood and still needed to work on.',
    'I5. I felt comfortable interacting with the game and AI tutor.',
    'I6. I felt comfortable asking the AI tutor questions and trying things out in the games.',
    'I7. Interacting with the game and AI tutor felt like a genuine back-and-forth, not a one-way lecture.',
    'I8. I felt that what I did was acknowledged — the game and AI tutor responded to my actions.'
  ]);
  addLikertGrid(f, 'Satisfaction (ARCS)', [
    'S1. Completing the activities gave me a satisfying feeling of accomplishment.',
    'S2. I enjoyed these activities so much that I would like to learn more this way.',
    'S3. It was a pleasure to work through such well-designed activities.',
    'S4. I felt good when I completed an assessment successfully.',
    'S5. The variety of games, challenges, and feedback helped hold my interest.',
    'G1. Overall, I am satisfied with this learning experience.',
    'G2. I would recommend this way of learning to other students.',
    'G3. If COMPGame were available for my courses, I would choose to use it.'
  ]);
  logForm('Post questionnaire battery', f);
}

function buildReflectionLoad() {
  var f = newForm('COMPGame — Reflection & Effort',
    'A few short reflections and effort ratings. No right answers, and nothing here is graded.');
  addParticipantCode(f);
  f.addParagraphTextItem().setTitle('Before each assessment, did playing the Understanding game change how ready you felt to be tested? In what way?').setRequired(false);
  f.addParagraphTextItem().setTitle('When you used the AI tutor, what did it help you with — or where did it fall short?').setRequired(false);
  f.addParagraphTextItem().setTitle('Name one thing that "clicked" for you today, and one thing that is still confusing.').setRequired(false);
  addLikertGrid(f, 'How much do you agree?', [
    'RL1. I understand these HCI concepts better than I did before today.',
    'RL2. Playing the game first made the concepts feel concrete and easier to grasp.',
    'RL3. At each step I knew what I was supposed to do next.',
    'RL4. I would choose to learn this way again.'
  ]);
  TOPIC_ORDER.forEach(function (k) {
    f.addScaleItem().setTitle('Mental effort to learn ' + TOPICS[k].name + ' (1 = very low … 9 = very high)')
      .setBounds(1, 9).setLabels('very low', 'very high').setRequired(true);
  });
  logForm('Reflection + cognitive load', f);
}

function logForm(label, f) {
  Logger.log('%s\n  edit: %s\n  live: %s', label, f.getEditUrl(), f.getPublishedUrl());
}

// ---------- entry point ----------

function main() {
  Logger.log('Building COMPGame Stage-1 forms…');
  buildConsentDemographics();
  if (SEPARATE_TOPIC_FORMS) {
    TOPIC_ORDER.forEach(function (k) { buildConceptForm(k, 'A'); buildConceptForm(k, 'B'); });
  } else {
    buildCombinedConcept('A');
    buildCombinedConcept('B');
  }
  buildPostBattery();
  buildReflectionLoad();
  Logger.log('Done. URLs above.');
}
