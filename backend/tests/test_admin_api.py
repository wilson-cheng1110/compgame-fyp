import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_admintest")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24TEACH01A,A\n24STUDENT1B,B\n24STUDENT2C,C\n")
with open(os.path.join(d, "admins.txt"), "w", encoding="utf-8") as fh:
    fh.write("# the course team\n24TEACH01A   # Dr Example\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d, "a.db"), "RESEARCH_DB_PATH": os.path.join(d, "r.db"),
    "ENROLMENT_PATH": os.path.join(d, "enrolled.txt"),
    "ADMIN_PATH": os.path.join(d, "admins.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(d, ".secret"),
    "TOPIC_SCHEDULE_PATH": os.path.join(BE, "topic_schedule.json"),
    "COOKIE_SECURE": "0", "TELEMETRY_ENABLED": "0",
})
for f in ("a.db", "r.db", ".secret"):
    p = os.path.join(d, f)
    if os.path.exists(p):
        os.remove(p)
sys.path.insert(0, BE)
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth_store, research_store
from auth_api import router as auth_router
from admin_api import router as admin_router

auth_store.init_db(); research_store.init_db()
app = FastAPI(); app.include_router(auth_router); app.include_router(admin_router)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

PW = "hunter2xyz"

print("\n-- the allowlist is a file, and it is read --")
check("the teacher is an admin",      auth_store.is_admin("24TEACH01A") is True)
check("a student is not",            auth_store.is_admin("24STUDENT1B") is False)
check("lowercase still matches",     auth_store.is_admin("24teach01a") is True)
check("a comment is not a SID",      auth_store.is_admin("#") is False)

print("\n-- every route needs a session AND the allowlist --")
anon = TestClient(app)
for path in ("/api/admin/whoami", "/api/admin/participants", "/api/admin/audit"):
    check(f"401 without a session {path}", anon.get(path).status_code == 401)
check("401 on section without a session",
      anon.post("/api/admin/section", json={"sid": "24STUDENT1B", "section": "A"}).status_code == 401)
check("401 on password without a session",
      anon.post("/api/admin/password", json={"sid": "24STUDENT1B", "password": PW}).status_code == 401)

student = TestClient(app)
student.post("/api/auth/signup", json={"sid": "24STUDENT1B", "password": PW})
check("a signed-in STUDENT is refused", student.get("/api/admin/participants").status_code == 403)
check("and told nothing about what would work",
      student.get("/api/admin/whoami").json().get("error") == "not_admin")
check("a student cannot change a section",
      student.post("/api/admin/section", json={"sid": "24STUDENT2C", "section": "A"}).status_code == 403)
check("a student cannot reset anyone's password",
      student.post("/api/admin/password", json={"sid": "24STUDENT2C", "password": PW}).status_code == 403)

teacher = TestClient(app)
teacher.post("/api/auth/signup", json={"sid": "24TEACH01A", "password": PW})
check("the teacher gets in", teacher.get("/api/admin/whoami").status_code == 200)

print("\n-- the roster refuses a section change instead of silently losing it --")
r = teacher.post("/api/admin/section", json={"sid": "24STUDENT1B", "section": "C"})
check("409 while a class list is active", r.status_code == 409, r.status_code)
check("and it says to edit the list", "enrolled_sids" in r.json().get("message", ""), r.json())
# The refusal is not squeamishness: start_session re-reads the section from the file
# on every sign-in, so a change written here would be reverted at the student's next
# login and the teacher would never know.
check("the section really is still the roster's",
      [p for p in auth_store.list_participants() if p["sid"] == "24STUDENT1B"][0]["section"] == "B")

print("\n-- with no class list, the section IS editable --")
auth_store.ENROLMENT_PATH = os.path.join(d, "gone.txt")
auth_store._enrolment, auth_store._enrolment_mtime = {}, None
check("roster is now inactive", auth_store.roster_active() is False)
r = teacher.post("/api/admin/section", json={"sid": "24STUDENT1B", "section": "C"})
check("the change is accepted", r.status_code == 200, r.json())
check("and it stuck",
      [p for p in auth_store.list_participants() if p["sid"] == "24STUDENT1B"][0]["section"] == "C")
check("a section the cohort does not run is refused",
      teacher.post("/api/admin/section", json={"sid": "24STUDENT1B", "section": "Z"}).status_code == 400)
check("an unknown SID is refused",
      teacher.post("/api/admin/section", json={"sid": "99Z99999Z", "section": "A"}).status_code == 400)

print("\n-- password reset is the only way back in, so it has to work --")
check("a short reset is refused",
      teacher.post("/api/admin/password", json={"sid": "24STUDENT1B", "password": "abc"}).status_code == 400)
r = teacher.post("/api/admin/password", json={"sid": "24STUDENT1B", "password": "new-passw0rd"})
check("the reset is accepted", r.status_code == 200, r.json())
check("the new password is NOT echoed back", "password" not in r.text, r.text[:120])
check("the old password no longer works", auth_store.start_session("24STUDENT1B", PW) is None)
check("the new one does",  auth_store.start_session("24STUDENT1B", "new-passw0rd") is not None)
# A reset is a forgotten password, not a compromise: existing sessions survive unless
# the teacher asks for them to be killed.
check("existing sessions survive by default", student.get("/api/auth/me").status_code == 200)
teacher.post("/api/admin/password",
             json={"sid": "24STUDENT1B", "password": "third-passw0rd", "end_sessions": True})
check("end_sessions signs them out everywhere", student.get("/api/auth/me").status_code == 401)

print("\n-- no password material ever leaves --")
body = teacher.get("/api/admin/participants").json()
check("participants are listed", body["counts"]["total"] >= 2, body["counts"])
check("has_password is a boolean, not a hash",
      all(p["has_password"] in (0, 1, True, False) for p in body["participants"]))
check("no hash or salt field is present",
      not any(k in p for p in body["participants"] for k in ("pw_hash", "pw_salt")))
check("the raw response has no hex digest", "pw_hash" not in teacher.get("/api/admin/participants").text)

print("\n-- every mutation is audited --")
entries = teacher.get("/api/admin/audit").json()["entries"]
actions = [e["action"] for e in entries]
check("the section change was logged", "set_section" in actions, actions)
check("both resets were logged", actions.count("reset_password") == 2, actions)
check("the audit names WHO did it", all(e["admin_sid"] == "24TEACH01A" for e in entries), entries[:2])
check("and WHO it was done to", all(e["target_sid"] == "24STUDENT1B" for e in entries), entries[:2])
check("a refused change is NOT in the log", len(entries) == 3, len(entries))

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
