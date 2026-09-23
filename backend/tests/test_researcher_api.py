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
for k in ("sink", "accounts", "coverage", "arms", "questionnaires", "roster_active",
          "sink_census", "sink_reconcile"):
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

print("\n-- monitor: sink census + reconcile (aggregate-only, no SID leak) --")
# Record a person under BOTH the numeric and the check-letter form of the same SID: two
# raw streams that canonicalise to one person (the reconcile split_by_check_letter signal),
# neither of which has an account.
research_store.record_event({"participant_id": "20250001",
                             "event_type": "understanding_complete", "topic_id": "memory"})
research_store.record_event({"participant_id": "20250001A",
                             "event_type": "topic_posttest", "topic_id": "memory", "score": 3.0})
m2 = pi.get("/api/researcher/monitor").json()
_cen = {r["event_type"]: r for r in m2["sink_census"]}
check("sink_census is a list of per-event-type rows with counts + first/last seen",
      isinstance(m2["sink_census"], list) and all(
          {"event_type", "n", "participants", "first_seen", "last_seen"} <= set(r)
          for r in m2["sink_census"]), m2["sink_census"][:2])
check("sink_census counts a wired event type (topic_posttest present with n>=1)",
      "topic_posttest" in _cen and _cen["topic_posttest"]["n"] >= 1, list(_cen))
check("sink_census participants is DISTINCT (never more than the row count)",
      all(r["participants"] <= r["n"] for r in m2["sink_census"]), m2["sink_census"][:3])
_rec = m2["sink_reconcile"]
check("sink_reconcile is counts-only (the exact integer-count field set)",
      set(_rec) == {"sink_streams", "sink_canonical_people", "accounts_canonical",
                    "matched_to_account", "excess_no_account", "split_by_check_letter"}, _rec)
check("sink_reconcile values are all integers", all(isinstance(v, int) for v in _rec.values()), _rec)
check("reconcile matched the real enrolled student's stream to an account",
      _rec["matched_to_account"] >= 1, _rec)
check("reconcile flags the numeric/check-letter twin as one split person",
      _rec["split_by_check_letter"] >= 1, _rec)
check("the account-less twin shows as excess_no_account", _rec["excess_no_account"] >= 1, _rec)
# THE HARD INVARIANT for the new fields: aggregate-only, never a raw SID. Assert both the
# numeric and the check-letter synthetic SIDs are absent from the whole monitor payload.
_mon_text = pi.get("/api/researcher/monitor").text
for _leak in ("20250001", "20250001A", "24STUDENT1B", "99Z00000Z"):
    check(f"the monitor payload leaks no raw SID ({_leak})", _leak not in _mon_text, _mon_text[:160])

print("\n-- the papers dashboard: same gate, aggregate-only, no SID leak --")
# A demographics submission for a real enrolled student, straight into the sink.
research_store.record_event({"participant_id": "24STUDENT1B",
                             "event_type": "questionnaire_demographics",
                             "meta": {"answers": {"AGE": "21", "GENDER": 2, "GAMING": 3, "AITOOL": 1}}})
check("a student cannot see demographics",
      student.get("/api/researcher/demographics").status_code == 403)
check("a teacher (admin) cannot see demographics",
      teacher.get("/api/researcher/demographics").status_code == 403)
check("a student cannot open a paper slice",
      student.get("/api/researcher/paper/01-flip-effectiveness").status_code == 403)
check("a teacher cannot open a paper slice",
      teacher.get("/api/researcher/paper/06-classroom-rct-methods").status_code == 403)
_dem = pi.get("/api/researcher/demographics")
check("the PI gets demographics (200)", _dem.status_code == 200, _dem.text[:160])
check("demographics counts the submission", _dem.json()["n"] >= 1, _dem.json())
check("demographics returns NO raw SID", "24STUDENT1B" not in _dem.text, _dem.text[:200])
_dgender = next(i for i in _dem.json()["items"] if i["id"] == "GENDER")
check("demographics labels come from the bank", _dgender["options"][0]["label"] == "Female", _dgender)
for _pid in ("01-flip-effectiveness", "02-motivation-experience", "03-reflection-help-seeking",
             "04-test-taking-behaviour", "05-cross-population-transfer", "06-classroom-rct-methods",
             "07-ai-tutor-design", "08-small-local-model", "09-game-psychophysics"):
    _r = pi.get(f"/api/researcher/paper/{_pid}")
    check(f"paper {_pid}: 200 with a full envelope",
          _r.status_code == 200 and {"id", "basis", "status", "stats"} <= set(_r.json()),
          _r.text[:160])
    check(f"paper {_pid}: no raw SID leaks", "24STUDENT1B" not in _r.text, _r.text[:200])
