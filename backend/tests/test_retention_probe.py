"""backend/retention_probe.py: the end-of-study APPLICATION short-answer probe.

Covers: the loader (parses docs/retention-application-bank.md), the model answer /
rubric NEVER crossing the wire (only the prompt is served), and the HTTP gates
(session / consent / end-of-study window / topic-must-be-complete / one-submission),
plus that a submission records a `topic_retention_probe` row with the answer + stamped
prompt and returns NO grade (grading is offline/blind, like topic_probe).

Entirely isolated DBs and a monkeypatched `schedule.end_of_study_open`, mirroring
test_retention.py, so it never touches the real sink or depends on today being inside
the real 2026-11-23..26 window (it is not, while this is being built).
"""
import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)

d = os.path.join(BE, "tests", "_tmp_retentionprobetest")
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24012345D,A\n24067890X,B\n")
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
import retention_probe as RP

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")


# ── the loader ─────────────────────────────────────────────────────────────────

print("\n-- the application-bank loader (docs/retention-application-bank.md) --")
bank = RP._load()
scheduled = {t["id"] for t in schedule._load()["topics"]}
check("every scheduled topic has an application prompt",
      scheduled <= set(bank), sorted(scheduled - set(bank)))
check("a topic carries prompt + model_answer + rubric",
      all(k in bank["memory"] for k in ("prompt", "model_answer", "rubric")), bank.get("memory"))
check("the prompt is non-empty prose", len(bank["memory"]["prompt"]) > 40, bank["memory"]["prompt"])
check("the 'Wiring notes' section is NOT parsed as a topic (no `(`topic-id`)` header)",
      "wiring-notes" not in bank and "wiring" not in bank, sorted(bank))
check("has_bank True for a real topic, False otherwise",
      RP.has_bank("memory") and not RP.has_bank("not-a-real-topic"))
check("importing retention_probe leaves checks.py's Form A/B loader untouched",
      checks.has_bank("memory") and "A" in checks._load()["memory"])


# ── the model answer / rubric NEVER cross the wire ───────────────────────────────

print("\n-- only the prompt is served; the model answer / rubric stay server-side --")
prompt = RP.prompt_for("memory")
check("prompt_for returns the prompt", isinstance(prompt, str) and len(prompt) > 40, prompt)
check("prompt_for is None for an unknown topic", RP.prompt_for("not-a-real-topic") is None)
# A distinctive phrase from memory's MODEL ANSWER must never appear in what is served.
model_phrase = "4 chunks of 4"
check("the model answer holds the distinctive phrase (guards the negative test below)",
      model_phrase in bank["memory"]["model_answer"], bank["memory"]["model_answer"])
check("that phrase is NOT in the served prompt", model_phrase not in prompt, prompt)


# ── HTTP surface: gates in the right order, one-submission enforced ──────────────

print("\n-- HTTP: unauthenticated is locked out --")
from fastapi import FastAPI
from fastapi.testclient import TestClient
from auth_api import router as auth_router

auth_store.init_db(); research_store.init_db()
app = FastAPI()
app.include_router(auth_router)
app.include_router(RP.router)
c = TestClient(app)

check("401 on GET /api/retention/probe/{topic}",
      c.get("/api/retention/probe/memory").status_code == 401)
check("401 on POST",
      c.post("/api/retention/probe/memory", json={"answer": "x"}).status_code == 401)

student = TestClient(app)
student.post("/api/auth/signup", json={"sid": "24012345D", "password": "hunter2xyz"})

print("\n-- HTTP: consent gates everything --")
check("403 no_consent before consent",
      student.get("/api/retention/probe/memory").status_code == 403
      and student.get("/api/retention/probe/memory").json()["error"] == "no_consent")
student.post("/api/auth/consent", json={"agreed": True})

