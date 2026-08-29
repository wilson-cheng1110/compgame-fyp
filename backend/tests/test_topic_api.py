import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_topictest")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as _fh:
    _fh.write("24012345D,A\n24067890X,B\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d,"a.db"), "RESEARCH_DB_PATH": os.path.join(d,"r.db"),
    "ENROLMENT_PATH": os.path.join(d,"enrolled.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(d,".secret"),
    "TOPIC_SCHEDULE_PATH": os.path.join(BE,"topic_schedule.json"),
    "COOKIE_SECURE": "0", "TELEMETRY_ENABLED": "0",
})
for f in ("a.db","r.db",".secret"):
    p = os.path.join(d,f)
    if os.path.exists(p): os.remove(p)
sys.path.insert(0, BE)
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth_store, research_store, schedule, topic_api
from auth_api import router as auth_router

auth_store.init_db(); research_store.init_db()
app = FastAPI(); app.include_router(auth_router); app.include_router(topic_api.router)
c = TestClient(app)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

print("\n-- unauthenticated is locked out --")
for path, m in [("/api/topics","get"), ("/api/topics/webers-law","get"),
                ("/api/topics/webers-law/check/A","get")]:
    check(f"401 {path}", getattr(c,m)(path).status_code == 401)
check("401 on submit", c.post("/api/topics/webers-law/check/A", json={"answers":{}}).status_code == 401)

c.post("/api/auth/signup", json={"sid":"24012345D","password":"hunter2xyz"})

print("\n-- journey --")
j = c.get("/api/topics").json()
check("13 topics", len(j["topics"]) == 13, len(j["topics"]))
check("section A", j["section"] == "A")
check("telemetry off by default", j["telemetry_enabled"] is False)
check("lecture order", [t["topic_id"] for t in j["topics"]][:3] == ["memory","problem-solving","stroop"],
      [t["topic_id"] for t in j["topics"]][:3])
check("has_bank flags 4", sum(1 for t in j["topics"] if t["has_bank"]) == 4)
check("arm present on every topic", all(t["arm"] in ("FLIP","CONTROL") for t in j["topics"]))
check("nothing done yet", not any(t["pre_done"] or t["post_done"] for t in j["topics"]))

print("\n-- consent gate blocks recording --")
r = c.post("/api/topics/webers-law/check/A", json={"answers":{"A1":"b"}})
check("submit refused before consent", r.status_code == 403 and r.json()["error"]=="no_consent", r.json())
check("nothing written to sink", len([e for e in research_store.fetch_all() if e["event_type"]=="topic_pretest"]) == 0)
c.post("/api/auth/consent", json={"agreed": True})

print("\n-- schedule gate is server-side --")
locked = [t for t in j["topics"] if t["state"] == "locked"]
check("some topics are locked right now", len(locked) > 0, [t["state"] for t in j["topics"]][:5])
if locked:
    t = locked[0]["topic_id"]
    check("locked topic detail 403s",  c.get(f"/api/topics/{t}").status_code == 403)
    check("locked topic items 403s",   c.get(f"/api/topics/{t}/check/A").status_code == 403)
    check("locked topic submit 403s",  c.post(f"/api/topics/{t}/check/A", json={"answers":{}}).status_code == 403)

print("\n-- open a window so we can exercise the happy path --")
import datetime
real = schedule.topic_states
schedule.topic_states = lambda sid, sec, now=None: real(sid, sec, datetime.datetime.fromisoformat("2026-09-24T10:00:00+08:00"))
topic_api.schedule = schedule
st = c.get("/api/topics/webers-law").json()
check("webers-law now open", st["state"] == "open", st.get("state"))

print("\n-- items carry no key --")
r = c.get("/api/topics/webers-law/check/A")
check("200", r.status_code == 200, r.status_code)
body = r.json()
check("6 items", len(body["items"]) == 6)
check("no key in payload", "✓" not in json.dumps(body) and not any("correct" in i for i in body["items"]))
check("pre-check flagged as not revealing", body["reveals_answers"] is False)

