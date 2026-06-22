# Google Forms builder — COMPGame Stage-1 pack

`build-forms.gs` generates all 11 study forms from the item banks in `../` so you don't hand-type
them. Google Forms has no question import, so this Apps Script *is* the import path.

## Run it

1. Open https://script.google.com → **New project**.
2. Delete the stub, paste all of `build-forms.gs`, **Save**.
3. **Run → `main`**. Authorise when asked (needs Google Forms + Drive — it creates files in your
   Drive).
4. **View → Logs** (or `Ctrl+Enter`): the log prints an **edit URL** and a **live URL** for each
   of the 11 forms. The forms are now in your Drive ("Recent").

What it builds: Consent+Demographics · 8 concept quizzes (Form A/B × 4 topics) · Post battery
(IMI+CoI+ARCS) · Reflection+load. Set `SEPARATE_TOPIC_FORMS = false` at the top if you'd rather
get one combined pre-test and one combined post-test (sectioned by topic) instead of 8 per-topic
forms.

## ⚠️ One required manual step — stop the pre-test leaking answers

The 8 concept forms are created as **auto-graded quizzes** (answer keys baked in, 1 pt/item), so
H1 scores itself in the response sheet. But a Google quiz **shows respondents the correct answers
by default** — if a participant sees the Form A answers, the post-test (Form B) is contaminated.
The Apps Script API can't toggle this, so for **each concept form**:

> **Settings (gear) → Quizzes →** under *"Respondent can see"* turn **OFF**:
> **Missed questions**, **Correct answers**, and **Point values**. Optionally set
> *Release marks → Later (after manual review)*.

This keeps auto-scoring for you while showing the participant nothing. Do it once per concept
form (or do it on one and duplicate). The other three forms (consent, battery, reflection) aren't
quizzes, so they're unaffected.

## Anonymity

Email collection is OFF in every form. Identity is the **participant code** (a short-answer
field at the top of each form) — assign `P01`, `P02`… and don't collect names. If you later turn
on "Limit to 1 response," that forces Google sign-in and de-anonymises — leave it off.

## Getting the data out

- Each form → **Responses → Link to Sheets** → one row per submission, keyed by participant code.
- Concept quizzes also produce a **Score** column (auto-graded) — that's `{topic}_{A|B}_score`.
  Compute `% = score / 6 × 100`, then Hake ⟨g⟩ per `../06_scoring-codebook-analysis.md` §B.
- The battery grid exports one column per item (M1…M12, I1…I8, S1…S5, G1…G3). Reverse-score
  **M9** and **M11** (`6 − raw`) before averaging — see `../06` §C for every subscale map.
- Paas load exports as four 1–9 columns. Reflection open items export as free text for coding.

## Manual fallback (no Apps Script)

If you'd rather build by hand: every form's exact wording, options, scales, and section order is
in the participant files `../01`–`../05`. Build each form by copying those, use a 1–5 multiple-
choice grid for the questionnaire, a 1–9 linear scale for Paas, and (for the concept quizzes)
turn on quiz mode and set the answer key from `../06` §B. The script just automates this.
