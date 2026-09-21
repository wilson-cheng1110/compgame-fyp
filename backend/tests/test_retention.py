"""backend/retention.py: the end-of-study Form-C retention re-test.

Covers: the loader (parses docs/retention-item-banks.md the same way
scripts/validate_retention_bank.py already proves correct), the answer key never
crossing the wire, the anti-collusion per-student shuffle (both that it actually
differs per student AND that grading correctly un-shuffles it), and the HTTP gates
(session / consent / end-of-study window / topic-must-be-complete / one-submission).

Entirely isolated DBs and a monkeypatched `schedule.end_of_study_open`, so this never
touches the real sink or depends on today's date being inside the real 2026-11-23..26
window (it is not, while this is being built).
"""
import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)

d = os.path.join(BE, "tests", "_tmp_retentiontest")
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24012345D,A\n24067890X,B\n24099999D,A\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d, "a.db"), "RESEARCH_DB_PATH": os.path.join(d, "r.db"),
    "ENROLMENT_PATH": os.path.join(d, "enrolled.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(d, ".secret"),
    "TOPIC_SCHEDULE_PATH": os.path.join(BE, "topic_schedule.json"),
    "COOKIE_SECURE": "0", "TELEMETRY_ENABLED": "0",
})
for f in ("a.db", "r.db", ".secret"):
    p = os.path.join(d, f)
    if os.path.exists(p):
        os.remove(p)

import auth_store, checks, research_store, schedule
import retention as R

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")


# ── the loader: never touches checks.py's OWN banks/parsing state ──────────────

print("\n-- the Form-C loader (docs/retention-item-banks.md), standalone from checks.py --")
bank = R._load()
check("every scheduled topic has a Form C bank",
      set(t["id"] for t in schedule._load()["topics"]) <= set(bank),
      sorted(set(t["id"] for t in schedule._load()["topics"]) - set(bank)))
check("6 items for a normal topic", len(bank["memory"]) == 6, len(bank["memory"]))
check("8 items for experiment-design (2 bonus items, Wilson 2026-09-22)",
      len(bank["experiment-design"]) == 8, len(bank["experiment-design"]))
check("gestalt uses its shared 5-option list (chance 20%, like Forms A/B)",
      len(bank["gestalt"][0]["options"]) == 5, bank["gestalt"][0])
check("checks.py's OWN Form A/B loader is untouched by importing retention.py",
      checks.has_bank("memory") and "A" in checks._load()["memory"])

print("\n-- the answer key NEVER crosses the wire --")
served = R.items_for_student("24012345D", "memory")
check("served items exist", served is not None and len(served) == 6, served)
blob = json.dumps(served)
check("no `correct` key anywhere in the served payload", '"correct"' not in blob, blob[:200])
correct_letters = {it["correct"] for it in bank["memory"]}
# The correct TEXT must not be identifiable by a leaked field name; the raw option
# text itself is expected to appear (it's the class of a legitimate distractor too).
check("items_for_student for an unbanked/unknown topic returns None",
      R.items_for_student("24012345D", "not-a-real-topic") is None)


# ── anti-collusion: differs per student, and un-shuffles correctly ─────────────

print("\n-- anti-collusion: two students get a DIFFERENT shuffle for the SAME item --")
topic = "webers-law"
canonical = R._load()[topic][0]
servedA, mapA = R._shuffled_options("24012345D", topic, canonical)
servedB, mapB = R._shuffled_options("24067890X", topic, canonical)
check("the OPTION order (and so the letter->content mapping) differs between students",
      [o["text"] for o in servedA] != [o["text"] for o in servedB],
      {"A": servedA, "B": servedB})

orderA = [it["id"] for it in R._shuffled_items("24012345D", topic)]
orderB = [it["id"] for it in R._shuffled_items("24067890X", topic)]
check("the QUESTION order differs between students",
      orderA != orderB, {"A": orderA, "B": orderB})
check("...but both orders are a permutation of the SAME item set",
      sorted(orderA) == sorted(orderB) == [it["id"] for it in bank[topic]])

