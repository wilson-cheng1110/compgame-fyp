# Which games actually record a completion

`node frontend/finishable.mjs`. Watches the wire for
understanding_complete / assessment_complete -- the event the unit now waits on.

**15 of 26** recorded a completion under a generic clicker.

| game | records a completion | clicks | duration reported |
|---|---|---|---|
| `fitts-law-understanding` | **no** | 40 | - |
| `fitts-law-assessment` | yes | 23 | 17.6s |
| `gestalt-understanding` | **no** | 40 | - |
| `gestalt-assessment` | **no** | 40 | - |
| `hicks-law-understanding` | yes | 7 | 5.8s |
| `hicks-law-assessment` | **no** | 40 | - |
| `memory-understanding` | yes | 2 | 2.2s |
| `memory-assessment` | **no** | 40 | - |
| `stroop-understanding` | yes | 18 | 14.0s |
| `stroop-assessment` | yes | 20 | - |
| `webers-law-understanding` | **no** | 40 | - |
| `webers-law-assessment` | yes | 10 | 8.1s |
| `norman-understanding` | yes | 16 | 12.4s |
| `norman-assessment` | yes | 10 | - |
| `mental-model-understanding` | **no** | 40 | - |
| `mental-model-assessment` | **no** | 40 | - |
| `problem-solving-understanding` | **no** | 40 | - |
| `problem-solving-assessment` | yes | 12 | - |
| `visual-perception-understanding` | yes | 2 | 2.2s |
| `visual-perception-assessment` | yes | 12 | - |
| `language-understanding` | yes | 9 | 7.3s |
| `language-assessment` | yes | 12 | - |
| `ergonomics-understanding` | **no** | 40 | - |
| `ergonomics-assessment` | yes | 12 | - |
| `experiment-design-understanding` | **no** | 40 | - |
| `experiment-design-assessment` | yes | 12 | - |

## Play these by hand before go-live

- `fitts-law-understanding`
- `gestalt-understanding`
- `gestalt-assessment`
- `hicks-law-assessment`
- `memory-assessment`
- `webers-law-understanding`
- `mental-model-understanding`
- `mental-model-assessment`
- `problem-solving-understanding`
- `ergonomics-understanding`
- `experiment-design-understanding`

A "no" here is not proof the game is broken: a clicker cannot do a
reaction-time or pointing task. It means nothing has ever verified it, and
the unit now blocks on it.

## Chrome, exit, and the progress strip (sweep follow-up, 2026-08-30)

Four sweep findings about the game frame, and what each became:

- **M10 (fixed).** `gestalt-assessment`'s in-game Exit buttons hardcoded
  `/dashboard`, so a student launched from a topic unit was dropped OUT of the
  guided flow. `results-screen.tsx` now reads the top window's `?unit=` and
  returns to `/topics/<unit>` when in a unit — matching `game-debrief.tsx` and
  `app/games/layout.tsx`. Verified in-browser: from inside the iframe
  `window.top.location.search` reads `unit=gestalt`.

- **M11 (fixed).** `gestalt-assessment` is the one game rendered in an IFRAME
  whose src is itself a `/games/*` route, so `app/games/layout.tsx` and the AI
  tutor widget mounted a SECOND time inside the frame — a duplicate exit strip
  (showing the wrong "Exit to dashboard", no unit) stacked on the correct outer
  one, and two tutor buttons. Both now return `null` when framed
  (`window.top !== window.self`, mount-gated against hydration mismatch). The
  outer strip already carries the real unit/step and paints above the frame
  (fixed, z-100). Verified: inner exit strips = 0, outer = 1 ("← Back").
  This is deliberately NOT a de-nesting refactor — the game was authored as a
  standalone mini-app; suppressing the duplicate furniture is the proportionate
  fix and touches no game logic.

- **L9 (deliberate boundary, no code).** The outer strip shows `← Back | Topic |
  Step X of Y` for ALL 26 routes (it reads the URL). The finer within-game
  `PhaseLine` ("Practise · 2 of 3") needs each game to DECLARE its phase; 7 do,
  19 do not. Wiring the phase into 19 heterogeneous game state machines is
  high-risk for low marginal value — the unit-level step already tells a student
  they are still in the flow. Left as-is on purpose.

- **M6 (non-defect, no code).** There is no hard gate forcing the Understanding
  game before the standalone Assessment. That is correct by design: `arm` is
  ASSIGNED server-side and `played_first` is OBSERVED from event timestamps
  (`backend/measures.py`), so order is MEASURED, not mandated. A prerequisite
  gate would break the CONTROL arm (assessment-first is a valid condition) and
  free replay. Documented in the `measures.py` docstring.
