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
  /** The end-of-study battery's OWN global window (retention Form C + affect
   *  recall) — separate from any one topic's release window. See
   *  schedule.end_of_study_open on the backend. */
  end_of_study_open?: boolean
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

// ── questionnaires (IMI/CoI/ARCS/Paas, demographics, feedback) ─────────────────
//
// An item defaults to `likert` (no `type` on the wire) -- the shape topic-
// questionnaire.tsx has always rendered. `single` (demographics: GENDER/GAMING/
// AITOOL) carries its OWN `options`; `text` (demographics: AGE; feedback: all four)
// is free text. The scoring key (`reverse`/`subscales`) never reaches this client.

export type QuestionnaireItemType = "likert" | "single" | "text"

export interface QuestionnaireItem {
  id: string
  text: string
  type?: QuestionnaireItemType
  /** Present only on a `single` item -- its own choices, answered as 1..length. */
  options?: string[]
  /** Present only on a bounded `text` item (currently just AGE). CONTRACT: the
   *  answer stays optional -- blank/absent is always fine -- but a NON-EMPTY value
   *  must be a whole number in [min, max] or the server refuses it with
   *  `invalid_age`. Both present together or not at all. */
  min?: number
  max?: number
}

export interface QuestionnaireInstrument {
  id: string
  title: string
  cite: string
  /** The SHARED scale for `likert` items. Empty for an instrument with no likert
   *  items at all (demographics, feedback) -- a `single` item's own `options` or a
   *  `text` item answers independently of this. */
  scale: string[]
  when: string
  items: QuestionnaireItem[]
}

export const questionnaires = {
  get: (name: string) => api.get<QuestionnaireInstrument>(`/api/questionnaire/${name}`),
  submit: (
    name: string,
    answers: Record<string, number | string>,
    extra?: { topic_id?: string; duration_ms?: number },
  ) => api.post<{ ok: true }>(`/api/questionnaire/${name}`, { answers, ...extra }),
  /** Which instruments this session has already submitted -- the one-time
   *  demographics gate and the end-of-study feedback prompt both need this so they
   *  show exactly once. ADDED for that (no prior "have I submitted X" signal existed
   *  on this client). Same three gates (session/ENABLED/consent) as every other
   *  questionnaire route, so it 404s the same way while questionnaires are off. */
  status: () => api.get<{ submitted: string[] }>("/api/questionnaire/_status"),
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
  /** The tutorial DECKS (.pptx) — what the report page surfaces now. Always blind
   *  and SID-free, so every row is safe to project. Download via a same-origin GET
   *  (see deckDownloadUrl) so the HttpOnly session cookie rides along. */
  decks: () => api.get<{ reports: ReportRow[] }>("/api/admin/reports/decks"),
  deckDownloadUrl: (path: string) =>
    `/api/admin/reports/download?path=${encodeURIComponent(path)}`,
  generateReport: (topic: string, section: string) =>
    api.post<{ ok: true; topic: string; section: string }>(
      "/api/admin/reports/generate", { topic, section }),

  /** The OFFLINE, arm-BLIND short-answer grading pass. `gradeRunStatus` READS
   *  grade_runner's coarse state (state + timestamps only — NEVER a grade, answer, SID
   *  or arm); `gradeRun` TRIGGERS one and returns state "started" | "already_running"
   *  (or a non-ok result on a 429 throttle / 400 unknown topic). Same admin gate as
   *  everything else on this surface; the researcher list is never consulted. */
  gradeRunStatus: () => api.get<GradeRunStatus>("/api/admin/grade-run"),
  gradeRun: (topic?: string) =>
    api.post<{ ok: true; state: GradeRunTrigger }>(
      "/api/admin/grade-run", topic ? { topic } : {}),

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
  /** Deck rows carry structured parts so the page can show a human title.
   *  (Absent on the older .md brief rows.) */
  topic?: string | null
  section?: string | null
  date?: string | null
}

export interface ScheduleGrid {
  sections: Record<string, { day: string; size: number }>
  sessions: { session: number; dates: Record<string, string>; topics: string[] }[]
  problems: string[]
}

/** The offline blind grading pass's coarse status — `grade_runner.status()` verbatim.
 *  It is coarse BY DESIGN: never a grade, an answer, a SID or an arm. `error`, present
 *  only after a failed run, is the exception TYPE (e.g. "RuntimeError"), never a
 *  message (which could carry a path or a value). */
export type GradeRunState = "idle" | "running" | "done" | "error"
export interface GradeRunStatus {
  state: GradeRunState
  started_at?: string
  finished_at?: string
  error?: string
}
/** What a TRIGGER (`admin.gradeRun`) returns on success: it either started a pass, or
 *  found one already in flight (single-flight — nothing new was launched). */
