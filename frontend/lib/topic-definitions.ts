export const TOPICS = [
  {
    id: "fitts-law",
    title: "Fitts' Law",
    description: "How target size and distance affect interaction time",
    category: "hci" as const,
    icon: "🎯",
    understandingGameId: "fitts-law-understanding",
    assessmentGameId: "fitts-law-assessment",
  },
  {
    id: "gestalt",
    title: "Gestalt Principles",
    description: "How humans perceive and group visual elements",
    category: "hci" as const,
    icon: "👁️",
    understandingGameId: "gestalt-understanding",
    assessmentGameId: "gestalt-assessment",
  },
  {
    id: "hicks-law",
    title: "Hick's Law",
    description: "How the number of choices affects decision time",
    category: "hci" as const,
    icon: "⚡",
    understandingGameId: "hicks-law-understanding",
    assessmentGameId: "hicks-law-assessment",
  },
  {
    id: "memory",
    title: "Miller's Law",
    description: "Working memory limits and the magic number 7 ± 2",
    category: "hci" as const,
    icon: "🧠",
    understandingGameId: "memory-understanding",
    assessmentGameId: "memory-assessment",
  },
  {
    id: "stroop",
    title: "Principle of Consistency",
    description: "How stimulus-response compatibility affects reaction time and error rate",
    category: "hci" as const,
    icon: "🚦",
    understandingGameId: "stroop-understanding",
    assessmentGameId: "stroop-assessment",
  },
  {
    id: "webers-law",
    title: "Weber's Law",
    description: "The smallest detectable change is a constant fraction of the stimulus",
    category: "hci" as const,
    icon: "🔍",
    understandingGameId: "webers-law-understanding",
    assessmentGameId: "webers-law-assessment",
  },
  {
    id: "norman",
    title: "Norman's Action Cycle",
    description: "Seven stages from goal to evaluation — and where UIs break down",
    category: "hci" as const,
    icon: "🔄",
    understandingGameId: "norman-understanding",
    assessmentGameId: "norman-assessment",
  },
  {
    id: "mental-model",
    title: "Mental Models & Affordances",
    description: "How users predict system behaviour and what cues guide their actions",
    category: "hci" as const,
    icon: "🗺️",
    understandingGameId: "mental-model-understanding",
    assessmentGameId: "mental-model-assessment",
  },
  {
    id: "problem-solving",
    title: "Problem Solving",
    description: "Searching the problem space with means-end analysis and good representation",
    category: "hci" as const,
    icon: "🧩",
    understandingGameId: "problem-solving-understanding",
    assessmentGameId: "problem-solving-assessment",
  },
  {
    id: "visual-perception",
    title: "Visual Perception",
    description: "How the eye and brain construct sight — colour, depth, illusions and reading",
    category: "hci" as const,
    icon: "🌈",
    understandingGameId: "visual-perception-understanding",
    assessmentGameId: "visual-perception-assessment",
  },
  {
    id: "language",
    title: "Language & Ambiguity",
    description: "Syntax, semantics, pragmatics and why natural language is ambiguous",
    category: "hci" as const,
    icon: "💬",
    understandingGameId: "language-understanding",
    assessmentGameId: "language-assessment",
  },
  {
    id: "ergonomics",
    title: "Ergonomics & I/O Devices",
    description: "Fitting devices and workspaces to the human body, perception and motor limits",
    category: "hci" as const,
    icon: "🪑",
    understandingGameId: "ergonomics-understanding",
    assessmentGameId: "ergonomics-assessment",
  },
  {
    id: "experiment-design",
    title: "HCI Experiment Design",
    description: "IV/DV, between vs within subjects, confounds, order effects and counter-balancing",
    category: "hci" as const,
    icon: "🔬",
    understandingGameId: "experiment-design-understanding",
    assessmentGameId: "experiment-design-assessment",
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
  }
}
