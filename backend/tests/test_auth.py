import os, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_authtest")
os.environ["AUTH_DB_PATH"] = os.path.join(d, "t.db")
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, 'enrolled.txt'), 'w', encoding='utf-8') as _fh:
    _fh.write('24012345D,A\n24067890X,B\n24099999Z,C\nbadline_no_section\n')
os.environ["ENROLMENT_PATH"] = os.path.join(d, "enrolled.txt")
os.environ["PARTICIPANT_SECRET_PATH"] = os.path.join(d, ".secret")
for f in ("t.db", ".secret"):
    p = os.path.join(d, f)
    if os.path.exists(p): os.remove(p)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import auth_store as A

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1;  print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

A.init_db()
print("\n-- enrolment gate --")
check("enrolled SID resolves section", A.enrolled_section("24012345D") == "A")
check("lowercase SID normalised",      A.enrolled_section("24067890x") == "B")
check("no-section line defaults to A", A.enrolled_section("BADLINE_NO_SECTION") == "A")
check("unknown SID rejected",          A.enrolled_section("99999999Q") is None)

print("\n-- session lifecycle --")
sacc, serr = A.create_account("24012345D", "hunter2xyz")
check("signup on the class list succeeds", serr is None, serr)
check("signup twice is refused",           A.create_account("24012345D", "hunter2xyz")[1] == "exists")
check("a short password is refused",       A.create_account("24067890X", "abc")[1] == "weak_password")
check("roster is active in this fixture",  A.roster_active() is True)
s = A.start_session("24012345D", "hunter2xyz")
check("session created for enrolled",  s is not None and s["token"])
check("section carried onto session",  s["section"] == "A", s)
check("new user needs onboarding",     s["needs_onboarding"] is True)
check("unenrolled SID cannot sign up",  A.create_account("99999999Q", "hunter2xyz")[1] == "not_enrolled")
check("unenrolled SID gets no session", A.start_session("99999999Q", "hunter2xyz") is None)
check("wrong password gets no session", A.start_session("24012345D", "WRONG-pass") is None)
# One failure mode on purpose: an unclaimed row must look exactly like a wrong
# password, or this endpoint becomes a way to discover who is on the list.
A.create_account("24067890X", "hunter2xyz")
check("right password still works",     A.start_session("24067890X", "hunter2xyz") is not None)
check("password verifies constant-time against a null hash",
      A.verify_password("anything", None, None) is False)

r = A.resolve_session(s["token"])
check("token resolves to same sid",    r and r["sid"] == "24012345D")
check("bad token resolves to None",    A.resolve_session("nope") is None)
check("empty token resolves to None",  A.resolve_session("") is None)

print("\n-- profile + onboarding flag --")
A.update_profile("24012345D", username="wilson", avatar_id="av2")
r = A.resolve_session(s["token"])
check("profile persisted",             r["username"] == "wilson" and r["avatar_id"] == "av2")
check("onboarding flag clears",        r["needs_onboarding"] is False)

s2 = A.start_session("24012345D", "hunter2xyz")
check("2nd session keeps profile",     s2["username"] == "wilson")
check("2nd session is a new token",    s2["token"] != s["token"])
check("1st session still valid",       A.resolve_session(s["token"]) is not None)

print("\n-- pseudonymisation (§5) --")
p1, p2 = A.pseudonym("24012345D"), A.pseudonym("24012345d")
check("pseudonym stable across calls", p1 == p2)
check("pseudonym differs per sid",     p1 != A.pseudonym("24067890X"))
check("pseudonym hides the sid",       "24012345" not in p1, p1)

print("\n-- withdrawal --")
check("withdraw reports success",      A.withdraw("24012345D") is True)
check("sessions killed on withdraw",   A.resolve_session(s["token"]) is None)
check("withdrawn cannot re-enter",     A.start_session("24012345D", "hunter2xyz") is None)
check("withdrawn cannot sign up again", A.create_account("24012345D", "hunter2xyz")[1] == "withdrawn")
check("withdraw unknown sid is False", A.withdraw("99999999Q") is False)

print("\n-- hot reload of enrolment --")
with open(os.environ["ENROLMENT_PATH"], "a", encoding="utf-8") as fh:
    fh.write("\n24055555L,C\n")
os.utime(os.environ["ENROLMENT_PATH"], (9e8, 9e8))   # force a distinct mtime
check("late enrolment picked up",      A.enrolled_section("24055555L") == "C")

print("\n-- stats --")
st = A.stats()
check("stats shape",                   set(st) == {"enrolled","registered","withdrawn","by_section"}, st)
check("withdrawn counted",             st["withdrawn"] == 1, st)
print("   ", st)

print("\n-- every sign-in failure costs the same work (no timing oracle) --")
# The single 401 /api/auth/session returns is worth nothing if a missing row can
# skip the hash. Measured 2026-08-30 before the fix: an unknown SID answered in
# 14.6 ms against 61.3 ms for a real one with a wrong password -- 4.2x, and the two
# distributions did not overlap. That is the enrolment list, readable with a
# stopwatch, and a WITHDRAWN student sat in the fast bucket too.
#
# Asserted structurally rather than by clock: count the hashes. A timing bound alone
# would be flaky; a call count cannot be.
import time as _time
_real_verify = A.verify_password
_calls = []
def _counting_verify(pw, salt, expected):
    _calls.append(1)
    return _real_verify(pw, salt, expected)
A.verify_password = _counting_verify
try:
    A.create_account("24067890X", "hunter2xyz")

    _calls.clear(); A.start_session("99Z99999Z", "anything-at-all")
    check("a SID with no account still hashes", len(_calls) == 1, len(_calls))

    _calls.clear(); A.start_session("24067890X", "wrong-password-here")
    check("a real SID with a wrong password hashes", len(_calls) == 1, len(_calls))

    _calls.clear(); A.start_session("", "x")
    check("an EMPTY sid is the one allowed short-circuit", len(_calls) == 0, len(_calls))
finally:
    A.verify_password = _real_verify

# A withdrawn account must not be distinguishable either -- that promise is in
# start_session's own docstring.
A.create_account("24099999Z", "hunter2xyz")
A.withdraw("24099999Z")
_calls.clear(); A.verify_password = _counting_verify
try:
    A.start_session("24099999Z", "hunter2xyz")
    check("a withdrawn account still hashes", len(_calls) == 1, len(_calls))
finally:
    A.verify_password = _real_verify
check("and still cannot sign in", A.start_session("24099999Z", "hunter2xyz") is None)

def _median_ms(sid, pw, n=9):
    xs = []
    for _ in range(n):
        t0 = _time.perf_counter()
        A.start_session(sid, pw)
        xs.append((_time.perf_counter() - t0) * 1000)
    return sorted(xs)[n // 2]

_miss = _median_ms("99Z99999Z", "anything-at-all")
_wrong = _median_ms("24067890X", "wrong-password-here")
_ratio = max(_miss, _wrong) / max(0.001, min(_miss, _wrong))
# Generous on purpose -- this is a smoke check on a shared machine, not a
# constant-time proof. The bug it guards was 4.2x; anything under 3 is fine.
check("miss and wrong-password take comparable time", _ratio < 3.0,
      f"miss={_miss:.1f}ms wrong={_wrong:.1f}ms ratio={_ratio:.1f}x")
print(f"     miss={_miss:.1f}ms  wrong-password={_wrong:.1f}ms  ratio={_ratio:.2f}x")

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
