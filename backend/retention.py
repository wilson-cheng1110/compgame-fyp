"""The end-of-study RETENTION re-test: Form C, its own loader, its own router.

See docs/end-of-study-battery-plan.md and docs/retention-item-banks.md. This module
is a STANDALONE companion to checks.py, never an edit to it -- the hard invariant for
this build is that the LIVE pre/post-check path (checks.py, docs/quiz-item-banks.md,
topic_schedule.json's existing topic rows) never changes behaviour while 314 students
are mid-study. Form C has its own bank file, its own parser, its own grader and its
own /api/retention/* router; checks.py is only ever READ from here (its already-
trusted `_TOPIC_RE` / `_SHARED_OPTS_RE` / `_parse_options`), never imported for its
Form A/B machinery and never modified.

The loader is a direct port of scripts/validate_retention_bank.py's `parse_retention_bank`
(that script's own docstring calls itself "the loader blueprint" for exactly this).

THE SAME RULE checks.py enforces holds here: the answer key never reaches the client.
`items_for_student()` strips it; only `grade()` -- server-side -- ever sees it.

ANTI-COLLUSION SHUFFLE. The battery is unproctored (a student sits it on their own
device, any time inside the window), so "the answer is C" travels for free between
friends unless the letters themselves differ per student. Every item's OPTIONS are
reordered and relabelled a../d.. sequentially, and the QUESTION order for a topic is
independently reordered, both deterministically from a per-student, per-item seed:

    seed = HMAC(participant_secret, "SID|topic_id|item_id|...")

using the SAME participant-secret HMAC auth_store.pseudonym() already keys off
(auth_store._load_secret()) -- never a second secret, never stored anywhere. The
server re-derives the identical permutation at grade time from (sid, topic_id,
item_id) alone, maps the student's chosen DISPLAYED letter back to the canonical
option, and compares THAT to the server-only key. Answers are submitted keyed by
item_id (not by position), so the question-order shuffle never touches grading.
"""

import asyncio
import hashlib
import hmac
import os
import random
import re

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import checks
import research_store
import schedule

router = APIRouter(prefix="/api/retention", tags=["retention"])

BANK_PATH = os.environ.get(
    "RETENTION_BANK_PATH",
    os.path.join(os.path.dirname(__file__), "..", "docs", "retention-item-banks.md"),
)

_banks: dict | None = None
_banks_mtime: float | None = None

# Form-C equivalents of checks.py's Form-A/B-only regexes (which hard-code the [AB]
# letter class). Byte-for-byte the same shape scripts/validate_retention_bank.py
# already defined and proved correct against every topic in the bank.
_FORM_C_RE = re.compile(r"^###\s+Form\s+C\b", re.M)
_ITEM_C_RE = re.compile(
    r"^\*\*(C\d+)\.\*\*\s*(.+?)\n\s*([a-e]\).+?)(?=\n\s*\n|\n\*\*|\n\*Answer|\Z)",
    re.M | re.S,
)
_ITEM_SHARED_C_RE = re.compile(r"^\*\*(C\d+)\.\*\*\s*(.+?)\s*→\s*✓\s*\*\*([a-e])\)", re.M)


