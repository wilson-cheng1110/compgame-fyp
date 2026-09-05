"""Server-side participant accounts for the COMP3423 rollout.

Deliberately mirrors `research_store.py`: stdlib sqlite3 only, one module-level
lock, explicit conn.close(). That is the house pattern -- do not introduce an ORM,
bcrypt/passlib, or a second DB engine for this.

WHY THIS EXISTS (it overrides CLAUDE.md's "Do NOT add server-side auth", ratified
by Wilson 2026-08-16): cookie-only state cannot survive 300 students on their own
laptops. It gives no cross-device resume, no deletion path when a participant
withdraws, and silent total data loss on a cache clear.

THE CREDENTIAL MODEL CHANGED 2026-08-30 (Wilson): **SID + password**, and the class
list became optional. What the old docstring said here -- "this is not
authentication", "the allowlist is the only gate", "never hang an admin surface off
it" -- was true of the SID-only design and is true no longer. Three consequences:

  * A password is required to start a session, so impersonation between students is
    no longer free. scrypt from the stdlib; still no bcrypt/passlib.
  * The allowlist is OPTIONAL. When `enrolled_sids.txt` exists and parses to at
    least one SID it still gates signup and still dictates the section -- the
    teacher's list outranks a student's guess. When it is absent, signup is open and
    the student picks their own section, which is then the ONLY source of their
    release window: a wrong pick is wrong data, and /api/admin exists to correct it.
  * Because there is a real secret, an admin surface is now defensible. It lives in
    its own router with its own allowlist file, never on this one.

WHAT THIS STILL IS NOT: strong identity. A password can be shared, and with no
roster an unenrolled person can create an account. Both belong in the paper.

Schema:
  users     sid PK · username · avatar_id · section · pw_salt · pw_hash
            · created_at · last_seen_at · withdrawn
  sessions  token PK · sid · created_at · expires_at · last_seen_at (idle timeout)

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
# IDLE (inactivity) timeout: a login is dropped after this many minutes with NO
# request, independently of the absolute SESSION_DAYS expiry. `last_seen_at` on the
# session is stamped (throttled, at most ~once/min) on each resolve; past the window
# resolve_session refuses and deletes the row, so the next request lands on /login.
SESSION_IDLE_MINUTES = int(os.environ.get("SESSION_IDLE_MINUTES", "30"))

# Teacher accounts, same shape and same house pattern as the enrolment list: one SID
# per line, `#` comments, re-read on mtime. Gitignored -- it names real people.
ADMIN_PATH = os.environ.get("ADMIN_PATH", os.path.join(_HERE, "admin_sids.txt"))

# stdlib scrypt. n=2**14, r=8, p=1 measures ~37 ms per verify on the dev box: dear
# enough that an offline guess costs, cheap enough that a section of 100 signing in
# at once is not a self-inflicted DoS. 16 MiB of working memory per call.
_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1, "dklen": 32}
MIN_PASSWORD = 8

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
    # A roster section that is not one the schedule runs -- a typo like 'MCS', or a
    # comma-less line that silently defaulted to 'A' -- gives those students NO release
    # window on every topic, with no error to them or the teacher. Flag it loudly at
    # load; the fix is editing the roster file (audit finding 2026-09-05).
    try:
        import schedule
        known = set(schedule.sections())
        bad = sorted({sec for sec in parsed.values() if sec not in known})
        if bad:
            print(f"[auth] WARNING: roster names section(s) the schedule does not run: "
                  f"{bad} -- those students would get no release windows. Known: {sorted(known)}.")
    except Exception:
        pass  # schedule config absent/unreadable: a diagnostic must never crash startup


def enrolled_section(sid: str) -> str | None:
    """Section for an enrolled SID, or None if not on the list."""
    _refresh_enrolment()
    return _enrolment.get(sid.strip().upper())


# ── schema ────────────────────────────────────────────────────────────────────

def roster_active() -> bool:
    """Is there a class list to gate on? Absent or empty means open signup."""
    _refresh_enrolment()
    return len(_enrolment) > 0


_admins: set[str] = set()
_admins_mtime: float | None = None


def is_admin(sid: str) -> bool:
    """Teacher? Read from ADMIN_PATH, re-read on mtime like the enrolment list.

    Deliberately a FILE and not a database flag: revoking a teacher must not need a
    migration or a running app, and the list is reviewable in one `cat`.
    """
    global _admins, _admins_mtime
    # THREAD-SAFE CACHE REFRESH. Since C2, is_staff() -> is_admin() runs on a threadpool
    # worker (record_event_status is dispatched via asyncio.to_thread) at the same time
    # is_admin() is still called on the event-loop thread (needsConsent/needsBaseline).
    # Two OS threads racing on the two-name `_admins, _admins_mtime = ...` assignment
    # could leave a reader seeing a new set against an old mtime. The lock makes the
    # assignment atomic; the membership read below needs no lock (reading the _admins
    # reference is atomic in CPython — a mid-swap reader gets a whole old or new set).
    try:
        mtime = os.path.getmtime(ADMIN_PATH)
    except OSError:
        with _lock:
            _admins, _admins_mtime = set(), None
        return False
    if mtime != _admins_mtime:
        parsed = set()
        with open(ADMIN_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.split("#", 1)[0].strip()
                if line:
                    parsed.add(line.split(",")[0].strip().upper())
        with _lock:
            _admins, _admins_mtime = parsed, mtime
    return sid.strip().upper() in _admins


# -- passwords ----------------------------------------------------------------

def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt if salt is not None else secrets.token_bytes(16)
    return salt, hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)


def verify_password(password: str, salt, expected) -> bool:
    """Constant-time check. A row with no password can never verify -- that is what
    makes a legacy SID-only account unusable until it is claimed through signup."""
    if not salt or not expected:
        return False
    _, got = hash_password(password, bytes(salt))
    return hmac.compare_digest(got, bytes(expected))


# A password nobody can supply, hashed once per process. It exists so that a
# sign-in that CANNOT succeed still costs the same as one that fails on the
# password -- see the note in start_session. Regenerated every boot, so it is not
# even a stable target.
_DECOY_SALT, _DECOY_HASH = hash_password(secrets.token_urlsafe(32))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Wait for the file lock rather than raise "database is locked" if the in-process
    # _lock is ever relaxed or a second connection contends (finding C2). Harmless
    # while _lock serialises access; a cheap correctness backstop.
    conn.execute("PRAGMA busy_timeout = 5000")
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
            # IDLE TIMEOUT support (added 2026-08-31). Add last_seen_at to any older DB
            # that predates it — guarded so it runs at most once. Existing sessions get
            # NULL, which resolve_session treats as "stamp now" so nobody is logged out
            # retroactively the instant this ships.
            if "last_seen_at" not in {r[1] for r in conn.execute("PRAGMA table_info(sessions)")}:
                conn.execute("ALTER TABLE sessions ADD COLUMN last_seen_at TEXT")
            # Additive migration rather than a new table: an existing dev DB keeps its
            # rows, and those rows simply have no password -- which reads correctly as
            # "not signed up yet" and cannot be logged into (verify_password refuses a
            # null hash). ALTER TABLE ADD COLUMN is not idempotent, so ask first.
            # Every teacher action that can change a participant's data or their
            # release window is written here. A section change moves WHEN topics open
            # for that student, which is the timing of the independent variable -- an
            # unlogged mutation of an experimental condition is not something the
            # paper could defend later.
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS admin_audit (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    at          TEXT NOT NULL,
                    admin_sid   TEXT NOT NULL,
                    action      TEXT NOT NULL,
                    target_sid  TEXT,
                    detail      TEXT
                )
                """
            )
            have = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
            for col, decl in (("pw_salt", "BLOB"), ("pw_hash", "BLOB"),
                              ("disabled", "INTEGER NOT NULL DEFAULT 0")):
                if col not in have:
                    conn.execute(f"ALTER TABLE users ADD COLUMN {col} {decl}")
            conn.commit()
        finally:
            conn.close()
    _refresh_enrolment()


