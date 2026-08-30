"""
Lightweight SQLite sink for flip-learning research events.

Kept deliberately small: stdlib sqlite3 only (no new dependencies), one table,
append-only. The frontend stays cookie-based for the live app; this is a
parallel, anonymous-by-default data sink so the paper can aggregate learning
events across participants instead of relying on per-browser cookie exports.

Schema (events):
  id                         autoincrement PK
  participant_id             stable per-participant key (the SID, or a hash)
  event_type                 e.g. "understanding_complete" / "assessment_complete"
  topic_id                   topic key from topic-definitions.ts (e.g. "fitts-law")
  mode                       "understanding" | "assessment"
  score                      0-100, nullable
  played_understanding_first 1/0/NULL — the core flip-learning IV
  duration_ms                nullable
  client_ts                  ISO timestamp from the browser
  server_ts                  ISO timestamp recorded server-side
  meta                       free-form JSON string, nullable
"""

import hashlib
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone
from threading import Lock

DB_PATH = os.environ.get("RESEARCH_DB_PATH", os.path.join(os.path.dirname(__file__), "research_events.db"))

# sqlite3 connections are not safe to share across threads without care; a
# module-level lock keeps the simple single-file store correct under uvicorn.
_lock = Lock()


# ── provenance (docs/revamp.md Part 13.2) ─────────────────────────────────────
# "stale then stale lor, requirement updates happen" -- correct, and exactly the
# problem. The corpus WILL be rebuilt again during the study, and a rebuild
# silently changes what the tutor knows. Rebuild in week 6 and students in weeks
# 1-5 had a materially different tutor from weeks 7-13: an uncontrolled variable
# sitting underneath H2-H4 that, unrecorded, cannot be detected afterwards -- not
# even in principle, because nothing in the data would distinguish the two groups.
#
# Preference is still to FREEZE (rebuild before launch, then leave it alone). This
# stamp exists because that rule will eventually be broken by someone tidying up,
# and the difference between a confound and a covariate is whether it was recorded.
#
# Computed ONCE at import: it is a filesystem stat, and doing it per event would
# put an os.stat in the hot path of every single row.

def _corpus_version() -> str:
    db = os.path.join(os.path.dirname(__file__), "hci_chroma_db_local", "chroma.sqlite3")
    try:
        st = os.stat(db)
        return hashlib.sha256(f"{st.st_size}:{int(st.st_mtime)}".encode()).hexdigest()[:12]
    except OSError:
        return "absent"


def _app_version() -> str:
    """Short git sha. Falls back to 'unknown' rather than raising -- a deployment
    from a tarball with no .git must still record events."""
    env = os.environ.get("APP_VERSION")
    if env:
        return env
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                             cwd=os.path.dirname(__file__), capture_output=True,
                             text=True, timeout=5)
        return out.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


