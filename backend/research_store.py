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

import json
import os
import sqlite3
from datetime import datetime, timezone
from threading import Lock

DB_PATH = os.environ.get("RESEARCH_DB_PATH", os.path.join(os.path.dirname(__file__), "research_events.db"))

# sqlite3 connections are not safe to share across threads without care; a
# module-level lock keeps the simple single-file store correct under uvicorn.
_lock = Lock()


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
    meta_str = json.dumps(meta) if meta is not None else None

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