export type GradeRunTrigger = "started" | "already_running"

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

// ── researcher (PI) surface ─────────────────────────────────────────────────
//
// A SEPARATE gate from `admin`, on purpose. The teacher surface is blind to
// arms/scores/export (research integrity); this one shows exactly those, so it is
// gated on `researcher_sids.txt` — a list the teacher need not be on. This client only
// asks; the backend (researcher_api.py) enforces both the session and the allowlist.

export interface ResearcherMonitor {
  sink: { total_events: number; participants: number }
  accounts: {
    total: number
    claimed: number
    withdrawn: number
    disabled: number
    by_section: Record<
      string,
      { total: number; claimed: number; withdrawn: number; disabled: number }
    >
  }
  coverage: {
    pairs: number
    determinable: number
    complied: number
    no_activity: number
    no_posttest: number
    took_escape: number
  }
  /** Per topic, in release order. Counts are over participants with any event on that
   *  topic, by their ASSIGNED arm — the operational "is my data filling in balanced". */
  arms: {
    topic_id: string
    order: number
    flip: number
    control: number
    determinable: number
    complied: number
    no_activity: number
    no_posttest: number
  }[]
  /** Distinct participants who finished each questionnaire instrument. */
  questionnaires: Record<string, number>
  /** Per event_type capture census — the stale-event-type / capture-gap detector. Counts
   *  only (COUNT(DISTINCT participant_id)), never a raw participant id. */
  sink_census: SinkCensusRow[]
  /** Counts-only reconcile of sink participant streams vs auth accounts. No SID leaves. */
  sink_reconcile: SinkReconcile
  roster_active: boolean
  /** Rows dropped as non-roster (test/e2e) traffic, or null when no roster is gating. */
  test_traffic_excluded: number | null
}

export interface SinkCensusRow {
  event_type: string
  n: number
  /** DISTINCT participants who produced this event type — never the ids themselves. */
  participants: number
  first_seen: string | null
  last_seen: string | null
}

export interface SinkReconcile {
  /** Distinct raw participant_id streams in the sink. */
  sink_streams: number
  /** Distinct people after folding the check-letter (12345678 and 12345678D → one). */
  sink_canonical_people: number
  accounts_canonical: number
  matched_to_account: number
  /** Canonical sink people with NO matching account — the data-hygiene alarm. */
  excess_no_account: number
  /** People recorded under BOTH the numeric and the check-letter SID. */
  split_by_check_letter: number
}

export interface ForgetPreview {
  sid: string
  events: number
  withdrawn: boolean
  pseudonym: string
}

// ── the research-papers dashboard (Phase 2 live slices) ─────────────────────
//
// Shared demographics distribution + one live slice per paper. All aggregate-only on the
// backend (measures.py returns counts, never a SID); this client only asks.

export interface DemographicsItemAge {
  id: string
  text: string
  kind: "age"
  answered: number
  declined: number
  min: number | null
  max: number | null
  median: number | null
  mean: number | null
  q1: number | null
  q3: number | null
  iqr: number | null
  /** value → count histogram, ascending by value — makes a junk upper tail visible. */
  distribution: { value: number; count: number }[]
}
export interface DemographicsItemSingle {
  id: string
  text: string
  kind: "single"
  answered: number
  /** Each declared option and how many chose it — GENDER's "Prefer not to say" is one such
   *  option, so its count is a real bar, not a missing value. */
  options: { label: string; count: number }[]
  other: number
}
export type DemographicsItem = DemographicsItemAge | DemographicsItemSingle
export interface DemographicsSummary {
  n: number
  test_traffic_excluded: number | null
  items: DemographicsItem[]
}

/** live = a real measure · proxy = a live stand-in for a construct whose PRIMARY analysis
 *  is an offline pass · flag_off = telemetry was off (zero rows) · pending = nothing to
 *  read yet. */
export type PaperLiveStatus = "live" | "proxy" | "flag_off" | "pending" | "unavailable"
export interface PaperStat {
  label: string
  value: string | number
  sub?: string | null
}
export interface PaperTable {
  columns: string[]
  rows: (string | number | null)[][]
}
export interface PaperSlice {
  id: string
  basis: string
  status: PaperLiveStatus
  stats: PaperStat[]
  note?: string | null
  table?: PaperTable | null
}

// ── deployment signal-health (aggregate-only) ──────────────────────────────────
//
// The two offline CLI checks (check_measurement_coverage / check_corpus_coverage),
// surfaced live. Counts, statuses and timestamps only — no participant id crosses the
// wire, same as every other researcher payload. Mirrors the backend summary() dicts.

