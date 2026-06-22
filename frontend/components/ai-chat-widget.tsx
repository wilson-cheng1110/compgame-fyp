"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { MessageCircle, X, Send, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { TOPICS } from "@/lib/topic-definitions"

interface Message {
  id: string
  role: "user" | "ai"
  content: string
  sources?: string[]
  isSourcesOpen?: boolean
}

// Detect topic from current URL path
function detectTopicFromPath(pathname: string): (typeof TOPICS)[number] | null {
  for (const topic of TOPICS) {
    if (pathname.includes(topic.understandingGameId) || pathname.includes(topic.assessmentGameId)) {
      return topic
    }
  }
  return null
}

function getSystemGreeting(topicName: string | null): string {
  if (topicName) {
    return `I'm your AI teaching assistant for COMP3423. You're currently studying **${topicName}**. I can:\n• Explain concepts from the lecture slides\n• Give hints for the game you're playing\n• Quiz you for exam revision\n\nWhat would you like help with?`
  }
  return `Hello! I'm your COMP3423 AI Teaching Assistant. I can explain HCI concepts, give game hints, or quiz you for exam revision. What would you like to know?`
}

const QUICK_ACTIONS = [
  { label: "💡 Hint", prompt: "Give me a hint for the current topic" },
  { label: "📖 Explain", prompt: "Explain this concept clearly" },
  { label: "🧪 Quiz me", prompt: "Ask me 3 exam-style questions about this topic" },
  { label: "📝 Summarise", prompt: "Summarise the key points I need to know" },
]

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [currentTopic, setCurrentTopic] = useState<(typeof TOPICS)[number] | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Detect topic from URL whenever widget opens or route changes
  useEffect(() => {
    const update = () => {
      const topic = detectTopicFromPath(window.location.pathname)
      setCurrentTopic(topic)
    }
    update()
    window.addEventListener("popstate", update)
    return () => window.removeEventListener("popstate", update)
  }, [isOpen])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    // Prepend topic context to the question for the RAG backend
    const contextPrefix = currentTopic
      ? `[Context: student is studying ${currentTopic.title} in COMP3423] `
      : ""
    const augmentedQuestion = contextPrefix + text.trim()

    // Send the recent conversation so the tutor has multi-turn memory (follow-ups
    // like "explain that more" need it). `messages` here is the state BEFORE this
    // turn — exactly the prior history. Drop the canned greeting and backend-down
    // error notices, and cap to the last 8 turns to bound payload + latency.
    const priorHistory = messages
      .filter((m) => m.id !== "welcome" && !m.content.startsWith("⚠️"))
      .slice(-8)
      .map((m) => ({ role: m.role === "user" ? "human" : "assistant", content: m.content }))

    try {
      const response = await fetch("http://localhost:8080/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: augmentedQuestion, history: priorHistory }),
      })

      if (!response.ok) throw new Error("Backend error")

      const data = await response.json()
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.answer,
        sources: data.sources,
        isSourcesOpen: false,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content:
            "⚠️ The AI tutor is offline right now, so I can't answer that yet. Please try again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, currentTopic, messages])

  // Keep a stable ref so the event listener below never needs to re-register
  const sendMessageRef = useRef(sendMessage)
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // Allow external components (GameDebrief) to open the chat with a pre-filled prompt
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt
      if (prompt) {
        setIsOpen(true)
        setTimeout(() => sendMessageRef.current(prompt), 300)
      }
    }
    window.addEventListener("open-ai-chat", handler)
    return () => window.removeEventListener("open-ai-chat", handler)
  }, []) // stable — sendMessageRef.current is always current

  // Reset greeting when topic changes
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "ai",
        content: getSystemGreeting(currentTopic?.title ?? null),
        isSourcesOpen: false,
      },
    ])
  }, [currentTopic])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (prompt: string) => {
    const full = currentTopic ? `${prompt} (topic: ${currentTopic.title})` : prompt
    sendMessage(full)
  }

  const toggleSources = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isSourcesOpen: !m.isSourcesOpen } : m)))
  }

  const widgetTitle = currentTopic ? `AI Tutor · ${currentTopic.title}` : "AI Teaching Assistant"

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[95vw] flex flex-col rounded-xl border-2 border-black shadow-[6px_6px_0px_0px_#000] bg-white overflow-hidden"
          style={{ height: "520px" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0099db] text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <span className="font-press-start-2p text-[10px] leading-tight">{widgetTitle}</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-[#007cb2] rounded transition-colors" aria-label="Close AI tutor">
              <X size={18} />
            </button>
          </div>

          {/* Topic badge */}
          {currentTopic && (
            <div className="px-3 py-1 bg-[#0099db]/10 border-b border-[#0099db]/20 flex items-center gap-2">
              <span className="text-sm">{currentTopic.icon}</span>
              <span className="font-pixelify-sans text-xs text-[#0099db] font-bold">
                Studying: {currentTopic.title}
              </span>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8f9fa]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm font-pixelify-sans ${
                  msg.role === "user"
                    ? "bg-[#0099db] text-white"
                    : "bg-white border border-gray-200 text-black shadow-sm"
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        {msg.isSourcesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                      </button>
                      {msg.isSourcesOpen && (
                        <ul className="mt-1 space-y-0.5">
                          {msg.sources.map((s, i) => (
                            <li key={i} className="text-[10px] text-gray-500">· {s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
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
          </div>

          {/* Quick actions */}
          <div className="px-3 py-2 border-t border-gray-200 flex gap-1.5 overflow-x-auto">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-2 rounded-full border border-[#0099db] text-[#0099db] font-pixelify-sans text-xs hover:bg-[#0099db]/10 transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t-2 border-black bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentTopic ? `Ask about ${currentTopic.title}…` : "Ask anything…"}
              className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-300 font-pixelify-sans text-sm focus:outline-none focus:border-[#0099db] bg-white text-black"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 bg-[#0099db] text-white rounded-lg border-2 border-[#0077a9] hover:bg-[#007cb2] disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-[#0099db] border-2 border-[#0077a9] text-white shadow-[3px_3px_0px_0px_#005a81] hover:bg-[#007cb2] transition-colors flex items-center justify-center"
        aria-label="Open AI tutor"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  )
}
