# Journey repair — task list

Working state for the repair plan. The reasoning behind the staging lives in the
teardown artifact; this file is the checklist that gets ticked.

Five design calls were settled on 2026-08-27 and everything below assumes them:

| Call | Settled |
|---|---|
| Assessment games | a **required step in every unit, after the post-check**, in both arms |
| Close screen | leads with the **pre→post change**, path underneath |
| Dashboard | **path strip above** the existing list, list stays |
| Declining consent | **change the wording**; no study-free mode |
| Tutor on the reflect step | **questions first, explain on request** |

Rules that hold across every stage:

- Never hard-gate a student out of progressing. A stranded participant at 300
  scale costs more than a soft datum.
- The step order is the experiment. Nothing reorders `pre → post` around the game.
- No new database, ORM or hosted service. One sqlite file.
- The 26 games are not rewritten. What is wrong sits around them.

---

## Stage 1 — say only what is true · **DONE** (`d70aff4`)

- [x] `/account` page: SID, section, data download, two-step withdraw wired to
      `POST /api/auth/withdraw`
- [x] dashboard rail links to it; the lone export button folded in
- [x] consent form states what declining means, above the button; the study-free
      promise removed
- [x] Gestalt probe renders the layout its stem refers to
- [x] item-bank markdown renders instead of leaking asterisks
- [x] two browser tests added and mutation-checked (124 assertions, was 113)

### Stage 1 aftermath — found by the pre-mortem on Stage 1 itself

- [x] **`research_store` had no delete path.** `grep "^def " backend/research_store.py`
      returns eight functions and none of them removes anything; there are zero
      `DELETE` statements. `auth_store.withdraw()` tombstones the account and its own
      docstring says research rows "are removed separately via research_store" — that
      separate removal was never written. Both the approved information sheet
      (`docs/study-pack/01_…` line 44) and the account page I just shipped promise a
      participant can have their responses discarded. Fixed: `forget_participant(sid)` + `count_for(sid)` and a dry-run-by-default CLI
      (`python backend/research_store.py --forget SID [--yes]`), kept OFF the web path on
      purpose, documented in runbook 4, and 9 assertions in test_research_api.py.
- [ ] **The Stage-2 HSESC amendment must match the app's consent screen.** The approved
      pack is the Stage-1 focus-group document; the wide-rollout amendment does not
      exist yet, so the app's consent text is currently governed by nothing. When it is
      written, the two have to say the same thing. *(Wilson)*

---

## Stage 2 — make finishing a topic mean something · **DONE**

- [x] dashboard ring reads the server's `complete` per topic, not the cookie's
      `assessmentCompleted`. The value is already typed and already arriving
      (`lib/api.ts:126`); `app/dashboard/page.tsx:183` ignores it.
- [x] badges derive from server truth (display side), one per completed topic; delete the cookie
      badge store. Level is 1 until Stage 3 has an assessment score to raise it with.
      *Deferred to stage 3:* the cookie store itself still exists because the assessment
      games are its last writer, and they get rewired there. Nothing reads it for display
      any more.
- [x] the unit records its own completion — one `logResearchEvent` at the close step
- [x] close screen rebuilt: pre→post delta first, one plain sentence about what changed,
      path underneath, and a button that continues the journey rather than retreating
      to a list
- [x] path strip above the dashboard list: 13 nodes, position marked, `n of 13`
- [x] browser test: finishing a unit moves the ring and puts a badge on `/badges`, and
      both survive a fresh browser

### Stage 2 aftermath — surfaced by the path strip

- [ ] **The release order and the displayed order disagreed for 10 of the 13 topics.**
      The dashboard iterated `topic-definitions.ts` and numbered 01..13 by array index,
      while the copy directly above it promised "topics open in the order they are
      lectured" and the server released in a different order entirely — Gestalt is
      `order: 9` and was displayed as "02". The list now follows the server, so the
      strip, the numbering and the release all agree.
      **What still needs your eye:** that order comes from `topic_schedule.json`'s
      topics array — norman, memory, problem-solving, stroop, hicks-law, fitts-law … —
      and the dates in that file are placeholders, so the order may be a placeholder
      too. It is now numbered and shown prominently, which makes it worth checking
      against the real timetable. *(Wilson)*
- [x] the e2e test named "dashboard shows the journey in lecture order" only ever
      checked the API payload, never the rendered page, so it passed throughout the
      bug. It now asserts what the student sees, and was mutation-checked against the
      old ordering.