/** One measurement signal's staleness verdict. `status`: "ok" | "BROKEN" (a severed
 *  capture pipe — the 2026 completion-events loss signature) | "NEVER" | "none". `last`
 *  is a MAX(server_ts) timestamp, never a participant id. */
export interface HealthSignalRow {
  event: string
  what: string
  needed_for: string
  kind: string
  n: number
  recent: number
  last: string | null
  status: string
}
export interface ResearcherSignalHealth {
  window_days: number
  active: number
  signals: HealthSignalRow[]
  not_built: { event: string; what: string; needed_for: string }[]
  manipulation: {
    pairs: number
    determinable: number
    determinable_pct: number
    complied: number
    no_activity: number
    no_posttest: number
    took_escape: number
  }
  effort: {
    submissions: number
    timed: number
    untimed: number
    median_sec_per_item: number | null
    fastest_sec_per_item: number | null
    straight_lined: number
    rapid_guess: number
    rapid_guess_rate: number | null
    verdicts: Record<string, number>
    threshold_s_per_item: number
  }
  /** Hours since the last successful sink backup, or null if none has ever completed —
   *  the one failure that costs the whole dataset, and which can't report its own absence. */
  backup: { hours_since: number | null }
  withdrawals: { stuck_in_sink: number }
  /** Human-readable problem lines (the CLI's exit-code driver). No SID. */
  problems: string[]
  ok: boolean
}
/** Per-topic RAG-corpus coverage. `status`: "ok" | "thin" (< 5 hits) | "uncovered". */
export interface CorpusTopicRow {
  topic: string
  total_hits: number
  status: "ok" | "thin" | "uncovered"
  hits: Record<string, number>
}
export interface ResearcherCorpusHealth {
  db_exists: boolean
  chunks: number
  topics: CorpusTopicRow[]
  uncovered: string[]
  ok: boolean
}
export interface ResearcherHealth {
  signal: ResearcherSignalHealth
  corpus: ResearcherCorpusHealth
}

export const researcher = {
  whoami: () => api.get<{ ok: true; sid: string }>("/api/researcher/whoami"),
  monitor: () => api.get<ResearcherMonitor>("/api/researcher/monitor"),
  /** The shared demographics distribution for the papers dashboard (aggregate-only). */
  demographics: () => api.get<DemographicsSummary>("/api/researcher/demographics"),
  /** Deployment signal-health from the two offline CLI checks (aggregate-only). */
  health: () => api.get<ResearcherHealth>("/api/researcher/health"),
  /** One paper's live-data slice — a normalized envelope rendered generically. */
  paper: (id: string) =>
    api.get<PaperSlice>(`/api/researcher/paper/${encodeURIComponent(id)}`),
  /** Preview a forget: how many rows it would erase, before erasing them. */
  participant: (sid: string) =>
    api.get<ForgetPreview>(`/api/researcher/participant?sid=${encodeURIComponent(sid)}`),
  forget: (sid: string) =>
    api.post<{ ok: true; sid: string; removed: number }>("/api/researcher/forget", { sid }),
  /** The export is a file download: a same-origin GET so the HttpOnly session cookie
   *  rides along (no token in the bundle). One source of truth for the path. */
  exportUrl: (format: "json" | "csv") =>
    `${API_BASE}/api/researcher/export?format=${format}`,
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

// ── the end-of-study battery: Form-C retention re-test ─────────────────────────
//
// Its OWN router (`backend/retention.py`), entirely separate from the live
// pre/post-check path above — same `CheckPayload`/`CheckResult` shapes as
// `topics.getCheck/submitCheck` so `topic-check.tsx`'s item rendering can be reused
// as-is. Options arrive in THIS student's own server-shuffled order (anti-
// collusion) — render them exactly as served, never re-sort.

export const retention = {
  get: (topicId: string) => api.get<CheckPayload>(`/api/retention/${topicId}`),
  submit: (topicId: string, answers: Record<string, string>, durationMs?: number) =>
    api.post<CheckResult>(`/api/retention/${topicId}`, {
      answers,
      duration_ms: durationMs,
    }),
  /** Has the terminal "whole battery is finished" marker already been recorded for
   *  this SID? Mirrors `questionnaires.status()`'s "have I already done this" idiom,
   *  scoped to the one thing this router needs to report. */
  status: () => api.get<{ done: boolean }>("/api/retention/_status"),
  /** Records the terminal marker, once every completed+banked topic already has a
   *  retention row (the server re-checks this — a client that raced ahead is
   *  refused with `{error: "incomplete", missing: [...]}`) . */
  complete: () => api.post<{ ok: true }>("/api/retention/_complete"),
}
