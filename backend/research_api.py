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

# Behavioural telemetry ships OFF until the HSESC amendment lands -- same flag,
# same module-scope pattern as topic_api.py:34. Kept as its own module constant
# (not imported from topic_api) so this router stays importable standalone, like
# every other router split out of rag_api.py.
TELEMETRY_ENABLED = os.environ.get("TELEMETRY_ENABLED", "0") == "1"


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


# ── the pseudonymisation boundary, in ONE place ───────────────────────────────
#
# Both export paths -- the token-gated /api/research/export here and the
# session-gated /api/researcher/export -- go through these two helpers, so the two
# study-critical properties are decided once and cannot drift apart:
#
#   * REAL SIDs NEVER LEAVE. participant_id is replaced by a stable HMAC pseudonym;
#     there is deliberately no way to ask for identified data over HTTP (that split
#     is the whole point of docs/revamp.md Part 13). The HMAC is stable for the life
#     of backend/.participant_secret, so pre/post rows still join per participant.
#   * WITHDRAWN PARTICIPANTS ARE EXCLUDED. Withdrawal tombstones the account, but the
#     append-only sink is purged only by the manual --forget CLI, so between the two
#     the rows still exist -- filter them here so every export honours the consent-form
#     promise by default, whoever triggered it.

def pseudonymised_rows() -> list[dict]:
    """Every event, withdrawn AND explicitly-excluded participants dropped,
    participant_id pseudonymised.

    Two exclusions, both here so every export honours them by default:
      * WITHDRAWN -- the consent-form promise (see the block above).
      * TEST-TRAFFIC -- the roster-independent deny-list (auth_store.excluded_sids),
        matched on the canonical (_canon_sid) key so a stream under either the numeric or
        the check-letter form of an excluded SID is dropped. Keeps the export in step with
        the researcher dashboards, which drop the same ids via measures.enrolled_only.
    """
    withdrawn = auth_store.withdrawn_sids()
    excluded = auth_store.excluded_sids()
    rows = []
    for r in research_store.fetch_all():
        row = dict(r)
        sid = row.get("participant_id")
        if sid in withdrawn:
            continue
        if excluded and auth_store._canon_sid(sid or "") in excluded:
            continue
        row["participant_id"] = auth_store.pseudonym(sid) if sid else None
        rows.append(row)
    return rows


def rows_as_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    for r in rows:
        writer.writerow({c: r.get(c) for c in EXPORT_COLUMNS})
    return buf.getvalue()


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
    # Board card #09 -- game-route behavioural telemetry (frontend/lib/game-telemetry.tsx),
    # gated the same way topic_api.py gates the check/probe telemetry field (:275-279).
    telemetry: Optional[dict] = None
    # Board card #08 -- per-trial psychophysics capture (frontend/lib/progress-context.tsx
    # markGameComplete's optional `result` param, built by each game-client.tsx). Same
    # TELEMETRY_ENABLED gate as `telemetry` above. Shape is game-specific and untyped here
    # on purpose -- this API stays agnostic to individual games' trial schemas.
    game_result: Optional[dict] = None


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

    # FREE-CHAT TUTOR TURNS (ask_turn / socratic_turn) are BEHAVIOURAL, gated exactly like
    # the telemetry / game_result fields below: recorded only while TELEMETRY_ENABLED, and
    # DROPPED (not refused) when off -- so dev/tests and any pre-approval box never
    # accumulate them, and an old client cannot keep sending after the flag flips off. This
    # closes paper 07's gap: the floating tutor widget (/api/ask) was the one tutor channel
    # with no log (reflection is already captured via reflection_complete). Metadata only --
    # the widget sends usage + latency + length, never the question text.
    if event.event_type in ("ask_turn", "socratic_turn") and not TELEMETRY_ENABLED:
        return {"ok": True, "id": 0}

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

    # Telemetry is accepted only while the flag is on -- mirrors topic_api.py's
    # gating (topic_api.py:275-279). Popped and dropped here rather than left for
    # record_event_status's generic "unknown keys fold into meta" path, so an old
    # client cannot keep sending it after the flag goes off, and nothing
    # pre-approval reaches the sink even as a stray column.
    telemetry = payload.pop("telemetry", None)
    if TELEMETRY_ENABLED and telemetry:
        meta = payload.get("meta")
        meta = dict(meta) if isinstance(meta, dict) else {}
        meta["telemetry"] = telemetry
        payload["meta"] = meta

    # Board card #08 -- same pop-and-gate as telemetry above, so game_result never
    # reaches record_event's generic "unknown keys fold into meta" path and never
    # lands in the sink while the flag is off.
    game_result = payload.pop("game_result", None)
    if TELEMETRY_ENABLED and game_result:
        meta = payload.get("meta")
        meta = dict(meta) if isinstance(meta, dict) else {}
        meta["game_result"] = game_result
        payload["meta"] = meta
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

    # Pseudonymisation + withdrawn-exclusion live in one shared helper (above), used by
    # this token path and the session-gated /api/researcher/export alike.
    rows = pseudonymised_rows()
    if format == "csv":
        return PlainTextResponse(
            rows_as_csv(rows),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=research_events.csv"},
        )
    return JSONResponse(rows)
