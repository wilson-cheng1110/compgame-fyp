"""Auth + consent endpoints, as a standalone APIRouter.

WHY A SEPARATE MODULE rather than more routes in rag_api.py: `rag_api.py` imports
chromadb / langchain at module scope, so it cannot even be imported on a machine
without the RAG stack installed (which is the case on this dev box right now).
Auth must not inherit that fragility -- students have to be able to log in whether
or not the tutor is up. This mirrors the existing decision in rag_api.py's startup
that "the research sink must stay up" if Chroma fails.

Wire-up is one line in rag_api.py:

    from auth_api import router as auth_router
    app.include_router(auth_router)

COOKIES -- two, with different jobs (docs/revamp.md Part 0):
  `session`  HttpOnly, SameSite=Lax  -- the identity token, validated server-side
  `user`     JS-readable             -- set by the FRONTEND from our response body,
                                        shape unchanged `{sid, username, avatarId}`
                                        so all 15 Cookies.get("user") sites keep working.

We deliberately do NOT set the `user` cookie here: the frontend already owns it, and
having two writers of one cookie with different encodings is how it starts drifting.

AUTHENTICATION, as of 2026-08-30 (Wilson): the credential is SID + password and the
class list is optional. `auth_store` holds the reasoning; what matters here is the
shape of the two doors.

  POST /signup   distinguishes its failures -- not_enrolled, exists, weak_password,
                 bad_section -- because a signup form that will not say "that account
                 already exists" is unusable.
  POST /session  does NOT. Unknown SID, unclaimed account, wrong password and
                 withdrawn all return the same 401, so this endpoint cannot be walked
                 to discover who is enrolled.

The admin surface still does not belong on this router -- it gets its own, with its
own allowlist file. What changed is only that one is now defensible at all.
"""

import os

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import baseline
import research_store

router = APIRouter(prefix="/api/auth", tags=["auth"])

# http://localhost in dev can't carry a Secure cookie in every browser; the deployed
# box is behind an HTTPS tunnel, so default secure ON and let dev opt out explicitly.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1") != "0"
SESSION_COOKIE = "session"
CONSENT_VERSION = os.environ.get("CONSENT_VERSION", "2026-08-info-sheet-v1")


class SessionRequest(BaseModel):
    sid: str
    password: str = ""
    username: str | None = None
    avatar_id: str | None = None


class SignupRequest(BaseModel):
    sid: str
    password: str
    section: str | None = None
    username: str | None = None
    avatar_id: str | None = None


class ProfileRequest(BaseModel):
    username: str | None = None
    avatar_id: str | None = None


class ConsentRequest(BaseModel):
    agreed: bool
    version: str | None = None


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=auth_store.SESSION_DAYS * 86400,
        path="/",
    )


SIGNUP_MESSAGES = {
    "bad_sid": "Enter your student ID.",
    "weak_password": f"Pick a password of at least {auth_store.MIN_PASSWORD} characters.",
    "not_enrolled": "That student ID isn't on the class list for this study.",
    "bad_section": "Choose which session you attend.",
    "exists": "There's already an account for that student ID — sign in instead.",
    "withdrawn": "That account was withdrawn from the study and can't be reopened.",
}


@router.get("/sections")
async def list_sections():
    """The sections a student can pick from at signup, with their lecture day.

    Public: it is the same information as the course timetable, and the signup form
    needs it before anyone has a session. Read from the schedule config so the picker
    and the release windows can never drift apart.
    """
    import schedule
    return {"sections": [{"code": c, "day": v.get("day")} for c, v in schedule.sections().items()],
            "roster": auth_store.roster_active()}


@router.post("/signup")
async def signup(req: SignupRequest, response: Response):
    """Create an account. Returns the same body as /session so the frontend stores
    one shape either way."""
    result, reason = auth_store.create_account(
        req.sid, req.password, req.section, req.username, req.avatar_id)
    if result is None:
        response.status_code = (409 if reason in ("exists", "withdrawn")
                                else 403 if reason == "not_enrolled" else 400)
        return {"error": reason, "message": SIGNUP_MESSAGES.get(reason, "Couldn't create that account.")}

    _set_session_cookie(response, result["token"])
    return {
        "sid": result["sid"],
        "username": result["username"],
        "avatarId": result["avatar_id"],
        "section": result["section"],
        "needsOnboarding": result["needs_onboarding"],
        "needsConsent": not _has_consented(result["sid"]),
        "needsBaseline": not research_store.has_event(result["sid"], baseline.EVENT_TYPE),
    }


@router.post("/session")
async def create_session(req: SessionRequest, response: Response):
    """Sign in. 401 on any failure, with one message -- see the module docstring.

    The response body is what the frontend writes into its own `user` cookie.
    """
    result = auth_store.start_session(req.sid, req.password)
    if result is None:
        # ONE message for unknown / unclaimed / wrong-password / withdrawn. A student
        # who withdrew must not have that fact confirmed back to whoever typed their
        # SID, and nobody should be able to walk this endpoint to find out who is on
        # the list.
        response.status_code = 401
        return {"error": "bad_credentials",
                "message": "That student ID and password don't match an account."}

    _set_session_cookie(response, result["token"])
    return {
        "sid": result["sid"],
        "username": result["username"],
        "avatarId": result["avatar_id"],      # camelCase: matches the existing cookie shape
        "section": result["section"],
        "needsOnboarding": result["needs_onboarding"],
        "needsConsent": not _has_consented(result["sid"]),
        "needsBaseline": not research_store.has_event(result["sid"], baseline.EVENT_TYPE),
    }


