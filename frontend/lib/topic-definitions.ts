export const TOPICS = [
  {
    id: "fitts-law",
    title: "Fitts' Law",
    description: "How target size and distance affect interaction time",
    category: "hci" as const,
    icon: "🎯",
    understandingGameId: "fitts-law-understanding",
    assessmentGameId: "fitts-law-assessment",
    reflectionQuestion:
      "You found that bigger, closer targets are faster to hit — so why don't designers just make every button huge? Where does that logic break down?",
  },
  {
    id: "gestalt",
    title: "Gestalt Principles",
    description: "How humans perceive and group visual elements",
    category: "hci" as const,
    icon: "👁️",
    understandingGameId: "gestalt-understanding",
    assessmentGameId: "gestalt-assessment",
    reflectionQuestion:
      "Your eye grouped those shapes automatically, without you deciding to. If grouping is automatic, can a designer ever truly switch it off — or only redirect it?",
  },
  {
    id: "hicks-law",
    title: "Hick's Law",
    description: "How the number of choices affects decision time",
    category: "hci" as const,
    icon: "⚡",
    understandingGameId: "hicks-law-understanding",
    assessmentGameId: "hicks-law-assessment",
    reflectionQuestion:
      "More choices slowed you down. Yet a menu of 3 options isn't always better than one with 30 — when would adding choices actually help the user?",
  },
  {
    id: "memory",
    title: "Miller's Law",
    description: "Working memory limits and the magic number 7 ± 2",
    category: "hci" as const,
    icon: "🧠",
    understandingGameId: "memory-understanding",
    assessmentGameId: "memory-assessment",
    reflectionQuestion:
      "You could hold about 7 items but not 12 — yet phone numbers are longer than that and we still remember them. What did chunking actually change about the limit?",
  },
  {
    id: "stroop",
    title: "Principle of Consistency",
    description: "How stimulus-response compatibility affects reaction time and error rate",
    category: "hci" as const,
    icon: "🚦",
    understandingGameId: "stroop-understanding",
    assessmentGameId: "stroop-assessment",
    reflectionQuestion:
      "Reading the word fought against naming its colour. What does that conflict reveal about which process is automatic — and why does consistency in a UI matter because of it?",
  },
  {
    id: "webers-law",
    title: "Weber's Law",
    description: "The smallest detectable change is a constant fraction of the stimulus",
    category: "hci" as const,
    icon: "🔍",
    understandingGameId: "webers-law-understanding",
    assessmentGameId: "webers-law-assessment",
    reflectionQuestion:
      "You only noticed the change when it was big enough relative to the original. So is a $5 discount 'noticeable'? On what does your answer actually depend?",
  },
  {
    id: "norman",
    title: "Norman's Action Cycle",
    description: "Seven stages from goal to evaluation — and where UIs break down",
    category: "hci" as const,
    icon: "🔄",
    understandingGameId: "norman-understanding",
    assessmentGameId: "norman-assessment",
    reflectionQuestion:
      "You found where the interaction broke in the action cycle. Was the failure in forming the goal, executing it, or evaluating the result — and how would you tell those apart?",
  },
  {
    id: "mental-model",
    title: "Mental Models & Affordances",
    description: "How users predict system behaviour and what cues guide their actions",
    category: "hci" as const,
    icon: "🗺️",
    understandingGameId: "mental-model-understanding",
    assessmentGameId: "mental-model-assessment",
    reflectionQuestion:
      "You predicted what the system would do before touching it. Where did that prediction come from if you'd never used it before — what built your mental model?",
  },
  {
    id: "problem-solving",
    title: "Problem Solving",
    description: "Searching the problem space with means-end analysis and good representation",
    category: "hci" as const,
    icon: "🧩",
    understandingGameId: "problem-solving-understanding",
    assessmentGameId: "problem-solving-assessment",
    reflectionQuestion:
      "You searched for the solution rather than seeing it instantly. What made a good representation 'good' — what did it remove from the search space?",
  },
  {
    id: "visual-perception",
    title: "Visual Perception",
    description: "How the eye and brain construct sight — colour, depth, illusions and reading",
    category: "hci" as const,
    icon: "🌈",
    understandingGameId: "visual-perception-understanding",
    assessmentGameId: "visual-perception-assessment",
    reflectionQuestion:
      "Your brain 'saw' things that weren't physically on the screen. If perception is partly constructed, can a UI ever be 'objectively' clear — or only clear for a given viewer?",
  },
  {
    id: "language",
    title: "Language & Ambiguity",
    description: "Syntax, semantics, pragmatics and why natural language is ambiguous",
    category: "hci" as const,
    icon: "💬",
    understandingGameId: "language-understanding",
    assessmentGameId: "language-assessment",
    reflectionQuestion:
      "The same sentence had two valid meanings. If language is inherently ambiguous, how does a person — or an interface — ever pick the intended one reliably?",
  },
  {
    id: "ergonomics",
    title: "Ergonomics & I/O Devices",
    description: "Fitting devices and workspaces to the human body, perception and motor limits",
    category: "hci" as const,
    icon: "🪑",
    understandingGameId: "ergonomics-understanding",
    assessmentGameId: "ergonomics-assessment",
    reflectionQuestion:
      "A device that fit one person's hand strained another's. Is there such a thing as an 'ergonomic' design in the abstract — or only ergonomic for whom?",
  },
  {
    id: "experiment-design",
    title: "HCI Experiment Design",
    description: "IV/DV, between vs within subjects, confounds, order effects and counter-balancing",
    category: "hci" as const,
    icon: "🔬",
    understandingGameId: "experiment-design-understanding",
    assessmentGameId: "experiment-design-assessment",
    reflectionQuestion:
      "You spotted a confound that could explain the result instead of the independent variable. If you can never rule out every confound, what makes one experiment more trustworthy than another?",
  },
]

export type TopicId = (typeof TOPICS)[number]["id"]
export type GameMode = "understanding" | "assessment"

export interface TopicProgress {
  understandingCompleted: boolean
  understandingCompletedAt: string | null
  assessmentCompleted: boolean
  assessmentCompletedAt: string | null
  assessmentScore: number | null
  // KEY flip-learning metric for the paper
  playedUnderstandingFirst: boolean
  // Socratic post-assessment reflection. Only a lightweight summary is stored
  // client-side (the full transcript goes to the server research sink, never to
  // localStorage — we just fixed a 4 KB overflow and won't re-bloat the blob).
  reflectionCompleted: boolean
  reflectionCompletedAt: string | null
  reflectionTurns: number
  reflectionInsight: boolean
}

export type AllTopicProgress = Partial<Record<TopicId, TopicProgress>>

export function getTopicFromGameId(gameId: string): { topicId: TopicId; mode: GameMode } | null {
  for (const topic of TOPICS) {
    if (topic.understandingGameId === gameId) return { topicId: topic.id as TopicId, mode: "understanding" }
    if (topic.assessmentGameId === gameId) return { topicId: topic.id as TopicId, mode: "assessment" }
  }
  return null
}

export function getDefaultTopicProgress(): TopicProgress {
  return {
    understandingCompleted: false,
    understandingCompletedAt: null,
    assessmentCompleted: false,
    assessmentCompletedAt: null,
    assessmentScore: null,
    playedUnderstandingFirst: false,
    reflectionCompleted: false,
    reflectionCompletedAt: null,
    reflectionTurns: 0,
    reflectionInsight: false,
  }
}
