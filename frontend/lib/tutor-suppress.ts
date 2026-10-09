"use client"

import { useSyncExternalStore } from "react"

// A component can ask the floating AI tutor to step aside while it is on screen.
// The tutor normally hides by URL (ai-chat-widget.tsx `hideOn`), but the end-of-study
// battery lives on /dashboard: hiding by URL would take the tutor off the whole
// dashboard. On the immediate checks 30 of 86 free-chat questions were asked DURING a
// check (2026-10-08), so the retention battery switches it off while it is open.
// A counter, not a boolean, so two suppressors cannot release each other.

let holders = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Hide the tutor until the returned release() is called (call it from an effect cleanup). */
export function suppressTutor(): () => void {
  holders++
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    holders = Math.max(0, holders - 1)
    emit()
  }
}

export function useTutorSuppressed(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => holders > 0,
    () => false,
  )
}
