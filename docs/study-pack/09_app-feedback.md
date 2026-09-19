# 09 — End-of-study feedback (app-collected, Stage 2)

> Administered **once, at the end of the study** — offered from the dashboard once a participant
> has completed every topic released so far (`backend/questionnaire_api.py`, instrument
> `feedback`). Free text, optional per item, and the whole form is **skippable**: this is
> feedback about the experience, not a study instrument anyone is obliged to complete. Left
> blank, an item is simply not recorded — see `06_scoring-codebook-analysis.md` for how the
> written answers already disclosed on the consent form are handled (course-team read, quoted
> anonymously). `backend/build_questionnaires.py` extracts this table verbatim — edit here, not
> the JSON.

| ID | Text |
|----|------|
| FB_AI | How was the AI tutor for you? Did having to work through it before it gave the answer help your learning, or get in the way? |
| FB_GAME | Did learning a concept by playing the game help you understand it — or was the game mainly just engaging/fun? What worked or didn't about learning-by-playing? |
| FB_OVERALL | Overall, what was most helpful, and what was frustrating or could be improved? |
| FB_EXTRA | Anything else you'd like the course team to know? (optional) |
