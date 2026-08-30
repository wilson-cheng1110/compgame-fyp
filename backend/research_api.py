"""The research sink's HTTP surface, as a standalone router.

Moved out of rag_api.py on 2026-08-16 for the same reason as auth_api/topic_api:
rag_api imports chromadb + langchain at module scope, so nothing defined in it can
be imported — or TESTED — on a box without the RAG stack. These endpoints carry the
study's entire dataset and two security fixes; they need to be verifiable.

The two fixes (docs/revamp.md Part 13, stage2-deployment-plan.md §D4):

  * /api/research/event  — identity comes from the SESSION, never the request body.
    Previously the client posted its own participant_id, so any student could write
    events attributed to a classmate, into the dataset the paper rests on.

  * /api/research/export — was completely unauthenticated and emitted real student
    SIDs, on an internet-exposed tunnel. Now token-gated (failing CLOSED) and
    pseudonymised with no way to ask for identified data. Identified access is
    local-sqlite-only, for the teacher report.
"""

import csv
import io
import os
import asyncio
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Cookie, Header, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

import auth_store
import research_store

router = APIRouter(prefix="/api/research", tags=["research"])


def _known_topics() -> set:
    """The real topic ids, for validating a client-posted topic_id. Lazy import so
    research_api stays importable with no schedule config (like research_store)."""
    try:
        import schedule
        return {t["id"] for t in schedule._load()["topics"]}
    except Exception:
        return set()

EXPORT_COLUMNS = [
    "id", "participant_id", "event_type", "topic_id", "mode", "score",
    "played_understanding_first", "duration_ms", "client_ts", "server_ts", "meta",
]


class ResearchEvent(BaseModel):
    # Optional and IGNORED — identity is taken from the session cookie. Kept in the
    # model so an older client that still sends it gets a clear 401 from the handler
    # rather than a confusing 422 from validation.
    participant_id: Optional[str] = None
    event_type: str
    topic_id: Optional[str] = None
    mode: Optional[str] = None
    score: Optional[float] = None
    played_understanding_first: Optional[bool] = None
    duration_ms: Optional[int] = None
    client_ts: Optional[str] = None
    meta: Optional[Any] = None


@router.post("/event")
async def research_event(event: ResearchEvent, session: Optional[str] = Cookie(default=None)):
    # resolve_session off the event loop — see topic_api._me (finding C2).
    user = await asyncio.to_thread(auth_store.resolve_session, session or "")
    if user is None:
        # Refuse rather than record an unattributable row. A silently anonymous
        # event is worse than a missing one — it pollutes the denominator.
        raise HTTPException(status_code=401, detail="no_session")

    # CONSENT GATE. Found by the sweep: this endpoint checked only the session, so
    # understanding_complete / assessment_complete / topic_complete recorded on an
    # unconsented account — contradicting the study's "nothing recorded before
    # consent" claim, which topic_api's check/probe endpoints DO enforce. An ethics
    # precondition cannot live on only some of the write paths. Staff are dropped in
    # record_event and never get a consent event, so this refuses a teacher too.
    if not await asyncio.to_thread(research_store.has_event, user["sid"], "consent_recorded"):
        raise HTTPException(status_code=403, detail="no_consent")

    # A topic_id that is not a real topic is rejected rather than stored. The sweep
    # posted topic_id="totally-fake-topic-xyz" and it was accepted, silently
    # inflating the participant×topic denominator. None stays allowed (some events
    # are not topic-scoped). Fail OPEN if the schedule can't load — an empty known
    # set must not reject every write.
    known = _known_topics()
    if event.topic_id is not None and known and event.topic_id not in known:
        raise HTTPException(status_code=400, detail="unknown_topic")

    payload = event.model_dump()
    payload["participant_id"] = user["sid"]   # overwrite whatever the client claimed
    try:
        return {"ok": True, "id": await asyncio.to_thread(research_store.record_event, payload)}
    except Exception:
        # Generic body, never str(e): the fuzz sweep showed this handler echoing the
        # raw Python exception text to the client. record_event now sanitises its
        # inputs, so a 500 here is a real server fault — and its internals are not
        # the client's business.
        raise HTTPException(status_code=500, detail="record_failed")


@router.get("/summary")
async def research_summary():
    # Counts only, no identifiers. Left open deliberately so it doubles as a cheap
    # "is the sink alive?" probe for the ops checks in stage2 Loop C.
    return research_store.summary()


@router.get("/export")
async def research_export(format: str = "json",
                          x_export_token: Optional[str] = Header(default=None)):
    """Pseudonymised export. format=json (default) or csv.

    Requires X-Export-Token to match EXPORT_TOKEN. If that env var is UNSET the
    endpoint is DISABLED rather than open — a forgotten config must not silently
    expose the study.

    There is deliberately no `?identified=1`. Real SIDs never leave over HTTP; the
    teacher report reads the sqlite file locally. That split is the point of Part 13.
    The HMAC is stable for the life of backend/.participant_secret, so pre/post rows
    still join per participant across exports — lose that file and past exports stop
    being joinable to future ones.
    """
    expected = os.environ.get("EXPORT_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="export_disabled: set EXPORT_TOKEN in the environment to enable this endpoint",
        )
    if not x_export_token or not secrets.compare_digest(x_export_token, expected):
        raise HTTPException(status_code=401, detail="bad_export_token")

    # EXCLUDE WITHDRAWN PARTICIPANTS. Withdrawal tombstones the account and kills
    # sessions, but the append-only sink is purged only by a manual operator CLI
    # (research_store.py --forget), so between a withdrawal and that purge the export
    # would still ship the person's rows — breaking the consent-form promise if
    # nobody remembers to run it per SID. Filter here so the export honours the
    # promise by default; the CLI purge remains for hard erasure from disk.
    withdrawn = auth_store.withdrawn_sids()
    rows = []
    for r in research_store.fetch_all():
        row = dict(r)
        sid = row.get("participant_id")
        if sid in withdrawn:
            continue
        row["participant_id"] = auth_store.pseudonym(sid) if sid else None
        rows.append(row)

    if format == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow({c: r.get(c) for c in EXPORT_COLUMNS})
        return PlainTextResponse(
            buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=research_events.csv"},
        )
    return JSONResponse(rows)
