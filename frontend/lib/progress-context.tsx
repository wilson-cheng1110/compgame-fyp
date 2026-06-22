"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import Cookies from "js-cookie"
import { getUsers, setUsers } from "@/lib/user-store"
import {
  type TopicId,
  type GameMode,
  type AllTopicProgress,
  type TopicProgress,
  getTopicFromGameId,
  getDefaultTopicProgress,
} from "@/lib/topic-definitions"
import { logResearchEvent } from "@/lib/research-log"

interface ProgressContextType {
  progress: AllTopicProgress
  markGameComplete: (gameId: string, score?: number) => void
  recordReflection: (topicId: TopicId, summary: { turns: number; insight: boolean }) => void
  getTopicProgress: (topicId: TopicId) => TopicProgress
  refreshProgress: () => void
  totalCompleted: number
}

const ProgressContext = createContext<ProgressContextType>({
  progress: {},
  markGameComplete: () => {},
  recordReflection: () => {},
  getTopicProgress: () => getDefaultTopicProgress(),
  refreshProgress: () => {},
  totalCompleted: 0,
})

export const useProgress = () => useContext(ProgressContext)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<AllTopicProgress>({})

  const readProgress = useCallback((): AllTopicProgress => {
    try {
      const userCookie = Cookies.get("user")
      if (!userCookie) return {}
      const { sid } = JSON.parse(userCookie)
      if (!sid) return {}
      const users = getUsers()
      return (users[sid]?.topicProgress as AllTopicProgress) ?? {}
    } catch {
      return {}
    }
  }, [])

  const refreshProgress = useCallback(() => {
    setProgress(readProgress())
  }, [readProgress])

  const markGameComplete = useCallback(
    (gameId: string, score?: number) => {
      try {
        const userCookie = Cookies.get("user")
        if (!userCookie) return
        const { sid } = JSON.parse(userCookie)
        if (!sid) return

        const parsed = getTopicFromGameId(gameId)
        if (!parsed) return
        const { topicId, mode } = parsed

        const users = getUsers()
        if (!users[sid]) return

        const existing: AllTopicProgress = users[sid].topicProgress ?? {}
        const current: TopicProgress = existing[topicId] ?? getDefaultTopicProgress()

        const now = new Date().toISOString()

        if (mode === "understanding") {
          existing[topicId] = {
            ...current,
            understandingCompleted: true,
            understandingCompletedAt: current.understandingCompletedAt ?? now,
          }
        } else {
          // assessment
          existing[topicId] = {
            ...current,
            assessmentCompleted: true,
            assessmentCompletedAt: current.assessmentCompletedAt ?? now,
            assessmentScore: score ?? current.assessmentScore,
            playedUnderstandingFirst: current.understandingCompleted,
          }
        }

        users[sid].topicProgress = existing
        setUsers(users)
        setProgress({ ...existing })

        // Mirror to the centralised research sink (best-effort, never blocks UI).
        logResearchEvent({
          event_type: mode === "understanding" ? "understanding_complete" : "assessment_complete",
          topic_id: topicId,
          mode,
          score: mode === "assessment" ? score : undefined,
          played_understanding_first:
            mode === "assessment" ? current.understandingCompleted : undefined,
        })
      } catch (e) {
        console.error("markGameComplete error", e)
      }
    },
    []
  )

  // Persist only the lightweight reflection SUMMARY (turns/insight/completed) —
  // the full Socratic transcript is sent to the server research sink by the
  // dialog, never to localStorage. ~80 bytes/topic, safe post-migration.
  const recordReflection = useCallback(
    (topicId: TopicId, summary: { turns: number; insight: boolean }) => {
      try {
        const userCookie = Cookies.get("user")
        if (!userCookie) return
        const { sid } = JSON.parse(userCookie)
        if (!sid) return

        const users = getUsers()
        if (!users[sid]) return

        const existing: AllTopicProgress = users[sid].topicProgress ?? {}
        const current: TopicProgress = existing[topicId] ?? getDefaultTopicProgress()

        existing[topicId] = {
          ...current,
          reflectionCompleted: true,
          reflectionCompletedAt: current.reflectionCompletedAt ?? new Date().toISOString(),
          reflectionTurns: summary.turns,
          reflectionInsight: summary.insight || current.reflectionInsight,
        }

        users[sid].topicProgress = existing
        setUsers(users)
        setProgress({ ...existing })
      } catch (e) {
        console.error("recordReflection error", e)
      }
    },
    []
  )

  const getTopicProgress = useCallback(
    (topicId: TopicId): TopicProgress => {
      return progress[topicId] ?? getDefaultTopicProgress()
    },
    [progress]
  )

  const totalCompleted = Object.values(progress).filter(
    (p) => p?.understandingCompleted || p?.assessmentCompleted
  ).length

  useEffect(() => {
    refreshProgress()
  }, [refreshProgress])

  return (
    <ProgressContext.Provider value={{ progress, markGameComplete, recordReflection, getTopicProgress, refreshProgress, totalCompleted }}>
      {children}
    </ProgressContext.Provider>
  )
}
