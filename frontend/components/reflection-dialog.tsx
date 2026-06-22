"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles, Send, Loader2, X } from "lucide-react"
import { TOPICS, type TopicId } from "@/lib/topic-definitions"
import { useProgress } from "@/lib/progress-context"
import { logResearchEvent } from "@/lib/research-log"

// Minimum substantive student turns before "Finish" unlocks. The AI can also
// unlock early by detecting genuine insight (understood===true). It NEVER traps
// the student — "Leave for now" is always available (essential when the Ollama
// backend is down).
const REFLECTION_FLOOR = 3

const SOCRATIC_API = "http://localhost:8080/api/socratic"

// Backend history format: {role: "human"|"assistant", content}.
interface Turn {
  role: "human" | "assistant"
  content: string
}

export function ReflectionDialog() {
  const { recordReflection } = useProgress()

  const [isOpen, setIsOpen] = useState(false)
  const [topicId, setTopicId] = useState<TopicId | null>(null)
  const [topicTitle, setTopicTitle] = useState("")
  const [history, setHistory] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [insight, setInsight] = useState(false) // ever reached understood===true
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Stable handle to the latest `leave` so the focus-trap effect (keyed on isOpen)
  // doesn't re-register on every render.
  const leaveRef = useRef<() => void>(() => {})

  const humanTurns = history.filter((t) => t.role === "human").length
  const canFinish = humanTurns >= REFLECTION_FLOOR || insight

  // Open from a `start-reflection` event ({topicId}) — dispatched by the
  // assessment debrief (auto) and the dashboard "Discuss with tutor" CTA (resume).
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ topicId: string }>).detail?.topicId
      const topic = TOPICS.find((t) => t.id === id)
      if (!topic) return
      setTopicId(topic.id as TopicId)
      setTopicTitle(topic.title)
      // Seed with the topic's sharp Socratic opener as the first AI turn.
      setHistory([{ role: "assistant", content: topic.reflectionQuestion }])
      setInsight(false)
      setErrorMsg(null)
      setInput("")
      setIsOpen(true)
    }
    window.addEventListener("start-reflection", handler)
    return () => window.removeEventListener("start-reflection", handler)
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, isLoading, errorMsg])

  // A11y: this is a modal, so trap focus inside it, move focus to the input on
  // open, and let Esc dismiss it (same as "Leave for now"). Without this,
  // keyboard / screen-reader users tab straight out into the page behind it.
  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        leaveRef.current()
        return
      }
      if (e.key !== "Tab" || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      const studentTurn: Turn = { role: "human", content: text.trim() }
      const nextHistory = [...history, studentTurn]
      setHistory(nextHistory)
      setInput("")
      setErrorMsg(null)
      setIsLoading(true)

      try {
        const res = await fetch(SOCRATIC_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topicTitle, history: nextHistory }),
        })
        if (!res.ok) throw new Error("backend error")
        const data = await res.json()
        setHistory((prev) => [...prev, { role: "assistant", content: data.response }])
        if (data.understood === true) setInsight(true)
      } catch {
        // Resilience: the student's turn is kept (so it still counts toward the
        // floor and they're never blocked), and we show the same graceful
        // message the floating tutor uses. "Leave for now" stays enabled.
        setErrorMsg(
          "⚠️ The AI tutor is offline right now, so it couldn't reply. Your response was saved — you can keep reflecting and try again in a moment, or leave and come back from your dashboard later.",
        )
      } finally {
        setIsLoading(false)
      }
    },
    [history, isLoading, topicTitle],
  )

  const close = () => {
    setIsOpen(false)
    setTopicId(null)
    setHistory([])
  }

  const finish = () => {
    if (!topicId) return
    const endReason = insight ? "insight" : "floor"
    recordReflection(topicId, { turns: humanTurns, insight })
    logResearchEvent({
      event_type: "reflection_complete",
      topic_id: topicId,
      // Full transcript goes to the SERVER sink (the paper needs it); only the
      // lightweight summary lands in localStorage via recordReflection.
      meta: { turns: humanTurns, insight, endReason, transcript: history },
    })
    close()
  }

  const leave = () => {
    if (topicId) {
      logResearchEvent({
        event_type: "reflection_skipped",
        topic_id: topicId,
        meta: { turns: humanTurns },
      })
    }
    close()
  }
  leaveRef.current = leave

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Reflect on ${topicTitle}`}
        className="w-full max-w-lg flex flex-col rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_#000] bg-white overflow-hidden"
        style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0099db] text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span className="font-press-start-2p text-[10px] leading-tight">
              Reflect · {topicTitle}
            </span>
          </div>
          <button onClick={leave} className="p-1.5 hover:bg-[#007cb2] rounded transition-colors" aria-label="Leave reflection">
            <X size={18} />
          </button>
        </div>

        {/* Insight banner */}
        {insight && (
          <div className="px-4 py-2 bg-[#fef9c3] border-b border-yellow-300 flex items-center gap-2">
            <span className="text-base">⭐</span>
            <span className="font-pixelify-sans text-xs text-yellow-800 font-bold">
              Deep Insight! You explained it in your own words — finish whenever you like.
            </span>
          </div>
        )}

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8f9fa]" style={{ minHeight: "240px" }}>
          {history.map((t, i) => (
            <div key={i} className={`flex ${t.role === "human" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm font-pixelify-sans whitespace-pre-wrap leading-relaxed ${
                t.role === "human"
                  ? "bg-[#0099db] text-white"
                  : "bg-white border border-gray-200 text-black shadow-sm"
              }`}>
                {t.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                <span className="font-pixelify-sans text-xs">Thinking…</span>
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs font-pixelify-sans bg-red-50 border border-red-200 text-red-700 whitespace-pre-wrap leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}
        </div>

        {/* Progress hint */}
        <div className="px-3 pt-2 text-center">
          <span className="font-pixelify-sans text-xs text-gray-600">
            {canFinish
              ? "You've reflected enough — finish, or keep going."
              : `Reflect a little more to finish (${humanTurns}/${REFLECTION_FLOOR} responses).`}
          </span>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t-2 border-black bg-white">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share your thinking…"
            className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-300 font-pixelify-sans text-sm focus:outline-none focus:border-[#0099db] bg-white text-black"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-[#0099db] text-white rounded-lg border-2 border-[#007cb2] hover:bg-[#007cb2] disabled:opacity-50 transition-colors"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>

        {/* Actions */}
        <div className="flex gap-2 px-3 pb-3">
          <button
            onClick={leave}
            className="flex-1 bg-gray-200 text-gray-700 font-pixelify-sans text-sm py-2 px-3 rounded hover:bg-gray-300 transition"
          >
            Leave for now
          </button>
          <button
            onClick={finish}
            disabled={!canFinish}
            className="flex-1 bg-[#0099db] text-white font-pixelify-sans text-sm py-2 px-3 rounded hover:bg-[#007cb2] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {insight ? "⭐ Finish" : "Finish"}
          </button>
        </div>
      </div>
    </div>
  )
}
