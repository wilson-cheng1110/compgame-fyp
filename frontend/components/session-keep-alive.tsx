"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Cookies from "js-cookie"

// Keep-alive for the server-side idle timeout (auth_store.SESSION_IDLE_MINUTES, 30 min).
//
// The idle timeout logs a student out after 30 minutes with NO request. Most of the app
// makes requests as you use it (games, checks, the tutor), but one path does not: typing
// a long short-answer probe is many minutes of keystrokes and zero network calls, so a
// student mid-answer could be logged out and lose it on submit. This pings a do-nothing
// endpoint that just refreshes the session — but ONLY while there has actually been
// interaction since the last tick, so a truly idle tab (walked away, no input) still
// times out as intended. Active use resets the clock; absence does not.
const PING_EVERY_MS = 5 * 60 * 1000 // 5 min — comfortably inside the 30-min window

export default function SessionKeepAlive() {
  const pathname = usePathname()
  // Set by any interaction, cleared each time we ping. A plain boolean, not a timestamp:
  // "did anything happen since the last check" is all we need, and mousemove/scroll fire
  // constantly, so the write must be as cheap as possible.
  const active = useRef(false)

  useEffect(() => {
    // Pre-auth surfaces have no session to keep alive.
    const preAuth =
      pathname === "/" ||
      pathname?.startsWith("/login") ||
      pathname?.startsWith("/signup")
    if (preAuth) return
    // UI-decoration cookie only, but its presence is a good-enough "is someone signed in"
    // signal to avoid pinging for a logged-out visitor. The server is still the authority.
    if (!Cookies.get("user")) return

    const mark = () => {
      active.current = true
    }
    const events = ["keydown", "pointerdown", "mousemove", "scroll", "touchstart"] as const
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }))

    const id = window.setInterval(() => {
      if (!active.current) return // idle since last tick — let the server time out
      active.current = false
      // Relative URL (ONE ORIGIN); the first-party SameSite=Lax session cookie rides
      // along automatically. Best-effort: a failed ping just means the next real request
      // (or the idle timeout) handles the session — nothing here should throw at a user.
      fetch("/api/auth/ping", { method: "POST" }).catch(() => {})
    }, PING_EVERY_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, mark))
      window.clearInterval(id)
    }
  }, [pathname])

  return null
}
