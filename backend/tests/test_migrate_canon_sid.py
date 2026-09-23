"""Synthetic-DB test for migrate_canon_sid.py.

Builds a tiny auth DB + research DB by hand (raw sqlite3, NOT auth_store.create_account
-- create_account is already fixed and can no longer produce a letter-suffixed row, which
is exactly why this script exists: to fold back accounts that were created BEFORE the fix,
back when a roster-OFF signup stored whatever shape the student typed).

Three accounts:
  12345678D  -- needs migration, no collision. Has a session, admin_audit rows referencing
               it both as admin_sid and target_sid, and one research event.
  87654321   -- pure numeric, was never a candidate, must come out byte-for-byte untouched.
  22334455E  -- needs migration, but 22334455 ALREADY exists as a separate account (the
               same-student-signed-up-twice scenario flagged in migrate_canon_sid.py's
               docstring). Must be refused and BOTH sides left untouched, every run.
"""
import os, sys, sqlite3, json
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_migratetest")
os.makedirs(d, exist_ok=True)
AUTH_DB = os.path.join(d, "auth.db")
RESEARCH_DB = os.path.join(d, "research.db")
for p in (AUTH_DB, RESEARCH_DB):
    if os.path.exists(p):
        os.remove(p)

os.environ["AUTH_DB_PATH"] = AUTH_DB
os.environ["RESEARCH_DB_PATH"] = RESEARCH_DB
os.environ["ENROLMENT_PATH"] = os.path.join(d, "enrolled.txt")   # absent -- roster OFF
os.environ["PARTICIPANT_SECRET_PATH"] = os.path.join(d, ".secret")
os.environ["ADMIN_PATH"] = os.path.join(d, "admin.txt")          # sandboxed, not the real file
os.environ["RESEARCHER_PATH"] = os.path.join(d, "researcher.txt")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import auth_store as A
import research_store as R

A.init_db()
R.init_db()

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1;  print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── seed the pre-fix (broken) state directly, bypassing the now-fixed auth_store API ──
_auth = sqlite3.connect(AUTH_DB)
_salt, _hash = b"salt-bytes", b"hash-bytes"
_auth.executemany(
    "INSERT INTO users (sid, username, avatar_id, section, pw_salt, pw_hash, created_at,"
    " last_seen_at, withdrawn, disabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)",
    [
        ("12345678D", "alice", "av1", "A", _salt, _hash, _now(), _now()),
        ("87654321",  "bob",   "av2", "B", _salt, _hash, _now(), _now()),
        ("22334455E", "carol", "av1", "A", _salt, _hash, _now(), _now()),
        ("22334455",  "carol-again", "av2", "A", _salt, _hash, _now(), _now()),
    ],
)
_auth.execute(
    "INSERT INTO sessions (token, sid, created_at, expires_at, last_seen_at)"
    " VALUES (?, ?, ?, ?, ?)",
    ("tok-alice-1", "12345678D", _now(), _now(), _now()),
)
_auth.executemany(
    "INSERT INTO admin_audit (at, admin_sid, action, target_sid, detail) VALUES (?, ?, ?, ?, ?)",
    [
        (_now(), "12345678D", "teacher_reset_password", "87654321", "pre-existing audit row"),
        (_now(), "ADMIN", "teacher_reset_password", "12345678D", "pre-existing audit row"),
    ],
)
_auth.commit()
_auth.close()

_research = sqlite3.connect(RESEARCH_DB)
_research.execute(
    "INSERT INTO events (participant_id, event_type, topic_id, mode, score,"
    " played_understanding_first, duration_ms, client_ts, server_ts, meta)"
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ("12345678D", "topic_pretest", "memory", None, 80.0, None, 1000, _now(), _now(), "{}"),
)
_research.execute(
    "INSERT INTO events (participant_id, event_type, topic_id, mode, score,"
    " played_understanding_first, duration_ms, client_ts, server_ts, meta)"
    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ("22334455", "topic_pretest", "memory", None, 55.0, None, 1000, _now(), _now(), "{}"),
)
_research.commit()
_research.close()


def _users():
    c = sqlite3.connect(AUTH_DB); c.row_factory = sqlite3.Row
    rows = {r["sid"]: dict(r) for r in c.execute("SELECT * FROM users")}
    c.close()
    return rows


def _sessions():
    c = sqlite3.connect(AUTH_DB); c.row_factory = sqlite3.Row
    rows = [dict(r) for r in c.execute("SELECT * FROM sessions")]
    c.close()
    return rows


def _audit():
    c = sqlite3.connect(AUTH_DB); c.row_factory = sqlite3.Row
    rows = [dict(r) for r in c.execute("SELECT * FROM admin_audit ORDER BY id")]
    c.close()
    return rows


def _events():
    c = sqlite3.connect(RESEARCH_DB); c.row_factory = sqlite3.Row
    rows = [dict(r) for r in c.execute("SELECT * FROM events")]
    c.close()
    return rows