def _load() -> dict:
    """{topic_id: [item, ...]}; item = {id, stem, options, correct}. mtime hot-reload,
    same discipline as checks._load() -- a bank edit must not need a restart."""
    global _banks, _banks_mtime
    try:
        mtime = os.path.getmtime(BANK_PATH)
    except OSError:
        return {}
    if _banks is not None and mtime == _banks_mtime:
        return _banks

    with open(BANK_PATH, encoding="utf-8") as fh:
        text = fh.read()

    topics: dict[str, list] = {}
    marks = [(m.start(), m.group(1)) for m in checks._TOPIC_RE.finditer(text)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[start:end]

        fmatch = _FORM_C_RE.search(chunk)
        if not fmatch:
            continue
        body = chunk[fmatch.start():]

        # Layout 2 (Gestalt): one option set declared for the whole topic.
        shared = checks._SHARED_OPTS_RE.search(chunk)
        shared_options = (checks._parse_options(shared.group(1), expect_correct=False)[0]
                          if shared else None)

        items = []
        for item_id, stem, opts in _ITEM_C_RE.findall(body):
            options, correct = checks._parse_options(opts)
            items.append({"id": item_id, "stem": " ".join(stem.split()),
                          "options": options, "correct": correct})

        if not items and shared_options:
            for item_id, stem, correct in _ITEM_SHARED_C_RE.findall(body):
                stem = re.sub(r"\s*→.*$", "", " ".join(stem.split())).strip()
                items.append({"id": item_id, "stem": stem,
                              "options": shared_options, "correct": correct})

        if items:
            topics[topic_id] = items

    _banks, _banks_mtime = topics, mtime
    return topics


def has_bank(topic_id: str) -> bool:
    return bool(_load().get(topic_id))


# ── anti-collusion shuffle ───────────────────────────────────────────────────────

def _seed(*parts: str) -> int:
    secret = auth_store._load_secret()
    digest = hmac.new(secret, "|".join(parts).encode("utf-8"), hashlib.sha256).digest()
    return int.from_bytes(digest, "big")


def _permutation(n: int, seed: int) -> list[int]:
    """A deterministic permutation of range(n), reproducible from the same seed."""
    idx = list(range(n))
    random.Random(seed).shuffle(idx)
    return idx


def _shuffled_options(sid: str, topic_id: str, item: dict) -> tuple[list[dict], dict[str, str]]:
    """-> (options in THIS student's shuffled order with NEW sequential letters,
    {displayed_letter: canonical_letter}). The canonical letter/text pairing never
    ships -- only the served list (new letter, original text) does."""
    options = item["options"]
    perm = _permutation(len(options),
                        _seed(sid.strip().upper(), topic_id, item["id"], "opts"))
    served, mapping = [], {}
    for i, src in enumerate(perm):
        letter = chr(97 + i)
        opt = options[src]
        served.append({"letter": letter, "text": opt["text"]})
        mapping[letter] = opt["letter"]
    return served, mapping


def _shuffled_items(sid: str, topic_id: str) -> list[dict]:
    """This topic's items, in THIS student's shuffled question order. Pure display
    ordering -- answers are keyed by item_id, so this never touches grading."""
    items = _load().get(topic_id, [])
    perm = _permutation(len(items), _seed(sid.strip().upper(), topic_id, "__order__"))
    return [items[i] for i in perm]


# ── serving ──────────────────────────────────────────────────────────────────────

def items_for_student(sid: str, topic_id: str) -> list[dict] | None:
    """Items WITHOUT the key, in this student's own shuffled order. The only shape
    that may cross the wire -- mirrors checks.items_for_student's one rule."""
    if not has_bank(topic_id):
        return None
    out = []
    for item in _shuffled_items(sid, topic_id):
        served, _mapping = _shuffled_options(sid, topic_id, item)
        out.append({"id": item["id"], "stem": item["stem"], "options": served})
    return out


# ── grading ──────────────────────────────────────────────────────────────────────

def grade(sid: str, topic_id: str, answers: dict[str, str]) -> dict:
    """Score one Form-C submission server-side, against the server-only key.

    checks.grade_submission cannot do this job -- it only ever parses Forms A/B out
    of quiz-item-banks.md. This re-derives the SAME per-student shuffle used to serve
    the item, maps the student's chosen DISPLAYED letter back to the canonical
    option, and compares that to the key. `correct_option` in the result is reported
    in DISPLAYED terms too, so a revealed answer matches what the student actually saw.
    """
    items = _load().get(topic_id)
    if not items:
        raise ValueError(f"no retention bank for {topic_id}")

    per_item, correct_n = [], 0
    for item in items:
        _served, mapping = _shuffled_options(sid, topic_id, item)
        given_displayed = (answers.get(item["id"]) or "").strip().lower()[:1]
        given_canonical = mapping.get(given_displayed)
        is_right = given_canonical == item["correct"]
        correct_n += is_right
        displayed_correct = next(
            (d for d, c in mapping.items() if c == item["correct"]), None)
        per_item.append({
            "id": item["id"],
            "answered": given_displayed or None,
            "correct_option": displayed_correct,
            "was_correct": is_right,
        })

    total = len(items)
    return {
        "topic_id": topic_id, "form": "C",
        "answered": sum(1 for e in per_item if e["answered"]),
        "total": total, "correct": correct_n,
        "score": round(100.0 * correct_n / total, 1),
        "items": per_item,
    }


# ── the topic-completion gate ────────────────────────────────────────────────────

def _topic_completed(sid: str, topic_id: str) -> bool:
    """A topic counts as COMPLETED the same way topic_api.journey() derives it: the
    post-check landed, or -- for a bankless topic -- the game's own completion
    event did. Only completed topics carry a retention re-test."""
    rows = research_store.fetch_for_participant(sid)
    done = {(r.get("topic_id"), r.get("event_type")) for r in rows}
    if (topic_id, "topic_posttest") in done:
        return True
    return not checks.has_bank(topic_id) and (topic_id, "assessment_complete") in done


# ── the router ────────────────────────────────────────────────────────────────────
#
# Mirrors topic_api's check GET/POST gate order exactly:
#   session -> consent -> (schedule gate) -> one-submission -> (empty) -> grade -> record
# with the end-of-study window and "topic completed" standing in for topic_api's
# per-topic schedule gate.

async def _me(session: str | None):
    # OFF THE EVENT LOOP -- same reasoning as topic_api._me (finding C2).
    return await asyncio.to_thread(auth_store.resolve_session, session or "")


async def _consented(sid: str) -> bool:
    return await asyncio.to_thread(research_store.has_event, sid, "consent_recorded")


class Submission(BaseModel):
    answers: dict[str, str]
    duration_ms: int | None = None


@router.get("/_status")
async def battery_status(response: Response, session: str | None = Cookie(default=None)):
    """Has this SID already recorded the terminal end-of-study marker? Mirrors the
    demographics/feedback `_status` idiom in questionnaire_api.py, scoped to the one
    thing this router needs to report (there is nothing else per-instrument to list
    here -- retention/affect_recall completion is tracked per TOPIC, not globally,
    and the frontend walks that per topic as it goes)."""
    user = await _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}
    done = await asyncio.to_thread(
        research_store.has_event, user["sid"], "questionnaire_end_of_study")
    return {"done": done}


