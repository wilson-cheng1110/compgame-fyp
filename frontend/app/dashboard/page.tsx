"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pixelify_Sans, Press_Start_2P } from "next/font/google"
import Cookies from "js-cookie"
import { useForceScrollbar } from "@/lib/use-force-scrollbar"
import { useBadges } from "@/lib/badge-context"
import { useProgress } from "@/lib/progress-context"
import { TOPICS } from "@/lib/topic-definitions"
import type { TopicId } from "@/lib/topic-definitions"

const pixelifySans = Pixelify_Sans({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap", variable: "--font-pixelify-sans" })
const pressStart2P = Press_Start_2P({ weight: ["400"], subsets: ["latin"], display: "swap", variable: "--font-press-start-2p" })

const AVATAR_URLS: Record<number, string> = {
  1: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
  2: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
}

const CATEGORY_LABELS: Record<string, string> = {
  hci: "Human-Computer Interaction",
  os: "Operating Systems",
}

const CATEGORY_COLORS: Record<string, string> = {
  hci: "bg-[#0099db] text-white border-[#0077a9]",
  os: "bg-[#7c3aed] text-white border-[#5b21b6]",
}

function getSpeechBubble(progress: ReturnType<typeof useProgress>["progress"], username: string): string {
  const total = Object.values(progress)
  const doneCount = total.filter((p) => p?.assessmentCompleted).length
  const learningCount = total.filter((p) => p?.understandingCompleted && !p?.assessmentCompleted).length

  if (doneCount === TOPICS.length) return `Amazing, ${username}! You've mastered all ${TOPICS.length} topics! 🏆`
  if (doneCount >= TOPICS.length - 1) return `Almost there, ${username}! One more topic to go! 💪`
  if (learningCount > 0) return `Good progress, ${username}! Now put your knowledge to the test! 🎯`
  if (doneCount > 0) return `Keep it up, ${username}! You're on a roll! ⚡`
  return `Welcome, ${username}! Start with Understanding — learn before you leap! 📚`
}

function StepConnector() {
  return (
    <div className="flex justify-center my-1">
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
        <div className="text-gray-400 text-xs">▼</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  useForceScrollbar()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const { badges, refreshBadges } = useBadges()
  const { progress, refreshProgress, getTopicProgress } = useProgress()

  useEffect(() => {
    const interval = setInterval(() => { refreshBadges(); refreshProgress() }, 3000)
    return () => clearInterval(interval)
  }, [refreshBadges, refreshProgress])

  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) { router.push("/login"); return }
    const userData = JSON.parse(userCookie)
    if (userData.needsOnboarding) { router.push("/onboarding/avatar"); return }
    if (!userData.avatarId || !userData.username) { Cookies.remove("user"); router.push("/login"); return }
    setUser(userData)
    refreshBadges()
    refreshProgress()
    const darkModePref = Cookies.get("darkMode")
    if (darkModePref === "true") { setDarkMode(true); document.body.classList.add("dark-mode") }
  }, [router, refreshBadges, refreshProgress])

  useEffect(() => {
    const onFocus = () => { refreshBadges(); refreshProgress() }
    const onVis = () => { if (document.visibilityState === "visible") onFocus() }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVis)
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis) }
  }, [refreshBadges, refreshProgress])

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    if (next) { document.body.classList.add("dark-mode"); Cookies.set("darkMode", "true", { expires: 365 }) }
    else { document.body.classList.remove("dark-mode"); Cookies.set("darkMode", "false", { expires: 365 }) }
  }

  const handleSignOut = () => { Cookies.remove("user"); router.push("/") }

  const handleExportData = () => {
    if (!user?.sid) return
    try {
      const usersRaw = Cookies.get("users")
      const users = usersRaw ? JSON.parse(usersRaw) : {}
      const userData = users[user.sid] ?? {}

      const exportData = {
        exportDate: new Date().toISOString(),
        sid: user.sid,
        username: user.username,
        avatarId: user.avatarId,
        badges: userData.badges ?? [],
        topicProgress: userData.topicProgress ?? {},
        // Flip-learning metrics for paper
        flipMetrics: Object.fromEntries(
          TOPICS.map((t) => {
            const tp = (userData.topicProgress ?? {})[t.id]
            return [t.id, {
              understandingCompleted: tp?.understandingCompleted ?? false,
              assessmentCompleted: tp?.assessmentCompleted ?? false,
              playedUnderstandingFirst: tp?.playedUnderstandingFirst ?? false,
              assessmentScore: tp?.assessmentScore ?? null,
            }]
          })
        ),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `COMPGame_Progress_${user.sid}.json`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
    } catch (e) { console.error("Export failed", e) }
  }

  const speechBubble = useMemo(() => getSpeechBubble(progress, user?.username ?? ""), [progress, user?.username])

  // Find the active topic (first not fully done)
  const activeTopicIndex = useMemo(() => {
    const idx = TOPICS.findIndex((t) => {
      const p = progress[t.id as TopicId]
      return !p?.assessmentCompleted
    })
    return idx === -1 ? TOPICS.length - 1 : idx
  }, [progress])

  if (!user) return <div className="min-h-screen flex items-center justify-center font-press-start-2p text-sm">Loading...</div>

  const bg = darkMode ? "bg-[#020617] text-white" : "bg-white text-black"
  const cardBg = darkMode ? "bg-[#1e293b] border-slate-700" : "bg-[#f8f6ee] border-gray-200"

  return (
    <main className={`min-h-screen ${bg} ${pixelifySans.variable} ${pressStart2P.variable}`}>
      {/* Header */}
      <header className="w-full bg-[#f4eba7] py-3 border-b-2 border-black sticky top-0 z-10">
        <div className="container mx-auto px-8 md:px-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-6j0in4cMtwP0VsfG29Fx3ycVPSyTKf.png" alt="COMPGame" width={40} height={40} className="mr-3" />
            <span className="font-press-start-2p text-black text-xl">COMPGame</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} className="p-2">{darkMode ? <SunIcon /> : <MoonIcon />}</button>
            <button onClick={handleSignOut} className="bg-[#facc15] border-2 border-[#a16207] px-5 py-2 font-pixelify-sans font-bold text-base hover:bg-[#fde047] transition-colors text-black shadow-[3px_3px_0px_0px_#000]">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8 px-6 md:px-12 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── MAIN: Journey Map ── */}
          <div className="flex-1">
            <h1 className="font-press-start-2p text-xl mb-2">Your Learning Journey</h1>
            <p className="font-pixelify-sans text-sm opacity-60 mb-6">Learn each topic, then prove your knowledge. The AI tutor is always here to help.</p>

            {/* Avatar + Speech Bubble */}
            <div className="flex items-start gap-4 mb-8 p-4 rounded-lg border-2 border-dashed border-[#facc15] bg-[#fefce8]">
              <Image
                src={AVATAR_URLS[user.avatarId ?? 1]}
                alt="Your avatar"
                width={56}
                height={56}
                className="object-contain flex-shrink-0"
              />
              <div className="relative bg-white border-2 border-black rounded-lg px-4 py-3 font-pixelify-sans text-sm text-black flex-1 shadow-[3px_3px_0px_0px_#000]">
                {/* speech bubble tail */}
                <div className="absolute -left-[10px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[10px] border-r-black" />
                <div className="absolute -left-[8px] top-[17px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[8px] border-r-white" />
                {speechBubble}
              </div>
            </div>

            {/* Journey Steps */}
            <div className="space-y-0">
              {TOPICS.map((topic, idx) => {
                const tp = getTopicProgress(topic.id as TopicId)
                const uDone = tp.understandingCompleted
                const aDone = tp.assessmentCompleted
                const isActive = idx === activeTopicIndex
                const hasBadge = aDone

                const categoryColor = CATEGORY_COLORS[topic.category] || "bg-gray-500 text-white"

                return (
                  <div key={topic.id}>
                    {/* Topic Card */}
                    <div className={`relative rounded-xl border-2 p-5 transition-all ${
                      isActive
                        ? `${cardBg} border-[#facc15] shadow-[4px_4px_0px_0px_#facc15]`
                        : aDone
                        ? `${cardBg} border-green-400`
                        : `${cardBg} border-gray-300`
                    }`}>
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute -top-3 left-4 bg-[#facc15] border border-[#a16207] px-2 py-0.5 font-press-start-2p text-[9px] text-black">
                          ▶ CURRENT
                        </div>
                      )}
                      {aDone && (
                        <div className="absolute -top-3 right-4 bg-green-500 border border-green-700 px-2 py-0.5 font-press-start-2p text-[9px] text-white">
                          ✓ DONE
                        </div>
                      )}

                      {/* Topic Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{topic.icon}</span>
                          <div>
                            <h3 className="font-press-start-2p text-sm">{topic.title}</h3>
                            <p className="font-pixelify-sans text-xs opacity-60 mt-0.5">{topic.description}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-press-start-2p px-2 py-1 rounded border ${categoryColor} flex-shrink-0 ml-2`}>
                          {topic.category.toUpperCase()}
                        </span>
                      </div>

                      {/* Flip Flow: Understanding → Assessment */}
                      <div className="flex items-stretch gap-3">
                        {/* Understanding */}
                        <Link href={`/games/${topic.understandingGameId}`} className="flex-1">
                          <div className={`rounded-lg border-2 p-4 h-full cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
                            uDone
                              ? "bg-green-50 border-green-400 hover:bg-green-100"
                              : "bg-blue-50 border-[#0099db] hover:bg-blue-100"
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{uDone ? "✅" : "📚"}</span>
                              <span className="font-press-start-2p text-[10px]">Learn</span>
                            </div>
                            <p className="font-pixelify-sans text-xs opacity-70">Explore the concept interactively</p>
                            {uDone && <p className="font-pixelify-sans text-[10px] text-green-600 font-bold mt-1">Completed ✓</p>}
                          </div>
                        </Link>

                        {/* Arrow */}
                        <div className="flex items-center text-gray-400 font-press-start-2p text-sm flex-shrink-0">→</div>

                        {/* Assessment */}
                        <Link href={`/games/${topic.assessmentGameId}`} className="flex-1">
                          <div className={`rounded-lg border-2 p-4 h-full cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
                            aDone
                              ? "bg-green-50 border-green-400 hover:bg-green-100"
                              : uDone
                              ? "bg-[#facc15]/20 border-[#a16207] hover:bg-[#facc15]/40"
                              : "bg-gray-50 border-gray-300 hover:bg-gray-100"
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{aDone ? "✅" : uDone ? "🎯" : "🔒"}</span>
                              <span className="font-press-start-2p text-[10px]">Assess</span>
                              {hasBadge && <span className="text-sm ml-auto">🏅</span>}
                            </div>
                            <p className="font-pixelify-sans text-xs opacity-70">Test what you've learned</p>
                            {aDone && <p className="font-pixelify-sans text-[10px] text-green-600 font-bold mt-1">Completed ✓</p>}
                            {!aDone && !uDone && (
                              <p className="font-pixelify-sans text-[10px] text-gray-500 mt-1">Play Learn first!</p>
                            )}
                            {!aDone && uDone && (
                              <p className="font-pixelify-sans text-[10px] text-amber-600 font-bold mt-1">Ready — prove it! ▶</p>
                            )}
                          </div>
                        </Link>
                      </div>

                      {/* AI hint for active topic */}
                      {isActive && (
                        <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                          <p className="font-pixelify-sans text-xs opacity-60">
                            💬 Stuck? Ask the AI tutor about <strong>{topic.title}</strong> using the chat button →
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Step connector (not after last) */}
                    {idx < TOPICS.length - 1 && <StepConnector />}
                  </div>
                )
              })}
            </div>

            {/* Completion Banner */}
            {Object.values(progress).filter((p) => p?.assessmentCompleted).length === TOPICS.length && (
              <div className="mt-8 p-6 rounded-xl bg-[#fef9c3] border-2 border-[#facc15] text-center shadow-[4px_4px_0px_0px_#a16207]">
                <div className="font-press-start-2p text-xl mb-2">🏆 Journey Complete! 🏆</div>
                <p className="font-pixelify-sans text-sm">You've mastered all topics. Export your data below for the research study.</p>
              </div>
            )}
          </div>

          {/* ── SIDEBAR: Profile + Tools ── */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className={`rounded-xl border-2 p-5 ${cardBg} sticky top-24 space-y-4`}>
              {/* User card */}
              <div className="flex items-center gap-3">
                <Image src={AVATAR_URLS[user.avatarId ?? 1]} alt="avatar" width={52} height={52} className="object-contain" />
                <div className="min-w-0">
                  <p className="font-press-start-2p text-xs truncate">{user.username}</p>
                  <p className="font-pixelify-sans text-xs text-[#0099db] font-bold mt-0.5">SID: {user.sid}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between font-pixelify-sans text-xs mb-1">
                  <span>Progress</span>
                  <span>{Object.values(progress).filter((p) => p?.assessmentCompleted).length} / {TOPICS.length} complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 border border-gray-300">
                  <div
                    className="bg-[#0099db] h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${(Object.values(progress).filter((p) => p?.assessmentCompleted).length / TOPICS.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Badge count */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#facc15]/20 border border-[#a16207]/40">
                <span className="text-xl">🏅</span>
                <span className="font-press-start-2p text-xs">{badges.length} Badges Earned</span>
              </div>

              {/* Actions */}
              <Link href="/badges">
                <button className="w-full bg-[#0099db] border-2 border-black hover:bg-[#007cb2] text-white font-press-start-2p text-[10px] py-3 transition-colors shadow-[3px_3px_0px_0px_#005a81]">
                  View All Badges
                </button>
              </Link>

              <button
                onClick={handleExportData}
                className="w-full bg-white border-2 border-black text-black font-press-start-2p text-[9px] py-2.5 hover:bg-gray-100 transition-colors shadow-[3px_3px_0px_0px_#000]"
              >
                Export My Data
              </button>

              {/* AI Tutor panel */}
              <div className="pt-2 border-t border-dashed border-gray-300">
                <p className="font-press-start-2p text-[9px] mb-2 text-[#0099db]">AI Teaching Assistant</p>
                <p className="font-pixelify-sans text-xs opacity-70 mb-2">
                  Ask about any topic, get hints for games, or prep for your exam.
                </p>
                <p className="font-pixelify-sans text-[10px] opacity-50">→ Click the chat bubble (bottom right)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function SunIcon() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" /></svg> }
function MoonIcon() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /></svg> }