_unknown = pi.get("/api/researcher/paper/99-not-a-paper")
check("an unknown paper id is a graceful pending envelope, not a 500",
      _unknown.status_code == 200 and _unknown.json()["status"] == "pending", _unknown.text[:160])

print("\n-- the end-of-study battery folds into papers 01 (retention) and 02 (affect recall) --")
# Before any battery data exists, paper 01's stats are pre/post gain only.
_p01_before = pi.get("/api/researcher/paper/01-flip-effectiveness").json()
check("no retention row yet -> paper 01 has no retention stat labels",
      not any("Retention" in s["label"] for s in _p01_before["stats"]), _p01_before["stats"])

research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "topic_posttest",
                             "topic_id": "fitts-law", "score": 60.0})
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "topic_retention",
                             "topic_id": "fitts-law", "score": 45.0})
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "questionnaire_affect_recall",
                             "topic_id": "fitts-law",
                             "meta": {"answers": {"AR1": 4, "AR2": 3, "AR3": 2}}})

_p01 = pi.get("/api/researcher/paper/01-flip-effectiveness")
check("paper 01 now carries a retention stat once a topic_retention row exists",
      _p01.status_code == 200 and any("Retention" in s["label"] for s in _p01.json()["stats"]),
      _p01.json()["stats"])
check("paper 01's retention stats leak no raw SID", "24STUDENT1B" not in _p01.text, _p01.text[:200])

print("\n-- paper 01 now RETURNS its computed table (was discarded): pre/post by arm --")
# Give the memory pair a pretest too, so there is a genuine pre+post pair for gain_detail
# to populate a real row (24STUDENT1B already has understanding_complete + topic_posttest).
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "topic_pretest",
                             "topic_id": "memory", "score": 2.0})
_p01resp = pi.get("/api/researcher/paper/01-flip-effectiveness")
_p01t = _p01resp.json()
check("paper 01 returns a non-null table (the by-topic-arm detail, no longer discarded)",
      _p01t.get("table") is not None, list(_p01t))
check("the table columns are the pre/post-by-arm + ceiling + attrition detail",
      _p01t["table"]["columns"][:6] == ["Topic", "Arm", "n (pre+post)", "mean pre",
                                        "mean post", "⟨g⟩"], _p01t["table"]["columns"])
check("the table has at least one (topic, arm) row", len(_p01t["table"]["rows"]) >= 1,
      _p01t["table"]["rows"][:2])
_memrows = [r for r in _p01t["table"]["rows"] if r[0] == "memory" and r[2] >= 1]
check("the memory pre+post pair populates a row with a computed gain",
      len(_memrows) == 1 and _memrows[0][5] is not None, _memrows)
check("paper 01's table leaks no raw SID", "24STUDENT1B" not in _p01resp.text, _p01resp.text[:200])

_p02 = pi.get("/api/researcher/paper/02-motivation-experience")
check("paper 02 now carries an affect-recall stat once a questionnaire_affect_recall row exists",
      _p02.status_code == 200 and any("Affect recall" in s["label"] for s in _p02.json()["stats"]),
      _p02.json()["stats"])
check("paper 02's affect-recall stats leak no raw SID", "24STUDENT1B" not in _p02.text, _p02.text[:200])

print("\n-- PASS-THROUGH P02: the per-topic affect-recall table (was computed then discarded) --")
_p02j = _p02.json()
check("paper 02 now RETURNS its per-topic affect-recall table (by_topic, no longer discarded)",
      _p02j.get("table") is not None, list(_p02j))
check("the affect table columns are per-topic AR means each with its n",
      _p02j["table"]["columns"] == ["Topic", "AR1 mean", "AR1 n", "AR2 mean", "AR2 n",
                                    "AR3 mean", "AR3 n"], _p02j["table"]["columns"])
_arfitts = [r for r in _p02j["table"]["rows"] if r[0] == "fitts-law"]
check("the fitts-law affect row carries the AR1 mean (4) beside its denominator n (1)",
      len(_arfitts) == 1 and _arfitts[0][1] == 4 and _arfitts[0][2] == 1, _arfitts)