# ── sessions ──────────────────────────────────────────────────────────────────

def create_account(sid: str, password: str, section: str | None = None,
                   username: str | None = None, avatar_id: str | None = None):
    """Sign up. Returns (session_dict, None) or (None, reason).

    reason is one of: bad_sid | weak_password | not_enrolled | bad_section |
    exists | withdrawn. Unlike `start_session` this one DOES distinguish, because
    a signup form that will not say "that account already exists" is unusable.

    Claiming: a row that exists but has no password -- a legacy SID-only account,
    or one an admin pre-created -- is claimed here rather than being a dead end.
    """
    sid = (sid or "").strip().upper()
    if not sid:
        return None, "bad_sid"
    if len(password or "") < MIN_PASSWORD:
        return None, "weak_password"

    # The teacher's list outranks a student's guess. With no list, the student's
    # choice is the only source of the release window -- see the module docstring.
    if roster_active():
        rostered = enrolled_section(sid)
        if rostered is None:
            return None, "not_enrolled"
        section = rostered
    else:
        import schedule  # lazy: auth_store must stay importable with no schedule config
        if section not in schedule.sections():
            return None, "bad_section"

    # Hashed BEFORE the lock is taken -- see start_session for why.
    salt, pw = hash_password(password)
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)

    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM users WHERE sid = ?", (sid,)).fetchone()
            if row and row["withdrawn"]:
                return None, "withdrawn"
            if row and row["disabled"]:
                return None, "disabled"
            if row and row["pw_hash"]:
                return None, "exists"

            if row is None:
                conn.execute(
                    "INSERT INTO users (sid, username, avatar_id, section, pw_salt, pw_hash,"
                    " created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (sid, username, avatar_id, section, salt, pw, now.isoformat(), now.isoformat()),
                )
            else:
                username = username or row["username"]
                avatar_id = avatar_id or row["avatar_id"]
                conn.execute(
                    "UPDATE users SET pw_salt = ?, pw_hash = ?, section = ?, username = ?,"
                    " avatar_id = ?, last_seen_at = ? WHERE sid = ?",
                    (salt, pw, section, username, avatar_id, now.isoformat(), sid),
                )

            conn.execute(
                "INSERT INTO sessions (token, sid, created_at, expires_at, last_seen_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (token, sid, now.isoformat(), (now + timedelta(days=SESSION_DAYS)).isoformat(),
                 now.isoformat()),
            )
            conn.commit()
        finally:
            conn.close()

    return {
        "token": token,
        "sid": sid,
        "username": username,
        "avatar_id": avatar_id,
        "section": section,
        "needs_onboarding": not (username and avatar_id),
    }, None


