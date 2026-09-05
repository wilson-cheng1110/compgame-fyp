import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_researchertest")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(d, exist_ok=True)
# Four roles on the roster: an admin-only teacher, a researcher-only PI, a plain
# student, and an MSc student (so the by_section monitor is exercised on MSC too).
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24TEACH01A,A\n24RSRCHR1A,A\n24STUDENT1B,B\n24MSCSTU01,MSC\n")
with open(os.path.join(d, "admins.txt"), "w", encoding="utf-8") as fh:
    fh.write("# teachers\n24TEACH01A   # Dr Example, teaches only\n")
with open(os.path.join(d, "researchers.txt"), "w", encoding="utf-8") as fh:
    fh.write("# the PI\n24RSRCHR1A   # Wilson, researcher only\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d, "a.db"), "RESEARCH_DB_PATH": os.path.join(d, "r.db"),
    "ENROLMENT_PATH": os.path.join(d, "enrolled.txt"),
    "ADMIN_PATH": os.path.join(d, "admins.txt"),
    "RESEARCHER_PATH": os.path.join(d, "researchers.txt"),
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
from researcher_api import router as researcher_router

auth_store.init_db(); research_store.init_db()
app = FastAPI()
app.include_router(auth_router); app.include_router(admin_router); app.include_router(researcher_router)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

PW = "hunter2xyz"

print("\n-- the researcher allowlist is a SEPARATE file, independent of the admin one --")
check("the PI is a researcher",                 auth_store.is_researcher("24RSRCHR1A") is True)
check("lowercase still matches",                auth_store.is_researcher("24rsrchr1a") is True)
check("a teacher is NOT a researcher",          auth_store.is_researcher("24TEACH01A") is False)
check("a researcher is NOT a teacher",          auth_store.is_admin("24RSRCHR1A") is False)
check("a student is neither",                   not auth_store.is_researcher("24STUDENT1B")
                                                and not auth_store.is_admin("24STUDENT1B"))
check("a comment is not a SID",                 auth_store.is_researcher("#") is False)

print("\n-- every route needs a session AND researcher membership --")
anon = TestClient(app)
for path in ("/api/researcher/whoami", "/api/researcher/monitor",
             "/api/researcher/export", "/api/researcher/participant?sid=24STUDENT1B"):
    check(f"401 without a session  GET {path}", anon.get(path).status_code == 401)
check("401 without a session  POST /forget",
      anon.post("/api/researcher/forget", json={"sid": "24STUDENT1B"}).status_code == 401)

student = TestClient(app)
student.post("/api/auth/signup", json={"sid": "24STUDENT1B", "password": PW})
check("a signed-in STUDENT is refused (403)", student.get("/api/researcher/monitor").status_code == 403)
check("and told nothing about what would work",
      student.get("/api/researcher/whoami").json().get("error") == "not_researcher")
check("a student cannot export",  student.get("/api/researcher/export").status_code == 403)
check("a student cannot forget",
      student.post("/api/researcher/forget", json={"sid": "24STUDENT1B"}).status_code == 403)

print("\n-- THE BLINDING PROPERTY: a teacher (admin) cannot see the researcher surface --")
# This is the whole reason the surface is separate. A lecturer who could read arms would
# be able to teach to the manipulation -- a confound on H1 that cannot be undone.
teacher = TestClient(app)
teacher.post("/api/auth/signup", json={"sid": "24TEACH01A", "password": PW})
check("the teacher IS an admin (sanity)", teacher.get("/api/admin/whoami").status_code == 200)
check("but the teacher is refused the monitor (403)",
      teacher.get("/api/researcher/monitor").status_code == 403)
check("refused with not_researcher, no hint",
      teacher.get("/api/researcher/whoami").json().get("error") == "not_researcher")
check("the teacher cannot export the dataset", teacher.get("/api/researcher/export").status_code == 403)
check("the teacher cannot erase a participant",
      teacher.post("/api/researcher/forget", json={"sid": "24STUDENT1B"}).status_code == 403)

print("\n-- and the mirror: a researcher is not a teacher --")
pi = TestClient(app)
pi.post("/api/auth/signup", json={"sid": "24RSRCHR1A", "password": PW})
check("the PI gets the researcher surface (200)", pi.get("/api/researcher/whoami").status_code == 200)
check("but the PI is refused the teacher panel (403)",
      pi.get("/api/admin/participants").status_code == 403)
check("refused with not_admin",
      pi.get("/api/admin/whoami").json().get("error") == "not_admin")

print("\n-- the PI is treated as staff, not a participant --")
# A researcher-only account (not on admin_sids) must still skip the participant gates
# and be dropped from the sink -- otherwise the PI is forced to consent to their own
# study and their activity is counted as a student's (the bug teacher-path caught for
# teachers, now that 'staff' is admin OR researcher, not admin alone).
_me = pi.get("/api/auth/me").json()
check("the PI is not asked to consent as a participant", _me.get("needsConsent") is not True, _me)
check("the PI is not asked to sit the baseline pre-test", _me.get("needsBaseline") is not True, _me)
_before_evts = research_store.summary()["total_events"]
research_store.record_event({"participant_id": "24RSRCHR1A",
                             "event_type": "topic_complete", "topic_id": "memory"})
check("a researcher's own event is dropped from the sink",
      research_store.summary()["total_events"] == _before_evts, research_store.summary())

print("\n-- monitor: derived, read-only, and MSC is present --")
# Give the derivation something to chew on: an activity then a post-check for a real
# enrolled student on a real topic makes exactly one pair determinable.
research_store.record_event({"participant_id": "24STUDENT1B",
                             "event_type": "understanding_complete", "topic_id": "memory"})
research_store.record_event({"participant_id": "24STUDENT1B",
                             "event_type": "topic_posttest", "topic_id": "memory",
                             "score": 5.0, "meta": {"form": "B"}})
mon = pi.get("/api/researcher/monitor")
check("monitor is 200 for the PI", mon.status_code == 200, mon.text[:200])
m = mon.json()
for k in ("sink", "accounts", "coverage", "arms", "questionnaires", "roster_active"):
    check(f"monitor carries `{k}`", k in m, list(m))
check("accounts break down by section", isinstance(m["accounts"].get("by_section"), dict))
check("MSC appears as a section even before anyone signs up there",
      "MSC" in m["accounts"]["by_section"], list(m["accounts"]["by_section"]))
check("every scheduled section is present",
      set(m["accounts"]["by_section"]) >= {"A", "B", "C", "MSC"}, list(m["accounts"]["by_section"]))
check("coverage counts at least the one determinable pair we made",
      m["coverage"]["determinable"] >= 1, m["coverage"])
_memrow = [a for a in m["arms"] if a["topic_id"] == "memory"]
check("the topic shows up in the per-topic arm table", len(_memrow) == 1, m["arms"][:3])
check("and its determinable count reflects the pair", _memrow and _memrow[0]["determinable"] >= 1, _memrow)

# Code-review finding 1: the coverage headline and the arm table must read the SAME
# filtered set. A non-roster SID's events must not inflate coverage while being absent
# from the arm table. Under the old code (coverage re-scanned unfiltered) these diverged.
research_store.record_event({"participant_id": "99Z00000Z",
                             "event_type": "understanding_complete", "topic_id": "memory"})
research_store.record_event({"participant_id": "99Z00000Z",
                             "event_type": "topic_posttest", "topic_id": "memory", "score": 4.0})
m_c = pi.get("/api/researcher/monitor").json()
_arms_det = sum(a["determinable"] for a in m_c["arms"])
check("coverage.determinable equals the arm-table total (one filtered set, two panels)",
      m_c["coverage"]["determinable"] == _arms_det,
      {"coverage": m_c["coverage"]["determinable"], "arms_sum": _arms_det})
import schedule as _sch
_known_topics = {t["id"] for t in _sch._load().get("topics", [])}
check("the arm table carries only real schedule topics (no phantom/off-schedule rows)",
      all(a["topic_id"] in _known_topics for a in m_c["arms"]),
      [a["topic_id"] for a in m_c["arms"]])

print("\n-- export is pseudonymised: the real SID never leaves --")
j = pi.get("/api/researcher/export")
check("export json is 200", j.status_code == 200, j.status_code)
check("the raw student SID is NOT in the export", "24STUDENT1B" not in j.text, j.text[:160])
_pseud = auth_store.pseudonym("24STUDENT1B")
check("the stable pseudonym IS", _pseud in j.text, _pseud)
csv = pi.get("/api/researcher/export?format=csv")
check("csv export is 200", csv.status_code == 200)
check("csv is served as a file", "text/csv" in csv.headers.get("content-type", ""), csv.headers.get("content-type"))
check("csv still has no raw SID", "24STUDENT1B" not in csv.text)

print("\n-- export excludes a withdrawn participant --")
mscc = TestClient(app)
mscc.post("/api/auth/signup", json={"sid": "24MSCSTU01", "password": PW})
research_store.record_event({"participant_id": "24MSCSTU01",
                             "event_type": "understanding_complete", "topic_id": "fitts-law"})
check("the MSc student's pseudonym is in the export before withdrawal",
      auth_store.pseudonym("24MSCSTU01") in pi.get("/api/researcher/export").text)
mscc.post("/api/auth/consent", json={"agreed": True})   # withdraw requires a live session
mscc.post("/api/auth/withdraw")
check("after withdrawal their pseudonym is gone from the export",
      auth_store.pseudonym("24MSCSTU01") not in pi.get("/api/researcher/export").text)

print("\n-- forget: preview the blast radius, erase, and the account tombstone survives --")
prev = pi.get("/api/researcher/participant?sid=24STUDENT1B").json()
check("the preview counts the student's rows", prev["events"] >= 2, prev)
check("the preview is not withdrawn", prev["withdrawn"] is False, prev)
check("the preview carries the pseudonym", prev["pseudonym"] == _pseud, prev)
_fg = pi.post("/api/researcher/forget", json={"sid": "24STUDENT1B"})
check("forget is 200", _fg.status_code == 200, _fg.text)
check("forget removed the rows it previewed", _fg.json()["removed"] == prev["events"], _fg.json())
check("nothing is left for that participant",
      pi.get("/api/researcher/participant?sid=24STUDENT1B").json()["events"] == 0)
check("the account row still exists (tombstone untouched)",
      any(p["sid"] == "24STUDENT1B" for p in auth_store.list_participants()))
check("and the student did NOT get marked withdrawn by a forget",
      [p for p in auth_store.list_participants() if p["sid"] == "24STUDENT1B"][0]["withdrawn"] == 0)
check("an empty sid is refused (400)",
      pi.post("/api/researcher/forget", json={"sid": "   "}).status_code == 400)

print("\n-- researcher actions are audited (a dataset leaving the box is a record) --")
_acts = [e["action"] for e in auth_store.audit_log()]
check("the export was audited", "researcher_export" in _acts, _acts)
check("the forget was audited", "researcher_forget" in _acts, _acts)
_fgrow = [e for e in auth_store.audit_log() if e["action"] == "researcher_forget"][0]
check("the forget audit names who it was done to and how much",
      _fgrow["target_sid"] == "24STUDENT1B" and "removed=" in (_fgrow["detail"] or ""), _fgrow)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
