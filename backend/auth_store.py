"""Server-side participant accounts for the COMP3423 rollout.

Deliberately mirrors `research_store.py`: stdlib sqlite3 only, one module-level
lock, explicit conn.close(). That is the house pattern -- do not introduce an ORM,
bcrypt/passlib, or a second DB engine for this.

WHY THIS EXISTS (it overrides CLAUDE.md's "Do NOT add server-side auth", ratified
by Wilson 2026-08-16): cookie-only state cannot survive 300 students on their own
laptops. It gives no cross-device resume, no deletion path when a participant
withdraws, and silent total data loss on a cache clear.

WHAT THIS IS NOT: authentication. The credential model is **SID only, no secret**.
Anyone who knows a classmate's SID can start a session as them. Hence:

  * `start_session`, not `login` -- the name should not imply a guarantee we do
    not provide.
  * The enrolled-SID allowlist is the ONLY gate. It gives enrolment control on a
    public URL (an arbitrary string will not work) but does NOT stop impersonation
    between enrolled students. That limitation belongs in the paper.
  * The `session` cookie is an identity hint, never a security boundary. Do not
    later hang an admin surface off it without adding a real credential first.

Schema:
  users     sid PK · username · avatar_id · section · created_at · last_seen_at · withdrawn
  sessions  token PK · sid · created_at · expires_at

Enrolment file (`enrolled_sids.txt`, one per line, `#` comments):
    24012345D,A          # SID,section  -- section drives the Tue/Wed/Thu windows
    24067890X,B
Re-read automatically when its mtime changes, so a late enrolment needs no restart.
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from threading import Lock

_HERE = os.path.dirname(__file__)

DB_PATH = os.environ.get("AUTH_DB_PATH", os.path.join(_HERE, "auth_store.db"))
ENROLMENT_PATH = os.environ.get("ENROLMENT_PATH", os.path.join(_HERE, "enrolled_sids.txt"))
SECRET_PATH = os.environ.get("PARTICIPANT_SECRET_PATH", os.path.join(_HERE, ".participant_secret"))

SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "120"))  # one semester + margin

_lock = Lock()
_enrolment: dict[str, str] = {}     # sid -> section
_enrolment_mtime: float | None = None


# ── identity ──────────────────────────────────────────────────────────────────

def _load_secret() -> bytes:
    """HMAC key for participant pseudonyms (docs/revamp.md Part 13).

    MUST be stable for the whole study -- it is what joins a participant's pre and
    post rows across exports. Losing it makes every past export un-joinable to
    every future one, so it is persisted rather than regenerated per boot.
    """
    env = os.environ.get("PARTICIPANT_HMAC_SECRET")
    if env:
        return env.encode()
    if os.path.exists(SECRET_PATH):
        with open(SECRET_PATH, "rb") as fh:
            return fh.read().strip()
    generated = secrets.token_hex(32).encode()
    with open(SECRET_PATH, "wb") as fh:
        fh.write(generated)
    print(
        f"[auth] *** Generated a new participant HMAC secret at {SECRET_PATH}.\n"
        f"    BACK THIS UP OFF THIS MACHINE NOW. Without it, exports taken before and\n"
        f"    after any loss of this file cannot be joined to the same participant."
    )
    return generated


def pseudonym(sid: str) -> str:
    """Stable pseudonymous ID for research export. Real SIDs never leave the box."""
    return hmac.new(_load_secret(), sid.strip().upper().encode(), hashlib.sha256).hexdigest()[:16]


# ── enrolment allowlist ───────────────────────────────────────────────────────

def _refresh_enrolment() -> None:
    """Reload the allowlist if the file changed. Cheap stat on every check."""
    global _enrolment, _enrolment_mtime
    try:
        mtime = os.path.getmtime(ENROLMENT_PATH)
    except OSError:
        if _enrolment_mtime is not None:
            print(f"[auth] WARNING: enrolment file vanished ({ENROLMENT_PATH}); keeping the last good list.")
        return
    if mtime == _enrolment_mtime:
        return

    parsed: dict[str, str] = {}
    with open(ENROLMENT_PATH, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            sid, _, section = line.partition(",")
            parsed[sid.strip().upper()] = section.strip().upper() or "A"

    _enrolment, _enrolment_mtime = parsed, mtime
    # ASCII only, deliberately. An emoji here crashed uvicorn at startup on a
    # cp1252 Windows console (UnicodeEncodeError inside the lifespan handler ->
    # "Application startup failed"). A log decoration must never be able to take
    # the server down, least of all on an unattended box.
    print(f"[auth] Enrolment list loaded: {len(parsed)} SID(s) from {ENROLMENT_PATH}")


def enrolled_section(sid: str) -> str | None:
    """Section for an enrolled SID, or None if not on the list."""
    _refresh_enrolment()
    return _enrolment.get(sid.strip().upper())


# ── schema ────────────────────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    # `with sqlite3.connect()` commits but does NOT close -- same trap noted in
    # research_store.py; on Windows the leaked handle also locks the file.
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    sid           TEXT PRIMARY KEY,
                    username      TEXT,
                    avatar_id     TEXT,
                    section       TEXT,
                    created_at    TEXT NOT NULL,
                    last_seen_at  TEXT,
                    withdrawn     INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    token       TEXT PRIMARY KEY,
                    sid         TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    expires_at  TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_sid ON sessions(sid)")
            conn.commit()
        finally:
            conn.close()
    _refresh_enrolment()


# ── sessions ──────────────────────────────────────────────────────────────────

def start_session(sid: str, username: str | None = None, avatar_id: str | None = None) -> dict | None:
    """Claim an identity. Returns {token, sid, username, avatar_id, section,
    needs_onboarding} or None if the SID is not enrolled / has withdrawn.

    NOT authentication -- see the module docstring. The allowlist is the only gate.
    """
    sid = sid.strip().upper()
    section = enrolled_section(sid)
    if section is None:
        return None

    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)

    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM users WHERE sid = ?", (sid,)).fetchone()
            if row and row["withdrawn"]:
                return None

            if row is None:
                conn.execute(
                    "INSERT INTO users (sid, username, avatar_id, section, created_at, last_seen_at)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (sid, username, avatar_id, section, now.isoformat(), now.isoformat()),
                )
                username_out, avatar_out = username, avatar_id
            else:
                # Section can change if the lecturer moves a student between days.
                username_out = username or row["username"]
                avatar_out = avatar_id or row["avatar_id"]
                conn.execute(
                    "UPDATE users SET last_seen_at = ?, section = ?, username = ?, avatar_id = ?"
                    " WHERE sid = ?",
                    (now.isoformat(), section, username_out, avatar_out, sid),
                )

            conn.execute(
                "INSERT INTO sessions (token, sid, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, sid, now.isoformat(), (now + timedelta(days=SESSION_DAYS)).isoformat()),
            )
            conn.commit()
        finally:
            conn.close()

    return {
        "token": token,
        "sid": sid,
        "username": username_out,
        "avatar_id": avatar_out,
        "section": section,
        "needs_onboarding": not (username_out and avatar_out),
    }


def resolve_session(token: str) -> dict | None:
    """Current user for a session token, or None if unknown/expired/withdrawn."""
    if not token:
        return None
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT s.expires_at, u.* FROM sessions s JOIN users u ON u.sid = s.sid"
                " WHERE s.token = ?",
                (token,),
            ).fetchone()
        finally:
            conn.close()

    if row is None or row["withdrawn"]:
        return None
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        return None
    return {
        "sid": row["sid"],
        "username": row["username"],
        "avatar_id": row["avatar_id"],
        "section": row["section"],
        "needs_onboarding": not (row["username"] and row["avatar_id"]),
    }


def end_session(token: str) -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        finally:
            conn.close()


def update_profile(sid: str, username: str | None = None, avatar_id: str | None = None) -> None:
    """Onboarding writes the username/avatar the `user` cookie carries."""
    sid = sid.strip().upper()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT username, avatar_id FROM users WHERE sid = ?", (sid,)).fetchone()
            if row is None:
                return
            conn.execute(
                "UPDATE users SET username = ?, avatar_id = ? WHERE sid = ?",
                (username or row["username"], avatar_id or row["avatar_id"], sid),
            )
            conn.commit()
        finally:
            conn.close()


# ── withdrawal ────────────────────────────────────────────────────────────────

def withdraw(sid: str) -> bool:
    """Consent withdrawal: kill every session, tombstone the account.

    Tombstone rather than DELETE so a withdrawn SID cannot simply start a fresh
    session and reappear in the data. Their research rows are removed separately
    via research_store -- this module does not reach across into that table.
    """
    sid = sid.strip().upper()
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("UPDATE users SET withdrawn = 1 WHERE sid = ?", (sid,))
            conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def stats() -> dict:
    _refresh_enrolment()
    with _lock:
        conn = _connect()
        try:
            total = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
            withdrawn = conn.execute("SELECT COUNT(*) AS c FROM users WHERE withdrawn = 1").fetchone()["c"]
            by_section = {
                r["section"]: r["c"]
                for r in conn.execute(
                    "SELECT section, COUNT(*) AS c FROM users WHERE withdrawn = 0 GROUP BY section"
                )
            }
        finally:
            conn.close()
    return {
        "enrolled": len(_enrolment),
        "registered": total,
        "withdrawn": withdrawn,
        "by_section": by_section,
    }
