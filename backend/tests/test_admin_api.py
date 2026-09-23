import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_admintest")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24TEACH01A,A\n24STUDENT1B,B\n24STUDENT2C,C\n")
with open(os.path.join(d, "admins.txt"), "w", encoding="utf-8") as fh:
    fh.write("# the course team\n24TEACH01A   # Dr Example\n")
# A researcher who is NOT an admin, to prove the grade-run route consults ONLY the admin
# allowlist (a real researcher is still refused). Separate file from the admin one.
with open(os.path.join(d, "researchers.txt"), "w", encoding="utf-8") as fh:
    fh.write("24RSRCH88Z\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d, "a.db"), "RESEARCH_DB_PATH": os.path.join(d, "r.db"),
    "ENROLMENT_PATH": os.path.join(d, "enrolled.txt"),
    "ADMIN_PATH": os.path.join(d, "admins.txt"),
    "RESEARCHER_PATH": os.path.join(d, "researchers.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(d, ".secret"),
    "TOPIC_SCHEDULE_PATH": os.path.join(BE, "topic_schedule.json"),
    "COOKIE_SECURE": "0", "TELEMETRY_ENABLED": "0",
    "REPORTS_DIR": os.path.join(d, "reports"),   # a throwaway reports tree for the blinding test
    "GRADES_DIR": os.path.join(d, "grades"),     # throwaway grades tree for the grade-run test
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

print("\n-- report blinding is an allowlist, not a '-research.md' denylist (L7) --")
# generate_tutorial_report writes <t>-<date>-{teacher,discussion,research}.md into
# REPORTS_DIR. The research copy names each student's FLIP/CONTROL order and must never
# be listed or served — nor may any ORDINARY copy of it (a backup, an autosave, a
# Windows "(1)" duplicate), which a suffix denylist let straight through.
_rep = os.path.join(d, "reports", "COMP3423", "section-A")
os.makedirs(_rep, exist_ok=True)
_files = {
    "memory-2026-08-31-teacher.md": "TEACHER copy (has SIDs, but servable to the teacher)",
    "memory-2026-08-31-discussion.md": "DISCUSSION copy (projectable)",
    "memory-2026-08-31-research.md": "RESEARCH copy — names FLIP/CONTROL, never serve",
    "memory-2026-08-31-research-backup.md": "a BACKUP of the research copy — same content",
    "memory-2026-08-31-research (1).md": "a Windows duplicate of the research copy",
    "memory-2026-08-31-RESEARCH.md": "a case-variant of the research copy",
}
for _fn, _body in _files.items():
    with open(os.path.join(_rep, _fn), "w", encoding="utf-8") as _fh:
        _fh.write(_body)

_listing = teacher.get("/api/admin/reports")
_names = [r["name"] for r in _listing.json().get("reports", [])] if _listing.status_code == 200 else []
check("listing shows the teacher + discussion copies",
      any("teacher" in n for n in _names) and any("discussion" in n for n in _names), _names)
check("listing hides EVERY research variant (backup, (1), case-variant included)",
      not any("research" in n.lower() for n in _names), _names)

def _read(fn):
    return teacher.get("/api/admin/reports/file", params={"path": "COMP3423/section-A/" + fn})

check("teacher copy is served (200)", _read("memory-2026-08-31-teacher.md").status_code == 200)
check("discussion copy is served (200)", _read("memory-2026-08-31-discussion.md").status_code == 200)
check("research copy is refused (403)", _read("memory-2026-08-31-research.md").status_code == 403)
check("a research BACKUP is refused (403)", _read("memory-2026-08-31-research-backup.md").status_code == 403)
check("a research '(1)' duplicate is not served",
      _read("memory-2026-08-31-research (1).md").status_code in (400, 403, 404))
check("a case-variant research copy is refused (403)",
      _read("memory-2026-08-31-RESEARCH.md").status_code == 403)

print("\n-- disable is a REVERSIBLE off switch, not a tombstone (three gates) --")
victim = TestClient(app)                          # an earlier test emptied the roster => signup takes a section
victim.post("/api/auth/signup", json={"sid": "24STUDENT2C", "password": PW, "section": "C"})
check("the student is in before disable", victim.get("/api/auth/me").status_code == 200)
nonadmin = TestClient(app)
nonadmin.post("/api/auth/signup", json={"sid": "24NOADM99Z", "password": PW, "section": "A"})
check("a student cannot disable anyone (403)",
      nonadmin.post("/api/admin/disable", json={"sid": "24STUDENT2C", "disabled": True}).status_code == 403)

_rd = teacher.post("/api/admin/disable", json={"sid": "24STUDENT2C", "disabled": True})
check("the teacher disables the student (200)", _rd.status_code == 200, _rd.text)
# Gate 1: resolve_session — the LIVE session is dropped immediately.
check("the disabled student's live session is now dead (401)",
      victim.get("/api/auth/me").status_code == 401)
# Gate 2: start_session — a fresh sign-in is refused.
check("the disabled student cannot sign in again (401)",
      TestClient(app).post("/api/auth/session", json={"sid": "24STUDENT2C", "password": PW}).status_code == 401)
# Gate 3: create_account — cannot be re-claimed via signup.
_rc = TestClient(app).post("/api/auth/signup", json={"sid": "24STUDENT2C", "password": PW, "section": "C"})
check("a disabled account cannot be re-claimed via signup (409 disabled)",
      _rc.status_code == 409 and _rc.json().get("error") == "disabled", _rc.json())
check("disabled shows on the roster",
      any(p["sid"] == "24STUDENT2C" and p["disabled"]
          for p in teacher.get("/api/admin/participants").json()["participants"]))

_re = teacher.post("/api/admin/disable", json={"sid": "24STUDENT2C", "disabled": False})
check("the teacher re-enables (200)", _re.status_code == 200, _re.text)
check("the re-enabled student can sign in again (200)",
      TestClient(app).post("/api/auth/session", json={"sid": "24STUDENT2C", "password": PW}).status_code == 200)

_rt = teacher.post("/api/admin/disable", json={"sid": "24TEACH01A", "disabled": True})
check("disabling a teacher is refused (409 cannot_disable_admin)",
      _rt.status_code == 409 and _rt.json().get("error") == "cannot_disable_admin", _rt.json())
check("the teacher is still in after that refusal", teacher.get("/api/admin/whoami").status_code == 200)

print("\n-- username edit touches the label, nothing else --")
_ru = teacher.post("/api/admin/username", json={"sid": "24STUDENT2C", "username": "Ada L"})
check("the teacher sets a display name (200)", _ru.status_code == 200, _ru.text)
check("the new name shows on the roster",
      any(p["sid"] == "24STUDENT2C" and p["username"] == "Ada L"
          for p in teacher.get("/api/admin/participants").json()["participants"]))
check("an empty name is refused (bad_username)",
      teacher.post("/api/admin/username", json={"sid": "24STUDENT2C", "username": "   "}).json().get("error") == "bad_username")
check("a student cannot rename anyone (403)",
      nonadmin.post("/api/admin/username", json={"sid": "24STUDENT2C", "username": "x"}).status_code == 403)
_acts = {e["action"] for e in teacher.get("/api/admin/audit").json()["entries"]}
check("disable + username edits were audited", {"set_disabled", "set_username"} <= _acts, _acts)

print("\n-- POST /api/admin/grade-run: guardrailed trigger for the OFFLINE blind grade_batch pass --")
import threading as _threading
import grade, grade_batch, grade_runner
import ops as _ops

# A synthetic short answer in the sink, tagged with an ARM and a recognisable SID, so we
# can prove that NEITHER reaches the grader NOR the HTTP response. The participant is a
# plain student SID -- a staff SID would be dropped by research_store.record_event.
SYN_SID = "24GRADEE9Z"
SYN_ARM = "FLIP"
SYN_ANSWER = "A bigger closer target is faster to hit because the movement time falls."
research_store.record_event({
    "participant_id": SYN_SID, "event_type": "topic_probe", "topic_id": "fitts-law",
    "meta": {"answer": SYN_ANSWER, "arm": SYN_ARM, "form": "pre"},
})

# ---- guardrail 1: ONLY an admin may trigger it ----
check("grade-run: an anonymous caller has no session (401)",
      anon.post("/api/admin/grade-run", json={}).status_code == 401)
check("grade-run: a signed-in STUDENT is refused (403)",
      nonadmin.post("/api/admin/grade-run", json={}).status_code == 403)
# A researcher who is NOT an admin: the route consults ONLY the admin allowlist, so a
# genuine researcher is refused exactly like a student -- grading stays off their surface.
researcher = TestClient(app)
researcher.post("/api/auth/signup", json={"sid": "24RSRCH88Z", "password": PW, "section": "A"})
check("grade-run: that account really is a researcher and NOT an admin",
      auth_store.is_researcher("24RSRCH88Z") is True and auth_store.is_admin("24RSRCH88Z") is False)
check("grade-run: a researcher-but-not-admin is refused (403)",
      researcher.post("/api/admin/grade-run", json={}).status_code == 403)
check("grade-run: refusal shape matches the other admin routes (not_admin)",
      researcher.post("/api/admin/grade-run", json={}).json().get("error") == "not_admin")

# ---- guardrails 2/4/5: an ACCEPTED trigger runs the REAL blind path (LLM stubbed) ----
# Stub the grading call so no real Ollama runs. It records exactly what it was handed, so
# we can assert the grader was invoked ARM-BLIND (answer-only, never an arm).
_orig_grade_answer = grade.grade_answer
_seen = []
def _spy(*a, **k):
    _seen.append((a, k))
    return {"level": "full", "evidence": "movement time falls", "rubric_hit": [],
            "evidence_verbatim": True, "parse_ok": True, "ungradeable_reason": None, "llm": True}
try:
    grade.grade_answer = _spy
    _ops._buckets.clear()                                  # ensure a rate-limit token is free
    r = teacher.post("/api/admin/grade-run", json={})
    check("grade-run: the teacher's trigger is accepted (200 started)",
          r.status_code == 200 and r.json().get("state") == "started", r.text)
    grade_runner.join(timeout=15)                          # wait for the background pass
    check("grade-run: the blind pass reached the grader exactly once", len(_seen) == 1, _seen)
    _args, _kw = (_seen[0] if _seen else ((), {}))
    # guardrail 5: the grader was called (topic_id, answer) ONLY -- no arm anywhere.
    check("grade-run: grader got exactly (topic_id, answer), no kwargs, so no arm",
          len(_args) == 2 and _kw == {}, (_args, _kw))
    check("grade-run: no FLIP/CONTROL arm string reached the grader",
          SYN_ARM not in str(_args) and "CONTROL" not in str(_args), _args)
    check("grade-run: the answer DID flow to the grader (blind, not empty)",
          any(SYN_ANSWER in str(x) for x in _args))
    # guardrail 4: the RESPONSE body carries no SID, answer, grade or arm.
    _body = r.text
    check("grade-run: response body has no SID", SYN_SID not in _body, _body)
    check("grade-run: response body has no arm/condition",
          "FLIP" not in _body and "CONTROL" not in _body and "arm" not in _body, _body)
    check("grade-run: response body has no answer text or grade level",
          SYN_ANSWER not in _body and "full" not in _body and "level" not in _body, _body)
finally:
    grade.grade_answer = _orig_grade_answer                # RESTORE no matter what
check("grade-run: the monkeypatch was restored", grade.grade_answer is _orig_grade_answer)

# guardrail 2: the accepted trigger was audited.
_ga = [e for e in teacher.get("/api/admin/audit").json()["entries"] if e["action"] == "grade_run"]
check("grade-run: an accepted trigger writes exactly one admin_audit row", len(_ga) == 1, _ga)
check("grade-run: the audit names the teacher who triggered it",
      bool(_ga) and _ga[0]["admin_sid"] == "24TEACH01A", _ga)

# ---- guardrail 3: single-flight + rate-limit -- a rapid second trigger starts NOTHING ----
_gate = _threading.Event()
_calls = []
def _blocking(*a, **k):
    _calls.append((a, k))
    _gate.wait(15)                                         # hold the pass open
    return {"level": "none", "evidence": "", "rubric_hit": [],
            "evidence_verbatim": None, "parse_ok": True, "ungradeable_reason": None, "llm": True}
_orig2 = grade.grade_answer
try:
    grade.grade_answer = _blocking
    _ops._buckets.clear()                                  # give the FIRST trigger its token
    r1 = teacher.post("/api/admin/grade-run", json={})
    check("grade-run: the first trigger starts a run (200 started)",
          r1.status_code == 200 and r1.json().get("state") == "started", r1.text)
    # HTTP: a rapid SECOND trigger is throttled (burst spent) -> 429, and start()s nothing.
    r2 = teacher.post("/api/admin/grade-run", json={})
    check("grade-run: a rapid second HTTP trigger is refused (429 throttled)",
          r2.status_code == 429, r2.text)
    # Runner: a DIRECT second start() while one is in flight is single-flight-refused,
    # independent of the rate limit, and launches no second thread.
    check("grade-run: single-flight -- start() returns already_running mid-run",
          grade_runner.start() == "already_running")
    check("grade-run: a run really is in flight", grade_runner.is_running() is True)
finally:
    _gate.set()                                            # release the held pass
    grade_runner.join(timeout=15)
    grade.grade_answer = _orig2                            # RESTORE
check("grade-run: exactly ONE run executed despite three triggers", len(_calls) == 1, _calls)
check("grade-run: the runner is idle again once the pass finished",
      grade_runner.is_running() is False)

# ---- an unknown topic is refused BEFORE any run is launched ----
_ops._buckets.clear()
_before = len(_calls)
check("grade-run: an unknown topic is refused (400)",
      teacher.post("/api/admin/grade-run", json={"topic": "not-a-real-topic"}).status_code == 400)
check("grade-run: the refused topic launched no run", len(_calls) == _before)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
