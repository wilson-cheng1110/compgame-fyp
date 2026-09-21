"""The questionnaire surface: IMI, CoI, ARCS, the Paas load item, demographics and
end-of-study feedback.

    GET  /api/questionnaire/_status               which instruments this SID has submitted
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

ITEM TYPES. An item defaults to `likert` (answer 1..len(instrument scale), the original
shape) but may declare `type: "single"` (a categorical choice; the item itself carries
`options`, answer 1..len(options)) or `type: "text"` (free text, capped at TEXT_MAX_LEN,
stored as-is). `demographics` mixes `text` (AGE -- typed, not bucketed) with `single`
(GENDER/GAMING/AITOOL); `feedback` is all `text`. GET forwards `type`/`options`
unchanged so the client can render the right control; POST validates per item against
whichever shape that item declares.

OFF BY DEFAULT. `QUESTIONNAIRES_ENABLED=1` turns it on, and that is a DEPLOYMENT
decision tied to the HSESC amendment (docs/ethics-amendment-stage2.md), never a code
change -- the same discipline TELEMETRY_ENABLED already follows in topic_api.py.
Collecting a new class of data about participants is not something a merge should be
able to start.
"""

import json
import asyncio
import os
import re

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


def instrument_names() -> list[str]:
    return list(_load().get("instruments", {}).keys())


# Open text is capped, not unbounded -- a 500KB "answer" is either a bug (paste of
# something else entirely) or an attempt to bloat the sink, and either way it is not
# something the pack's read-and-quote-anonymously process (06_scoring-codebook-
# analysis.md) is built to handle.
TEXT_MAX_LEN = 2000

# ASCII digits only, and `re.match` anchors the start but not the end, so `$` does
# the rest -- `str.isdigit()` was considered and rejected: it accepts Unicode digit
# characters (superscripts, Arabic-Indic digits, ...) that `int()` cannot always
# parse, which would 500 instead of 400 on a deliberately-weird paste.
_WHOLE_INT_RE = re.compile(r"^[0-9]+$")


class Responses(BaseModel):
    # {item_id: 1..len(scale-or-options) for likert/single, or a string for text}
    answers: dict[str, int | str]
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


@router.get("/_status")
async def status(response: Response, session: str | None = Cookie(default=None)):
    """Which instruments this SID has already submitted.

    ADDED for the demographics/feedback rollout: both are ONE-TIME, but at different
    moments in the journey (demographics before the first topic, feedback once every
    released topic is done) that the frontend has to recognise without re-deriving it
    from the whole research sink. Registered ABOVE `/{name}` on purpose -- FastAPI
    matches routes in registration order, and `_status` would otherwise be swallowed
    by `/{name}` as name="_status".

    Same three gates as every other route here (session, ENABLED, consent), so a
    client cannot use this to probe submission state before it is allowed to see the
    item bank at all.
    """
    user, err = await _who(session, response)
    if err:
        return err
    if not ENABLED:
        response.status_code = 404
        return {"error": "not_available"}
    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}
    submitted = []
    for name in instrument_names():
        if await asyncio.to_thread(research_store.has_event, user["sid"],
                                   f"questionnaire_{name}"):
            submitted.append(name)
    return {"submitted": submitted}


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

    # AFFECT_RECALL IS WINDOW-GATED to the end-of-study battery. It records through
    # this SAME generic mechanism (per-topic, one-submission, exactly like paas), so
    # this is the one line questionnaire_api needs -- the window itself is owned by
    # retention.py / schedule.py, not duplicated here. Every other instrument is
    # unaffected by this check.
    if name == "affect_recall" and not schedule.end_of_study_open(user["section"]):
        response.status_code = 403
        return {"error": "not_open",
                "message": "This isn't open yet -- it runs at the end of the study."}

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

    item_by_id = {i["id"]: i for i in inst["items"]}
    unknown = sorted(set(body.answers) - set(item_by_id))
    if unknown:
        response.status_code = 400
        return {"error": "unknown_items", "items": unknown[:5]}

    # PER-ITEM VALIDATION. An item defaults to `likert` (answer 1..len(instrument
    # scale)); `single` validates against that ITEM's own `options` length instead
    # (demographics: GENDER/GAMING/AITOOL each have a different option count); `text`
    # validates it is a string within TEXT_MAX_LEN (demographics: AGE; feedback: all
    # four items). Three separate error codes, not one, because they are different
    # failures a client should handle differently -- a number outside range, the
    # wrong JSON type or an oversized paste, or text that LOOKS free-form but is
    # actually a bounded whole number (AGE).
    #
    # A `text` item MAY also carry `min`/`max` (both ints) -- CONTRACT: the answer
    # stays OPTIONAL (an empty/blank string, or the key simply absent, is fine and
    # is never flagged here), but a NON-EMPTY value must parse as a whole number
    # (digits only -- no sign, decimal point or thousands separator) within
    # [min, max] inclusive, or it is refused as `invalid_age`. A value that passes
    # is NORMALISED to its canonical decimal form (`str(int(trimmed))`) before it is
    # recorded, so " 07 " and "7" store identically rather than baking whitespace or
    # leading zeros into the sample-composition table.
    out_of_range, invalid_text, invalid_age = [], [], []
    normalized_answers = dict(body.answers)
    for item_id, value in body.answers.items():
        item = item_by_id[item_id]
        itype = item.get("type", "likert")
        if itype == "text":
            if not isinstance(value, str) or isinstance(value, bool) or len(value) > TEXT_MAX_LEN:
                invalid_text.append(item_id)
                continue
            lo, hi = item.get("min"), item.get("max")
            if isinstance(lo, int) and isinstance(hi, int):
                trimmed = value.strip()
                if trimmed:
                    if not _WHOLE_INT_RE.match(trimmed) or not (lo <= int(trimmed) <= hi):
                        invalid_age.append(item_id)
                        continue
                    normalized_answers[item_id] = str(int(trimmed))
        else:
            hi = len(item["options"]) if itype == "single" else len(inst["scale"])
            if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= hi:
                out_of_range.append(item_id)
    if out_of_range:
        response.status_code = 400
        return {"error": "out_of_range", "items": sorted(out_of_range)[:5]}
    if invalid_text:
        response.status_code = 400
        return {"error": "invalid_text", "items": sorted(invalid_text)[:5],
                "max_length": TEXT_MAX_LEN}
    if invalid_age:
        bounds = item_by_id[invalid_age[0]]
        response.status_code = 400
        return {"error": "invalid_age", "items": sorted(invalid_age)[:5],
                "min": bounds.get("min"), "max": bounds.get("max")}

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
        # Raw responses only (bar the AGE-style whitespace/leading-zero normalisation
        # above). Reversing and subscale means happen at ANALYSIS time from the
        # pack's codebook -- storing a computed score would bake today's scoring
        # decisions into data that outlives them.
        "meta": {"answers": normalized_answers, "instrument": name,
                 "n_items": len(inst["items"]),
                 # A single instrument-wide scale_max only means something when every
                 # item shares one scale (imi/coi/arcs/paas); demographics/feedback mix
                 # per-item shapes, so this is None for them rather than a misleading 0.
                 "scale_max": len(inst["scale"]) if inst.get("scale") else None},
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
