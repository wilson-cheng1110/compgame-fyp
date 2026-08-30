# Fixing the style and the flow — a plan

Written 2026-08-30 from `ux-audit-findings.md` (34 surfaces, measured, regenerable with
`node frontend/ux-audit.mjs`). Companion to `ux-walkthrough-plan.md`, which covers the
part a script cannot judge.

## What the numbers actually are

```
                          LANDING PAGES (34)   WALKED IN (207 screens)
primary-action styling             7                    25
distinct page grounds              8                    14
dominant font             2   (Inter, Pixelify Sans)
no visible way back       7 surfaces
controls with no name     3 games
no heading                1 game
tutor missing             2 surfaces
```

**One correction worth keeping.** The first run of the audit reported *one* page
background — white, everywhere — and I wrote that up as the one thing that was unified.
It was an artefact: it measured `<body>`, which ties on area with a `min-h-screen` child
and wins the sort, so the 23 games that paint their cream ground on an inner div all read
as white. Probing what is actually behind the centre of the viewport gives **eight**. The
measure I trusted most was the one that was wrong, and it took someone asking "why is the
page white?" to find it.

**The right-hand column is the real one.** `ux-audit.mjs` measures one screen per route
and found 7 primary styles; `ux-phases.mjs` walks INTO the games and finds **25** across
207 screens. Both are honest -- the first counts front doors, the second the building.
Plan against 25, and treat every count here as a FLOOR: 207 is only what a generic
click-driver reaches, and the three games it cannot advance at all
(`fitts-law-understanding`, `gestalt-understanding`, `gestalt-assessment`) contribute one
screen each. 152 of 207 screens do show an "N of M"; **7 games show none on any screen**.

## Why it looks like this

Two palettes that were never introduced to each other.

- **CUBIK** — Inter, teal `#006666`, white/`#f9fafb`, `rounded-2xl`, black primary buttons.
  Chosen, documented, ported deliberately (`revamp.md` 14.1).
- **The yellow** — `#facc15` fill, `#a16207` border (**142 uses**), `#fde047` hover,
  `#f8f6ee` ground (**103 uses**). **Nobody chose this.** It is v0's scaffolding palette;
  `v0-user-next.config.mjs` still names `v0.blob.com`, and CLAUDE.md records v0 adding
  `output: 'standalone'` "blind by v0". It arrived with the generated games and stayed.

So the two-register split (documented as deliberate) is really *one deliberate register and
one inherited one*. That matters for the fix: you are not reconciling two designs, you are
adopting an accident or replacing it — and either is fine, but it should be a decision.

**And the inherited register has drifted from itself.** Of the 7 primary styles, four are
near-misses of the same button:

```
rgb(250,204,21) 16px Press Start 2P shadow    20 games   the de-facto standard
rgb(250,204,21) 18px Press Start 2P shadow     2 games   same colour, wrong size
rgb(253,224,71) 16px Press Start 2P shadow     1 game    different yellow
rgb(255,225,0)  20px ui-monospace   no-shadow  1 game    different yellow, wrong font
```

That is not a design disagreement. It is copy-paste drift, and it is free to fix.

---

## Wave 1 — mechanical. No design decisions, no debate.

Everything here is a defect by any standard, including the project's own.

| # | Fix | Cost |
|---|---|---|
| 1.1 | Collapse the four near-miss buttons into the 20-game standard. **7 primary styles → 4** | 4 files |
| 1.2 | Name the 3 unnamed controls (gestalt-, hicks-, webers-understanding). A control a screen reader cannot announce is unusable, and it is one attribute | 3 files |
| 1.3 | Give `fitts-law-understanding` a heading | 1 file |
| 1.4 | Put the tutor on `/account` and `/admin`, or state why those two are exempt | 1 file |
| 1.5 | A way back on the 7 surfaces without one — `/`, `/login`, `/signup`, `/dashboard`, `/about` … Nielsen 3, and the cheapest heuristic there is | ~5 files |

**Do 1.1 by extracting one shared pixel-button class**, not by editing four buttons to
match. Editing four to match is how you get five next month.

## Wave 2 — one decision, then mechanical

**The decision: are there two registers, or one?** The audit cannot answer it; it is a
design call and it should be made once and written down.

- **Two registers (recommended, and already the documented position).** The shell is the
  study; the games are the play. Then the target is exactly **2 primary styles and 2
  grounds** — not 7 and 8. Every game uses the one pixel button on the one cream ground;
  every shell surface uses the one CUBIK button on `#f9fafb`. The remaining six grounds
  (`#03607f`, `#003344`, `#000000`, `#dbeafe`, `#facc15`) are per-game backdrops that
  should become *content inside* the frame, not the frame itself.
- **One register.** Restyle 26 games to CUBIK. Weeks of work, throws away the arcade
  quality that makes the games feel unlike a quiz, and CLAUDE.md warns the games depend on
  `globals.css`'s global `.text-*` redefinitions. **Not recommended.**

Under the two-register answer the target is measurable, which is the point:

```
primary-action styling   25 -> 2
page ground              14 -> 2
```

## Wave 3 — the flow, which is the harder half

Style consistency stops the product feeling broken. It does not make the flow legible.

| # | Fix | Cost |
|---|---|---|
| 3.1 | **In-game progress.** The games are state machines (`learn -> compare -> debrief`) and only **4 of 24** tell the player where they are. Highest severity: every student, 13 topics, 26 routes, at the moment they are furthest from the app's frame | 24 files, or one shared phase-indicator component |
| 3.2 | **The session map.** 13 topics belong to 6 lecture sessions and that structure is invisible; `journey-path.tsx` colours by state, not session | 1 file + the lecture structure |
| 3.3 | **Admin release dates.** A professor edits `topic_schedule.json` by hand today. Also mutates the independent variable, so it must be audited like every other admin action | endpoint + page |

3.1 is the one to do first, and the cheap version is one component the games import,
not 24 bespoke indicators.

---

## Guard it, or it comes back

The audit is a script, so its numbers can be assertions. Add to the browser suite:

```
the product has at most 2 distinct primary-action styles
the product has at most 2 distinct page grounds
every surface has a visible way back
every visible control has an accessible name
```

Written as *at most N*, these ratchet: they pass today at the current number only if you
set N to today's number, so set them to the target and let them fail until Wave 2 lands.
A failing test with a known reason is a to-do list that cannot be forgotten; a passing
test at 7 styles is a rubber stamp.

## What not to do

- **Do not hand-restyle 26 games.** Extract one class; import it.
- **Do not move shell styles into `globals.css`.** It redefines Tailwind's `.text-*`
  utilities globally and the games depend on that — this is why `.shell` scoping exists.
- **Do not fix the grounds by making everything white.** The cream ground is the one part
  of the inherited palette that is doing real work: it separates play from study. Keep
  one cream, not six backdrops.