# HARD INVARIANT (this table): aggregate-only, no raw SID — numeric AND check-letter forms.
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 02's affect table leaks no raw SID ({_leak})", _leak not in _p02.text, _p02.text[:200])

print("\n-- PASS-THROUGH P06: per-topic arm-balance table + the dropped CONSORT-flow stats --")
_p06 = pi.get("/api/researcher/paper/06-classroom-rct-methods")
_p06j = _p06.json()
check("paper 06 now RETURNS the per-topic arm-balance table (mon['arms'], was discarded)",
      _p06j.get("table") is not None, list(_p06j))
check("the arm-balance columns are Topic/FLIP/CONTROL/determinable/complied + a compliance rate",
      _p06j["table"]["columns"] == ["Topic", "FLIP", "CONTROL", "determinable", "complied",
                                    "compliance %"], _p06j["table"]["columns"])
check("the arm-balance table carries the memory row we made determinable",
      any(r[0] == "memory" for r in _p06j["table"]["rows"]), _p06j["table"]["rows"][:3])
_p06labels = [s["label"] for s in _p06j["stats"]]
check("paper 06 now surfaces the dropped CONSORT stats (no post-check, escape, disabled, per-section)",
      {"No post-check", "Took escape hatch", "Disabled", "Enrolment by section"} <= set(_p06labels),
      _p06labels)
_complied_stat = next(s for s in _p06j["stats"] if s["label"] == "Complied")
check("paper 06 expresses compliance as a RATE beside the count",
      isinstance(_complied_stat.get("sub"), str) and "of determinable" in _complied_stat["sub"],
      _complied_stat)
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 06's arm-balance table leaks no raw SID ({_leak})", _leak not in _p06.text, _p06.text[:200])

print("\n-- PASS-THROUGH P08: by-topic grader level distribution (batch.summary, was discarded) --")
import json as _json
import researcher_api as _rapi
# No grade pass exists by default -> pending, NO table (we must not fabricate one).
_p08pending = pi.get("/api/researcher/paper/08-small-local-model").json()
check("paper 08 is 'pending' with no table before any grade pass (nothing fabricated)",
      _p08pending["status"] == "pending" and _p08pending.get("table") is None, _p08pending)
# Point the OFFLINE grades dir at a synthetic non-dry-run batch report (an offline artifact,
# never the sink) and confirm the persisted by-topic level distribution surfaces as a table.
_gd = os.path.join(d, "grades")
os.makedirs(_gd, exist_ok=True)
with open(os.path.join(_gd, "all-20260101T000000Z.json"), "w", encoding="utf-8") as fh:
    _json.dump({"generated": "20260101T000000Z", "dry_run": False, "model": "gemma4:e4b",
                "summary": {"memory": {"full": 3, "partial": 1, "none": 1, "ungradeable": 2,
                                       "n": 7, "graded_n": 5, "full_pct": 60.0,
                                       "dry_run": False}}}, fh)
_rapi.GRADES_DIR = _gd
_p08 = pi.get("/api/researcher/paper/08-small-local-model")
_p08j = _p08.json()
check("paper 08 flips to 'live' once an offline grade pass exists", _p08j["status"] == "live", _p08j["status"])
check("paper 08 now RETURNS the by-topic grader level-distribution table (batch.summary)",
      _p08j.get("table") is not None, list(_p08j))
check("the grader table columns are Topic/graded n/full/partial/none/ungradeable/full %",
      _p08j["table"]["columns"] == ["Topic", "graded n", "full", "partial", "none",
                                    "ungradeable", "full %"], _p08j["table"]["columns"])
_p08mem = [r for r in _p08j["table"]["rows"] if r[0] == "memory"]
check("the grader table carries the memory row (graded_n excludes ungradeable; full% over graded_n)",
      len(_p08mem) == 1 and _p08mem[0][1] == 5 and _p08mem[0][6] == 60.0, _p08mem)
check("paper 08 now surfaces the grade-pass generated timestamp",
      any(s["label"] == "Grade pass generated" and s["value"] == "20260101T000000Z"
          for s in _p08j["stats"]), _p08j["stats"])
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 08's grader table leaks no raw SID ({_leak})", _leak not in _p08.text, _p08.text[:200])

