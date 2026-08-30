"use client"

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

// Where you are INSIDE a game.
//
// Measured 2026-08-30 (`node frontend/ux-phases.mjs`, 207 screens): 7 games have
// more than one screen and show no "N of M" on ANY of them -- worst is
// problem-solving-understanding, 14 screens with nothing. The games are state
// machines (`learn -> puzzle -> debrief`) and the student is simply not told which
// state they are in or how many are left. Nielsen 1, at the moment they are furthest
// from the app's own frame.
//
// TWO REASONS THIS IS A CONTEXT AND NOT A COMPONENT THE GAME DRAWS ITSELF.
//
// 1. There is already a counter on screen. `app/games/layout.tsx` shows the UNIT's
//    "Step 3 of 7" in a fixed strip. A game that draws its own "2 of 3" somewhere
//    else puts two unrelated counters on one screen, which is worse than one. Routed
//    through here, the in-game position lands in the SAME card, directly under the
//    unit's -- one piece of furniture, read once, nested the way the two counters
//    actually nest.
// 2. The alternative is an indicator per render branch: 7 games x ~4 branches is
//    ~24 insertion points to keep in sync. This is one call per game, at the top of
//    the component, where the phase already lives.
//
// TWO CONTEXTS, NOT ONE, AND THAT IS NOT TIDINESS. Games subscribe only to the
// setter, which `useState` guarantees is stable, so a strip re-render can never
// re-render a game subtree. `hicks-law-assessment` MEASURES REACTION TIME in
// milliseconds; letting chrome updates land inside its render path would perturb the
// thing the experiment is recording.

type Declared = { owner: string; labels: string[]; index: number } | null

const PhaseValue = createContext<Declared>(null)
const PhaseSetter = createContext<Dispatch<SetStateAction<Declared>>>(() => {})

export function GamePhaseProvider({ children }: { children: ReactNode }) {
  const [declared, setDeclared] = useState<Declared>(null)
  return (
    <PhaseSetter.Provider value={setDeclared}>
      <PhaseValue.Provider value={declared}>{children}</PhaseValue.Provider>
    </PhaseSetter.Provider>
  )
}

/** Declare this game's stages and which one is showing. Call it once, at the top.
 *
 *  `labels` are the stages a STUDENT would name, not the `Phase` union -- Hick's has
 *  eight phases and three of them are one warm-up. Four or five labels is the point
 *  at which a rail still reads at a glance.
 */
export function useGamePhase(labels: string[], index: number) {
  const declare = useContext(PhaseSetter)
  const owner = useId()
  // Depend on the JOINED string, never the array. Games pass an inline literal, so
  // a new identity every render would re-fire the effect, set state, re-render, and
  // loop forever.
  const key = labels.join("\u0000")

  useEffect(() => {
    declare({ owner, labels: key.split("\u0000"), index })
    // Only clear if we are still the one on screen: on a route change the next game
    // mounts and declares before the old one's cleanup runs, and an unguarded reset
    // would blank the strip the new game just filled in.
    return () => declare((prev) => (prev?.owner === owner ? null : prev))
  }, [declare, owner, key, index])
}

/** For the strip. Null in free play, and null in a game that has not declared. */
export function useDeclaredPhase(): Declared {
  return useContext(PhaseValue)
}