CORPUS_VERSION = _corpus_version()
APP_VERSION = _app_version()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # WAIT for the file lock rather than raise "database is locked" immediately. This is
    # NOT merely hypothetical insurance: the report generator (generate_tutorial_report.py)
    # runs as a SEPARATE OS PROCESS via subprocess.run, opens its own connection and does
    # a full `fetch_all()` scan — and the in-process _lock cannot serialise across
    # processes, so a live write here and that scan can genuinely collide on the real
    # sqlite file lock. busy_timeout is what turns that collision into a brief wait instead
    # of an error surfaced to a student mid-submit. It also covers the case where _lock is
    # ever relaxed. The lock is released long before 5 s, so this never actually stalls.
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_db() -> None:
    # NOTE: `with sqlite3.connect() as conn` only commits/rollbacks — it does
    # NOT close the connection. We close explicitly to avoid leaking a handle
    # per call (which also locks the file open on Windows).
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    participant_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    topic_id TEXT,
                    mode TEXT,
                    score REAL,
                    played_understanding_first INTEGER,
                    duration_ms INTEGER,
                    client_ts TEXT,
                    server_ts TEXT NOT NULL,
                    meta TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_events_participant ON events(participant_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic_id)")
            # ONE-SUBMISSION, ENFORCED BY THE DB — not just by luck of scheduling.
            # The load and adversarial sweeps both noted that "exactly one submission
            # per check" held ONLY because record_event runs synchronously with no
            # await between the has_event() check and the INSERT, so single-process
            # asyncio never interleaves two requests inside that window. That is
            # incidental: it silently reopens the moment record_event moves off the
            # event loop (which it now does, to fix the lock-contention freeze) or the
            # server runs multiple workers. A PARTIAL unique index is the real
            # backstop. It covers ONLY the once-per-(student,topic) events — the
            # checks, probes, baseline, consent, unit completion, and questionnaires —
            # and deliberately NOT understanding_complete / assessment_complete /
            # reflection_*, which legitimately repeat when a student replays a game
            # from the close screen. COALESCE(topic_id,'') because two NULLs are not
            # equal in SQL, so a non-topic once-only event (pre_test_complete) would
            # otherwise slip the constraint.
            # SELF-HEALING NAME (findings C3 + L8). CREATE UNIQUE INDEX IF NOT EXISTS
            # matches on index NAME only -- it will NOT re-derive an index that already
            # exists under the same name with an OLDER predicate. So when this predicate
            # grows (here: consent_withdrawn, added 2026-08-30), a database created
            # before the change would silently keep the stale index and never gain the
            # new coverage -- and the go-live plan initialises the deployment box's DB
            # during a pre-launch test, exactly when that could bite, with no error.
            # Bumping the NAME (_v2) sidesteps it: a fresh DB gets only v2; an older DB
            # keeps its idx_events_once (still enforcing the original events, harmless)
            # AND gains v2, so consent_withdrawn becomes covered everywhere. Verified
            # across fresh / stale / pre-duplicate DBs before shipping.
            #
            # GUARDED so it can never brick startup. The only way this UNIQUE create can
            # fail is a pre-existing duplicate in a newly-covered event_type -- reachable
            # in principle only by a pre-C3 concurrent /withdraw (two consent_withdrawn
            # rows) and harmless. On that failure skip v2 and keep the prior index; do
            # NOT rollback (the tables and other indexes share this transaction and must
            # survive) -- the final commit persists them.
            try:
                conn.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_once_v2
                    ON events(participant_id, event_type, COALESCE(topic_id, ''))
                    WHERE event_type IN (
                        'topic_pretest', 'topic_posttest', 'topic_probe', 'topic_probe_post',
                        'pre_test_complete', 'consent_recorded', 'consent_withdrawn',
                        'topic_complete'
                    ) OR event_type LIKE 'questionnaire_%'
                    """
                )
            except sqlite3.IntegrityError:
                pass
            conn.commit()
        finally:
            conn.close()


def is_staff(sid: str) -> bool:
    """Is this SID a member of the course team rather than a participant?

    Imported lazily: research_store must stay importable with no auth stack, which
    is what lets the offline analysis scripts read the sink on any machine.
    """
    try:
        import auth_store
        return auth_store.is_admin(sid or "")
    except Exception:
        return False


def record_event(payload: dict) -> int:
    """Insert one event, returning the new row id. See record_event_status when the
    caller must know whether IT wrote the row or lost a once-only race."""
    return record_event_status(payload)[0]


def record_event_status(payload: dict) -> tuple[int, bool]:
    """Insert one event. Returns (row_id, created). Unknown keys go into meta.

    `created` is True when THIS call wrote the row, and False only when a once-only
    duplicate lost the race to an already-persisted row (the partial unique index
    fired). A caller that shows the student a graded result must gate that reveal on
    `created` — the loser of the race has NOT written the answers it just graded, so
    returning its reveal would show a score that never reached the sink (finding C1).

    STAFF EVENTS ARE DROPPED. `is_admin` was never consulted anywhere in the request
    path, so a teacher signing in hit the identical gate chain as a student -- agree
    to a PARTICIPANT information sheet, pick an avatar, sit the prior-knowledge
    pre-test -- and every one of those landed in the sink looking exactly like a
    student's. Measured 2026-08-30: the admin account 22074221D held three completed
    topics with pre-checks, post-checks and probes, indistinguishable from a
    participant, and `enrolled_only()` could not filter them because a teacher has to
    be on the roster to sign up at all.

    Dropped HERE rather than in the UI on purpose. This is the single place every
    event passes through, so it holds whatever a page, a game or a future route
    does -- and the failure it prevents is silent, which is the kind this project
    keeps having.
    """
    known = {
        "participant_id", "event_type", "topic_id", "mode", "score",
        "played_understanding_first", "duration_ms", "client_ts", "meta",
    }
    if is_staff(payload.get("participant_id") or ""):
        # Not an error and not worth a 4xx: the teacher did nothing wrong, their
        # data simply is not study data. Returning 0 keeps every caller's
        # fire-and-forget contract intact. created=True: there is no competing row
        # and no race, so a caller gating a reveal on `created` proceeds normally.
        return 0, True

    extra = {k: v for k, v in payload.items() if k not in known}
    meta = payload.get("meta")
    if extra:
        # preserve anything the client sends that we don't have a column for
        merged = dict(extra)
        if isinstance(meta, dict):
            merged.update(meta)
        elif meta is not None:
            merged["_meta"] = meta
        meta = merged
    # Provenance is folded in SERVER-SIDE, so it is authoritative (a client cannot
    # claim a different corpus) and research-log.ts needs no change. Purely additive
    # to the free-form meta column -- no migration, and old rows simply lack it,
    # which is itself the correct reading: they predate the stamp.
    meta = dict(meta) if isinstance(meta, dict) else ({"_meta": meta} if meta is not None else {})
    meta.setdefault("corpus_version", CORPUS_VERSION)
    meta.setdefault("app_version", APP_VERSION)

    meta_str = json.dumps(meta)

    puf = payload.get("played_understanding_first")
    puf_int = None if puf is None else (1 if puf else 0)

    # SANITISE THE NUMERIC COLUMNS before they reach SQLite. The fuzz sweep crashed
    # five endpoints with an unhandled OverflowError: duration_ms >= 2**63 does not
    # fit SQLite's signed-64-bit INTEGER, and record_event bound the raw int. A
    # buggy client-side timer -- not even an attacker -- could emit an absurd value
    # and 500 the pre/post-test write for a real student. This is the LAST line of
    # defence and holds whatever any caller (research_api, topic_api, questionnaire_api)
    # does, so no endpoint has to remember it.
    #
    # A value out of range is set to NULL (missing), never clamped to a plausible
    # number: a fabricated-looking datum in the study set is worse than a gap.
    duration = payload.get("duration_ms")
    try:
        duration = int(duration) if duration is not None else None
        if duration is not None and not (0 <= duration < 2**63):
            duration = None            # negative or overflow -> missing
    except (TypeError, ValueError):
        duration = None

    score = payload.get("score")
    try:
        score = float(score) if score is not None else None
        # All scores in this system are percentages/counts in [0, 100]. 250 and -999
        # were forged in the adversarial sweep; a NaN/inf would also poison analysis.
        if score is not None and not (0.0 <= score <= 100.0):
            score = None
    except (TypeError, ValueError):
        score = None

    server_ts = datetime.now(timezone.utc).isoformat()

    pid = str(payload.get("participant_id", "anonymous"))
    etype = str(payload.get("event_type", "unknown"))
    tid = payload.get("topic_id")

    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                """
                INSERT INTO events (
                    participant_id, event_type, topic_id, mode, score,
                    played_understanding_first, duration_ms, client_ts, server_ts, meta
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (pid, etype, tid, payload.get("mode"), score, puf_int, duration,
                 payload.get("client_ts"), server_ts, meta_str),
            )
            conn.commit()
            return cur.lastrowid, True
        except sqlite3.IntegrityError:
            # The partial unique index rejected a once-only duplicate. Under a real
            # race two requests both pass the endpoint's has_event() check and both
            # try to insert; one wins, and this is the loser. Treat it as the no-op
            # it is — return the winner's id instead of a 500, so the caller's "one
            # submission" contract holds even when this runs off the event loop.
            row = conn.execute(
                "SELECT id FROM events WHERE participant_id=? AND event_type=?"
                " AND COALESCE(topic_id,'')=COALESCE(?,'') ORDER BY id LIMIT 1",
                (pid, etype, tid),
            ).fetchone()
            return (row[0] if row else 0), False
        finally:
            conn.close()