@router.post("/_complete")
async def battery_complete(response: Response, session: str | None = Cookie(default=None)):
    """Records the terminal 'the whole battery is finished' marker, ONCE.

    REGISTERED ABOVE `/{topic_id}` on purpose -- FastAPI matches routes in
    registration order, and `_complete` would otherwise be swallowed by
    POST `/{topic_id}` as topic_id="_complete" (the same reason `_status` above sits
    ahead of GET `/{topic_id}` -- see questionnaire_api.py's identical note).

    event_type is `questionnaire_end_of_study` ON PURPOSE: it already matches
    research_store's `event_type LIKE 'questionnaire_%'` predicate on
    idx_events_once_v3, so the one-submission guarantee is enforced at the DB level
    with no index change needed for this event specifically (only `topic_retention`
    needed adding). This is what lets the dashboard mirror the demographics/feedback
    `_status` idiom for "has this been done" (`GET /_status` above), without a new
    per-instrument bank entry for what is really just a checkpoint, not a question.

    Server-side completeness check: every topic that is COMPLETE and has a Form-C
    bank must already carry a `topic_retention` row before the marker can be set --
    a client that raced ahead (or was simply buggy) must not be able to close the
    battery out having silently skipped a topic.
    """
    user = await _me(session)
    if user is None:
        response.status_code = 401
        return {"error": "no_session"}

    if not await _consented(user["sid"]):
        response.status_code = 403
        return {"error": "no_consent"}

    if not schedule.end_of_study_open(user["section"]):
        response.status_code = 403
        return {"error": "not_open"}

    if await asyncio.to_thread(
            research_store.has_event, user["sid"], "questionnaire_end_of_study"):
        response.status_code = 409
        return {"error": "already_submitted"}

    states = await asyncio.to_thread(schedule.topic_states, user["sid"], user["section"])
    rows = await asyncio.to_thread(research_store.fetch_for_participant, user["sid"])
    retained = {r["topic_id"] for r in rows if r["event_type"] == "topic_retention"}
    missing = [
        st["topic_id"] for st in states
        if has_bank(st["topic_id"])
        and _topic_completed(user["sid"], st["topic_id"])
        and st["topic_id"] not in retained
    ]
    if missing:
        response.status_code = 400
        return {"error": "incomplete", "missing": missing}

    _row_id, created = await asyncio.to_thread(research_store.record_event_status, {
        "participant_id": user["sid"],
        "event_type": "questionnaire_end_of_study",
        "meta": {},
    })
    if not created:
        response.status_code = 409
        return {"error": "already_submitted"}
    return {"ok": True}


@router.get("/{topic_id}")
async def get_retention(topic_id: str, response: Response,
                        session: str | None = Cookie(default=None)):
    """Items for the Form-C retention re-test. NEVER carries the answer key."""
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
                "message": "You have to finish this topic before its retention check."}

    items = items_for_student(user["sid"], topic_id)
    if items is None:
        response.status_code = 404
        return {"error": "no_bank", "message": "This topic has no retention set yet."}

    if await asyncio.to_thread(
            research_store.has_event, user["sid"], "topic_retention", topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already submitted this one — it can only be answered once."}

    return {"topic_id": topic_id, "form": "C", "items": items}


@router.post("/{topic_id}")
async def submit_retention(topic_id: str, body: Submission, response: Response,
                           session: str | None = Cookie(default=None)):
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
                "message": "You have to finish this topic before its retention check."}

    if await asyncio.to_thread(
            research_store.has_event, user["sid"], "topic_retention", topic_id):
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already submitted this one — it can only be answered once."}

    if not body.answers:
        response.status_code = 400
        return {"error": "empty", "message": "Answer the questions before submitting."}

    try:
        graded = grade(user["sid"], topic_id, body.answers)
    except ValueError:
        response.status_code = 404
        return {"error": "no_bank"}

    _row_id, created = await asyncio.to_thread(research_store.record_event_status, {
        "participant_id": user["sid"],
        "event_type": "topic_retention",
        "topic_id": topic_id,
        "score": graded["score"],
        "duration_ms": body.duration_ms,
        "meta": {"form": "C", "answers": body.answers,
                 "section": user["section"]},
    })
    if not created:
        # Lost the one-submission race (finding C1, sibling of topic_api.submit_check):
        # has_event() passed for two near-simultaneous POSTs, the partial unique index
        # let ONE row win, and this is the loser. Its answers were NOT persisted.
        response.status_code = 409
        return {"error": "already_submitted",
                "message": "You've already submitted this one — it can only be answered once."}

    # Score revealed unconditionally, unlike the live pre-check: this is the END of
    # the study, so there is no downstream measurement left for a revealed answer to
    # contaminate (docs/end-of-study-battery-plan.md: "score to the sink immediately;
    # key never ships").
    return {"ok": True, **graded}
