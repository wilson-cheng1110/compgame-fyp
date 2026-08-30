"""Teacher operations, as a standalone APIRouter.

WHY ITS OWN MODULE AND ITS OWN ALLOWLIST. Until 2026-08-30 both `auth_store.py` and
`auth_api.py` carried a standing instruction not to build this: "the session cookie
is an identity hint, never a security boundary -- do not later hang an admin surface
off it without adding a real credential first." That was correct while the credential
was a SID with no secret. Passwords landed first, deliberately, and Wilson lifted the
prohibition afterwards. The order mattered: an admin panel over SID-only auth would
have meant anyone who knew a teacher's SID owned the class.

Two independent things must both hold for any route here:

  1. a valid `session` cookie  -> 401 without one
  2. that session's SID is in ADMIN_PATH -> 403 otherwise

The allowlist is a FILE, not a database flag, for the same reason the enrolment list
is: revoking a teacher must not need a migration or a running app, and the whole list
must be reviewable in one `cat`.

EVERYTHING THAT MUTATES IS AUDITED to `admin_audit`. A section change moves when
topics open for that student, which is the timing of the independent variable; an
unlogged change to an experimental condition is not something the paper could defend.

WHAT THIS DELIBERATELY CANNOT DO:
  * read a student's answers or scores -- that is research_api's export path, which
    pseudonymises at the boundary. A teacher wanting data goes through it.
  * return password material. `list_participants` selects a boolean, not the hash.
  * delete anything. Withdrawal is the participant's own right and runs through
    /api/auth/withdraw plus research_store.forget_participant.


SCRYPT MUST NOT RUN ON THE EVENT LOOP. Measured 2026-08-30, 60 concurrent sign-ins:
/api/health -- which hashes nothing -- went from 1 ms to 2478 ms, and only three of
its probes completed during the 2.6 s burst. Throughput was 23 sign-ins/sec, i.e.
one 43 ms hash after another, because `async def` + a synchronous call means the
whole server does nothing else for the duration. A section of ~100 signing in
together freezes the app for ~4 s for EVERY student, not just the ones signing in.

This is the same bug `ops.run_gated` already documents for LangChain, one layer up:
"called directly from an async handler it blocks the whole event loop for the
duration -- so one student's 12-second tutor reply stalls every other request".
`asyncio.to_thread` is the fix there and it is the fix here. No semaphore: there is
no GPU to protect, and scrypt releases the GIL, so the threadpool gives real
parallelism. This is also what makes the P1 decision to hash OUTSIDE `_lock`
load-bearing -- with the hash inside it, threads would just queue on the lock again.
"""

import asyncio
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel

import auth_store
import ops
import schedule

router = APIRouter(prefix="/api/admin", tags=["admin"])


class GenerateReport(BaseModel):
    topic: str
    section: str


class SessionDate(BaseModel):
    session: int
    section: str
    date: str          # YYYY-MM-DD
    commit: bool = False


class SectionChange(BaseModel):
    sid: str
    section: str


class PasswordReset(BaseModel):
    sid: str
    password: str
    end_sessions: bool = False


MESSAGES = {
    "bad_section": "That isn't a section this cohort runs.",
    "no_such_user": "No account with that student ID.",
    "weak_password": f"Pick a password of at least {auth_store.MIN_PASSWORD} characters.",
    "no_such_session": "There is no lecture with that number in the schedule.",
    "no_such_section": "That isn't a section this cohort runs.",
    "bad_date": "Dates go in as YYYY-MM-DD.",
    "unchanged": "That is already the date for this lecture.",
    "would_add_problems": (
        "That date would break the schedule -- see the problems listed. Nothing was "
        "saved."
    ),
    "roster_authoritative": (
        "A class list is configured, so it decides the section — sign-in re-reads it "
        "every time and would undo this. Edit enrolled_sids.txt instead."
    ),
}


