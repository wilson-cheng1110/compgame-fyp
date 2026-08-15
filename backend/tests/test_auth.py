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
s = A.start_session("24012345D")
check("session created for enrolled",  s is not None and s["token"])
check("section carried onto session",  s["section"] == "A", s)
check("new user needs onboarding",     s["needs_onboarding"] is True)
check("unenrolled SID gets no session", A.start_session("99999999Q") is None)

r = A.resolve_session(s["token"])
check("token resolves to same sid",    r and r["sid"] == "24012345D")
check("bad token resolves to None",    A.resolve_session("nope") is None)
check("empty token resolves to None",  A.resolve_session("") is None)

print("\n-- profile + onboarding flag --")
A.update_profile("24012345D", username="wilson", avatar_id="av2")
r = A.resolve_session(s["token"])
check("profile persisted",             r["username"] == "wilson" and r["avatar_id"] == "av2")
check("onboarding flag clears",        r["needs_onboarding"] is False)

s2 = A.start_session("24012345D")
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
check("withdrawn cannot re-enter",     A.start_session("24012345D") is None)
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

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