import migrate_canon_sid as M
import schedule as SCH
import measures as MEAS   # to prove the freeze end-to-end at the analysis layer


def _arm_events():
    c = sqlite3.connect(RESEARCH_DB); c.row_factory = sqlite3.Row
    rows = [dict(r) for r in c.execute(
        "SELECT * FROM events WHERE event_type = 'topic_arm_assigned' ORDER BY id")]
    c.close()
    return rows


print("\n-- dry run reports the plan and writes NOTHING --")
before_users, before_sessions, before_audit, before_events = _users(), _sessions(), _audit(), _events()

summary = M.run(apply=False)
check("found both letter-shaped candidates", summary["found"] == 2, summary)
check("one is remappable (12345678D -> 12345678)",
      summary["remappable"] == [("12345678D", "12345678")], summary["remappable"])
check("one is colliding (22334455E vs pre-existing 22334455)",
      summary["colliding"] == [("22334455E", "22334455")], summary["colliding"])
check("dry run migrates nothing", summary["migrated"] == 0)

check("dry run touched no users rows",    _users() == before_users)
check("dry run touched no sessions rows", _sessions() == before_sessions)
check("dry run touched no audit rows",    _audit() == before_audit)
check("dry run touched no research events", _events() == before_events)

print("\n-- dry run REPORTS the arm freeze but writes no arm rows (study-integrity fix) --")
# 12345678D has one already-released topic ('memory'); the colliding 22334455E is never
# frozen. So exactly one arm row WOULD be frozen, and none is written in a dry run.
check("dry run reports arm_rows_would_freeze == 1", summary["arm_rows_would_freeze"] == 1, summary)
check("dry run freezes nothing (arm_rows_frozen == 0)", summary["arm_rows_frozen"] == 0, summary)
check("dry run wrote no topic_arm_assigned rows", _arm_events() == [], _arm_events())

# CAPTURE the resolved arm BEFORE migration -- while the event is still keyed 12345678D.
# This account's letter/numeric parities differ, so the arm WOULD flip on a naive re-derive.
idx_mem = MEAS.topic_index()["memory"]
arm_before = SCH.arm_for("12345678D", idx_mem)
pre = {r["participant_id"]: r for r in MEAS.per_topic(RESEARCH_DB)}
check("BEFORE migration, measures resolves 12345678D's arm from its (letter) sid",
      pre["12345678D"]["arm"] == arm_before, pre.get("12345678D"))

print("\n-- --apply migrates the remappable pair, refuses the colliding pair --")
summary2 = M.run(apply=True)
check("found is still 2 (both were candidates going in)", summary2["found"] == 2, summary2)
check("exactly one migrated", summary2["migrated"] == 1, summary2)
check("the colliding pair is reported, not silently dropped",
      summary2["colliding"] == [("22334455E", "22334455")], summary2["colliding"])

users_after = _users()
check("12345678D is GONE (renamed)", "12345678D" not in users_after, list(users_after))
check("12345678 now exists with alice's data",
      users_after.get("12345678", {}).get("username") == "alice", users_after.get("12345678"))
check("87654321 (never a candidate) is byte-for-byte untouched",
      users_after.get("87654321") == before_users["87654321"], users_after.get("87654321"))
check("22334455E (colliding, old side) is untouched",
      users_after.get("22334455E") == before_users["22334455E"], users_after.get("22334455E"))
check("22334455 (colliding, target side) is untouched",
      users_after.get("22334455") == before_users["22334455"], users_after.get("22334455"))

sessions_after = _sessions()
check("the session for the migrated account now carries the canonical sid",
      any(s["token"] == "tok-alice-1" and s["sid"] == "12345678" for s in sessions_after),
      sessions_after)

audit_after = _audit()
check("historical audit rows were remapped (admin_sid side)",
      any(r["admin_sid"] == "12345678" and r["target_sid"] == "87654321" for r in audit_after),
      audit_after)
check("historical audit rows were remapped (target_sid side)",
      any(r["admin_sid"] == "ADMIN" and r["target_sid"] == "12345678" for r in audit_after),
      audit_after)
mig_rows = [r for r in audit_after if r["action"] == "sid_canon_migrate"]
check("exactly one migration audit row was written",
      len(mig_rows) == 1 and mig_rows[0]["target_sid"] == "12345678"
      and mig_rows[0]["detail"] == "from=12345678D" and mig_rows[0]["admin_sid"] == "MIGRATION",
      mig_rows)

events_after = _events()
check("the migrated account's research event now carries the canonical participant_id",
      any(e["participant_id"] == "12345678" and e["topic_id"] == "memory" for e in events_after),
      events_after)
check("12345678D is gone from research_events",
      not any(e["participant_id"] == "12345678D" for e in events_after))
check("the pre-existing numeric account's event is untouched",
      any(e["participant_id"] == "22334455" and e["score"] == 55.0 for e in events_after),
      events_after)

