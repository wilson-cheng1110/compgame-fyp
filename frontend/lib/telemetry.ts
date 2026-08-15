// Behavioural telemetry — "mouse tracking for thinking, try to cap more parameters".
// Spec: docs/revamp.md Part 11.
//
// TWO THINGS THAT ARE NOT NEGOTIABLE:
//
// 1. OFF BY DEFAULT. Nothing is collected until the HSESC amendment lands and the
//    backend reports `telemetry_enabled: true`. `enabled` is passed in from the
//    server's journey response — never hardcoded, never a client-side default.
//    The backend ALSO strips telemetry it receives while the flag is off, so an
//    old client can't keep sending after it's switched back off. Belt and braces,
//    because "we collected behavioural data before approval" is unrecoverable.
//
// 2. AGGREGATES, NOT TRACES. A raw 60Hz mouse stream is ~1MB per student per topic
//    — 300 students x 13 topics is ~4GB of data nobody will analyse. Everything
//    here reduces to ~30 numbers per item, ~300 bytes. The whole study fits in
//    about 12MB.
//
// The integrity fields (paste, tab-blur) exist because a short-answer probe in 2026
// is trivially answerable by pasting into ChatGPT. They are an ANALYSIS COVARIATE
// and a caveat — never a punishment, never surfaced to the student. Building
// cheating detection into a coursework tool changes the student's relationship to
// it and poisons the very motivation measures the study collects.

const IDLE_MS = 5000

export interface ItemTelemetry {
  time_to_first_input_ms: number | null
  total_time_ms: number
  idle_gap_count: number
  max_idle_ms: number
  path_length_px: number
  direction_changes: number
  hover_dwell_ms: Record<string, number>
  selection_changes: number
  keystrokes: number
  backspaces: number
  time_to_first_keystroke_ms: number | null
  longest_pause_ms: number
  paste_detected: boolean
  tab_blur_count: number
  total_blur_ms: number
  input_modality: "mouse" | "touch" | "unknown"
  viewport_w: number
  viewport_h: number
}

/** Tracks one item. Inert unless `enabled`. */
export class ItemTracker {
  private start = Date.now()
  private firstInput: number | null = null
  private firstKey: number | null = null
  private lastActivity = Date.now()
  private idleGaps = 0
  private maxIdle = 0
  private path = 0
  private turns = 0
  private lastX: number | null = null
  private lastY: number | null = null
  private lastDx = 0
  private hover: Record<string, number> = {}
  private hoverStart: { key: string; at: number } | null = null
  private selections = 0
  private keys = 0
  private backspaces = 0
  private longestPause = 0
  private lastKeyAt: number | null = null
  private pasted = false
  private blurs = 0
  private blurTotal = 0
  private blurStart: number | null = null
  private modality: "mouse" | "touch" | "unknown" = "unknown"

  constructor(private enabled: boolean) {}

  private touch() {
    if (!this.enabled) return
    const now = Date.now()
    const gap = now - this.lastActivity
    if (gap > IDLE_MS) {
      this.idleGaps++
      if (gap > this.maxIdle) this.maxIdle = gap
    }
    this.lastActivity = now
    if (this.firstInput === null) this.firstInput = now - this.start
  }

  onPointerMove(x: number, y: number) {
    if (!this.enabled) return
    if (this.lastX !== null && this.lastY !== null) {
      const dx = x - this.lastX
      const dy = y - this.lastY
      this.path += Math.hypot(dx, dy)
      // A sign flip on the horizontal axis reads as "changed their mind mid-reach".
      if (dx !== 0 && Math.sign(dx) !== Math.sign(this.lastDx) && this.lastDx !== 0) this.turns++
      if (dx !== 0) this.lastDx = dx
    }
    this.lastX = x
    this.lastY = y
    if (this.modality === "unknown") this.modality = "mouse"
  }

  onTouch() {
    if (!this.enabled) return
    this.modality = "touch"
    this.touch()
  }

  /** Hover dwell per option — the highest-value field here and the cheapest.
   *  A student who rests on the right answer, moves to a distractor and comes
   *  back has told you something the score cannot. */
  onHoverStart(key: string) {
    if (!this.enabled) return
    this.hoverStart = { key, at: Date.now() }
  }

  onHoverEnd(key: string) {
    if (!this.enabled || !this.hoverStart || this.hoverStart.key !== key) return
    this.hover[key] = (this.hover[key] ?? 0) + (Date.now() - this.hoverStart.at)
    this.hoverStart = null
  }

  onSelectionChange() {
    if (!this.enabled) return
    this.touch()
    this.selections++
  }

  onKey(key: string) {
    if (!this.enabled) return
    this.touch()
    const now = Date.now()
    if (this.firstKey === null) this.firstKey = now - this.start
    if (this.lastKeyAt !== null) {
      const pause = now - this.lastKeyAt
      if (pause > this.longestPause) this.longestPause = pause
    }
    this.lastKeyAt = now
    this.keys++
    if (key === "Backspace" || key === "Delete") this.backspaces++
  }

  onPaste() {
    if (!this.enabled) return
    this.touch()
    this.pasted = true
  }

  onBlur() {
    if (!this.enabled) return
    this.blurs++
    this.blurStart = Date.now()
  }

  onFocus() {
    if (!this.enabled || this.blurStart === null) return
    this.blurTotal += Date.now() - this.blurStart
    this.blurStart = null
  }

  /** Snapshot. Returns null when disabled, so callers pass it straight through
   *  and nothing is fabricated when collection is off. */
  snapshot(): ItemTelemetry | null {
    if (!this.enabled) return null
    if (this.blurStart !== null) {
      this.blurTotal += Date.now() - this.blurStart
      this.blurStart = null
    }
    if (this.hoverStart) this.onHoverEnd(this.hoverStart.key)

    return {
      time_to_first_input_ms: this.firstInput,
      total_time_ms: Date.now() - this.start,
      idle_gap_count: this.idleGaps,
      max_idle_ms: this.maxIdle,
      path_length_px: Math.round(this.path),
      direction_changes: this.turns,
      hover_dwell_ms: this.hover,
      selection_changes: this.selections,
      keystrokes: this.keys,
      backspaces: this.backspaces,
      time_to_first_keystroke_ms: this.firstKey,
      longest_pause_ms: this.longestPause,
      paste_detected: this.pasted,
      tab_blur_count: this.blurs,
      total_blur_ms: this.blurTotal,
      input_modality: this.modality,
      viewport_w: typeof window === "undefined" ? 0 : window.innerWidth,
      viewport_h: typeof window === "undefined" ? 0 : window.innerHeight,
    }
  }
}

/** Attaches tab-visibility listeners to a set of trackers. Returns a detacher. */
export function watchVisibility(trackers: () => ItemTracker[]): () => void {
  if (typeof document === "undefined") return () => {}
  const onVis = () => {
    const list = trackers()
    if (document.hidden) list.forEach((t) => t.onBlur())
    else list.forEach((t) => t.onFocus())
  }
  document.addEventListener("visibilitychange", onVis)
  return () => document.removeEventListener("visibilitychange", onVis)
}