def start_session(sid: str, password: str) -> dict | None:
    """Sign in. Returns the session, or None for ANY failure.

    ONE failure mode on purpose: unknown SID, unclaimed account, wrong password and
    withdrawn are indistinguishable from outside, so this endpoint cannot be used to
    enumerate who is enrolled. Signup is where the distinctions live, because there
    they are unavoidable.
    """
    sid = (sid or "").strip().upper()
    if not sid:
        return None

    # scrypt costs ~37 ms and `_lock` is module-global, so verifying while holding it
    # would serialise a section of 100 signing in together into ~4 s for the last one
    # -- the same mistake journey() made with fetch_all(). Read, release, hash, write.
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM users WHERE sid = ?", (sid,)).fetchone()
        finally:
            conn.close()

    # CONSTANT WORK ON EVERY FAILURE. The single 401 this function promises is
    # undone by the clock if a missing row can skip the hash. Measured 2026-08-30
    # over a direct connection, medians of 21 requests:
    #
    #     SID with no account            14.6 ms   (min  1.1)
    #     SID with an account, wrong pw  61.3 ms   (min 38.2)
    #
    # 4.2x, and the two distributions do not overlap: that is the enrolment list,
    # readable with a stopwatch. A withdrawn student sat in the fast bucket too,
    # which defeats this docstring's own promise that withdrawal is not confirmed
    # back to whoever typed the SID. An unclaimed account was fast as well, since
    # verify_password returns early on a null hash.
    #
    # So exactly one scrypt runs on every path, against the real hash when there
    # is one and a decoy when there is not. `usable` is checked AFTER the hash so
    # the work happens either way -- do not reorder this into an early return.
    usable = (row is not None and not row["withdrawn"] and not row["disabled"]
              and row["pw_salt"] and row["pw_hash"])
    salt = row["pw_salt"] if usable else _DECOY_SALT
    expected = row["pw_hash"] if usable else _DECOY_HASH
    matched = verify_password(password or "", salt, expected)
    if not usable or not matched:
        return None

    # A student the lecturer moved between days gets the new window on next sign-in.
    section = enrolled_section(sid) or row["section"]
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)

    with _lock:
        conn = _connect()
        try:
            conn.execute("UPDATE users SET last_seen_at = ?, section = ? WHERE sid = ?",
                         (now.isoformat(), section, sid))
            conn.execute(
                "INSERT INTO sessions (token, sid, created_at, expires_at, last_seen_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (token, sid, now.isoformat(), (now + timedelta(days=SESSION_DAYS)).isoformat(),
                 now.isoformat()),
            )
            conn.commit()
        finally:
            conn.close()

    return {
        "token": token,
        "sid": sid,
        "username": row["username"],
        "avatar_id": row["avatar_id"],
        "section": section,
        "needs_onboarding": not (row["username"] and row["avatar_id"]),
    }


