"""The end-of-study RETENTION APPLICATION probe: short-answer, its own loader/router.

See docs/retention-application-bank.md and memory feedback-mc-recognition-not-application.
This is the CONSTRUCTED-RESPONSE half of the end-of-study battery, the companion to the
MC Form-C re-test in retention.py. MC is a recognition format (it hands the learner the
answer among the options); the flip-learning DELAYED-RETENTION hypothesis is about
application/transfer, so the discriminating retention DV must make the learner PRODUCE an
application. Form C stays the easy recognition floor; this bank is the hard half.

STANDALONE, exactly like retention.py is to checks.py -- the same hard invariant holds:
the LIVE pre/post path (checks.py, docs/quiz-item-banks.md, topic_schedule.json's topic
rows) and the live short-answer probe (topic_api.py's topic_probe / topic_probe_post,
docs/grading-rubric.md) are never touched. This module has its OWN bank file, its OWN
parser, its OWN router. It reuses retention.py's gate helpers (_me / _consented /
_topic_completed) BY IMPORT rather than reimplementing them, so "a topic is completed"
and "consent is recorded" can never drift between the two halves of the same battery.

CAPTURE-ONLY BY DESIGN. Unlike Form C (deterministic MC, graded + revealed on submit),
a short answer is prose: grading is OFFLINE and BLIND (the same posture as topic_probe --
docs/revamp.md Part 8.2). So this router only SERVES the prompt and RECORDS the answer;
it never returns a grade, and there is no key/rubric to protect from the client because
the prompt is the question and the answer is prose. The model answer and rubric DO live
in the bank (the offline grader will use them), and _load() parses them, but
`prompt_for()` -- the only shape that crosses the wire -- omits them. The offline grading
of these `topic_retention_probe` events, the researcher-dashboard summary, and the
front-end step in end-of-study-battery.tsx are a separate, later slice (the bank's
"Wiring notes"); none of them is required to START collecting the DV, and the end-of-study
window is not open until Nov, so there is no rush.
"""

import asyncio
import os
import re

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import research_store
import schedule
# Reuse the retention (Form-C) battery's gate helpers so completion/consent semantics
# cannot drift between the two halves of one battery. retention.py imports nothing from
# here, so there is no cycle. These are the SAME session/consent/topic-completed gates
# the MC re-test uses; the only difference below is the instrument, not who may sit it.
from retention import _consented, _me, _topic_completed

router = APIRouter(prefix="/api/retention/probe", tags=["retention-probe"])

BANK_PATH = os.environ.get(
    "RETENTION_APPLICATION_BANK_PATH",
    os.path.join(os.path.dirname(__file__), "..", "docs", "retention-application-bank.md"),
)

_banks: dict | None = None
_banks_mtime: float | None = None

# Byte-for-byte grade.py's `_TOPIC_RE` (the `## Title (`topic-id`)` header shared by
# grading-rubric.md and this bank), defined LOCALLY rather than imported -- the same
# discipline retention.py follows with its Form-C regexes, and it keeps this light
# module from pulling in grade.py's LLM/grading stack just for one pattern. The trailing
# "## Wiring notes (...)" section has no `(`topic-id`)`, so it is never parsed as a topic.
_TOPIC_RE = re.compile(r"^##\s+.*?\(`([a-z-]+)`\)\s*$", re.M)
_PROMPT_RE = re.compile(
    r"^\*\*Prompt\.\*\*\s*(.+?)(?=\n\*\*Model answer\.\*\*)", re.M | re.S)
_MODEL_RE = re.compile(
    r"^\*\*Model answer\.\*\*\s*(.+?)(?=\n\*\*Rubric key points\.\*\*)", re.M | re.S)
_RUBRIC_RE = re.compile(
    r"^\*\*Rubric key points\.\*\*\s*(.+?)(?=\n---|\n##\s|\Z)", re.M | re.S)


