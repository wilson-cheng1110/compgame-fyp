# Brief for the paper-backbone agents (2026-10-16)

Project: HCI Playground (repo FYP_Submission). Flipped-learning study in COMP3423 (PolyU HCI):
~340 students, 13 topics; per topic each student is randomly FLIP (interactive Understanding game
BEFORE the post-check) or CONTROL (post-check first, game after). Within-student design. Pre/post
6-item MC checks (Form A pre, Form B post), unproctored and ungraded; AI tutor (local gemma4:e4b)
reflection after the post-check; per-topic IMI/CoI/ARCS/Paas questionnaires; behavioural telemetry
on checks and games; end-of-study retention battery (Form C MC + application short answer) opens
~23 Nov 2026.

## Your job
Build the BACKBONE of ONE paper, in point form, in `docs/papers/<paper-id>-backbone.md`:
1. **Working title + one-sentence claim** (the honest claim the data supports today).
2. **Research question(s) / hypotheses** (match the pre-registration where one exists).
3. **Literature support** — 8-15 sources that ground the question, each: full citation, DOI/URL,
   one line on what it shows and how it supports or challenges this paper. Mark each VERIFIED
   (you opened the DOI/URL and title+authors+year match) or UNVERIFIED. NEVER invent a citation;
   a missing source is better than a fake one.
4. **Review of the field** — 5-10 points: what is known, what is contested, the gap this fills.
5. **Argument** — the paper's argument as numbered points, from premise to conclusion, with the
   evidence each point rests on (our data, cited, or "to come in Nov").
6. **Our evidence so far** — bullets from the findings below; label interim / exploratory.
7. **Threats and counter-arguments** — strongest objections and how the paper answers them.
8. **Venue fit** — 2-3 candidate venues with one line each.
9. **Open items** — what must happen before writing (data, coding, analyses).

Start from the existing dossier `docs/lit/<paper-id>.md` and `docs/lit/arguments-for-against.md`,
`docs/lit/citation-verification.md`, `docs/lit/data-to-paper-fit.md`, and any pre-registration in
`docs/pre-registration/`. Extend and verify; do not just copy. You MAY spawn sub-agents for web
search. Web queries: generic topic terms only — never send student data, IDs or repo contents.

## Current findings (prod, exploratory unless stated)
- **H1 / immediate (paper 01):** mixed model post ~ condition + pre, ITT: FLIP +0.85..+1.35 / 100
  (p .07-.25); with pre-check external-help covariate +1.35 (p .07). ⟨g⟩ overstates (0.52 vs 0.41).
  Gain ~7 pts = ~5.4 instrument (Form B easier + retest; CONTROL gains with nothing between
  checks) + ~1.3 game. Ceiling: ~73% post = 100. Gestalt FLIP attrition was a routing bug (fixed
  2026-10-08). External help: leaving the page = +7.0 (pre) / +5.5 (post) pts within student;
  44% of pre-checks; FLIP leaves less on post (−6 pp). Decisiveness (selection changes + options
  hovered) lower under FLIP (−0.041 SD, p .010); dwell on correct option +1.5 pp (p .019).
  On-time completions FLIP +2.11 (p .010) vs after-lecture −2.0 (post-hoc).
- **Paper 02:** per-topic IMI/CoI/ARCS: straight-lined 41% / 72% / 73%; FLIP edges IMI interest
  +0.064 (p .022), ARCS-S +0.065 (p .028), nothing else; none survive Holm. Paas FLIP 6.5 vs 6.7.
- **Paper 03/07:** 1,990+ reflections, 51% reach "insight" (tutor flag), 76% of students at least
  once; insight ≈ equal by arm; tracks prior post score weakly (p .07); 9-10% ask for the answer;
  free chat rare (~90 questions; a third DURING checks). Depth coding (two human coders) pending.
- **Paper 04:** ~4,700 checks; median 16 s/item; tab-leaving 40% of checks vs 13-21% of game
  sessions; external help as above; rapid-guess rule NT10 pre-registered.
- **Paper 05:** FLIP-CONTROL ⟨g⟩ gap UG 0.115 vs MSc 0.045; MSc pre ~90 (ceiling). MSc cleared.
- **Paper 06:** compliance 99.7%; per-topic randomisation by alternation (hash parity); SID
  migration froze arms; navigation bug → differential attrition (documented); outages (Windows
  Update reboot, Tailscale funnel) handled by keep-alive; unproctored low-stakes context.
- **Paper 08:** local gemma4:e4b grader, blind offline pass done; κ vs human NOT yet computed;
  tutor p50 ~2 s.
- **Paper 09:** Stroop interference ~650 ms (replicates); Weber JND FLIP 22.6% vs 27.0%; Fitts
  game order-confounded (easy target caught first); Hick shows no choice-count effect; games ~2×
  the pointer activity of checks.

Return to the caller ONLY: file path, 5-line summary, count of VERIFIED vs UNVERIFIED citations.
