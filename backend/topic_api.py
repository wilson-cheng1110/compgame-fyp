"""The topic unit: journey state, pre/post checks, and submission recording.

See docs/revamp.md Parts 2, 7, 8. Like auth_api, this is a standalone router with
no chromadb/langchain import, so the unit works whether or not the tutor is up.

Order of checks on every submission, and the order matters:

    session  ->  consent  ->  schedule gate  ->  one-submission  ->  grade  ->  record

Consent comes second because nothing may be recorded before it exists (Part 15).
The schedule gate is third and is server-side on purpose: topic availability and
order IS the independent variable (Part 10), so a client-side gate would make the
flip-learning claim unfalsifiable.
"""

import os

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import checks
import grade
import research_store
import schedule

router = APIRouter(prefix="/api/topics", tags=["topics"])

# Behavioural telemetry ships OFF until the HSESC amendment lands (docs/revamp.md
# Parts 0 and 15). The frontend collects nothing while this is false; flipping it
# is a deployment decision, never a code change.
TELEMETRY_ENABLED = os.environ.get("TELEMETRY_ENABLED", "0") == "1"

PRE, POST = "A", "B"
_EVENT = {PRE: "topic_pretest", POST: "topic_posttest"}
_PROBE_EVENT = {PRE: "topic_probe", POST: "topic_probe_post"}


class Submission(BaseModel):
    answers: dict[str, str]
    duration_ms: int | None = None
    telemetry: dict | None = None


def _me(session: str | None):
    return auth_store.resolve_session(session or "")


def _consented(sid: str) -> bool:
    # Indexed lookup, not a scan of the whole sink — see research_store.has_event.
    return research_store.has_event(sid, "consent_recorded")


@router.get("")
async def journey(response: Response, session: str | None = Cookie(default=None)):
    """The dashboard's whole data source: 13 topics in lecture order with state."""
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    states = schedule.topic_states(user["sid"], user["section"])
    # (topic, event) -> when. Still ONE pass over the sink; a dict rather than a set
    # so the client can say WHEN a topic was finished without a second query. The
    # `in done` membership tests below are unchanged by this.
    done, scores = {}, {}
    for r in research_store.fetch_for_participant(user["sid"]):
        key = (r.get("topic_id"), r.get("event_type"))
        done[key] = r.get("server_ts")
        if r.get("score") is not None:
            # The assessment can now be replayed from the debrief, so it is the one
            # event a participant can log more than once -- keep the BEST attempt,
            # or a worse retry would silently drop the badge level a student had
            # already earned. Every attempt is still its own row in the sink; this
            # is a display derivation, not the measurement.
            if r.get("event_type") == "assessment_complete" and key in scores:
                scores[key] = max(scores[key], r.get("score"))
            else:
                scores[key] = r.get("score")
    banks = checks.bank_report()

    for st in states:
        st["has_bank"] = checks.has_bank(st["topic_id"])
        # A topic can have a probe without an MC bank and vice versa -- the two
        # instruments roll out on different schedules (Part 8.4), so the client
        # must not infer one from the other.
        st["has_probe"] = grade.probe_for(st["topic_id"]) is not None
        st["probe_pre_done"] = (st["topic_id"], "topic_probe") in done
        st["probe_post_done"] = (st["topic_id"], "topic_probe_post") in done
        st["pre_done"] = (st["topic_id"], "topic_pretest") in done
        st["post_done"] = (st["topic_id"], "topic_posttest") in done
        # A unit is finished when its post-check is in. Without a bank there is no
        # post-check, so the game completion is what closes it.
        st["complete"] = st["post_done"] or (
            not st["has_bank"] and (st["topic_id"], "assessment_complete") in done)
        # What they actually DID, so the badge level can reflect it rather than the
        # badge itself gating on it. Same single pass -- no extra query. The unit
        # step is self-reported ("I have finished it"); this is the observed twin.
        st["game_done"] = (st["topic_id"], "understanding_complete") in done
        st["assess_done"] = (st["topic_id"], "assessment_complete") in done
        st["assess_score"] = scores.get((st["topic_id"], "assessment_complete"))
        # The pre->post change, as counts rather than the percentage the sink
        # stores. "2 of 6" is a thing a student recognises; "33.3" is not. The
        # pre score is safe to send only because the topic is finished -- the
        # check itself still never reveals it (Part 8.5).
        bank = banks.get(st["topic_id"], {})
        for form, ev, n_key in (("pre", "topic_pretest", "A"),
                                ("post", "topic_posttest", "B")):
            pct, total = scores.get((st["topic_id"], ev)), bank.get(n_key)
            st[f"{form}_total"] = total
            st[f"{form}_correct"] = (round(pct / 100 * total)
                                     if pct is not None and total else None)
        # When it closed, so a badge can carry a date the student recognises.
        st["completed_at"] = (done.get((st["topic_id"], "topic_posttest"))
                              or done.get((st["topic_id"], "assessment_complete")))

    # The section's lecture DAY travels with the journey, not just its letter. The
    # dashboard uses it to say "opens a week before your Tuesday class" instead of
    # showing a date and leaving the student to work out why. It is one field and it
    # saves a second round trip to /api/auth/sections for something that is plainly
    # part of "when does my work open".
    section_day = (schedule.sections().get(user["section"]) or {}).get("day")
    return {"section": user["section"], "section_day": section_day,
            "telemetry_enabled": TELEMETRY_ENABLED, "topics": states}