def _admin(session: str | None, response: Response):
    """(sid, None) for a teacher; (None, body) with the status already set otherwise.

    Written as one helper because the alternative is repeating a two-part check on
    every route, and the failure mode of getting that wrong once is the whole panel.
    """
    user = auth_store.resolve_session(session or "")
    if user is None:
        response.status_code = 401
        return None, {"error": "no_session"}
    if not auth_store.is_admin(user["sid"]):
        # 403, and no hint about what would make it a 200.
        response.status_code = 403
        return None, {"error": "not_admin", "message": "This page is for the course team."}
    return user["sid"], None


@router.get("/whoami")
async def whoami(response: Response, session: str | None = Cookie(default=None)):
    """Is the caller a teacher? The /admin page asks this before drawing anything, so
    a student who guesses the URL sees a plain refusal rather than an empty table."""
    sid, err = _admin(session, response)
    if err:
        return err
    return {"ok": True, "sid": sid}


@router.get("/participants")
async def participants(response: Response, session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    rows = auth_store.list_participants()
    return {
        "participants": rows,
        "roster": auth_store.roster_active(),
        "counts": {
            "total": len(rows),
            "withdrawn": sum(1 for r in rows if r["withdrawn"]),
            "claimed": sum(1 for r in rows if r["has_password"]),
        },
    }


@router.post("/section")
async def change_section(body: SectionChange, response: Response,
                         session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    ok, reason = auth_store.set_section(body.sid, body.section)
    if not ok:
        response.status_code = 409 if reason == "roster_authoritative" else 400
        return {"error": reason, "message": MESSAGES.get(reason, "Couldn't change that.")}
    auth_store.audit(sid, "set_section", body.sid, body.section)
    return {"ok": True}


@router.post("/password")
async def reset_password(body: PasswordReset, response: Response,
                         session: str | None = Cookie(default=None)):
    sid, err = _admin(session, response)
    if err:
        return err
    # to_thread: scrypt, same reason as auth_api. A teacher resetting passwords
    # down a class list would otherwise stall every student's page, one per reset.
    ok, reason = await asyncio.to_thread(auth_store.set_password, body.sid, body.password)
    if not ok:
        response.status_code = 400
        return {"error": reason, "message": MESSAGES.get(reason, "Couldn't reset that.")}
    ended = auth_store.end_all_sessions(body.sid) if body.end_sessions else 0
    # The new password is NOT echoed back. The teacher typed it and can read it off
    # their own screen; putting it in a response body puts it in every proxy log.
    auth_store.audit(sid, "reset_password", body.sid,
                     f"sessions_ended={ended}" if body.end_sessions else None)
    return {"ok": True, "sessions_ended": ended}


@router.get("/audit")
async def audit(response: Response, session: str | None = Cookie(default=None)):
    """The log of what teachers have done. Visible to teachers, because an audit trail
    nobody can read is decoration."""
    sid, err = _admin(session, response)
    if err:
        return err
    return {"entries": auth_store.audit_log()}


@router.get("/schedule")
async def get_schedule(response: Response, session: str | None = Cookie(default=None)):
    """Every lecture, its date per section, and which topics ride on it."""
    sid, err = _admin(session, response)
    if err:
        return err
    return schedule.session_grid()


@router.post("/schedule")
async def set_schedule(body: SessionDate, response: Response,
                       session: str | None = Cookie(default=None)):
    """Move one lecture for one section. `commit: false` previews and writes nothing.

    THE PREVIEW IS NOT A COURTESY. A lecture date is the timing of the independent
    variable: pushing one forward can put a topic a student is part-way through back
    behind a lock, and pulling one back marks topics late (still enterable -- late is
    a state, not a refusal). Neither is a thing to discover after the fact, so the
    panel asks first and shows exactly which topics change state.

    Audited like every other mutation here, with the old date in the entry, so the
    log is enough on its own to put a wrong edit back.
    """
    sid, err = _admin(session, response)
    if err:
        return err
    result = schedule.set_session_date(
        body.session, body.section, body.date, commit=body.commit)
    if not result.get("ok"):
        reason = result.get("reason", "bad_date")
        response.status_code = 409 if reason == "would_add_problems" else 400
        return {**result, "error": reason,
                "message": MESSAGES.get(reason, "Couldn't change that date.")}
    if result.get("committed"):
        auth_store.audit(sid, "set_session_date", None,
                         f"session {body.session} section {body.section}: "
                         f"{result['old']} -> {result['new']}")
    return result


# ── the tutorial brief, reachable ─────────────────────────────────────────────
#
# The brief is the teacher's ACTUAL weekly job and until now the only way to it was:
# ssh onto the box, run generate_tutorial_report.py, open a .md in an editor. The
# persona the report was written for -- reads one page, standing up, thirty minutes
# before the tutorial -- had no way to reach that page. The report was good and
# undeliverable, which is the same as not existing.
#
# THE `-research` COPY IS NOT LISTED HERE. It is the only one that names arms and
# sequence, and a lecturer who learns the manipulation exists can teach to compensate
# -- differential instruction by condition, a confound that lands on H1 and cannot be
# removed afterwards. It stays a file on the box, for Wilson.

REPORTS_DIR = os.environ.get(
    "REPORTS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reports"))

_SAFE = re.compile(r"^[A-Za-z0-9._-]+$")


@router.get("/reports")
async def list_reports(response: Response, session: str | None = Cookie(default=None)):
    """Every brief generated so far, newest first. Never the -research copies."""
    sid, err = _admin(session, response)
    if err:
        return err
    out = []
    for root, _dirs, files in os.walk(REPORTS_DIR):
        for fn in sorted(files):
            # ALLOWLIST, not a denylist (findings S4 + L7). generate_tutorial_report.py
            # writes exactly three files per (topic, section): `<t>-<date>-teacher.md`,
            # `-discussion.md`, and `-research.md`. The research copy is the ONLY one
            # that names each student's FLIP/CONTROL order and must never be listed or
            # served. A denylist on the literal "-research.md" was defeated by any
            # ordinary copy of that content — a "-research.md.bak", a Windows
            # "-research (1).md" duplicate, an editor autosave, a OneDrive conflict copy
            # — each of which still names the conditions. So list ONLY the two
            # known-safe suffixes; every other file, including any rename of the
            # research copy, is invisible by construction.
            low = fn.lower()
            if not low.endswith(("-teacher.md", "-discussion.md")):
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, REPORTS_DIR).replace(os.sep, "/")
            out.append({
                "path": rel,
                "name": fn[:-3],
                # A lecturer needs to know which one is safe to project BEFORE they
                # open it in front of a room, not after. Case-folded like the rest.
                "projectable": fn.lower().endswith("-discussion.md"),
                "bytes": os.path.getsize(full),
                "modified": datetime.fromtimestamp(
                    os.path.getmtime(full), timezone.utc).isoformat(),
            })
    out.sort(key=lambda r: r["modified"], reverse=True)
    return {"reports": out[:200]}