print("\n-- the assigned arm is FROZEN so the rename cannot relabel the IV --")
check("--apply froze exactly the one already-released arm row", summary2["arm_rows_frozen"] == 1, summary2)
arm_rows = _arm_events()
check("exactly one topic_arm_assigned row exists", len(arm_rows) == 1, arm_rows)
_am = json.loads(arm_rows[0]["meta"]) if arm_rows else {}
check("the frozen row was carried onto the CANONICAL sid by the remap",
      bool(arm_rows) and arm_rows[0]["participant_id"] == "12345678", arm_rows)
check("...for the already-released topic ('memory')",
      bool(arm_rows) and arm_rows[0]["topic_id"] == "memory", arm_rows)
check("...carrying the LETTER-parity arm -- the historical ground truth",
      _am.get("arm") == arm_before, (_am, arm_before))
check("...stamped with the migration's provenance",
      _am.get("source") == "sid_canon_migrate" and _am.get("frozen_from") == "12345678D", _am)
check("the colliding account was NOT frozen (neither the letter nor numeric side)",
      not any(r["participant_id"] in ("22334455E", "22334455") for r in arm_rows), arm_rows)

# CORE GUARANTEE, end to end: the resolved arm is IDENTICAL before vs after migration,
# and the freeze is doing the work -- a naive re-derivation from the new numeric sid flips it.
post = {r["participant_id"]: r for r in MEAS.per_topic(RESEARCH_DB)}
check("AFTER migration the resolved arm is UNCHANGED (frozen row preserved it)",
      post["12345678"]["arm"] == arm_before, (arm_before, post.get("12345678")))
check("without the freeze the arm WOULD have flipped (parity differs for this account)",
      SCH.arm_for("12345678", idx_mem) != arm_before, SCH.arm_for("12345678", idx_mem))
check("the letter sid no longer appears in per_topic", "12345678D" not in post, list(post))

print("\n-- second --apply run is idempotent: nothing left to remap, collision still refused --")
summary3 = M.run(apply=True)
check("found is now 1 (only the unresolved collision remains a candidate)",
      summary3["found"] == 1, summary3)
check("nothing left to remap", summary3["remappable"] == [], summary3["remappable"])
check("the same collision is still reported (not silently dropped)",
      summary3["colliding"] == [("22334455E", "22334455")], summary3["colliding"])
check("second run migrates nothing", summary3["migrated"] == 0)

mig_rows_2 = [r for r in _audit() if r["action"] == "sid_canon_migrate"]
check("no duplicate migration audit row was written on the idempotent re-run",
      len(mig_rows_2) == 1, mig_rows_2)

check("second --apply freezes nothing (already-migrated account is no longer a candidate)",
      summary3["arm_rows_frozen"] == 0, summary3)
check("no duplicate topic_arm_assigned row on the idempotent re-run",
      len(_arm_events()) == 1, _arm_events())

print("\n-- the run ALSO prints a read-only, AGGREGATE-ONLY research-sink census --")
# The sink now holds 2 topic_pretest rows (one migrated onto 12345678, one on 22334455)
# and the 1 frozen topic_arm_assigned row -- a well-defined per-type distribution.
import io as _io, contextlib as _ctx

# (a) counts + last_seen via the standalone PATH form (opens the sink read-only itself).
sink_rows = M._sink_event_summary(RESEARCH_DB)
by_type = {et: (n, last_seen) for et, n, last_seen in sink_rows}
check("census reports the correct topic_pretest count (2)",
      by_type.get("topic_pretest", (None,))[0] == 2, by_type)
check("census reports the correct topic_arm_assigned count (1)",
      by_type.get("topic_arm_assigned", (None,))[0] == 1, by_type)
check("every census row carries a last_seen timestamp",
      bool(sink_rows) and all(last_seen for _, _, last_seen in sink_rows), sink_rows)

# ...and the SAME aggregate numbers surface machine-readably in run()'s summary dict.
summary4 = M.run(apply=False)
sink_dict = {r["event_type"]: r for r in summary4["sink_event_summary"]}
check("run()'s summary dict carries the aggregate sink census",
      sink_dict.get("topic_pretest", {}).get("n") == 2
      and sink_dict.get("topic_arm_assigned", {}).get("n") == 1, sink_dict)
check("no census summary row exposes a participant_id key (aggregate only)",
      all("participant_id" not in r for r in summary4["sink_event_summary"]),
      summary4["sink_event_summary"])

# (b) the PRINTED census section names NO participant_id / SID value.
_buf = _io.StringIO()
with _ctx.redirect_stdout(_buf):
    M._print_sink_summary(sink_rows)
sink_out = _buf.getvalue()
check("the printed census is clearly labelled", "RESEARCH SINK: events by type" in sink_out, sink_out)
_synthetic_sids = ["12345678", "12345678D", "22334455", "22334455E", "87654321"]
_leaked = [s for s in _synthetic_sids if s in sink_out]
check("the census output leaks NO participant_id / SID value (aggregate only)", _leaked == [], _leaked)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
