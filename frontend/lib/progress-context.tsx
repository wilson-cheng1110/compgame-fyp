"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import Cookies from "js-cookie"
import {
  type TopicId,
  type GameMode,
  type AllTopicProgress,
  type TopicProgress,
  getTopicFromGameId,
  getDefaultTopicProgress,
} from "@/lib/topic-definitions"

interface ProgressContextType {
  progress: AllTopicProgress
  markGameComplete: (gameId: string, score?: number) => void
  getTopicProgress: (topicId: TopicId) => TopicProgress
  refreshProgress: () => void
  totalCompleted: number
}

const ProgressContext = createContext<ProgressContextType>({
  progress: {},
  markGameComplete: () => {},
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
      const usersRaw = Cookies.get("users")
      if (!usersRaw) return {}
      const users = JSON.parse(usersRaw)
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

        const usersRaw = Cookies.get("users")
        if (!usersRaw) return
        const users = JSON.parse(usersRaw)
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
          const flippedCorrectly = current.understandingCompleted && !current.assessmentCompleted
          existing[topicId] = {
            ...current,
            assessmentCompleted: true,
            assessmentCompletedAt: current.assessmentCompletedAt ?? now,
            assessmentScore: score ?? current.assessmentScore,
            playedUnderstandingFirst: current.understandingCompleted,
          }
        }

        users[sid].topicProgress = existing
        Cookies.set("users", JSON.stringify(users), { expires: 365 })
        setProgress({ ...existing })
      } catch (e) {
        console.error("markGameComplete error", e)
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
    <ProgressContext.Provider value={{ progress, markGameComplete, getTopicProgress, refreshProgress, totalCompleted }}>
      {children}
    </ProgressContext.Provider>
  )
}