## Stage 3 — reconnect the games, stop guessing whether they were played · **DONE bar one**

- [x] assessment becomes a step in both arms, after the post-check
- [x] the e2e arm-order assertion learns the new sequence, and now asserts the
      measurement invariant (assessment AFTER the post-check) — mutation-checked
- [ ] the yellow in-game "Take the Assessment" CTA becomes "Back to the unit" when the
      game was launched from one
- [x] `app/games/layout.tsx` Exit returns to the unit it came from, not always
      `/dashboard`
- [x] `journey()` gains `game_done` from the existing `understanding_complete` event —
      same loop, no extra query — and the unit records observed *and* claimed
- [x] badge level from what they did — 1 both checks, +1 activity observed, +1 assessment
      played, +1 at 60%, +1 at 80%. Badge itself still earned at the post-check (Wilson).

## Stage 4 — the tutor keeps the landing page's promise

- [ ] tutor step calls `/api/socratic`, not the explain path
- [ ] a visible "just tell me" control that switches to `/api/ask` for that turn
- [ ] `detectTopicFromPath` learns `/topics/…` routes
- [ ] chat renders markdown (`lib/inline-markdown.tsx` already exists from stage 1)
- [ ] panel stops clipping at 1440px; FAB stops overlapping its own panel

## Stage 5 — the polish sweep

- [ ] locked dates carry a year; "Late" says it is still open; NEXT UP stops pointing
      at an overdue topic silently
- [ ] onboarding counters agree (1 of 2 / 2 of 2 / then 3 of 3)
- [ ] baseline's primary button stops being "Skip the rest and finish" at 0 answered
- [ ] ship `click.mp3`; bring the background music in-repo off the external blob host
- [ ] the five principles get button affordances; the Controls card stops describing
      keys that do nothing
- [ ] first check acknowledges the submission before auto-advancing
- [ ] `0 / 6` gets a route onward

---

## Parallel — blocked on Wilson, gates launch regardless

- [x] **week 1 calendar date — resolved.** From the published academic calendar
      (AC.pdf, updated 2026-07-29): Semester One teaching commences **Mon 31 Aug 2026**,
      13 teaching weeks, ends **Sat 28 Nov 2026**. Week 1's Tue/Wed/Thu are 1/2/3 Sep,
      which is exactly what `topic_schedule.json` already held — the dates were never
      wrong, only unverified. Recorded in the file with its provenance.
- [ ] **ONE DECISION: Thursday 1 Oct 2026 is National Day**, and it is section C's
      session 5 — visual-perception, Weber's Law, Gestalt. `--validate` now fails on it
      rather than calling the config sane. Make it up, re-anchor the window, or shift
      section C's later sessions. *(Wilson / the department)*
- [x] **release order follows the lecture decks — checked by READING the slides.**
      A first pass counted keyword hits per deck and was wrong: `consistency` and
      `automatic` are ordinary English, so `stroop` scored 6 in the intro deck; and it
      dismissed a real problem in `memory` as noise. Redone by extracting slide titles
      and then probing for phrases that can only mean one thing.

      **Correct as configured (11 of 13; the other 2 unresolved, not disproved)** — problem-solving (problem space, means-end,
      ill-defined, deck 02), fitts-law (`index of difficulty` x10, deck 02),

      visual-perception and gestalt (deck 03: grouping, `proximity` x13, surroundedness,
      closure via the TIE/data-imputation slides), webers-law (deck 03, thin — `just
      noticeable difference` once, `Weber` never named), mental-model (`mental model` x5,
      deck 03 part 2, the icon-meaning material), language (deck 04: speech acts, Grice's
      maxims), ergonomics (deck 05), experiment-design (deck 06).

      **Retracted 2026-08-27 — my absence claims were too strong.** The method can
      show a concept IS present (quote the slide); it cannot show one is absent, because
      these decks teach concepts without their labels — `Gestalt` and `Weber` never
      appear as words, and the content plainly does. I allowed that for two topics and
      refused it for a third.

      - `stroop` / Principle of Consistency — **IS taught, in three decks.** Deck 01:
        Mac "interface guidelines encouraged consistency between applications". Deck 03
        part 2: a design-principles slide, "Consistency • Location • Format • Element
        Repetition", beside Proximity and Alignment. Deck 06: Nielsen-Molich heuristic 4,
        "Be consistent so users aren't confused". Deck 02 carries the reaction-time half
        ("Reaction time is dependent on stimulus type: Visual ~200ms") and deck 05 an
        auditory "Compatibility" principle. The corpus gate's green is CORRECT; the
        "false green" claim is withdrawn. `consistency` is a named HCI principle here,
        not ordinary English — which is what I mistook it for twice.
      - `memory` — **session 3 is correct** (Wilson, 2026-08-27). Withdrawn from this list.
      - `norman`, `hicks-law` — I found no matching slide content, and the corpus gate
        reports 0 for both. Stated as *no evidence found*, not *absent*: given the
        unlabelled-teaching pattern above, and given the topic set was derived by a
        fan-out session that READ these decks, the prior is that backing exists and I
        have not located it. Worth a human eye before anything is concluded. *(Wilson)*
      *Caveat: 2023 decks. The 2026/27 ones are pending and this needs redoing.* *(Wilson)*
