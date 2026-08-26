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

## Stage 2 — make finishing a topic mean something

- [ ] dashboard ring reads the server's `complete` per topic, not the cookie's
      `assessmentCompleted`. The value is already typed and already arriving
      (`lib/api.ts:126`); `app/dashboard/page.tsx:183` ignores it.
- [ ] badges derive from server truth too, one per completed topic; delete the cookie
      badge store. Level is 1 until Stage 3 has an assessment score to raise it with.
- [ ] the unit records its own completion — one `logResearchEvent` at the close step
- [ ] close screen rebuilt: pre→post delta first, one plain sentence about what changed,
      path underneath, and a button that continues the journey rather than retreating
      to a list
- [ ] path strip above the dashboard list: 13 nodes, position marked, `n of 13`
- [ ] browser test: finishing a unit moves the ring and puts a badge on `/badges`, and
      both survive a fresh browser

## Stage 3 — reconnect the games, stop guessing whether they were played

- [ ] assessment becomes a step in both arms, after the post-check
- [ ] the e2e arm-order assertion learns the new sequence
- [ ] the yellow in-game "Take the Assessment" CTA becomes "Back to the unit" when the
      game was launched from one
- [ ] `app/games/layout.tsx` Exit returns to the unit it came from, not always
      `/dashboard`
- [ ] `journey()` gains `game_done` from the existing `understanding_complete` event —
      same loop, no extra query — and the unit records observed *and* claimed
- [ ] badge level from the assessment score

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

- [ ] **week 1 calendar date.** The timetable settles everything else: Tue/Wed/Thu,
      13 weeks, ~301 students, groups 181+1011 → Tue, 1012 → Wed, 171+1013 → Thu.
      `topic_schedule.json` needs the one date, and checking against the holiday
      calendar — on placeholder dates 1 Oct lands on session 5's Thursday.
- [ ] **corpus coverage** — zero on `norman` and `hicks-law`; `webers-law` thin at 3 hits
- [ ] **the real class list** for `backend/enrolled_sids.txt`
- [ ] a backup of `backend/.participant_secret` held off this machine

## Watch, not scheduled

- `journey()` builds its event set with `research_store.fetch_all()` and filters in
  Python — a full scan per dashboard load. Stages 2 and 3 lean on it harder. Not
  measured at cohort scale.