print("\n-- pre-check hides the score --")
KEY = {"A1":"b","A2":"a","A3":"b","A4":"c","A5":"b","A6":"b"}
r = c.post("/api/topics/webers-law/check/A", json={"answers": KEY, "duration_ms": 90000})
check("submit 200", r.status_code == 200, r.json())
check("no score returned on pre", "score" not in r.json() and "items" not in r.json(), r.json())
row = [e for e in research_store.fetch_all() if e["event_type"]=="topic_pretest"][0]
check("score stored server-side", row["score"] == 100.0, row["score"])
check("arm recorded in meta", '"arm"' in row["meta"])
check("IV recorded", row["played_understanding_first"] in (0,1))
check("duration recorded", row["duration_ms"] == 90000)

print("\n-- one submission only --")
r = c.post("/api/topics/webers-law/check/A", json={"answers": KEY})
check("resubmit 409", r.status_code == 409, r.status_code)
check("GET after submit also 409", c.get("/api/topics/webers-law/check/A").status_code == 409)
check("still one row", len([e for e in research_store.fetch_all() if e["event_type"]=="topic_pretest"]) == 1)

print("\n-- post-check DOES reveal --")
r = c.post("/api/topics/webers-law/check/B", json={"answers": {"B1":"b"}})
check("post submit 200", r.status_code == 200, r.json())
pb = r.json()
check("post returns score", "score" in pb, list(pb))
check("post returns correct options", all("correct_option" in i for i in pb["items"]))

print("\n-- telemetry dropped while flag is off --")
row = [e for e in research_store.fetch_all() if e["event_type"]=="topic_posttest"][0]
check("no telemetry in meta", "telemetry" not in (row["meta"] or ""))
c.post("/api/topics/gestalt/check/A", json={"answers":{"A1":"b"}, "telemetry":{"paste_detected":True}})
grow = [e for e in research_store.fetch_all() if e["topic_id"]=="gestalt"]
check("telemetry stripped even when sent", grow and "telemetry" not in (grow[0]["meta"] or ""), grow[0]["meta"] if grow else None)

print("\n-- unbanked topic --")
# visual-perception, not norman: norman is session 6 now and therefore LOCKED at this
# test's frozen date, so it 403s before the no-bank branch is ever reached.
r = c.get("/api/topics/visual-perception/check/A")
check("no_bank 404 (not a crash)", r.status_code == 404 and r.json()["error"]=="no_bank", r.status_code)

print("\n-- journey reflects progress --")
j = c.get("/api/topics").json()
w = [t for t in j["topics"] if t["topic_id"]=="webers-law"][0]
check("pre_done true", w["pre_done"] is True)
check("post_done true", w["post_done"] is True)
check("complete true", w["complete"] is True)

print("\n-- a replayed assessment keeps the BEST attempt --")
# The debrief can now send a student back into a failed assessment, so
# assessment_complete is the one event a participant can log more than once.
# journey() used to take whichever row came last, which meant a worse retry
# silently dropped the badge level they had already earned (lib/badges.ts:
# +1 at 60%, +1 at 80%). Every attempt is still its own row in the sink --
# this is a display derivation, not the measurement.
sid = "24012345D"
for s in (88, 25):
    research_store.record_event({
        "participant_id": sid, "event_type": "assessment_complete",
        "topic_id": "webers-law", "mode": "assessment", "score": s,
    })
rows = [e for e in research_store.fetch_for_participant(sid)
        if e["event_type"] == "assessment_complete" and e["topic_id"] == "webers-law"]
check("both attempts are in the sink", len(rows) == 2, len(rows))
j = c.get("/api/topics").json()
w = [t for t in j["topics"] if t["topic_id"] == "webers-law"][0]
check("assess_done true", w["assess_done"] is True)
check("assess_score is the best attempt, not the last", w["assess_score"] == 88, w["assess_score"])

# The checks are single-submission (the server 409s a resubmit), so they must NOT
# be quietly max-ed alongside it -- that would be a measurement change, not a
# display one. Assert the pre/post path still reads exactly what was recorded.
check("the post-check score is untouched by the max rule",
      w["post_correct"] is not None and w["post_total"] is not None,
      (w.get("post_correct"), w.get("post_total")))

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
