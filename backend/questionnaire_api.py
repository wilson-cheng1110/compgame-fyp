"""The questionnaire surface: IMI, CoI, ARCS and the Paas load item.

    GET  /api/questionnaire/{instrument}          the items, as a student sees them
    POST /api/questionnaire/{instrument}          record one set of responses

H2 (motivation), H3 (interaction) and H4 (satisfaction) are three of the four
CO-EQUAL constructs in docs/experiment-design.md, and until now not one of them had
any way to reach the app -- they existed as paper forms in docs/study-pack/ and as a
"still open" line in CLAUDE.md. Three quarters of the paper's stated constructs were
unmeasurable in the rollout.

ONE MECHANISM, FOUR INSTRUMENTS AS DATA. The bank is generated from the study pack by
build_questionnaires.py, so adding the remaining instruments is data entry rather than
code, and the item text cannot drift away from the validated wording it cites.

THE SCORING KEY NEVER REACHES THE CLIENT, for the same reason the MC answer key does
not (see checks.py). The pack is explicit that subscale membership and reverse-scored
items are researcher-only -- a student who can see that M9 is reverse-scored is being
told which way "looks good", and that is exactly the response bias these instruments
are built to avoid. GET strips both.

OFF BY DEFAULT. `QUESTIONNAIRES_ENABLED=1` turns it on, and that is a DEPLOYMENT
decision tied to the HSESC amendment (docs/ethics-amendment-stage2.md), never a code
change -- the same discipline TELEMETRY_ENABLED already follows in topic_api.py.
Collecting a new class of data about participants is not something a merge should be
able to start.
"""

import json
import asyncio
import os

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import research_store
import schedule

router = APIRouter(prefix="/api/questionnaire", tags=["questionnaire"])

ENABLED = os.environ.get("QUESTIONNAIRES_ENABLED", "0") == "1"

_HERE = os.path.dirname(os.path.abspath(__file__))
BANK_PATH = os.environ.get("QUESTIONNAIRE_BANK",
                           os.path.join(_HERE, "questionnaires.json"))

_bank: dict | None = None
_bank_mtime: float | None = None


def _load() -> dict:
    """Hot-reload on mtime, like schedule.py -- a reworded item must not need a restart."""
    global _bank, _bank_mtime
    try:
        mtime = os.path.getmtime(BANK_PATH)
    except OSError:
        return {"instruments": {}}
    if _bank is None or mtime != _bank_mtime:
        with open(BANK_PATH, encoding="utf-8") as fh:
            _bank = json.load(fh)
        _bank_mtime = mtime
    return _bank


def instrument(name: str) -> dict | None:
    return _load().get("instruments", {}).get(name)


class Responses(BaseModel):
    # {item_id: 1..len(scale)}
    answers: dict[str, int]
    topic_id: str | None = None      # set for per-topic instruments (paas)
    duration_ms: int | None = None


async def _who(session: str | None, response: Response):
    # resolve_session off the event loop — see topic_api._me (finding C2).
    user = await asyncio.to_thread(auth_store.resolve_session, session or "")
    if user is None:
        response.status_code = 401
        return None, {"error": "no_session"}
    return user, None


async def _consented(sid: str) -> bool:
    # Indexed lookup, off the loop (C2). Every recorded path in this app enforces
    # consent first (topic_api, baseline, research_api) — the questionnaire surface
    # was the one that did not (findings F1/S2).
    return await asyncio.to_thread(research_store.has_event, sid, "consent_recorded")


@router.get("/{name}")
async def get_instrument(name: str, response: Response,
                         session: str | None = Cookie(default=None)):
    user, err = await _who(session, response)
    if err:
        return err
    if not ENABLED:
        # 404, not 403: a disabled instrument should look like one that does not
        # exist, so nothing in the UI starts drawing a form it cannot submit.
        response.status_code = 404
        return {"error": "not_available"}
    # Even the item bank is not served before consent (F1/S2): a form a student
    # cannot yet submit should not be drawable, and this keeps the surface uniform
    # with every other participant-facing instrument.
    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}
    inst = instrument(name)
    if not inst:
        response.status_code = 404
        return {"error": "no_such_instrument"}
    # `reverse` and `subscales` are deliberately NOT included.
    return {
        "id": name,
        "title": inst["title"],
        "cite": inst["cite"],
        "scale": inst["scale"],
        "when": inst["when"],
        "items": inst["items"],
    }


@router.post("/{name}")
async def submit(name: str, body: Responses, response: Response,
                 session: str | None = Cookie(default=None)):
    user, err = await _who(session, response)
    if err:
        return err
    if not ENABLED:
        response.status_code = 404
        return {"error": "not_available"}

    # CONSENT GATE (findings F1/S2). Without it a session-but-not-consented student
    # could POST responses straight into the sink before consent exists, and the
    # one-submission guard below would then block the real, post-consent submission.
    # This is the gate every sibling recorded path already enforces.
    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}

    inst = instrument(name)
    if not inst:
        response.status_code = 404
        return {"error": "no_such_instrument"}

    # NOT AN EMPTY SUBMISSION (finding F2). {"answers": {}} otherwise records a row
    # and permanently spends the one allowed submission on no content — the same hole
    # topic_api's check and probe endpoints already close.
    if not body.answers:
        response.status_code = 400
        return {"error": "empty", "message": "Answer the items before submitting."}

    # A topic-scoped instrument (paas) must name a REAL topic (finding F2). research_api
    # rejects an unknown topic_id for the same reason: a made-up id silently inflates
    # the participant×topic denominator. None stays allowed — imi/coi/arcs are
    # cohort-level, not topic-scoped. Fail open if the schedule can't load.
    known = schedule.session_grid_topics()
    if body.topic_id is not None and known and body.topic_id not in known:
        response.status_code = 400
        return {"error": "unknown_topic"}

    valid_ids = {i["id"] for i in inst["items"]}
    hi = len(inst["scale"])
    unknown = sorted(set(body.answers) - valid_ids)
    if unknown:
        response.status_code = 400
        return {"error": "unknown_items", "items": unknown[:5]}
    bad = sorted(k for k, v in body.answers.items() if not isinstance(v, int) or not 1 <= v <= hi)
    if bad:
        response.status_code = 400
        return {"error": "out_of_range", "items": bad[:5], "scale_max": hi}

    # ONE SUBMISSION, like every other instrument here. A second pass is a different
    # measurement occasion and would silently double-weight one participant.
    event = f"questionnaire_{name}"
    if await asyncio.to_thread(research_store.has_event, user["sid"], event, body.topic_id):
        response.status_code = 409
        return {"error": "already_submitted"}

    _row_id, created = await asyncio.to_thread(research_store.record_event_status, {
        "participant_id": user["sid"],
        "event_type": event,
        "topic_id": body.topic_id,
        "duration_ms": body.duration_ms,
        # Raw responses only. Reversing and subscale means happen at ANALYSIS time
        # from the pack's codebook -- storing a computed score would bake today's
        # scoring decisions into data that outlives them.
        "meta": {"answers": body.answers, "instrument": name,
                 "n_items": len(inst["items"]), "scale_max": hi},
    })
    if not created:
        # Lost the one-submission race (finding C1, sibling of topic_api.submit_check).
        # has_event() above passed for two near-simultaneous POSTs; the partial unique
        # index (which covers questionnaire_%) let ONE row win, and this is the loser —
        # its answers did NOT land. Return 409 rather than a false {"ok": True}. The
        # window is real post-C2 because record_event_status runs off the event loop.
        response.status_code = 409
        return {"error": "already_submitted"}
    return {"ok": True}
