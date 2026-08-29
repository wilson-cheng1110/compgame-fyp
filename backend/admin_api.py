"""Teacher operations, as a standalone APIRouter.

WHY ITS OWN MODULE AND ITS OWN ALLOWLIST. Until 2026-08-30 both `auth_store.py` and
`auth_api.py` carried a standing instruction not to build this: "the session cookie
is an identity hint, never a security boundary -- do not later hang an admin surface
off it without adding a real credential first." That was correct while the credential
was a SID with no secret. Passwords landed first, deliberately, and Wilson lifted the
prohibition afterwards. The order mattered: an admin panel over SID-only auth would
have meant anyone who knew a teacher's SID owned the class.

Two independent things must both hold for any route here:

  1. a valid `session` cookie  -> 401 without one
  2. that session's SID is in ADMIN_PATH -> 403 otherwise

The allowlist is a FILE, not a database flag, for the same reason the enrolment list
is: revoking a teacher must not need a migration or a running app, and the whole list
must be reviewable in one `cat`.

EVERYTHING THAT MUTATES IS AUDITED to `admin_audit`. A section change moves when
topics open for that student, which is the timing of the independent variable; an
unlogged change to an experimental condition is not something the paper could defend.

WHAT THIS DELIBERATELY CANNOT DO:
  * read a student's answers or scores -- that is research_api's export path, which
    pseudonymises at the boundary. A teacher wanting data goes through it.
  * return password material. `list_participants` selects a boolean, not the hash.
  * delete anything. Withdrawal is the participant's own right and runs through
    /api/auth/withdraw plus research_store.forget_participant.
"""

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SectionChange(BaseModel):
    sid: str
    section: str


class PasswordReset(BaseModel):
    sid: str
    password: str
    end_sessions: bool = False


MESSAGES = {
    "bad_section": "That isn't a section this cohort runs.",
    "no_such_user": "No account with that student ID.",
    "weak_password": f"Pick a password of at least {auth_store.MIN_PASSWORD} characters.",
    "roster_authoritative": (
        "A class list is configured, so it decides the section — sign-in re-reads it "
        "every time and would undo this. Edit enrolled_sids.txt instead."
    ),
}


def _admin(session: str | None, response: Response):
    """(sid, None) for a teacher; (None, body) with the status already set otherwise.

    Written as one helper because the alternative is repeating a two-part check on
    every route, and the failure mode of getting that wrong once is the whole panel.
    """
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return None, {"error": "no_session"}
    if not auth_store.is_admin(user["sid"]):
        # 403, and no hint about what would make it a 200.
        response.status_code = 403
        return None, {"error": "not_admin", "message": "This page is for the course team."}
    return user["sid"], None


@router.get("/whoami")
async def whoami(response: Response, session: str | None = Cookie(default=None)):
    """Is the caller a teacher? The /admin page asks this before drawing anything, so
    a student who guesses the URL sees a plain refusal rather than an empty table."""
    sid, err = _admin(session, response)
    if err:
        return err
    return {"ok": True, "sid": sid}


@router.get("/participants")
async def participants(response: Response, session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    rows = auth_store.list_participants()
    return {
        "participants": rows,
        "roster": auth_store.roster_active(),
        "counts": {
            "total": len(rows),
            "withdrawn": sum(1 for r in rows if r["withdrawn"]),
            "claimed": sum(1 for r in rows if r["has_password"]),
        },
    }


@router.post("/section")
async def change_section(body: SectionChange, response: Response,
                         session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    ok, reason = auth_store.set_section(body.sid, body.section)
    if not ok:
        response.status_code = 409 if reason == "roster_authoritative" else 400
        return {"error": reason, "message": MESSAGES.get(reason, "Couldn't change that.")}
    auth_store.audit(sid, "set_section", body.sid, body.section)
    return {"ok": True}


@router.post("/password")
async def reset_password(body: PasswordReset, response: Response,
                         session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    ok, reason = auth_store.set_password(body.sid, body.password)
    if not ok:
        response.status_code = 400
        return {"error": reason, "message": MESSAGES.get(reason, "Couldn't reset that.")}
    ended = auth_store.end_all_sessions(body.sid) if body.end_sessions else 0
    # The new password is NOT echoed back. The teacher typed it and can read it off
    # their own screen; putting it in a response body puts it in every proxy log.
    auth_store.audit(sid, "reset_password", body.sid,
                     f"sessions_ended={ended}" if body.end_sessions else None)
    return {"ok": True, "sessions_ended": ended}


@router.get("/audit")
async def audit(response: Response, session: str | None = Cookie(default=None)):
    """The log of what teachers have done. Visible to teachers, because an audit trail
    nobody can read is decoration."""
    sid, err = _admin(session, response)
    if err:
        return err
    return {"entries": auth_store.audit_log()}
