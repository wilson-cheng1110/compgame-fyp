"""The researcher (PI) surface, as a standalone APIRouter.

WHY IT IS SEPARATE FROM admin_api, AND WHY THAT SEPARATION IS THE WHOLE POINT.

The teacher (admin) surface is deliberately BLIND to the manipulation: it cannot read
answers, scores, arms, or the pseudonymised export (see admin_api.py's docstring). That
blindness is a research-integrity control, not a permissions convenience -- a lecturer
who learns which students are in FLIP vs CONTROL can teach to compensate, and
differential instruction by condition is a confound that lands on H1 and cannot be
removed after the fact.

So the things the teacher must NOT see -- arm balance, compliance, the export -- live
here, behind a SECOND allowlist file the teacher does not have to be on:

  1. a valid `session` cookie                 -> 401 without one
  2. that session's SID is in RESEARCHER_PATH  -> 403 otherwise

is_researcher is INDEPENDENT of is_admin (not a superset): the PI who also teaches is
on both lists; a teacher who is only a teacher is on neither this list nor this page,
and the page is invisible to them by construction. Nothing here checks is_admin.

WHAT THIS SURFACE DOES:
  * /monitor  read-only. Arm balance and compliance per topic, the coverage headline,
    N per section (including the MSc cross-population section), and questionnaire
    completion. Derived from the sink by measures.py -- no client-reported numbers,
    no Ollama.
  * /export   the pseudonymised dataset, gated on THIS session (is_researcher) rather
    than the X-Export-Token header. Real SIDs never leave -- it shares research_api's
    one pseudonymisation boundary (pseudonymised_rows) with the token path, so the two
    cannot drift. Audited: a dataset leaving the box is a recorded event.
  * /participant + /forget  the erasure the consent form promises. A participant may
    ask for their responses to be discarded; this is the operator action that does it,
    with a preview of the blast radius first and an audit entry after. It does NOT touch
    the account tombstone (that is what stops a withdrawn SID reappearing) -- same
    contract as research_store.forget_participant.

BLIND GRADING STAYS OFFLINE. There is deliberately no grading route here: grade_batch.py
is the blind offline pass (docs/revamp.md Part 8.2), and pulling grading onto a
logged-in web surface would undo the blinding. The monitor reports its STATUS only.
"""

import asyncio
import io
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Cookie, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

import auth_store
import measures
import research_api
import research_store
import schedule

router = APIRouter(prefix="/api/researcher", tags=["researcher"])


class ForgetRequest(BaseModel):
    sid: str


def _researcher(session: Optional[str], response: Response):
    """(sid, None) for a researcher; (None, body) with the status already set otherwise.

    A byte-for-byte parallel of admin_api._admin, on the OTHER allowlist. The failure
    mode of getting a two-part gate wrong once is the whole surface, so it is written
    exactly once and every route below calls it.
    """
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return None, {"error": "no_session"}
    if not auth_store.is_researcher(user["sid"]):
        # 403, and -- like the teacher gate -- no hint about what would make it a 200.
        # A teacher who is not on the researcher list learns only that it is not theirs.
        response.status_code = 403
        return None, {"error": "not_researcher",
                      "message": "This page is for the study's researcher."}
    return user["sid"], None


@router.get("/whoami")
async def whoami(response: Response, session: Optional[str] = Cookie(default=None)):
    """The page asks this before drawing anything -- a teacher or student who guesses
    the URL gets a plain refusal, not a flash of the monitoring dashboard."""
    sid, err = _researcher(session, response)
    if err:
        return err
    return {"ok": True, "sid": sid}


# ── monitoring (read-only) ────────────────────────────────────────────────────

