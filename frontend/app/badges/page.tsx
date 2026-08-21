"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useBadges } from "@/lib/badge-context"
import { TOPICS } from "@/lib/topic-definitions"

// The badge collection. docs/revamp.md Part 14: DEMOTED, NOT DELETED — badges are
// the H2 motivation construct's reason to exist (IMI), so this page has to stay
// and has to feel like it means something. It just no longer sits on the main path.
//
// In the CUBIK register (app/shell.css) like the rest of the shell.
//
// Two things the old version had and lost, both worth noting:
//   * `level` (1–5) was in the data model and never shown anywhere. It is the only
//     part of a badge that says HOW WELL, so it is now the thing the row leads with.
//   * A dead `truncateEmail()` helper and a `goToBadgesPage()` that navigated to the
//     page you were already on. Both gone.

const AVATAR_URLS: Record<number, string> = {
  1: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_1-0OHXpMnV7F5XjJKF4OuVW5OxvnxFRr.png",
  2: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar_2-QeIlj2Z9JERNw3e1qM9bzmMMkbbGso.png",
}

const MAX_LEVEL = 5

export default function BadgesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const { badges, refreshBadges } = useBadges()

  useEffect(() => {
    const userCookie = Cookies.get("user")
    if (!userCookie) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userCookie))
    refreshBadges()

    if (Cookies.get("darkMode") === "true") {
      setDarkMode(true)
      document.body.classList.add("dark-mode")
    }
  }, [router, refreshBadges])

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    document.body.classList.toggle("dark-mode", next)
    Cookies.set("darkMode", String(next), { expires: 365 })
  }

  const handleSignOut = () => {
    Cookies.remove("user")
    router.push("/")
  }

  if (!user) {
    return (
      <main className="shell min-h-screen flex items-center justify-center">
        <p className="u-muted">Loading…</p>
      </main>
    )
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

  const topicTitle = (gameId: string) => {
    const t = TOPICS.find((t) => gameId.startsWith(t.id))
    return t?.title ?? gameId.replace(/-/g, " ")
  }

  // Newest first — a collection reads as a history, and the thing you just earned
  // is the thing you came to look at.
  const sorted = [...badges].sort(
    (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime(),
  )

  return (
    <main className="shell min-h-screen">
      <header className="u-nav">
        <div className="mx-auto w-full max-w-5xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={26} height={26} priority />
            <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>COMPGame</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="u-btn" aria-label="Toggle theme">
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={handleSignOut} className="u-btn">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 pb-20">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 min-w-0">
            <p className="u-eyebrow">Collection</p>
            <h1 className="u-h1 mt-1">Badges</h1>
            <p className="u-stem u-muted mt-2">
              One badge per topic. The level goes up when you do better, so a badge you already
              have can still improve.
            </p>

            {sorted.length === 0 ? (
              <div className="u-card p-10 mt-7 text-center">
                <p className="u-h2">Nothing here yet</p>
                <p className="u-stem u-muted mt-2 mx-auto">
                  Badges arrive as you finish topics. Start with whichever one is open.
                </p>
                <Link href="/dashboard">
                  <button className="u-btn u-btn-primary mt-6">Go to my topics</button>
                </Link>
              </div>
            ) : (
              <ol className="mt-7 space-y-2.5">
                {sorted.map((badge, i) => (
                  <li key={`${badge.gameId}-${i}`}>
                    <div className="u-row p-4">
                      <div className="flex items-baseline justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <p style={{ fontWeight: 600, color: "var(--ink)" }}>{badge.name}</p>
                          <p className="u-faint mt-0.5">{topicTitle(badge.gameId)}</p>
                        </div>
                        <p className="u-faint u-num whitespace-nowrap">
                          {formatDate(badge.earnedAt)}
                        </p>
                      </div>

                      {/* Level, reusing the unit's step rail. It encodes the same kind
                          of thing — a position in a bounded sequence — so it gets the
                          same graphic rather than a second invented one. */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="u-rail" style={{ width: 88 }}>
                          {Array.from({ length: MAX_LEVEL }, (_, n) => (
                            <div
                              key={n}
                              className={`u-rail-seg ${n < badge.level ? "is-done" : ""}`}
                            />
                          ))}
                        </div>
                        <span className="u-faint u-num">
                          Level {badge.level} of {MAX_LEVEL}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="u-card p-5 lg:sticky lg:top-20 space-y-5">
              <div className="flex items-center gap-3">
                <Image
                  src={AVATAR_URLS[user.avatarId ?? 1]}
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate" style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {user.username}
                  </p>
                  <p className="u-faint u-num">{user.sid}</p>
                </div>
              </div>

              <div className="u-hr" style={{ borderTop: "1px solid var(--rule)" }} />

              <div className="flex items-baseline justify-between">
                <span className="u-faint">Earned</span>
                <span className="u-num" style={{ fontSize: "1.5rem", color: "var(--ink)" }}>
                  {badges.length}
                  <span className="u-faint"> / {TOPICS.length}</span>
                </span>
              </div>

              <Link href="/dashboard">
                <button className="u-btn u-btn-block">Back to my topics</button>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
        clipRule="evenodd"
      />
    </svg>
  )
}