# -- teacher operations (see admin_api.py; every one of these is audited) -------

def audit(admin_sid: str, action: str, target_sid: str | None = None,
          detail: str | None = None) -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO admin_audit (at, admin_sid, action, target_sid, detail)"
                " VALUES (?, ?, ?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(), admin_sid.strip().upper(),
                 action, (target_sid or "").strip().upper() or None, detail),
            )
            conn.commit()
        finally:
            conn.close()


def audit_log(limit: int = 100) -> list[dict]:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        finally:
            conn.close()
    return [dict(r) for r in rows]


def withdrawn_sids() -> set:
    """SIDs that have withdrawn. Used to keep their rows out of the research export
    even before an operator runs the manual --forget purge (a promise on the consent
    form should not depend on someone remembering a CLI command per withdrawal)."""
    with _lock:
        conn = _connect()
        try:
            return {r[0] for r in conn.execute(
                "SELECT sid FROM users WHERE withdrawn=1")}
        finally:
            conn.close()


def list_participants() -> list[dict]:
    """Everyone with an account. ONE query, no per-row lookups -- a teacher opening
    this page must not fan out into 300 of them. Password material never leaves
    here: `has_password` is a boolean, and the hash is not selected at all."""
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT sid, username, section, created_at, last_seen_at, withdrawn,"
                " disabled, (pw_hash IS NOT NULL) AS has_password FROM users ORDER BY sid"
            ).fetchall()
        finally:
            conn.close()
    return [dict(r) for r in rows]


def set_section(sid: str, section: str) -> tuple[bool, str | None]:
    """Correct a student's section. (ok, reason).

    REFUSES while a class list is active, and that refusal is the point: with a
    roster, `start_session` re-reads the section from the file on every sign-in, so a
    change made here would be silently reverted the next time the student logged in.
    Editing the list is the real fix; pretending otherwise would be worse than saying
    no.
    """
    import schedule  # lazy, as in create_account
    sid = (sid or "").strip().upper()
    if section not in schedule.sections():
        return False, "bad_section"
    if roster_active():
        return False, "roster_authoritative"
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("UPDATE users SET section = ? WHERE sid = ?", (section, sid))
            conn.commit()
            if cur.rowcount == 0:
                return False, "no_such_user"
        finally:
            conn.close()
    return True, None


def set_username(sid: str, username: str) -> tuple[bool, str | None]:
    """Teacher-side display-name edit (ok, reason). The username is the `user` cookie's
    decoration (docs/revamp.md Part 0), never a security boundary, so this touches only
    the label a teacher sees on the roster. Rejects an empty name; `update_profile` is
    not reusable here (it coalesces a blank back to the old value and returns no ok
    signal). Refuses on a withdrawn account, as password reset does."""
    sid = (sid or "").strip().upper()
    username = (username or "").strip()
    if not username:
        return False, "bad_username"
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                "UPDATE users SET username = ? WHERE sid = ? AND withdrawn = 0",
                (username, sid))
            conn.commit()
            if cur.rowcount == 0:
                return False, "no_such_user"
        finally:
            conn.close()
    return True, None