print("\n-- and each student's answer STILL grades correctly after un-shuffling --")
displayed_correct_A = next(d for d, c in mapA.items() if c == canonical["correct"])
displayed_correct_B = next(d for d, c in mapB.items() if c == canonical["correct"])
check("A's and B's DISPLAYED correct letter differ (the whole anti-collusion point)",
      displayed_correct_A != displayed_correct_B
      or [o["text"] for o in servedA] != [o["text"] for o in servedB],
      (displayed_correct_A, displayed_correct_B))

resA = R.grade("24012345D", topic, {canonical["id"]: displayed_correct_A})
resB = R.grade("24067890X", topic, {canonical["id"]: displayed_correct_B})
check("A answering A's own displayed-correct letter is marked correct",
      next(i for i in resA["items"] if i["id"] == canonical["id"])["was_correct"] is True,
      resA)
check("B answering B's own displayed-correct letter is marked correct",
      next(i for i in resB["items"] if i["id"] == canonical["id"])["was_correct"] is True,
      resB)

print("\n-- collusion is defeated: sharing A's displayed letter does not help B --")
res_collusion = R.grade("24067890X", topic, {canonical["id"]: displayed_correct_A})
collusion_item = next(i for i in res_collusion["items"] if i["id"] == canonical["id"])
check("B using A's displayed 'correct' letter is graded against B's OWN shuffle, "
      "not A's -- wrong unless the two coincidentally share the same permutation",
      (collusion_item["was_correct"] is False) or (displayed_correct_A == displayed_correct_B),
      collusion_item)

print("\n-- grading is deterministic and re-derivable (nothing stored) --")
res_again = R.grade("24012345D", topic, {canonical["id"]: displayed_correct_A})
check("re-grading the identical answer twice gives the identical result",
      res_again["items"][0] == resA["items"][0], (res_again, resA))


# ── HTTP surface: gates in the right order, one-submission enforced ────────────

print("\n-- HTTP: unauthenticated is locked out --")
from fastapi import FastAPI
from fastapi.testclient import TestClient
from auth_api import router as auth_router
from topic_api import router as topic_router

auth_store.init_db(); research_store.init_db()
app = FastAPI()
app.include_router(auth_router)
app.include_router(topic_router)
app.include_router(R.router)
c = TestClient(app)

check("401 on GET /api/retention/{topic}", c.get("/api/retention/memory").status_code == 401)
check("401 on POST", c.post("/api/retention/memory", json={"answers": {}}).status_code == 401)
check("401 on _status", c.get("/api/retention/_status").status_code == 401)

student = TestClient(app)
student.post("/api/auth/signup", json={"sid": "24012345D", "password": "hunter2xyz"})

print("\n-- HTTP: consent gates everything, same as every other recorded path --")
check("403 no_consent before consent",
      student.get("/api/retention/memory").status_code == 403
      and student.get("/api/retention/memory").json()["error"] == "no_consent")
student.post("/api/auth/consent", json={"agreed": True})

print("\n-- HTTP: the end-of-study WINDOW gate (closed by default -- real dates are Nov 2026) --")
r = student.get("/api/retention/memory")
check("403 not_open while the real window (Nov 2026) has not arrived",
      r.status_code == 403 and r.json()["error"] == "not_open", r.json())
r = student.post("/api/retention/memory", json={"answers": {"C1": "a"}})
check("POST is window-gated too", r.status_code == 403 and r.json()["error"] == "not_open", r.json())

# Force the window open for the rest of this suite -- monkeypatch, not a real date,
# so this suite runs correctly regardless of what day it is actually run on.
_real_eos_open = schedule.end_of_study_open
schedule.end_of_study_open = lambda section, now=None: True

print("\n-- HTTP: a topic must be COMPLETE before its retention check --")
r = student.get("/api/retention/memory")
check("403 topic_not_complete before the topic is finished",
      r.status_code == 403 and r.json()["error"] == "topic_not_complete", r.json())