@router.get("/{topic_id}")
async def topic_detail(topic_id: str, response: Response,
                       session: str | None = Cookie(default=None)):
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    st = schedule.topic_state(user["sid"], user["section"], topic_id)
    if st is None:
        response.status_code = 404
        return {"error": "unknown_topic"}
    if st["state"] in ("locked", "unscheduled"):
        response.status_code = 403
        return {"error": st["state"], "opens": st["opens"],
                "message": "This topic isn't open yet."}

    st["has_bank"] = checks.has_bank(topic_id)
    st["has_probe"] = grade.probe_for(topic_id) is not None
    st["telemetry_enabled"] = TELEMETRY_ENABLED
    return st


@router.get("/{topic_id}/check/{form}")
async def get_check(topic_id: str, form: str, response: Response,
                    session: str | None = Cookie(default=None)):
    """Items for the pre- or post-check. NEVER carries the answer key (Part 8.5)."""
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    form = form.upper()
    if form not in (PRE, POST):
        response.status_code = 400
        return {"error": "bad_form"}

    if not schedule.is_enterable(user["sid"], user["section"], topic_id):
        response.status_code = 403
        return {"error": "not_open"}

    items = checks.items_for_student(topic_id, form)
    if items is None:
        response.status_code = 404
        return {"error": "no_bank", "message": "This topic has no question set yet."}

    if research_store.has_event(user["sid"], _EVENT[form], topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already submitted this one — it can only be answered once."}

    return {"topic_id": topic_id, "form": form, "items": items,
            "reveals_answers": form == POST}


@router.post("/{topic_id}/check/{form}")
async def submit_check(topic_id: str, form: str, body: Submission, response: Response,
                       session: str | None = Cookie(default=None)):
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    form = form.upper()
    if form not in (PRE, POST):
        response.status_code = 400
        return {"error": "bad_form"}

    if not _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}

    st = schedule.topic_state(user["sid"], user["section"], topic_id)
    if st is None or st["state"] in ("locked", "unscheduled"):
        response.status_code = 403
        return {"error": "not_open"}

    # One indexed question, not a scan of the whole sink. This was the same
    # fetch_all() pattern journey() had: measured at 7 s wall for 100 concurrent
    # loads on a full-term sink, because fetch_all holds the module lock.
    if research_store.has_event(user["sid"], _EVENT[form], topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already submitted this one — it can only be answered once."}

    try:
        graded = checks.grade_submission(topic_id, form, body.answers, reveal=(form == POST))
        score = checks.score_only(topic_id, form, body.answers)
    except ValueError:
        response.status_code = 404
        return {"error": "no_bank"}

    meta = {
        "form": form,
        "arm": st["arm"],
        "section": user["section"],
        "late": st["late"],
        "answers": body.answers,
        "n_options": checks.bank_report().get(topic_id, {}).get("n_options"),
    }
    # Telemetry is accepted only while the flag is on. Dropping it here rather than
    # in the frontend means an old client cannot keep sending it after the flag goes
    # off, and nothing pre-approval can slip into the sink.
    if TELEMETRY_ENABLED and body.telemetry:
        meta["telemetry"] = body.telemetry

    research_store.record_event({
        "participant_id": user["sid"],
        "event_type": _EVENT[form],
        "topic_id": topic_id,
        "score": score,                       # always stored; only shown back on POST
        "played_understanding_first": st["plays_game_first"],
        "duration_ms": body.duration_ms,
        "meta": meta,
    })

    if form == PRE:
        # Nothing but acknowledgement. A pre-check that returns its score lets a
        # student infer the key by resubmitting, and contaminates the post-check.
        return {"ok": True, "recorded": graded["answered"], "total": graded["total"]}
    return {"ok": True, **graded}


class ProbeAnswer(BaseModel):
    answer: str
    duration_ms: int | None = None
    telemetry: dict | None = None


@router.get("/{topic_id}/probe/{form}")
async def get_probe(topic_id: str, form: str, response: Response,
                    session: str | None = Cookie(default=None)):
    """The short-answer probe. docs/revamp.md Part 8.1.

    THE PROBE IS FIXED PER TOPIC, NOT GENERATED PER STUDENT. The original note said
    "AI ask question", and the AI does the two jobs it is good at -- grading the
    answer (offline, blind) and the Socratic follow-up. It does NOT author the
    question, because a probe that varies per student is a different instrument per
    student, and answers to different questions cannot be pooled or compared pre to
    post. The question text lives in docs/grading-rubric.md beside the rubric that
    grades it, so the two can never drift apart.

    Unlike the MC items there is no key to protect -- the probe is the question, and
    the answer is prose. It is safe to serve in full.
    """
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    form = form.upper()
    if form not in (PRE, POST):
        response.status_code = 400
        return {"error": "bad_form"}

    if not schedule.is_enterable(user["sid"], user["section"], topic_id):
        response.status_code = 403
        return {"error": "not_open"}

    probe = grade.probe_for(topic_id)
    if not probe:
        response.status_code = 404
        return {"error": "no_probe",
                "message": "This topic has no short-answer probe yet."}

    if research_store.has_event(user["sid"], _PROBE_EVENT[form], topic_id):
        response.status_code = 409
        return {"error": "already_submitted"}

    return {"topic_id": topic_id, "form": form, "probe": probe,
            "telemetry_enabled": TELEMETRY_ENABLED}


@router.post("/{topic_id}/probe/{form}")
async def submit_probe(topic_id: str, form: str, body: ProbeAnswer, response: Response,
                       session: str | None = Cookie(default=None)):
    """Record a short answer. NEVER returns a grade.

    Grading is offline and blind (Part 8.2). Returning a level here would leak the
    rubric's judgement to the student mid-unit, and on the pre-check that is exactly
    the feedback Part 8.5 withholds -- it would teach from the test rather than from
    the intervention. The post-check's feedback is the Socratic turn, which is
    formative and deliberately not a grade.
    """
    user = _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    form = form.upper()
    if form not in (PRE, POST):
        response.status_code = 400
        return {"error": "bad_form"}

    if not _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent"}

    st = schedule.topic_state(user["sid"], user["section"], topic_id)
    if st is None or st["state"] in ("locked", "unscheduled"):
        response.status_code = 403
        return {"error": "not_open"}

    if research_store.has_event(user["sid"], _PROBE_EVENT[form], topic_id):
        response.status_code = 409
        return {"error": "already_submitted"}

    text = (body.answer or "").strip()
    if not text:
        response.status_code = 400
        return {"error": "empty"}

    meta = {
        "form": form,
        "answer": text[:4000],          # bounded: one textarea should not be able to
                                        # write a megabyte into the sink
        "arm": st["arm"],
        "section": user["section"],
        "late": st["late"],
        "probe": grade.probe_for(topic_id),   # stamped, so a later rubric edit cannot
                                              # silently change what was asked
    }
    if TELEMETRY_ENABLED and body.telemetry:
        meta["telemetry"] = body.telemetry

    research_store.record_event({
        "participant_id": user["sid"],
        "event_type": _PROBE_EVENT[form],
        "topic_id": topic_id,
        "played_understanding_first": st["plays_game_first"],
        "duration_ms": body.duration_ms,
        "meta": meta,
    })

    return {"ok": True, "recorded": True}
