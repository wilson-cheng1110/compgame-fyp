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