print("\n-- HTTP: the end-of-study WINDOW gate (closed by default -- real dates are Nov 2026) --")
r = student.get("/api/retention/probe/memory")
check("403 not_open while the real window has not arrived",
      r.status_code == 403 and r.json()["error"] == "not_open", r.json())
r = student.post("/api/retention/probe/memory", json={"answer": "some answer"})
check("POST is window-gated too", r.status_code == 403 and r.json()["error"] == "not_open", r.json())

# Force the window open for the rest of the suite -- monkeypatch, not a real date.
_real_eos_open = schedule.end_of_study_open
schedule.end_of_study_open = lambda section, now=None: True

print("\n-- HTTP: a topic must be COMPLETE before its application probe --")
r = student.get("/api/retention/probe/memory")
check("403 topic_not_complete before the topic is finished",
      r.status_code == 403 and r.json()["error"] == "topic_not_complete", r.json())

# Complete "memory": a post-check row under the CANONICAL sid (check-letter stripped),
# the key the session resolves to -- same as test_retention.py.
research_store.record_event({"participant_id": "24012345", "event_type": "topic_posttest",
                             "topic_id": "memory", "score": 66.7})

print("\n-- HTTP: served (prompt only), recorded, and locked to one submission --")
r = student.get("/api/retention/probe/memory")
check("200 once the topic is complete and the window is open", r.status_code == 200, r.json())
body = r.json()
check("the prompt is served", isinstance(body.get("prompt"), str) and len(body["prompt"]) > 40, body)
blob = json.dumps(body)
check("the served payload carries NO model answer / rubric field",
      "model_answer" not in blob and "rubric" not in blob, blob[:200])
check("and NOT the model-answer's distinctive phrase either", model_phrase not in blob, blob[:200])

r = student.post("/api/retention/probe/memory",
                 json={"answer": "Chunk the 16 digits into groups and the menu into ~5 sections.",
                       "duration_ms": 45000})
check("POST succeeds and returns NO grade (offline/blind, unlike Form C's MC)",
      r.status_code == 200 and r.json().get("ok") is True and "score" not in r.json(), r.json())

rows = [e for e in research_store.fetch_for_participant("24012345")
        if e["event_type"] == "topic_retention_probe" and e["topic_id"] == "memory"]
check("exactly one topic_retention_probe row landed", len(rows) == 1, len(rows))
if rows:
    meta = rows[0].get("meta") or {}
    if isinstance(meta, str):
        meta = json.loads(meta)
    check("the row stored the answer and the stamped prompt",
          "digits" in (meta.get("answer") or "") and len(meta.get("prompt") or "") > 40, meta)

r2 = student.get("/api/retention/probe/memory")
check("a second GET is refused (409) -- one submission per topic",
      r2.status_code == 409 and r2.json()["error"] == "already_submitted", r2.json())
r3 = student.post("/api/retention/probe/memory", json={"answer": "again"})
check("a second POST is refused (409), does not overwrite",
      r3.status_code == 409 and r3.json()["error"] == "already_submitted", r3.json())
check("still exactly one topic_retention_probe row for memory",
      sum(1 for e in research_store.fetch_for_participant("24012345")
          if e["event_type"] == "topic_retention_probe" and e["topic_id"] == "memory") == 1)

print("\n-- HTTP: an empty answer is refused, nothing recorded --")
research_store.record_event({"participant_id": "24012345", "event_type": "topic_posttest",
                             "topic_id": "problem-solving", "score": 50.0})
r = student.post("/api/retention/probe/problem-solving", json={"answer": "   "})
check("400 empty", r.status_code == 400 and r.json()["error"] == "empty", r.json())
check("nothing recorded for the empty submission",
      not any(e["event_type"] == "topic_retention_probe" and e["topic_id"] == "problem-solving"
              for e in research_store.fetch_for_participant("24012345")))

schedule.end_of_study_open = _real_eos_open
check("restoring the real end_of_study_open refuses again (real window is Nov 2026)",
      student.get("/api/retention/probe/memory").status_code in (403, 409))


print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