def set_password(sid: str, password: str) -> tuple[bool, str | None]:
    """Teacher-side reset. There is no self-serve path and no email, so this is the
    only way back in for a student who forgot -- which is why it exists and why it is
    audited."""
    sid = (sid or "").strip().upper()
    if len(password or "") < MIN_PASSWORD:
        return False, "weak_password"
    salt, pw = hash_password(password)          # hashed before the lock, as everywhere
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                "UPDATE users SET pw_salt = ?, pw_hash = ? WHERE sid = ? AND withdrawn = 0",
                (salt, pw, sid))
            conn.commit()
            if cur.rowcount == 0:
                return False, "no_such_user"
        finally:
            conn.close()
    # Every existing session keeps working on purpose: a reset is a lost password, not
    # a compromise. end_all_sessions() is the separate, deliberate action for that.
    return True, None


def end_all_sessions(sid: str) -> int:
    """Sign a student out everywhere. Used after a reset that WAS a compromise."""
    sid = (sid or "").strip().upper()
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def resolve_session(token: str) -> dict | None:
    """Current user for a session token, or None if unknown / expired / withdrawn / idle.

    The session's own last_seen_at is aliased `s_last_seen` because the users table ALSO
    has a last_seen_at column and `u.*` would otherwise collide with `s.last_seen_at`.
    """
    if not token:
        return None
    now = datetime.now(timezone.utc)
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT s.expires_at, s.last_seen_at AS s_last_seen, u.*"
                " FROM sessions s JOIN users u ON u.sid = s.sid WHERE s.token = ?",
                (token,),
            ).fetchone()
        finally:
            conn.close()

    if row is None or row["withdrawn"] or row["disabled"]:
        return None
    if datetime.fromisoformat(row["expires_at"]) < now:
        return None

    # IDLE TIMEOUT (SESSION_IDLE_MINUTES). last_seen_at is NULL only on a session that
    # predates the column; treat NULL as "seen just now" so shipping this logs nobody
    # out retroactively, and stamp it below so its clock starts.
    seen = row["s_last_seen"]
    if seen is not None:
        idle_s = (now - datetime.fromisoformat(seen)).total_seconds()
        if idle_s > SESSION_IDLE_MINUTES * 60:
            # Stale login: drop the row so the token can't be reused, and refuse — the
            # next request lands on /login. Idempotent under a concurrent burst.
            with _lock:
                conn = _connect()
                try:
                    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                    conn.commit()
                finally:
                    conn.close()
            return None
        stamp = idle_s > 60          # throttle: at most ~one session write per minute
    else:
        stamp = True

    if stamp:
        with _lock:
            conn = _connect()
            try:
                conn.execute("UPDATE sessions SET last_seen_at = ? WHERE token = ?",
                             (now.isoformat(), token))
                conn.commit()
            finally:
                conn.close()

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


def set_disabled(sid: str, disabled: bool) -> tuple[bool, str | None]:
    """Teacher-side REVERSIBLE off switch (ok, reason).

    Unlike withdrawal this carries NO research meaning and is not a tombstone: a
    disabled account cannot sign in (start_session refuses it) and its live sessions
    are dropped so it is out immediately (resolve_session also refuses it), but its
    recorded events stay and are STILL exported -- withdrawal, not this, is how a
    participant leaves the study. Refuses to disable a teacher so the panel cannot
    lock itself out. Re-enabling is just disabled=0; the student signs in fresh."""
    sid = (sid or "").strip().upper()
    if disabled and is_admin(sid):
        return False, "cannot_disable_admin"
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("UPDATE users SET disabled = ? WHERE sid = ?",
                               (1 if disabled else 0, sid))
            if disabled:
                conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            conn.commit()
            if cur.rowcount == 0:
                return False, "no_such_user"
        finally:
            conn.close()
    return True, None


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