@router.get("/me")
async def whoami(response: Response, session: str | None = Cookie(default=None)):
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}
    return {
        "sid": user["sid"],
        "username": user["username"],
        "avatarId": user["avatar_id"],
        "section": user["section"],
        "needsOnboarding": user["needs_onboarding"],
        "needsConsent": not _has_consented(user["sid"]),
        "needsBaseline": not research_store.has_event(user["sid"], baseline.EVENT_TYPE),
    }


@router.post("/logout")
async def logout(response: Response, session: str | None = Cookie(default=None)):
    if session:
        auth_store.end_session(session)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.post("/profile")
async def set_profile(req: ProfileRequest, response: Response,
                      session: str | None = Cookie(default=None)):
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}
    auth_store.update_profile(user["sid"], req.username, req.avatar_id)
    refreshed = auth_store.resolve_session(session or "")
    return {
        "sid": refreshed["sid"],
        "username": refreshed["username"],
        "avatarId": refreshed["avatar_id"],
        "section": refreshed["section"],
        "needsOnboarding": refreshed["needs_onboarding"],
    }


# ── consent ───────────────────────────────────────────────────────────────────
# Consent is recorded in the research sink rather than the accounts DB: it is a
# research fact with a timestamp and a document version, not a profile field, and
# it must survive in the same append-only log as everything it authorises.

def _has_consented(sid: str) -> bool:
    # Indexed lookup, not a scan of the whole sink — see research_store.has_event.
    return research_store.has_event(sid, "consent_recorded")


@router.post("/consent")
async def record_consent(req: ConsentRequest, response: Response,
                         session: str | None = Cookie(default=None)):
    """Blocking gate: nothing else may record data until this exists for the SID."""
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}
    if not req.agreed:
        response.status_code = 400
        return {"error": "not_agreed",
                "message": "Consent can't be recorded without agreement."}

    research_store.record_event({
        "participant_id": user["sid"],
        "event_type": "consent_recorded",
        "meta": {"version": req.version or CONSENT_VERSION, "section": user["section"]},
    })
    return {"ok": True, "version": req.version or CONSENT_VERSION}


@router.post("/withdraw")
async def withdraw(response: Response, session: str | None = Cookie(default=None)):
    """Consent withdrawal. Tombstones the account and kills every session.

    Research rows are deleted separately and deliberately -- a destructive sweep of
    the append-only sink is not something a web request should be able to trigger.
    """
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    sid = user["sid"]
    research_store.record_event({
        "participant_id": sid,
        "event_type": "consent_withdrawn",
        "meta": {"section": user["section"]},
    })
    auth_store.withdraw(sid)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True,
            "message": "Your account is closed. Ask the researcher to erase your recorded data."}


# ── baseline pre-test ─────────────────────────────────────────────────────────
# The prior-knowledge covariate (docs/experiment-design.md §8), sat once during
# onboarding. It lives on the auth router rather than the topic router because it
# belongs to the ACCOUNT, not to any topic: one sitting, before the first unit, never
# repeated. See backend/baseline.py for why the key stays on this side of the wire.

class BaselineSubmission(BaseModel):
    answers: dict[str, int]
    duration_ms: int | None = None


@router.get("/baseline")
async def get_baseline(response: Response, session: str | None = Cookie(default=None)):
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    if research_store.has_event(user["sid"], baseline.EVENT_TYPE):
        response.status_code = 409
        return {"error": "already_taken"}

    return {"items": baseline.items_for_student(), "n_items": len(baseline.items_for_student())}


@router.post("/baseline")
async def submit_baseline(body: BaselineSubmission, response: Response,
                          session: str | None = Cookie(default=None)):
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    # Consent first, exactly as for every other recorded thing (Part 15). Onboarding
    # runs after consent, so in the normal flow this is already satisfied; it is
    # asserted anyway because "the UI never sends it out of order" is not a control.
    if not _has_consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}

    if research_store.has_event(user["sid"], baseline.EVENT_TYPE):
        response.status_code = 409
        return {"error": "already_taken"}

    graded = baseline.grade(body.answers)

    research_store.record_event({
        "participant_id": user["sid"],
        "event_type": baseline.EVENT_TYPE,
        "score": graded["score"],
        "duration_ms": body.duration_ms,
        "meta": {
            "answered": graded["answered"],
            "total": graded["total"],
            "correct": graded["correct"],
            "chance_pct": graded["chance_pct"],
            "items": graded["items"],
            "section": user["section"],
        },
    })

    # No score comes back. These five items cover five topics the student is about to
    # be measured on; telling them how they did, or which they missed, is a head start
    # on those units and would contaminate the very gain this covariate exists to
    # adjust. Acknowledgement only.
    return {"ok": True, "recorded": graded["answered"], "total": graded["total"]}