def _build_monitor() -> dict:
    """Everything the monitor shows, derived from the sink. Synchronous and mildly
    heavy (it scans the events table a couple of times via measures), so the handler
    dispatches it off the event loop."""
    known_sections = list(schedule.sections().keys())      # includes MSC

    # N per section, seeded from the schedule so a section with zero sign-ups (a fresh
    # MSc cohort, say) still appears rather than silently missing.
    by_section: dict[str, dict] = {
        s: {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0} for s in known_sections
    }
    parts = auth_store.list_participants()
    totals = {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0}
    for p in parts:
        sec = (p.get("section") or "—")
        bucket = by_section.setdefault(sec, {"total": 0, "claimed": 0, "withdrawn": 0, "disabled": 0})
        bucket["total"] += 1
        totals["total"] += 1
        if p.get("has_password"):
            bucket["claimed"] += 1; totals["claimed"] += 1
        if p.get("withdrawn"):
            bucket["withdrawn"] += 1; totals["withdrawn"] += 1
        if p.get("disabled"):
            bucket["disabled"] += 1; totals["disabled"] += 1

    # Per-topic arm balance + compliance, from the derived manipulation check. ONE scan
    # of the sink, filtered ONCE, and BOTH the coverage headline and the arm table read
    # off that SAME filtered set -- otherwise the two panels on the same page disagree
    # (code review). Two filters:
    #   * enrolled_only -- drop non-roster / e2e traffic when a roster is active (the sink
    #     does not separate test traffic from participants); the dropped count is reported.
    #   * topic in `order` -- keep only real, current schedule topics; an off-schedule or
    #     legacy topic_id has no arm and would otherwise read as a phantom study topic.
    order = {t["id"]: i for i, t in enumerate(schedule._load().get("topics", []))}
    pairs = measures.per_topic()
    pairs, dropped = measures.enrolled_only(pairs)
    pairs = [r for r in pairs if r["topic_id"] in order]

    # Coverage computed INLINE from the same `pairs` -- deliberately NOT measures.coverage(),
    # which re-scans the sink unfiltered and would report a different denominator than the
    # arm table below. Same reductions measures.coverage() uses, over the filtered set.
    determinable = [r for r in pairs if r["played_first"] is not None]
    coverage = {
        "pairs": len(pairs),
        "determinable": len(determinable),
        "complied": sum(1 for r in determinable if r["complied"]),
        "no_activity": sum(1 for r in pairs if r["played_first_basis"] == "activity never recorded"),
        "no_posttest": sum(1 for r in pairs if r["played_first_basis"] == "post-check not sat"),
        "took_escape": sum(1 for r in pairs if r["skipped_activity"]),
    }

    agg: dict[str, dict] = defaultdict(
        lambda: {"flip": 0, "control": 0, "determinable": 0, "complied": 0,
                 "no_activity": 0, "no_posttest": 0})
    for r in pairs:
        a = agg[r["topic_id"]]
        if r["arm"] == schedule.FLIP:
            a["flip"] += 1
        elif r["arm"] == schedule.CONTROL:
            a["control"] += 1
        if r["played_first"] is not None:
            a["determinable"] += 1
            if r["complied"]:
                a["complied"] += 1
        if r["played_first_basis"] == "activity never recorded":
            a["no_activity"] += 1
        elif r["played_first_basis"] == "post-check not sat":
            a["no_posttest"] += 1
    arms = [{"topic_id": tid, "order": order[tid] + 1, **agg[tid]}
            for tid in sorted(agg, key=lambda t: order[t])]

    return {
        "sink": research_store.summary(),
        "accounts": {**totals, "by_section": by_section},
        "coverage": coverage,
        "arms": arms,
        # DISTINCT participants per questionnaire instrument -- "how many finished each".
        "questionnaires": research_store.event_counts_by_type("questionnaire"),
        "roster_active": auth_store.roster_active(),
        "test_traffic_excluded": dropped,   # None when no roster is gating
    }


@router.get("/monitor")
async def monitor(response: Response, session: Optional[str] = Cookie(default=None)):
    sid, err = _researcher(session, response)
    if err:
        return err
    return await asyncio.to_thread(_build_monitor)


# ── the erasure the consent form promises ─────────────────────────────────────

@router.get("/participant")
async def participant(sid: str, response: Response,
                      session: Optional[str] = Cookie(default=None)):
    """Preview a forget: how many rows it would remove, and whether they withdrew.

    A destructive erase should show its blast radius BEFORE it runs -- research_store
    kept count_for() for exactly this. Returns pseudonym too, so the researcher can find
    the same person in an export they already hold.
    """
    who, err = _researcher(session, response)
    if err:
        return err
    target = (sid or "").strip().upper()
    if not target:
        response.status_code = 400
        return {"error": "bad_sid", "message": "Give a student ID."}
    events = await asyncio.to_thread(research_store.count_for, target)
    withdrawn = target in await asyncio.to_thread(auth_store.withdrawn_sids)
    return {"sid": target, "events": events, "withdrawn": withdrawn,
            "pseudonym": auth_store.pseudonym(target)}


@router.post("/forget")
async def forget(body: ForgetRequest, response: Response,
                 session: Optional[str] = Cookie(default=None)):
    """Erase every research event for one participant. Returns rows removed.

    The account tombstone is NOT touched -- it is what stops a withdrawn SID signing up
    again and reappearing in the data, and it is the record that the withdrawal happened
    (same contract as research_store.forget_participant). Audited with the row count, so
    the log alone shows an erasure was carried out and how much it took.
    """
    who, err = _researcher(session, response)
    if err:
        return err
    target = (body.sid or "").strip().upper()
    if not target:
        response.status_code = 400
        return {"error": "bad_sid", "message": "Give a student ID."}
    removed = await asyncio.to_thread(research_store.forget_participant, target)
    auth_store.audit(who, "researcher_forget", target, f"removed={removed}")
    return {"ok": True, "sid": target, "removed": removed}


# ── the export, gated on THIS session (not the token) ─────────────────────────

@router.get("/export")
async def export(response: Response, format: str = "json",
                 session: Optional[str] = Cookie(default=None)):
    """Pseudonymised export, downloaded from the browser by the signed-in researcher.

    Distinct from /api/research/export's X-Export-Token path only in HOW it authorises
    (this session's is_researcher membership vs a header token) -- it shares the SAME
    pseudonymisation boundary (research_api.pseudonymised_rows), so real SIDs never
    leave and withdrawn participants are excluded, identically. Putting the token in the
    browser bundle would leak it; the session cookie is the right credential here.
    Audited -- a dataset leaving the box is a recorded event.
    """
    sid, err = _researcher(session, response)
    if err:
        return JSONResponse(err, status_code=response.status_code)
    rows = await asyncio.to_thread(research_api.pseudonymised_rows)
    auth_store.audit(sid, "researcher_export", None, f"format={format} rows={len(rows)}")
    if format == "csv":
        return PlainTextResponse(
            research_api.rows_as_csv(rows),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=research_events.csv"},
        )
    return JSONResponse(rows)
