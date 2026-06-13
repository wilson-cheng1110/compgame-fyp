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