print("\n-- NEW DV COMPLETERS: P05 population×arm gain, P09 psychophysics-by-arm, P02 subscales --")
# 24STUDENT1B (section B -> UG) already has a memory pre+post pair (added above), so paper 05's
# population×arm gain table has a real UG row. No global is mutated here.
_p05 = pi.get("/api/researcher/paper/05-cross-population-transfer")
_p05j = _p05.json()
check("paper 05 returns the population×arm gain table (the interaction DV)",
      _p05j.get("table") is not None
      and _p05j["table"]["columns"] == ["Population", "Arm", "n (pre+post)", "mean pre",
                                        "mean post", "⟨g⟩", "SD"], _p05j.get("table"))
check("paper 05 has a UG row from the enrolled student's pre+post pair",
      any(r[0] == "UG" for r in _p05j["table"]["rows"]), _p05j["table"]["rows"])
check("paper 05 surfaces the FLIP−CONTROL gain-gap headline stat (UG vs MSc)",
      any("gain gap" in s["label"] for s in _p05j["stats"]), [s["label"] for s in _p05j["stats"]])
check("paper 05 keeps the per-section coverage as stat cards (B present)",
      any(s["label"] == "B" for s in _p05j["stats"]), [s["label"] for s in _p05j["stats"]])
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 05's gain table leaks no raw SID ({_leak})", _leak not in _p05.text, _p05.text[:200])

# P09: give an enrolled student a real stroop game_result (record_event is the raw writer; the
# telemetry strip is the HTTP layer, so this persists even with TELEMETRY_ENABLED=0).
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "assessment_complete",
                             "topic_id": "stroop",
                             "meta": {"game_result": {"game": "stroop", "consistent_avg_ms": 480,
                                                      "inconsistent_avg_ms": 900, "trials": []}}})
_p09 = pi.get("/api/researcher/paper/09-game-psychophysics")
_p09j = _p09.json()
check("paper 09 flips to 'live' once a game_result trial exists", _p09j["status"] == "live", _p09j["status"])
check("paper 09 returns the per-paradigm psychophysics table split by arm",
      _p09j.get("table") is not None
      and _p09j["table"]["columns"] == ["Paradigm", "Arm", "N", "Statistic"], _p09j.get("table"))
check("the psychophysics table has a Stroop row for each arm (FLIP + CONTROL)",
      sum(1 for r in _p09j["table"]["rows"] if r[0] == "Stroop") == 2, _p09j["table"]["rows"][:2])
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 09's psychophysics table leaks no raw SID ({_leak})", _leak not in _p09.text, _p09.text[:200])

# P02: give the enrolled student IMI/CoI/ARCS submissions so the reverse-scored subscale table
# has data (it is preferred over the affect-recall table when questionnaire responses exist).
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "questionnaire_imi",
                             "meta": {"answers": {"M1": 5, "M5": 5, "M9": 1}}})   # IE, M9 reverse
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "questionnaire_coi",
                             "meta": {"answers": {"I1": 4, "I2": 4, "I3": 4, "I4": 4}}})
research_store.record_event({"participant_id": "24STUDENT1B", "event_type": "questionnaire_arcs",
                             "meta": {"answers": {"S1": 3, "S2": 3, "S3": 3, "S4": 3, "S5": 3}}})
_p02s = pi.get("/api/researcher/paper/02-motivation-experience")
_p02sj = _p02s.json()
check("paper 02 returns the reverse-applied subscale table once IMI/CoI/ARCS responses exist",
      _p02sj.get("table") is not None
      and _p02sj["table"]["columns"] == ["Instrument", "Subscale", "mean (reverse-applied)", "n"],
      _p02sj.get("table"))
check("the subscale table carries an IMI IE row (reverse-applied: M9=1 -> 5, mean 5.0)",
      any(r[0] == "IMI" and r[1] == "IE" and r[2] == 5.0 for r in _p02sj["table"]["rows"]),
      [r for r in _p02sj["table"]["rows"] if r[0] == "IMI"])
check("paper 02 surfaces a reverse-applied IMI subscale headline stat",
      any("reverse-applied" in (s.get("sub") or "") for s in _p02sj["stats"]),
      [s.get("sub") for s in _p02sj["stats"]])
for _leak in ("24STUDENT1B", "20250001", "20250001A", "99Z00000Z"):
    check(f"paper 02's subscale table leaks no raw SID ({_leak})", _leak not in _p02s.text, _p02s.text[:200])

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
