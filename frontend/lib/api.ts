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

// EMPTY BY DEFAULT, AND THAT IS THE POINT. Every call below becomes a RELATIVE
// `/api/...`, which `next.config.mjs` rewrites to the API on loopback. Three things
// fall out of that and each one was a real hazard:
//
//   * the build stops being environment-specific. This value is inlined at BUILD
//     time, so a bundle built with an absolute `http://localhost:8080` loads
//     perfectly on a deployed box and then does nothing -- 200s everywhere, no data,
//     no error anyone would look at. That was the single most likely deploy failure
//     and it is now impossible to make by omission rather than documented.
//   * no CORS. Same-origin requests do not preflight, so ALLOWED_ORIGINS stops
//     mattering for the browser at all.
//   * the session cookie stays FIRST-PARTY (SameSite=Lax). A split origin would
//     force SameSite=None, which Safari's ITP and Chrome's third-party-cookie
//     deprecation block by default -- silent sign-in failure for the students on
//     iPhones, which is a lot of them.
//
// Set NEXT_PUBLIC_API_BASE only to point a build at some OTHER host on purpose.
// `e2e/happy-path.mjs` asserts the built bundle contains no absolute API origin.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? ""

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
  /** The one-off prior-knowledge covariate (docs/experiment-design.md §8). Sat once,
   *  during onboarding, never repeated. */
  needsBaseline?: boolean
}

export interface BaselineItem {
  id: string
  stem: string
  options: string[]
}
export interface BaselinePayload {
  items: BaselineItem[]
  n_items: number
}

export type TopicState = "locked" | "open" | "late" | "unscheduled"

export interface JourneyTopic {
  topic_id: string
  order: number
  session: number
  state: TopicState
  arm: "FLIP" | "CONTROL"
  plays_game_first: boolean
  has_bank: boolean
  lecture_terms: string[]
  session_provisional: boolean
  opens: string | null
  closes: string | null
  late: boolean
  pre_done: boolean
  post_done: boolean
  /** A topic can have a probe without an MC bank and vice versa — the two
   *  instruments roll out on different schedules. Never infer one from the other. */
  has_probe?: boolean
  probe_pre_done?: boolean
  probe_post_done?: boolean
  complete: boolean
  /** When the post-check landed (or, for a bankless topic, the game). Null until
   *  the topic is complete. Lets a badge carry a date without a second query. */
  completed_at?: string | null
  /** The pre->post change, as counts. Only populated once the topic is finished —
   *  the checks themselves still never reveal a pre-check score (Part 8.5). */
  pre_correct?: number | null
  pre_total?: number | null
  post_correct?: number | null
  post_total?: number | null
  /** Observed, not claimed: these come from the sink's own game events, so a badge
   *  level reflects what happened rather than what the student ticked. */
  game_done?: boolean
  assess_done?: boolean
  /** A real reflection, not a dismissed dialog. */
  reflection_done?: boolean
  assess_score?: number | null
}

