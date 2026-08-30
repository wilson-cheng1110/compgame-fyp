"use client"

import { Suspense, useEffect, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUnitId, useUnitStep } from "@/lib/unit-link"
import { GamePhaseProvider, useDeclaredPhase } from "@/lib/game-phase"
import { startGameClock } from "@/lib/game-clock"
import { TOPICS } from "@/lib/topic-definitions"

// Shared chrome for every game route.
//
// WHY THIS IS A STRIP AND NOT A BUTTON. Measured 2026-08-30: across all 26 game
// routes the only shared chrome was a single corner Exit link -- no topic, no step,
// no progress -- and `components/game-layout.tsx`, the richer wrapper with a title
// and controls, is imported by exactly zero games. Inside the games it is no better:
// they are state machines (learn -> compare -> debrief); the strip's phase line now
// player where they are in one.
//
// So a student mid-unit went:
//
//     shell   Fitts' Law - Step 3 of 7 - progress rail
//     game    (nothing. a different font, a different palette, one corner link)
//     shell   Step 4 of 7
//
// The app's frame vanished at the door and came back after, which reads as leaving
// the product rather than continuing inside it. That is the confusion, and it is not
// caused by the pixel art -- it is caused by the pixel art being the ONLY thing on
// screen. A video embedded in a page can look like anything; the page around it is
// what says you are still on the page.
//
// The fix is deliberately the smallest one that covers all 26 routes: widen the
// corner slot that is ALREADY PROVEN not to break a canvas -- including the Fitts
// ResponsiveContainer, which scales a fixed 1920x1080 scene and is the fragile one --
// into a strip that names the topic and the step. No game file is touched.
//
// It is rendered in the SHELL register, not the game's. The old Exit was styled in
// Press Start 2P with the games' yellow, so the one piece of app furniture on screen
// was disguised as game UI. `.shell` is a CSS-variable scope only (app/shell.css),
// so wrapping the strip in it gives CUBIK's tokens without leaking a single rule into
// the game -- which matters, because globals.css redefines Tailwind's .text-*
// utilities and the games depend on that.

// The second line of the strip: where you are inside THIS game.
//
// It reuses `.u-rail`, which is already the unit's eight steps, the journey's
// thirteen topics and the badges page's level. All four encode one idea -- a
// position in a bounded sequence -- so they get one graphic rather than a fourth
// invented one, and a student learns to read it once.
//
// The rail is decorative and hidden from assistive tech; the sentence beside it is
// the announced version, and it is a polite live region so a screen-reader user is
// told "Practise, 2 of 3" when the game advances instead of silently landing on a
// new screen.
function PhaseLine() {
  const phase = useDeclaredPhase()
  if (!phase || phase.labels.length < 2) return null
  const { labels, index } = phase

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="u-rail" aria-hidden style={{ flex: 1, minWidth: 56 }}>
        {labels.map((l, i) => (
          <div
            key={l + i}
            className={`u-rail-seg ${i < index ? "is-done" : i === index ? "is-now" : ""}`}
          />
        ))}
      </div>
      <span
        className="text-[12px] whitespace-nowrap"
        data-testid="game-phase"
        aria-live="polite"
        style={{ color: "var(--ink-faint)" }}
      >
        {labels[index]} · {index + 1} of {labels.length}
      </span>
    </div>
  )
}

// The clock starts where the student does. This layout wraps every /games/* route
// and is the only place that sees the entry for all 26 without touching a game file.
function GameClock() {
  const pathname = usePathname()
  const gameId = pathname?.split("/")[2] ?? ""
  useEffect(() => {
    startGameClock(gameId)
    // FE1: mark the unit's step "tried" from the GAME side, on mount — so the unit's
    // "it didn't record" escape only unlocks once the activity actually LOADED, not on
    // the launch-link click. The click could be beaten with open-then-immediate-Back in
    // ~1 s, about as fast as the "I've finished it" button this whole flow replaced.
    // The unit reads this key back on return. Per-device, clearable, NOT a security
    // boundary — the same localStorage key unit-client.tsx writes and reads.
    try {
      const unit = new URLSearchParams(window.location.search).get("unit")
      if (unit) {
        const key = gameId.endsWith("-assessment")
          ? "assess"
          : gameId.endsWith("-understanding")
            ? "game"
            : null
        if (key) localStorage.setItem(`compgame:unit:${unit}:tried:${key}`, "1")
      }
    } catch {
      /* private mode / no storage: the escape simply won't pre-unlock */
    }
  }, [gameId])
  return null
}

function Chrome() {
  const pathname = usePathname()
  const unit = useUnitId()
  const { step, of } = useUnitStep()
  const topic = unit ? TOPICS.find((t: { id: string }) => t.id === unit) : null

  // gestalt-assessment renders the game in an IFRAME whose src is ALSO a /games/*
  // route, so this layout — and this strip — mount a SECOND time inside the frame,
  // duplicating the outer one. Suppress the inner copy. Keyed on the ROUTE, not on
  // "am I inside any iframe" (findings FE2/FE3): the inner document is always
  // /games/gestalt-assessment/app*, so this is precise — the whole app embedded in an
  // external LMS iframe no longer blanks every game's chrome — and it is known at SSR,
  // so there is no one-frame flash of a duplicate strip and no client-only framed
  // state to hydrate. The outer route (/games/gestalt-assessment) is untouched.
  const suppress = pathname?.includes("/gestalt-assessment/app") ?? false

  // Free play: no unit, so no sequence to be at position 3 of. Just the way out.
  const href = unit ? `/topics/${unit}` : "/dashboard"

  if (suppress) return null

  return (
    <div className="shell fixed top-3 left-3 z-[100]">
      <div
        className="rounded-xl px-3 py-2"
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--rule-strong)",
          boxShadow: "0 1px 3px rgba(0,0,0,.10)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        <div className="flex items-center gap-2.5">
        <Link
          href={href}
          aria-label={unit ? "Back to the topic" : "Exit to dashboard"}
          data-testid="game-exit"
          className="text-[13px] font-medium"
          style={{ color: "var(--ink)", textDecoration: "none" }}
        >
          ← {unit ? "Back" : "Exit"}
        </Link>

        {topic && (
          <>
            <span aria-hidden style={{ color: "var(--rule-strong)" }}>|</span>
            {/* The topic name, so the student can see they are still inside the
                thing they clicked, not somewhere else. */}
            <span className="text-[13px]" style={{ color: "var(--ink)", fontWeight: 600 }}>
              {topic.title}
            </span>
          </>
        )}

        {step && of && (
          // The same counter the unit shows, continued across the boundary instead
          // of restarting from nothing. This is the whole point of the strip.
          <span
            className="text-[12px] whitespace-nowrap"
            data-testid="game-step"
            style={{ color: "var(--ink-faint)" }}
          >
            Step {step} of {of}
          </span>
        )}
        </div>

        {/* Nested under the unit's counter, because that is how the two actually
            nest: the whole game is ONE of the unit's steps, and this says where you
            are within it. */}
        <PhaseLine />
      </div>
    </div>
  )
}

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GamePhaseProvider>
        <GameClock />
        {/* useSearchParams opts its subtree out of static prerendering, so it needs a
            Suspense boundary or the whole route becomes dynamic. */}
        <Suspense fallback={null}>
          <Chrome />
        </Suspense>
        {children}
      </GamePhaseProvider>
    </>
  )
}