# Complete "memory" the same way the real app would leave the sink: a post-check row.
research_store.record_event({"participant_id": "24012345D", "event_type": "topic_posttest",
                             "topic_id": "memory", "score": 66.7})

print("\n-- HTTP: served, graded, recorded, and locked to one submission --")
r = student.get("/api/retention/memory")
check("200 once the topic is complete and the window is open", r.status_code == 200, r.json())
served_items = r.json()["items"]
check("6 items served, none carrying a `correct` field",
      len(served_items) == 6 and all("correct" not in it for it in served_items), served_items)
check("options are relettered a../d. sequentially",
      all([o["letter"] for o in it["options"]] == ["a", "b", "c", "d"] for it in served_items
          if len(it["options"]) == 4))

answers = {it["id"]: it["options"][0]["letter"] for it in served_items}
r = student.post("/api/retention/memory", json={"answers": answers, "duration_ms": 45000})
check("POST succeeds and reveals a score (end of study -- no contamination risk)",
      r.status_code == 200 and r.json().get("ok") is True and "score" in r.json(), r.json())
check("topic_retention landed in the sink, once",
      sum(1 for e in research_store.fetch_for_participant("24012345D")
          if e["event_type"] == "topic_retention" and e["topic_id"] == "memory") == 1)

r2 = student.get("/api/retention/memory")
check("a second GET is refused (409) -- one submission per topic",
      r2.status_code == 409 and r2.json()["error"] == "already_submitted", r2.json())
r3 = student.post("/api/retention/memory", json={"answers": answers})
check("a second POST is refused (409), does not overwrite the recorded answers",
      r3.status_code == 409 and r3.json()["error"] == "already_submitted", r3.json())
check("still exactly one topic_retention row for memory",
      sum(1 for e in research_store.fetch_for_participant("24012345D")
          if e["event_type"] == "topic_retention" and e["topic_id"] == "memory") == 1)

print("\n-- HTTP: an empty submission is refused, same as the live check endpoints --")
research_store.record_event({"participant_id": "24012345D", "event_type": "topic_posttest",
                             "topic_id": "problem-solving", "score": 50.0})
r = student.post("/api/retention/problem-solving", json={"answers": {}})
check("400 empty", r.status_code == 400 and r.json()["error"] == "empty", r.json())
check("nothing recorded for the empty submission",
      not any(e["event_type"] == "topic_retention" and e["topic_id"] == "problem-solving"
              for e in research_store.fetch_for_participant("24012345D")))


print("\n-- HTTP: the terminal end-of-study marker --")
check("_status reports not done yet",
      student.get("/api/retention/_status").json()["done"] is False)
r = student.post("/api/retention/_complete")
check("refused while a completed+banked topic (problem-solving) has no retention yet",
      r.status_code == 400 and r.json()["error"] == "incomplete"
      and "problem-solving" in r.json()["missing"], r.json())

# Finish problem-solving's retention too, then the marker succeeds.
r = student.get("/api/retention/problem-solving")
answers2 = {it["id"]: it["options"][0]["letter"] for it in r.json()["items"]}
student.post("/api/retention/problem-solving", json={"answers": answers2})
r = student.post("/api/retention/_complete")
check("_complete succeeds once every completed+banked topic has a retention row",
      r.status_code == 200 and r.json().get("ok") is True, r.json())
check("_status now reports done",
      student.get("/api/retention/_status").json()["done"] is True)
r2 = student.post("/api/retention/_complete")
check("_complete is one-submission (409 on a second call)",
      r2.status_code == 409 and r2.json()["error"] == "already_submitted", r2.json())
check("exactly one questionnaire_end_of_study row",
      sum(1 for e in research_store.fetch_all()
          if e["event_type"] == "questionnaire_end_of_study"
          and e["participant_id"] == "24012345D") == 1)

schedule.end_of_study_open = _real_eos_open
check("restoring the real end_of_study_open still refuses (real window is Nov 2026)",
      student.get("/api/retention/memory").status_code in (403, 409))


print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