- [x] ~~The vector store is missing content that is in the PDFs~~ — **RETRACTED, false.**
      I claimed the decks contain `Hick` ten times while the corpus reports zero, and
      concluded a rebuild might close that gate. Grounded it against the source of truth
      (`python check_corpus_coverage.py`, 1,407 chunks, run 2026-08-27): `hicks-law
      0 hit(s) -- nothing matched --`. The checker also finds `index of difficulty=10`,
      the exact count deck 02's PDF has, so deck 02 IS indexed and the corpus is fine.
      All ten of my `Hick` matches were the photo credit **"Anthony Schick"** —
      `Hick` is 0. A rebuild would fix nothing. `hicks-law` is genuinely not taught,
      its `session_provisional` flag IS warranted, and it joins the list below.
- [ ] **`check_corpus_coverage.py` gives `stroop` a false green.** It reports 8 hits and
      calls it `ok`, but the hits are `consistency=6, automatic=2` — the same two
      ordinary English words that fooled my first pass. Stroop is not in the decks. The
      term list needs a phrase that can only mean the concept (`Stroop`,
      `stimulus-response compatibility`), or that gate keeps passing a topic with no
      lecture behind it. *(Wilson)*

## Red hat on stages 1-2 — run, not just named

Three premises were named as load-bearing and all three were then tested.

1. **"A badge means you finished the topic."** FALSE as built. Student `24E00273A`
   has no `understanding_complete` and no `assessment_complete` in the sink -- they
   never opened the activity -- and still earned the badge and counted 1 of 13,
   because `complete` is `post_done`. Correct for the measurement, off-message for
   the reward on a product whose whole thesis is play-then-check.
   **Recommendation, for stage 3 when `game_done` lands:** keep the badge at the
   post-check so nobody is stranded and the reward tracks the measurement, and let
   the LEVEL carry what they actually did. No new gate. *(needs Wilson's yes)*

2. **"The assessment games' badge writes are now unread."** TRUE. Four `addBadge`
   call sites still write the cookie store and nothing displays it any more. Stage 3
   rewires them. The grep also found dead code I had just left: `handleExportData`
   (40 lines) lost its caller when the rail became a link to `/account`, and `badges`
   was destructured unused. Both removed.

3. **"The lock serialises a section opening the dashboard together."** TRUE, and now
   measured instead of argued. 100 concurrent loads, sink seeded to a full term
   (27,514 rows):

   | | wall | p50 | p95 | max |
   |---|---|---|---|---|
   | old `fetch_all` + filter | 7,042 ms | 3,584 ms | 6,675 ms | 7,024 ms |
   | new `fetch_for_participant` | 511 ms | 256 ms | 476 ms | 504 ms |
   | same, end to end over HTTP | 560 ms | 247 ms | 466 ms | 491 ms |

   The last student in a section of 100 waited seven seconds for a dashboard.

**Still unratified:** the consent wording. The sentence I removed is not in the
approved Stage-1 pack, so the app moved toward the approved language -- but the
Stage-2 amendment does not exist, so that screen is governed by no approved document.

## Measured, then closed

- ~~`journey()` scans the whole sink per dashboard load~~ — **measured and fixed.**
  Seeded a full term (300 students x 13 topics x 7 events = 27,483 rows):
  `fetch_all()` took **64 ms** to find the ~91 rows belonging to one student, and it
  holds the module lock, so a section opening the dashboard together would serialise
  behind it. Now `fetch_for_participant()` off the existing `idx_events_participant`:
  **4.5 ms**.
