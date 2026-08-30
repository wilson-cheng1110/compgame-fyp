import Cookies from "js-cookie"

// Single source of truth for the per-user data blob (passwords, badges,
// topicProgress, pre-test answers — keyed by SID).
//
// WHY THIS EXISTS: this blob used to live in the `users` COOKIE. A cookie is
// capped at ~4096 bytes by every browser; the blob grows ~470 bytes per
// completed topic and crosses 4096 around the 9th of 13 topics. Past that, the
// browser SILENTLY drops the write, so the last topics a student finishes never
// persist their progress/badge. localStorage has a ~5 MB budget, so it holds
// the full journey with room to spare. The lightweight `user` SESSION cookie
// stays a cookie (middleware/GameLayout auth read it server-side).

const KEY = "users"

// Loose by design: this blob was previously `JSON.parse(cookie)` (i.e. `any`)
// and every consumer reads it untyped. Keeping the value `any` preserves that
// behaviour so the migration is a pure storage swap, not a typing change.
export type UsersMap = Record<string, any>

/**
 * Read the users map from localStorage. On first call after the migration ships,
 * transparently lifts any legacy `users` cookie into localStorage and clears the
 * cookie. Returns {} on the server or on any parse error.
 */
export function getUsers(): UsersMap {
  if (typeof window === "undefined") return {}
  try {
    const ls = window.localStorage.getItem(KEY)
    if (ls) {
      // localStorage is authoritative; drop any stale cookie so it can't shadow it.
      if (Cookies.get(KEY)) Cookies.remove(KEY)
      return JSON.parse(ls) as UsersMap
    }
    // One-time migration from the legacy cookie.
    const legacy = Cookies.get(KEY)
    if (legacy) {
      window.localStorage.setItem(KEY, legacy)
      Cookies.remove(KEY)
      return JSON.parse(legacy) as UsersMap
    }
    return {}
  } catch (e) {
    console.error("getUsers failed", e)
    return {}
  }
}

/** Persist the users map to localStorage and remove any legacy cookie copy. */
/**
 * The users map, with `sid` guaranteed to HAVE a record.
 *
 * WHY THIS EXISTS -- the bug it closes was a silent, ten-week loss of the
 * behavioural half of the dataset. `markGameComplete`, `recordReflection` and
 * `addBadge` all did `const users = getUsers(); if (!users[sid]) return`, and
 * nothing created that record: both onboarding writes are guarded
 * `if (users[sid])` and only ever UPDATE one. That was harmless while accounts
 * lived in this blob and signup wrote it here. Since accounts moved server-side
 * (2026-08-16) a student's record is simply never created, so every one of those
 * writes hit the guard and returned.
 *
 * The sink shows it exactly: `understanding_complete` and `assessment_complete`
 * both stop dead on 2026-06-23, while `topic_pretest`, `topic_probe` and
 * `topic_complete` run to the present day. Units were completing with no recorded
 * gameplay at all -- which also means `game_done`, `assess_done` and
 * `played_understanding_first`, the independent variable, were never written.
 *
 * It stayed invisible because the unit's activity step carried a self-declared
 * "I've finished it -- continue": students went past regardless, and nothing on
 * screen depended on the observed twin. Removing that button is what surfaced it.
 *
 * A missing per-device cache entry is not a reason to drop a write. Initialise it.
 */
export function ensureUser(sid: string): UsersMap {
  const users = getUsers()
  if (!users[sid]) users[sid] = {}
  return users
}

export function setUsers(users: UsersMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(users))
    if (Cookies.get(KEY)) Cookies.remove(KEY)
  } catch (e) {
    console.error("setUsers failed", e)
  }
}

/** Clear all stored users (used by the reset-password flow). */
export function removeUsers(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
  Cookies.remove(KEY)
}
