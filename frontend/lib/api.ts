// Single front door to the backend. Everything that talks to FastAPI goes through
// here so three things are true in exactly one place:
//
//  1. `credentials: "include"` on EVERY call. The session lives in an HttpOnly
//     cookie the JS can't see; omit this on one fetch and that call is silently
//     anonymous — a 401 that looks like a logic bug.
//  2. One base URL, from NEXT_PUBLIC_API_BASE. `lib/research-log.ts` hardcodes
//     http://localhost:8080, which is exactly why nothing works off the server
//     machine (docs/stage2-deployment-plan.md §A1).
//  3. The backend never throws into the UI. Callers get a typed result and decide.
//
// NOTE the CORS pairing: the backend must list this app's origin explicitly —
// `allow_origins=["*"]` cannot carry credentials.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://localhost:8080"

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  /** Backend's machine-readable code, e.g. "not_enrolled", "already_submitted". */
  error?: string
  /** Message safe to show a student. Never a stack trace. */
  message?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })

    let body: any = null
    try {
      body = await res.json()
    } catch {
      /* 204s and empty error bodies are fine */
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: body?.error ?? `http_${res.status}`,
        message: body?.message ?? friendlyStatus(res.status),
      }
    }
    return { ok: true, status: res.status, data: body as T }
  } catch {
    // Network-level failure: server down, tunnel dropped, offline.
    return {
      ok: false,
      status: 0,
      data: null,
      error: "unreachable",
      message: "Can't reach the server. Check your connection and try again.",
    }
  }
}

function friendlyStatus(status: number): string {
  if (status === 401) return "You're not signed in."
  if (status === 403) return "That isn't available to you right now."
  if (status === 404) return "That isn't here."
  if (status === 409) return "That's already been submitted."
  return "Something went wrong. Try again in a moment."
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
}

// ── shapes the backend returns ────────────────────────────────────────────────

export interface SessionUser {
  sid: string
  username: string | null
  avatarId: string | null
  section: string
  needsOnboarding: boolean
  needsConsent: boolean
}

export type TopicState = "locked" | "open" | "late" | "unscheduled"

export interface JourneyTopic {
  topic_id: string
  order: number
  session: number
  state: TopicState
  arm: "FLIP" | "CONTROL"
  plays_game_first: boolean
  mc_bank: boolean
  has_bank: boolean
  lecture_terms: string[]
  session_provisional: boolean
  opens: string | null
  closes: string | null
  late: boolean
  pre_done: boolean
  post_done: boolean
  complete: boolean
}

export interface Journey {
  section: string
  telemetry_enabled: boolean
  topics: JourneyTopic[]
}

export interface CheckOption {
  letter: string
  text: string
}
export interface CheckItem {
  id: string
  stem: string
  options: CheckOption[]
}
export interface CheckPayload {
  topic_id: string
  form: "A" | "B"
  items: CheckItem[]
  reveals_answers: boolean
}

export interface GradedItem {
  id: string
  answered: string | null
  correct_option?: string
  was_correct?: boolean
}
export interface CheckResult {
  ok: true
  /** Present on the POST-check only — the pre-check deliberately withholds it. */
  score?: number
  correct?: number
  total?: number
  recorded?: number
  items?: GradedItem[]
}

// ── calls ─────────────────────────────────────────────────────────────────────

export const auth = {
  start: (sid: string) => api.post<SessionUser>("/api/auth/session", { sid }),
  me: () => api.get<SessionUser>("/api/auth/me"),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
  consent: (agreed: boolean, version?: string) =>
    api.post<{ ok: boolean; version: string }>("/api/auth/consent", { agreed, version }),
  profile: (username?: string, avatarId?: string) =>
    api.post<SessionUser>("/api/auth/profile", { username, avatar_id: avatarId }),
  withdraw: () => api.post<{ ok: boolean; message: string }>("/api/auth/withdraw"),
}

export const topics = {
  journey: () => api.get<Journey>("/api/topics"),
  detail: (topicId: string) => api.get<JourneyTopic>(`/api/topics/${topicId}`),
  getCheck: (topicId: string, form: "A" | "B") =>
    api.get<CheckPayload>(`/api/topics/${topicId}/check/${form}`),
  submitCheck: (
    topicId: string,
    form: "A" | "B",
    answers: Record<string, string>,
    durationMs?: number,
    telemetry?: Record<string, unknown>,
  ) =>
    api.post<CheckResult>(`/api/topics/${topicId}/check/${form}`, {
      answers,
      duration_ms: durationMs,
      telemetry,
    }),
}