def has_event(participant_id: str, event_type: str, topic_id: str | None = None) -> bool:
    """Does this participant have this event? One indexed query, not a table scan.

    ADDED 2026-08-21 after measuring the alternative. Callers were asking this question
    with `fetch_all()` — pulling the ENTIRE sink into Python and scanning it in a list
    comprehension — and `/api/auth/me` did it TWICE per call (consent, then baseline).
    `/api/auth/me` runs on nearly every page load, `fetch_all()` holds the module lock
    for its whole duration, and the sink is designed to reach roughly 300 students x 13
    topics x several events. On this box each identity check was costing ~2 s, which is
    what made the browser tests flake: the topic page's journey request queued behind a
    lock held by a scan it did not need.

    `idx_events_participant` already existed; nothing was using it.
    """
    sql = "SELECT 1 FROM events WHERE participant_id = ? AND event_type = ?"
    args = [str(participant_id), str(event_type)]
    if topic_id is not None:
        sql += " AND topic_id = ?"
        args.append(topic_id)
    sql += " LIMIT 1"

    with _lock:
        conn = _connect()
        try:
            return conn.execute(sql, args).fetchone() is not None
        finally:
            conn.close()


def fetch_all() -> list[dict]:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute("SELECT * FROM events ORDER BY id").fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def fetch_for_participant(participant_id: str) -> list[dict]:
    """Every event for ONE participant, straight off idx_events_participant.

    topic_api.journey() used to call fetch_all() and filter in Python, which meant
    every dashboard load read the whole sink. Measured at full cohort scale -- 300
    students x 13 topics x 7 events, 27,483 rows -- that was 64 ms of scanning to
    find the ~91 rows belonging to one student. Tolerable alone, but fetch_all holds
    the module lock, so a lecture ending and a section opening the dashboard at once
    serialises behind it.
    """
    sid = participant_id.strip().upper()
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM events WHERE UPPER(participant_id) = ? ORDER BY id",
                (sid,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def summary() -> dict:
    with _lock:
        conn = _connect()
        try:
            total = conn.execute("SELECT COUNT(*) AS c FROM events").fetchone()["c"]
            participants = conn.execute(
                "SELECT COUNT(DISTINCT participant_id) AS c FROM events"
            ).fetchone()["c"]
            return {"total_events": total, "participants": participants}
        finally:
            conn.close()

def count_for(participant_id: str) -> int:
    """How many rows this participant has. Lets an operator see what a forget
    would remove BEFORE it removes it."""
    sid = participant_id.strip().upper()
    with _lock:
        conn = _connect()
        try:
            return conn.execute(
                "SELECT COUNT(*) AS c FROM events WHERE UPPER(participant_id) = ?", (sid,)
            ).fetchone()["c"]
        finally:
            conn.close()


def forget_participant(participant_id: str) -> int:
    """Erase every event belonging to one participant. Returns rows removed.

    WHY A FUNCTION AND NOT AN ENDPOINT. auth_api.withdraw is deliberate that "a
    destructive sweep of the append-only sink is not something a web request should
    be able to trigger", and that is right -- it stays an operator action. But the
    promise on the other end of it was never implemented: the information sheet
    (docs/study-pack/01_information-sheet-and-consent.md) tells a participant they
    may ask for their responses to be discarded, withdraw() replies "Ask the
    researcher to erase your recorded data", and nothing in this module erased
    anything. There were zero DELETE statements here. This is that code.

    The account tombstone in auth_store is NOT touched, and must not be: it is what
    stops a withdrawn SID signing up again and reappearing in the data, and it is
    the record that the withdrawal happened -- which erasing the events destroys.
    """
    sid = participant_id.strip().upper()
    if not sid:
        raise ValueError("refusing to forget an empty participant id")
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                "DELETE FROM events WHERE UPPER(participant_id) = ?", (sid,))
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def _main(argv=None) -> int:
    import argparse
    ap = argparse.ArgumentParser(
        description="Research sink operator tools. Erasure is deliberately offline: "
                    "no web request can trigger it.")
    ap.add_argument("--forget", metavar="SID",
                    help="erase every event for one participant (consent withdrawal)")
    ap.add_argument("--yes", action="store_true",
                    help="actually do it; without this the command only reports")
    ap.add_argument("--summary", action="store_true", help="row and participant counts")
    args = ap.parse_args(argv)

    if args.summary:
        s = summary()
        print("[sink] %d events from %d participant(s)" % (s["total_events"], s["participants"]))
        return 0

    if args.forget:
        sid = args.forget.strip().upper()
        n = count_for(sid)
        if not n:
            print("[sink] %s: nothing recorded -- nothing to erase" % sid)
            return 0
        if not args.yes:
            print("[sink] %s: %d event(s) would be erased. This cannot be undone." % (sid, n))
            print("[sink] re-run with --yes to do it.")
            return 0
        removed = forget_participant(sid)
        print("[sink] %s: erased %d event(s)." % (sid, removed))
        print("[sink] the account tombstone in auth_store is untouched, so the SID "
              "still cannot sign back in.")
        return 0

    ap.print_help()
    return 1


if __name__ == "__main__":
    import sys as _sys
    _sys.exit(_main())
