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
            conn.commit()
        finally:
            conn.close()


def record_event(payload: dict) -> int:
    """Insert one event. Returns the new row id. Unknown keys go into meta."""
    known = {
        "participant_id", "event_type", "topic_id", "mode", "score",
        "played_understanding_first", "duration_ms", "client_ts", "meta",
    }
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

    server_ts = datetime.now(timezone.utc).isoformat()

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
                (
                    str(payload.get("participant_id", "anonymous")),
                    str(payload.get("event_type", "unknown")),
                    payload.get("topic_id"),
                    payload.get("mode"),
                    payload.get("score"),
                    puf_int,
                    payload.get("duration_ms"),
                    payload.get("client_ts"),
                    server_ts,
                    meta_str,
                ),
            )
            conn.commit()
            return cur.lastrowid
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
