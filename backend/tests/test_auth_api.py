import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_apitest")
os.environ["AUTH_DB_PATH"] = os.path.join(d, "a.db")
os.environ["RESEARCH_DB_PATH"] = os.path.join(d, "r.db")
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, 'enrolled.txt'), 'w', encoding='utf-8') as _fh:
    _fh.write('24012345D,A\n24067890X,B\n24099999Z,C\n')
os.environ["ENROLMENT_PATH"] = os.path.join(d, "enrolled.txt")
os.environ["PARTICIPANT_SECRET_PATH"] = os.path.join(d, ".secret")
os.environ["COOKIE_SECURE"] = "0"
for f in ("a.db", "r.db", ".secret"):
    p = os.path.join(d, f)
    if os.path.exists(p): os.remove(p)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth_store, research_store
from auth_api import router

auth_store.init_db(); research_store.init_db()
app = FastAPI(); app.include_router(router)
c = TestClient(app)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

print("\n-- session --")
r = c.post("/api/auth/signup", json={"sid": "24012345D", "password": "hunter2xyz"})
check("signup 200", r.status_code == 200, r.status_code)
check("signup twice 409", c.post("/api/auth/signup",
      json={"sid": "24012345D", "password": "hunter2xyz"}).status_code == 409)
bad = c.post("/api/auth/session", json={"sid": "24012345D", "password": "WRONG-pass"})
check("wrong password 401", bad.status_code == 401, bad.status_code)
check("and says nothing about who exists", bad.json()["error"] == "bad_credentials", bad.json())
unknown = c.post("/api/auth/session", json={"sid": "99999999Q", "password": "WRONG-pass"})
check("an unknown SID is INDISTINGUISHABLE from a wrong password",
      (unknown.status_code, unknown.json()["error"]) == (bad.status_code, bad.json()["error"]),
      (unknown.status_code, unknown.json()))
sec = c.get("/api/auth/sections").json()
check("sections are public for the signup picker", len(sec["sections"]) == 3, sec)
check("and carry the lecture day", all(x["day"] for x in sec["sections"]), sec)
r = c.post("/api/auth/session", json={"sid": "24012345D", "password": "hunter2xyz"})
check("enrolled SID gets 200", r.status_code == 200, r.status_code)
b = r.json()
check("returns camelCase avatarId", "avatarId" in b, list(b))
check("section returned", b["section"] == "A", b)
check("needsOnboarding true for new", b["needsOnboarding"] is True)
check("needsConsent true before consent", b["needsConsent"] is True)
check("HttpOnly session cookie set", "session" in r.cookies or "session" in c.cookies, dict(c.cookies))

r = c.post("/api/auth/signup", json={"sid": "99999999Q", "password": "hunter2xyz"})
check("unenrolled SID gets 403", r.status_code == 403, r.status_code)
check("403 doesn't leak why", r.json().get("error") == "not_enrolled", r.json())

print("\n-- me --")
r = c.get("/api/auth/me")
check("/me works with cookie", r.status_code == 200 and r.json()["sid"] == "24012345D", r.json())

print("\n-- profile --")
r = c.post("/api/auth/profile", json={"username": "wilson", "avatar_id": "av2"})
check("profile set", r.status_code == 200 and r.json()["username"] == "wilson", r.json())
check("onboarding clears", r.json()["needsOnboarding"] is False)

print("\n-- consent --")
r = c.post("/api/auth/consent", json={"agreed": False})
check("refusing consent is 400", r.status_code == 400, r.status_code)
check("still needs consent", c.get("/api/auth/me").json()["needsConsent"] is True)
r = c.post("/api/auth/consent", json={"agreed": True})
check("consent recorded", r.status_code == 200, r.json())
check("needsConsent now false", c.get("/api/auth/me").json()["needsConsent"] is False)
rows = [x for x in research_store.fetch_all() if x["event_type"] == "consent_recorded"]
check("consent is in the research sink", len(rows) == 1, rows)
check("consent carries a version", "version" in (rows[0]["meta"] or ""), rows[0]["meta"])

print("\n-- logout --")
r = c.post("/api/auth/logout")
check("logout ok", r.status_code == 200)
c.cookies.clear()
check("/me is 401 with no cookie", c.get("/api/auth/me").status_code == 401)
check("profile is 401 with no cookie", c.post("/api/auth/profile", json={"username":"x"}).status_code == 401)
check("consent is 401 with no cookie", c.post("/api/auth/consent", json={"agreed":True}).status_code == 401)

print("\n-- withdrawal --")
c.post("/api/auth/signup", json={"sid": "24067890X", "password": "hunter2xyz"})
r = c.post("/api/auth/withdraw")
check("withdraw ok", r.status_code == 200, r.json())
c.cookies.clear()
r = c.post("/api/auth/session", json={"sid": "24067890X", "password": "hunter2xyz"})
# 401, not 403: /session has ONE failure mode now, so a withdrawn account is
# indistinguishable from a wrong password. Confirming the withdrawal back to whoever
# typed the SID is exactly what the single message exists to prevent.
check("withdrawn SID can't re-enter", r.status_code == 401, r.status_code)
check("and is indistinguishable from any other failure",
      r.json()["error"] == "bad_credentials", r.json())
w = [x for x in research_store.fetch_all() if x["event_type"] == "consent_withdrawn"]
check("withdrawal logged in sink", len(w) == 1, w)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
