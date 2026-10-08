# H1 interim + "why null" analyses (2026-10-08, EXPLORATORY)

Reproduce the numbers in `docs/research-actions-2026-10-03.md` and the disclosure in
`docs/pre-registration/01-flip-effect.md` §1. Input is the PSEUDONYMISED researcher export
(`/api/researcher/export`, JSON) — never commit it. Needs `statsmodels pandas scipy` (not app deps;
use a separate venv — on this Windows box a venv under %TEMP% is blocked by App Control).

    python h1.py       <export.json>   # per-student H1: mixed model, ITT, paired, P(post=100), <g>
    python whynull.py  <export.json>   # Form A/B equivalence (item level) + game dose
    python lateness.py <export.json>   # completion timing vs the lecture, FLIP effect by timing
    python gestalt.py  <export.json>   # where FLIP students stop between pre and post

These are the interim look disclosed in the pre-registration. They are not the confirmatory
analysis; that runs once, after the last topic closes.