def _load() -> dict:
    """{topic_id: {"prompt", "model_answer", "rubric"}}; mtime hot-reload, same
    discipline as checks._load() / retention._load() -- a bank edit needs no restart.
    A topic missing any of the three fields is skipped (it cannot be served or graded)."""
    global _banks, _banks_mtime
    try:
        mtime = os.path.getmtime(BANK_PATH)
    except OSError:
        return {}
    if _banks is not None and mtime == _banks_mtime:
        return _banks

    with open(BANK_PATH, encoding="utf-8") as fh:
        text = fh.read()

    topics: dict[str, dict] = {}
    marks = [(m.start(), m.group(1)) for m in _TOPIC_RE.finditer(text)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[start:end]
        prompt = _PROMPT_RE.search(chunk)
        model = _MODEL_RE.search(chunk)
        rubric = _RUBRIC_RE.search(chunk)
        if not (prompt and model and rubric):
            continue
        topics[topic_id] = {
            "prompt": " ".join(prompt.group(1).split()),
            "model_answer": " ".join(model.group(1).split()),
            "rubric": " ".join(rubric.group(1).split()),
        }

    _banks, _banks_mtime = topics, mtime
    return topics


def has_bank(topic_id: str) -> bool:
    return topic_id in _load()


def prompt_for(topic_id: str) -> str | None:
    """The ONLY shape that may cross the wire: the prompt alone. The model answer and
    rubric (which _load holds for the offline grader) are never served -- the same
    key-never-ships rule Form C and the MC checks enforce, adapted to a prose item where
    the 'key' is the model answer/rubric rather than a correct letter."""
    bank = _load().get(topic_id)
    return bank["prompt"] if bank else None


# ── the router ──────────────────────────────────────────────────────────────────────
#
# Gate order identical to retention.py's Form-C router (and to topic_api's probe):
#   session -> consent -> end-of-study window -> topic COMPLETE for this sid
#   -> one-submission -> record (NO grade, NO reveal -- graded offline/blind later).
# Because retention.router's `/{topic_id}` is a single path segment, this router's
# two-segment `/api/retention/probe/{topic_id}` can never be swallowed by it.


class ProbeAnswer(BaseModel):
    answer: str
    duration_ms: int | None = None


@router.get("/{topic_id}")
async def get_probe(topic_id: str, response: Response,
                    session: str | None = Cookie(default=None)):
    """The application short-answer prompt for one completed topic. Safe to serve in
    full: the prompt IS the question and the answer is prose (no key to protect); the
    model answer/rubric never leave the server."""
    user = await _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}

    if not schedule.end_of_study_open(user["section"]):
        response.status_code = 403
        return {"error": "not_open",
                "message": "This isn't open yet -- it runs at the end of the study."}

    if not await asyncio.to_thread(_topic_completed, user["sid"], topic_id):
        response.status_code = 403
        return {"error": "topic_not_complete",
                "message": "You have to finish this topic before its retention probe."}

    prompt = prompt_for(topic_id)
    if prompt is None:
        response.status_code = 404
        return {"error": "no_bank",
                "message": "This topic has no application probe yet."}

    if await asyncio.to_thread(
            research_store.has_event, user["sid"], "topic_retention_probe", topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already answered this one — it can only be answered once."}

    return {"topic_id": topic_id, "form": "C", "prompt": prompt}


@router.post("/{topic_id}")
async def submit_probe(topic_id: str, body: ProbeAnswer, response: Response,
                       session: str | None = Cookie(default=None)):
    """Record one application short answer. NEVER returns a grade -- grading is offline
    and blind (like topic_probe). Mirrors retention.py's submit gate order exactly."""
    user = await _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent",
                "message": "Consent has to be recorded before anything is saved."}

    if not schedule.end_of_study_open(user["section"]):
        response.status_code = 403
        return {"error": "not_open",
                "message": "This isn't open yet -- it runs at the end of the study."}

    if not await asyncio.to_thread(_topic_completed, user["sid"], topic_id):
        response.status_code = 403
        return {"error": "topic_not_complete",
                "message": "You have to finish this topic before its retention probe."}

    prompt = prompt_for(topic_id)
    if prompt is None:
        response.status_code = 404
        return {"error": "no_bank"}

    if await asyncio.to_thread(
            research_store.has_event, user["sid"], "topic_retention_probe", topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already answered this one — it can only be answered once."}

    text = (body.answer or "").strip()
    if not text:
        response.status_code = 400
        return {"error": "empty", "message": "Write an answer before submitting."}

    _row_id, created = await asyncio.to_thread(research_store.record_event_status, {
        "participant_id": user["sid"],
        "event_type": "topic_retention_probe",
        "topic_id": topic_id,
        "duration_ms": body.duration_ms,
        # answer bounded like topic_probe (one textarea must not write a megabyte); the
        # prompt is STAMPED so a later bank edit cannot change what was asked of this row.
        "meta": {"form": "C", "answer": text[:4000],
                 "prompt": prompt, "section": user["section"]},
    })
    if not created:
        # Lost the one-submission race (the partial unique index is the backstop; this
        # is the losing POST, its answer did NOT land) -- same as retention.py / topic_api.
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already answered this one — it can only be answered once."}

    # No score: graded offline/blind after the window closes. Acknowledge only.
    return {"ok": True, "recorded": True}
