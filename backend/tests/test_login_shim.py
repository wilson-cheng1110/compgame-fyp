"""Login-lookup shim: an un-migrated letter-PK account can still sign in.

TEMPORARY compat surface (auth_store._lookup_account_row + its three call sites),
to be DELETED after `migrate_canon_sid.py --apply`. See the SHIM comments in
auth_store.py. This suite pins the five invariants that make migrate-before-restart
ordering non-fatal, using SYNTHETIC SIDs only.

The setup is the LIVE prod shape: roster OFF (self-enroll), and accounts whose
users.sid primary key still carries the PolyU check letter ("24010001D") because
the migration has not run yet. Those rows are injected directly, because
create_account (correctly) canonicalises and so cannot itself create a letter PK.
"""
import os, sys, sqlite3
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_login_shim")
os.makedirs(d, exist_ok=True)
os.environ["AUTH_DB_PATH"] = os.path.join(d, "t.db")
# Point the roster/admin/researcher allowlists at absent files so this fixture runs
# roster-OFF (open self-enroll, the mode live prod has run in the whole rollout) and
# with no staff -- never the real gitignored lists.
os.environ["ENROLMENT_PATH"] = os.path.join(d, "no_such_roster.txt")
os.environ["PARTICIPANT_SECRET_PATH"] = os.path.join(d, ".secret")
os.environ["ADMIN_PATH"] = os.path.join(d, "no_admins.txt")
os.environ["RESEARCHER_PATH"] = os.path.join(d, "no_researchers.txt")
for f in ("t.db", ".secret", "no_such_roster.txt", "no_admins.txt", "no_researchers.txt"):
    p = os.path.join(d, f)
    if os.path.exists(p):
        os.remove(p)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import auth_store as A

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1;  print(f"  PASS  {label}")
    else:
        fail += 1; print(f"  FAIL  {label}  {extra}")

A.init_db()
check("fixture runs roster-OFF, as live prod self-enroll", A.roster_active() is False)

PW = "hunter2xyz-shim"


def inject_letter(sid_letter, password=PW, section="A", withdrawn=0, disabled=0,
                  username="stud", avatar_id="av1"):
    """Insert an un-migrated prod row: a users PK that still carries its check letter,
    with a real scrypt password -- the exact state migrate_canon_sid.py has not yet
    folded to the 8-digit canonical key."""
    salt, pw = A.hash_password(password)
    c = sqlite3.connect(os.environ["AUTH_DB_PATH"])
    c.execute(
        "INSERT INTO users (sid, username, avatar_id, section, created_at, last_seen_at,"
        " withdrawn, disabled, pw_salt, pw_hash) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (sid_letter, username, avatar_id, section, datetime.now(timezone.utc).isoformat(),
         None, withdrawn, disabled, salt, pw),
    )
    c.commit(); c.close()


def user_sids_like(prefix):
    c = sqlite3.connect(os.environ["AUTH_DB_PATH"])
    rows = [r[0] for r in c.execute(
        "SELECT sid FROM users WHERE sid LIKE ?", (prefix + "%",)).fetchall()]
    c.close(); return sorted(rows)


def session_sid(token):
    c = sqlite3.connect(os.environ["AUTH_DB_PATH"])
    r = c.execute("SELECT sid FROM sessions WHERE token = ?", (token,)).fetchone()
    c.close(); return r[0] if r else None


# ── Invariant 1: all three typed forms sign in against a letter PK ───────────────
print("\n-- (1) letter-PK account signs in from every typed form --")
inject_letter("24010001D")
s_bare = A.start_session("24010001", PW)          # bare 8-digit -> LIKE-prefix fallback
s_low  = A.start_session("24010001d", PW)         # lowercase letter -> exact fallback
s_up   = A.start_session("24010001D", PW)         # exact stored form
check("bare numeric form signs in",      s_bare is not None, s_bare)
check("lowercase check-letter form signs in", s_low is not None, s_low)
check("exact stored letter form signs in",    s_up is not None, s_up)
check("all three resolve the SAME actual stored (letter) sid",
      bool(s_bare and s_low and s_up)
      and s_bare["sid"] == s_low["sid"] == s_up["sid"] == "24010001D",
      (s_bare, s_low, s_up))
check("the session is keyed to the actual stored letter sid (referential consistency)",
      session_sid(s_bare["token"]) == "24010001D", session_sid(s_bare["token"]))

# ── Invariant 2: that session keeps resolving across calls ──────────────────────
print("\n-- (2) the letter-PK session persists through resolve_session --")
r1 = A.resolve_session(s_bare["token"])
r2 = A.resolve_session(s_bare["token"])   # second call, e.g. an idle ping / dashboard
check("first resolve returns the letter account",  r1 is not None and r1["sid"] == "24010001D", r1)
check("second resolve still returns it (survives)", r2 is not None and r2["sid"] == "24010001D", r2)

# ── Invariant 3: no enumeration; disabled/withdrawn gates intact via the fallback ─
print("\n-- (3) gates intact through the fallback; one generic failure --")
s_wrong   = A.start_session("24010001D", "WRONG-password")   # real letter acct, wrong pw
s_unknown = A.start_session("29999999", "anything-at-all")   # no such account at all
check("wrong password on the letter account fails",  s_wrong is None)
check("unknown SID fails identically (no enumeration)",
      s_wrong is None and s_unknown is None and (s_wrong == s_unknown))

inject_letter("24010002D", disabled=1)
check("a DISABLED letter account is blocked (bare form)",  A.start_session("24010002", PW) is None)
check("a DISABLED letter account is blocked (letter form)", A.start_session("24010002D", PW) is None)

inject_letter("24010003D", withdrawn=1)
check("a WITHDRAWN letter account is blocked (bare form)",  A.start_session("24010003", PW) is None)
check("a WITHDRAWN letter account is blocked (letter form)", A.start_session("24010003D", PW) is None)

# ── Invariant 4: numeric PK (post-migration shape) -- shim is a no-op ────────────
print("\n-- (4) a canonical numeric-PK account signs in & resolves normally --")
sacc, serr = A.create_account("24010004", PW, "A")   # stores PK "24010004" (no letter)
check("signup stores the canonical numeric sid", serr is None and sacc and sacc["sid"] == "24010004", (sacc, serr))
s_num = A.start_session("24010004", PW)
check("numeric account signs in (canonical hit, no fallback)", s_num is not None and s_num["sid"] == "24010004", s_num)
check("its session is keyed numeric", session_sid(s_num["token"]) == "24010004")
r_num = A.resolve_session(s_num["token"])
check("numeric session resolves normally", r_num is not None and r_num["sid"] == "24010004", r_num)

# ── Invariant 5: create_account dup-guard sees the letter PK via the fallback ────
print("\n-- (5) signup dup-guard refuses when a letter twin already exists --")
inject_letter("24010005D")
_, dup_num = A.create_account("24010005", PW, "A")    # bare numeric re-signup
_, dup_low = A.create_account("24010005d", PW, "A")   # lowercase-letter re-signup
check("re-signup as bare numeric is refused as existing",   dup_num == "exists", dup_num)
check("re-signup as lowercase letter is refused as existing", dup_low == "exists", dup_low)
check("NO duplicate numeric row was created (only the letter PK remains)",
      user_sids_like("24010005") == ["24010005D"], user_sids_like("24010005"))

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
