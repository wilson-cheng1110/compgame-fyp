"""Answer keys for the in-game assessments, kept off the client.

Found by the browser suite's bundle grep, 2026-08-21: `app/games/gestalt-assessment`
shipped its ten answers inline in the client bundle (`answer: "similarity"`, ...), so
a student with devtools could read the lot in a few seconds.

WHY IT MATTERS AND HOW MUCH. It is **not** a threat to H1 — the primary DV is the
fixed-key MC gain from `quiz-item-banks.md`, which `checks.py` never serves with its
key. But the **in-game assessment score is a secondary DV** (`CLAUDE.md`), and a
secondary DV anyone can trivially max out is not a measure of anything.

WHAT THIS FIXES, AND WHAT IT DOES NOT. The key now lives here and the game asks the
server whether a chosen option is right. That turns "read all ten answers instantly and
silently" into "make repeated guesses that hit the server and are logged". It does not
make the assessment unguessable: the game gives per-question feedback, so five probes
still reveal one answer. Removing that would mean dropping instant feedback, which is
most of what makes the game teach. The residual limitation is recorded in
`docs/revamp.md` 17.1b rather than hidden.

Only gestalt-assessment is here because it is the only game bundle the grep found. If
another one grows an inline key, it belongs in this file too.
"""

_KEYS: dict[str, dict[int, str]] = {
    # Values verbatim from app/games/gestalt-assessment/quiz-game.tsx before the key
    # was removed, so the instrument is unchanged.
    "gestalt-assessment": {
        1: "similarity",
        2: "proximity",
        3: "closure",
        4: "continuity",
        5: "symmetry",
        6: "similarity",
        7: "proximity",
        8: "closure",
        9: "continuity",
        10: "closure",
    },
}


def has_key(game_id: str) -> bool:
    return game_id in _KEYS


def n_questions(game_id: str) -> int:
    return len(_KEYS.get(game_id, {}))


def is_correct(game_id: str, question_id: int, answer: str) -> bool | None:
    """-> True/False, or None when the game or question is unknown.

    Returns ONLY a verdict on what was submitted. It never returns the right answer,
    so a wrong guess teaches nothing beyond "not that one".
    """
    key = _KEYS.get(game_id)
    if not key or question_id not in key:
        return None
    return key[question_id] == str(answer).strip().lower()


def score(game_id: str, answers: dict) -> dict | None:
    """Score a whole submission. `answers` maps question id -> chosen option."""
    key = _KEYS.get(game_id)
    if not key:
        return None
    correct = 0
    for qid, right in key.items():
        given = answers.get(str(qid), answers.get(qid))
        if given is not None and str(given).strip().lower() == right:
            correct += 1
    total = len(key)
    return {"correct": correct, "total": total,
            "score": round(100.0 * correct / total, 1) if total else None}


def build_router():
    """Built in a function so importing this module never requires fastapi."""
    import asyncio

    from fastapi import APIRouter, Cookie, Response
    from pydantic import BaseModel

    import auth_store

    router = APIRouter(prefix="/api/games", tags=["games"])

    async def _signed_in(session: str | None) -> bool:
        # resolve_session off the event loop (finding C2). These oracle endpoints are
        # hit per in-game probe during an assessment, so keep the auth read off the loop.
        user = await asyncio.to_thread(auth_store.resolve_session, session or "")
        return user is not None

    class Attempt(BaseModel):
        question_id: int
        answer: str

    class Submission(BaseModel):
        answers: dict[str, str]

    @router.post("/{game_id}/check")
    async def check(game_id: str, body: Attempt, response: Response,
                    session: str | None = Cookie(default=None)):
        # Signed in, because an unauthenticated oracle is one anyone can grind at
        # leisure. It is not a strong control — a signed-in student can still probe —
        # but it puts every probe against a participant id in the server log.
        if not await _signed_in(session):
            response.status_code = 401
            return {"error": "no_session"}

        verdict = is_correct(game_id, body.question_id, body.answer)
        if verdict is None:
            response.status_code = 404
            return {"error": "unknown_question"}
        return {"correct": verdict}

    @router.post("/{game_id}/score")
    async def final_score(game_id: str, body: Submission, response: Response,
                          session: str | None = Cookie(default=None)):
        if not await _signed_in(session):
            response.status_code = 401
            return {"error": "no_session"}
        result = score(game_id, body.answers)
        if result is None:
            response.status_code = 404
            return {"error": "unknown_game"}
        return result

    return router


if __name__ == "__main__":
    import json
    print(json.dumps({g: {"n": n_questions(g)} for g in _KEYS}, indent=2))