export interface Journey {
  section: string
  /** The section's lecture weekday ("Tue"). Travels with the journey so the dashboard
   *  can explain a locked topic in terms of the student's OWN class rather than
   *  showing a bare date. Optional: a section with no configured day is possible. */
  section_day?: string | null
  telemetry_enabled: boolean
  /** With the battery on a unit roughly doubles; the copy has to say so. */
  questionnaires_enabled?: boolean
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

export interface ProbePayload {
  topic_id: string
  form: "A" | "B"
  probe: string
  telemetry_enabled: boolean
}

// ── calls ─────────────────────────────────────────────────────────────────────

export interface SectionOption {
  code: string
  day: string | null
}

export const auth = {
  /** Sign IN. One failure message by design -- the backend will not tell you whether
   *  a SID exists, so do not try to render a more specific error from the response. */
  start: (sid: string, password: string) =>
    api.post<SessionUser>("/api/auth/session", { sid, password }),
  /** Sign UP. This one DOES distinguish its failures (`error` is one of
   *  not_enrolled | exists | weak_password | bad_section | withdrawn). */
  signup: (sid: string, password: string, section?: string, username?: string) =>
    api.post<SessionUser>("/api/auth/signup", { sid, password, section, username }),
  /** The section picker's options. Public -- the signup form needs them before
   *  anyone has a session. `roster` says whether a class list is gating signup, in
   *  which case the picker is decoration and the list decides. */
  sections: () => api.get<{ sections: SectionOption[]; roster: boolean }>("/api/auth/sections"),
  me: () => api.get<SessionUser>("/api/auth/me"),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
  consent: (agreed: boolean, version?: string) =>
    api.post<{ ok: boolean; version: string }>("/api/auth/consent", { agreed, version }),
  profile: (username?: string, avatarId?: string) =>
    api.post<SessionUser>("/api/auth/profile", { username, avatar_id: avatarId }),
  withdraw: () => api.post<{ ok: boolean; message: string }>("/api/auth/withdraw"),
  getBaseline: () => api.get<BaselinePayload>("/api/auth/baseline"),
  /** Returns `{ ok, recorded, total }` and NEVER a score. These five items cover five
   *  topics the student is about to be measured on; showing how they did would be a
   *  head start on those units. Do not add a score to this response later. */
  submitBaseline: (answers: Record<string, number>, durationMs?: number) =>
    api.post<{ ok: true; recorded: number; total: number }>("/api/auth/baseline", {
      answers,
      duration_ms: durationMs,
    }),
}

export interface AdminParticipant {
  sid: string
  username: string | null
  section: string | null
  created_at: string
  last_seen_at: string | null
  withdrawn: number
  disabled: number
  has_password: number
}

export interface AuditEntry {
  id: number
  at: string
  admin_sid: string
  action: string
  target_sid: string | null
  detail: string | null
}

/** The teacher surface. Guarded twice server-side (session + allowlist file); this
 *  client cannot and does not try to enforce anything -- it only asks. */
export const admin = {
  whoami: () => api.get<{ ok: true; sid: string }>("/api/admin/whoami"),
  participants: () =>
    api.get<{
      participants: AdminParticipant[]
      roster: boolean
      counts: { total: number; withdrawn: number; disabled: number; claimed: number }
    }>("/api/admin/participants"),
  setSection: (sid: string, section: string) =>
    api.post<{ ok: true }>("/api/admin/section", { sid, section }),
  setDisabled: (sid: string, disabled: boolean) =>
    api.post<{ ok: true }>("/api/admin/disable", { sid, disabled }),
  setUsername: (sid: string, username: string) =>
    api.post<{ ok: true }>("/api/admin/username", { sid, username }),
  resetPassword: (sid: string, password: string, endSessions = false) =>
    api.post<{ ok: true; sessions_ended: number }>("/api/admin/password", {
      sid,
      password,
      end_sessions: endSessions,
    }),
  audit: () => api.get<{ entries: AuditEntry[] }>("/api/admin/audit"),

  reports: () => api.get<{ reports: ReportRow[] }>("/api/admin/reports"),
  report: (path: string) =>
    api.get<{ path: string; markdown: string }>(
      `/api/admin/reports/file?path=${encodeURIComponent(path)}`),
  generateReport: (topic: string, section: string) =>
    api.post<{ ok: true; topic: string; section: string }>(
      "/api/admin/reports/generate", { topic, section }),

  schedule: () => api.get<ScheduleGrid>("/api/admin/schedule"),
  /** `commit: false` previews and writes nothing -- see SessionDateResult. */
  setSessionDate: (session: number, section: string, date: string, commit = false) =>
    api.post<SessionDateResult>("/api/admin/schedule", { session, section, date, commit }),
}

export interface ReportRow {
  path: string
  name: string
  /** Safe to put on a projector: the anonymised copy. */
  projectable: boolean
  bytes: number
  modified: string
}

export interface ScheduleGrid {
  sections: Record<string, { day: string; size: number }>
  sessions: { session: number; dates: Record<string, string>; topics: string[] }[]
  problems: string[]
}

/** The two-step edit. A lecture date is the timing of the independent variable, so
 *  the panel previews (`commit: false`), shows `affected`, and only then commits. */
export interface SessionDateResult {
  ok: boolean
  old?: string
  new?: string
  problems?: string[]
  added_problems?: string[]
  affected?: { topic_id: string; from: string; to: string }[]
  committed?: boolean
  error?: string
  message?: string
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
  getProbe: (topicId: string, form: "A" | "B") =>
    api.get<ProbePayload>(`/api/topics/${topicId}/probe/${form}`),
  /** Returns `{ ok, recorded }` and NEVER a grade. Grading is offline and blind
   *  (docs/revamp.md Part 8.2); a level returned here would leak the rubric's
   *  judgement mid-unit and, on the pre-check, is exactly the feedback that
   *  Part 8.5 withholds. Do not add a grade to this response later. */
  submitProbe: (
    topicId: string,
    form: "A" | "B",
    answer: string,
    durationMs?: number,
    telemetry?: Record<string, unknown>,
  ) =>
    api.post<{ ok: true; recorded: true }>(`/api/topics/${topicId}/probe/${form}`, {
      answer,
      duration_ms: durationMs,
      telemetry,
    }),
}