@router.get("/reports/file")
async def read_report(path: str, response: Response,
                      session: str | None = Cookie(default=None)):
    """One brief, as markdown text."""
    sid, err = _admin(session, response)
    if err:
        return err
    # Every segment validated against an allowlist and the result re-checked against
    # the root. `..` in a query parameter reaching os.path.join is the oldest file
    # -read bug there is, and this endpoint sits next to a directory of files with
    # student SIDs in them.
    parts = [p for p in path.split("/") if p]
    # `..` is all dots, so _SAFE (`[A-Za-z0-9._-]+`) lets it through -- the abspath
    # containment check below is what actually stops traversal, but reject `..`
    # here too so the regex is not the only thing standing between a query param and
    # the filesystem.
    if not parts or any(not _SAFE.match(p) or p in ("..", ".") for p in parts):
        response.status_code = 400
        return {"error": "bad_path"}
    # ALLOWLIST, not a denylist (findings S4 + L7). Serve ONLY the two safe report
    # copies; the research copy — which names each student's FLIP/CONTROL order — and
    # ANY rename of it (a "-research.md.bak", a "-research (1).md", an autosave) are
    # never servable. A denylist on the literal "-research.md" was defeated by exactly
    # those ordinary copies, and by case tricks an NTFS filesystem resolves loosely.
    # Requiring a -teacher.md / -discussion.md suffix removes the "-research.md" string
    # to case-trick around entirely, and fails closed for anything unexpected.
    _SERVABLE = ("-teacher.md", "-discussion.md")
    if not parts[-1].lower().endswith(_SERVABLE):
        response.status_code = 403
        return {"error": "not_for_this_page",
                "message": "That copy names the study conditions and stays on the box."}
    full = os.path.abspath(os.path.join(REPORTS_DIR, *parts))
    if not full.startswith(os.path.abspath(REPORTS_DIR)) or not os.path.isfile(full):
        response.status_code = 404
        return {"error": "no_such_report"}
    # Last-line defence: whatever the query string cased, verify the file the OS
    # ACTUALLY opened is one of the two servable copies. `os.path.realpath` gives the
    # true on-disk name (case-corrected, trailing dots/spaces stripped by the OS).
    if not os.path.basename(os.path.realpath(full)).lower().endswith(_SERVABLE):
        response.status_code = 403
        return {"error": "not_for_this_page",
                "message": "That copy names the study conditions and stays on the box."}
    with open(full, encoding="utf-8") as fh:
        return {"path": "/".join(parts), "markdown": fh.read()}


