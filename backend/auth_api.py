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

NOT AUTHENTICATION. The credential is the SID and there is no secret; the allowlist
is the only gate. Never hang an admin surface off this router.
"""

import os

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import research_store

router = APIRouter(prefix="/api/auth", tags=["auth"])

# http://localhost in dev can't carry a Secure cookie in every browser; the deployed
# box is behind an HTTPS tunnel, so default secure ON and let dev opt out explicitly.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1") != "0"
SESSION_COOKIE = "session"
CONSENT_VERSION = os.environ.get("CONSENT_VERSION", "2026-08-info-sheet-v1")


class SessionRequest(BaseModel):
    sid: str
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


@router.post("/session")
async def create_session(req: SessionRequest, response: Response):
    """Claim an identity. 403 if the SID is not on the enrolled list or has withdrawn.

    The response body is what the frontend writes into its own `user` cookie.
    """
    result = auth_store.start_session(req.sid, req.username, req.avatar_id)
    if result is None:
        # Deliberately one message for "not enrolled" and "withdrawn". A student who
        # withdrew should not have that fact confirmed back to whoever typed their SID.
        response.status_code = 403
        return {"error": "not_enrolled",
                "message": "That student ID isn't on the class list for this study."}

    _set_session_cookie(response, result["token"])
    return {
        "sid": result["sid"],
        "username": result["username"],
        "avatarId": result["avatar_id"],      # camelCase: matches the existing cookie shape
        "section": result["section"],
        "needsOnboarding": result["needs_onboarding"],
        "needsConsent": not _has_consented(result["sid"]),
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
    for row in research_store.fetch_all():
        if row.get("participant_id") == sid and row.get("event_type") == "consent_recorded":
            return True
    return False


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
