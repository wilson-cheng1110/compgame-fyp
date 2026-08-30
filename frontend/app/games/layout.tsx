"use client"

import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { useUnitId, useUnitStep } from "@/lib/unit-link"
import { TOPICS } from "@/lib/topic-definitions"

// Shared chrome for every game route.
//
// WHY THIS IS A STRIP AND NOT A BUTTON. Measured 2026-08-30: across all 26 game
// routes the only shared chrome was a single corner Exit link -- no topic, no step,
// no progress -- and `components/game-layout.tsx`, the richer wrapper with a title
// and controls, is imported by exactly zero games. Inside the games it is no better:
// they are state machines (learn -> compare -> debrief) and only 4 of 24 tell the
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

function Chrome() {
  const unit = useUnitId()
  const { step, of } = useUnitStep()
  const topic = unit ? TOPICS.find((t: { id: string }) => t.id === unit) : null

  // Free play: no unit, so no sequence to be at position 3 of. Just the way out.
  const href = unit ? `/topics/${unit}` : "/dashboard"

  return (
    <div className="shell fixed top-3 left-3 z-[100]">
      <div
        className="flex items-center gap-2.5 rounded-xl px-3 py-2"
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--rule-strong)",
          boxShadow: "0 1px 3px rgba(0,0,0,.10)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
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
    </div>
  )
}

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* useSearchParams opts its subtree out of static prerendering, so it needs a
          Suspense boundary or the whole route becomes dynamic. */}
      <Suspense fallback={null}>
        <Chrome />
      </Suspense>
      {children}
    </>
  )
}