@router.post("/reports/generate")
async def generate_report(body: GenerateReport, response: Response,
                          session: str | None = Cookie(default=None)):
    """Generate this week's tutorial brief from the browser — the affordance the
    sweep found missing (Defect 3 was only half-closed: a teacher could READ a brief
    but not PRODUCE one without shell access, so the empty state handed a
    non-technical lecturer a raw CLI command).

    Runs the SAME generator as the CLI, in a subprocess with --no-llm so it never
    blocks on Ollama and always returns the numeric report the teacher needs. The
    three files (teacher / discussion / research) are written as always; the
    -research copy is still never served to the browser. Audited like every mutation.
    """
    sid, err = _admin(session, response)
    if err:
        return err
    topic = (body.topic or "").strip()
    section = (body.section or "").strip().upper()
    # Validate against the real lists BEFORE shelling out — never pass unchecked
    # strings to a subprocess argv.
    if topic not in schedule.session_grid_topics():
        response.status_code = 400
        return {"error": "unknown_topic"}
    if section not in schedule.sections():
        response.status_code = 400
        return {"error": "unknown_section"}

    # RATE-LIMIT + BOUND (finding S3). The generator can run up to 120 s and holds a
    # shared threadpool worker for its whole duration, so an unbounded burst of admin
    # clicks could starve the pool that sign-in, record_event and session reads share.
    # A per-admin token bucket stops one teacher hammering it; ops.run_report_job keeps
    # it serial and off the event loop regardless of who calls.
    if not ops.allow(f"report:{sid}", per_minute=6, burst=3):
        response.status_code = 429
        return {"error": "too_many_requests",
                "message": "A report is already being generated — give it a moment and try again."}

    here = os.path.dirname(os.path.abspath(__file__))
    proc = await ops.run_report_job(
        subprocess.run,
        [sys.executable, os.path.join(here, "generate_tutorial_report.py"),
         "--topic", topic, "--section", section, "--no-llm"],
        capture_output=True, text=True, cwd=here, timeout=120,
    )
    if proc.returncode != 0:
        response.status_code = 500
        return {"error": "generate_failed",
                "message": (proc.stderr or proc.stdout or "").strip()[-300:]}
    auth_store.audit(sid, "generate_report", None, f"{topic}/{section}")
    return {"ok": True, "topic": topic, "section": section}
