import os, sys, io, json, re, tempfile, shutil
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
os.environ.setdefault("TOPIC_SCHEDULE_PATH", os.path.join(BE, "topic_schedule.json"))

# Isolated DBs for the HTTP-level gate tests at the foot of this file. Set BEFORE any
# store import binds its module-level DB_PATH, so these tests never touch the real sink.
_d = os.path.join(BE, "tests", "_tmp_qtest")
os.makedirs(_d, exist_ok=True)
with open(os.path.join(_d, "enrolled.txt"), "w", encoding="utf-8") as _fh:
    _fh.write("24012345D,A\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(_d, "a.db"),
    "RESEARCH_DB_PATH": os.path.join(_d, "r.db"),
    "ENROLMENT_PATH": os.path.join(_d, "enrolled.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(_d, ".secret"),
    "COOKIE_SECURE": "0",
})
for _f in ("a.db", "r.db", ".secret"):
    _p = os.path.join(_d, _f)
    if os.path.exists(_p):
        os.remove(_p)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

import questionnaire_api as Q

print("\n-- off unless a deployment turns it on --")
# Collecting a new class of data about participants must not be something a merge can
# start. Same discipline as TELEMETRY_ENABLED.
check("disabled by default", Q.ENABLED is False)
check("and the flag is read from the environment, not hardcoded",
      "QUESTIONNAIRES_ENABLED" in io.open(os.path.join(BE, "questionnaire_api.py"),
                                          encoding="utf-8").read())

print("\n-- all four instruments are present --")
bank = Q._load()["instruments"]
for name, n in (("imi", 12), ("coi", 8), ("arcs", 8), ("paas", 1)):
    check(f"{name} has its {n} item(s)", len(bank.get(name, {}).get("items", [])) == n,
          len(bank.get(name, {}).get("items", [])))
check("paas is the 9-point scale, not the shared 1-5",
      len(bank["paas"]["scale"]) == 9 and len(bank["imi"]["scale"]) == 5)
check("every instrument cites its source",
      all(bank[k].get("cite") for k in bank), [k for k in bank if not bank[k].get("cite")])

print("\n-- the bank has NOT drifted from the validated pack --")
# Retyping validated items into a second file is how a questionnaire quietly stops
# being the instrument it cites. The pack is the source; this proves the copy matches.
PACK = os.path.join(BE, "..", "docs", "study-pack")
post = io.open(os.path.join(PACK, "04_post-questionnaire.md"), encoding="utf-8").read()
load = io.open(os.path.join(PACK, "05_reflection-and-load.md"), encoding="utf-8").read()
missing = []
for name in ("imi", "coi", "arcs"):
    for it in bank[name]["items"]:
        if it["text"] not in post:
            missing.append(f"{name}/{it['id']}")
check("every IMI/CoI/ARCS item appears verbatim in 04_post-questionnaire.md",
      not missing, missing[:4])
check("the Paas item appears verbatim in 05_reflection-and-load.md",
      bank["paas"]["items"][0]["text"] in load, bank["paas"]["items"][0]["text"])

print("\n-- the scoring key never reaches the client --")
# The pack is explicit that subscale membership and reverse items are researcher-only.
# A student who can see M9 is reverse-scored is being told which way looks good.
src = io.open(os.path.join(BE, "questionnaire_api.py"), encoding="utf-8").read()
served = src[src.index('@router.get("/{name}")'): src.index('@router.post("/{name}")')]
check("GET does not return `reverse`", '"reverse"' not in served, served[-400:])
check("GET does not return `subscales`", '"subscales"' not in served)
check("but the server still holds them for analysis",
      bank["imi"]["reverse"] == ["M11", "M9"] and "IE" in bank["imi"]["subscales"],
      bank["imi"]["reverse"])
check("reverse items match the codebook (M9, M11)",
      set(bank["imi"]["reverse"]) == {"M9", "M11"})

print("\n-- responses are stored RAW --")
# Storing a computed subscale mean would bake today's scoring decisions into data
# that outlives them; reversing happens at analysis time from the codebook.
post_src = src[src.index('@router.post("/{name}")'):]
# Strip comments first: the write path CONTAINS the word "reverse" only in a comment
# saying reversing happens at analysis time. Grepping raw source flagged the very
# explanation that proves the point.
code = " ".join(l for l in post_src.splitlines() if not l.strip().startswith("#"))
check("no score is computed on the write path",
      "reverse" not in code and "subscale" not in code.lower(), code[-300:])
check("raw answers are what gets recorded", '"answers": body.answers' in post_src)
check("one submission per participant per instrument", "already_submitted" in post_src)
check("out-of-range values are refused", "out_of_range" in post_src)
check("unknown item ids are refused", "unknown_items" in post_src)

print("\n-- regenerating is deterministic --")
gen = os.path.join(BE, "build_questionnaires.py")
check("a generator exists so the pack stays the source", os.path.exists(gen))
before = io.open(os.path.join(BE, "questionnaires.json"), encoding="utf-8").read()
import subprocess
r = subprocess.run([sys.executable, gen], capture_output=True, text=True, cwd=BE)
after = io.open(os.path.join(BE, "questionnaires.json"), encoding="utf-8").read()
check("re-running the generator changes nothing", before == after,
      (r.stdout or r.stderr)[-200:])

print("\n-- HTTP gates: consent, empty answers, topic validation (findings F1/S2/F2) --")
# Exercise the live endpoints, not just the source. Isolated DBs (set at the top of this
# file) so nothing here reaches the real sink. QUESTIONNAIRES_ENABLED is off by default;
# the handlers read the module global at call time, so flip it here for the run.
from fastapi import FastAPI
from fastapi.testclient import TestClient
import schedule
import auth_store
import research_store
from auth_api import router as auth_router

auth_store.init_db(); research_store.init_db()
Q.ENABLED = True
app = FastAPI(); app.include_router(auth_router); app.include_router(Q.router)
c = TestClient(app)

imi_ans = {it["id"]: 3 for it in bank["imi"]["items"]}       # imi scale is 1-5, so 3 is valid
paas_id = bank["paas"]["items"][0]["id"]

# A session, but NO consent yet.
c.post("/api/auth/signup", json={"sid": "24012345D", "password": "hunter2xyz"})

r = c.post("/api/questionnaire/imi", json={"answers": imi_ans})
check("submit refused before consent (403 no_consent)",
      r.status_code == 403 and r.json().get("error") == "no_consent", r.json())
check("nothing recorded pre-consent",
      not any(e["event_type"].startswith("questionnaire_") for e in research_store.fetch_all()))
check("even the item bank is gated before consent (403)",
      c.get("/api/questionnaire/imi").status_code == 403)

# Consent, then the gate opens.
c.post("/api/auth/consent", json={"agreed": True})
check("item bank served after consent (200)",
      c.get("/api/questionnaire/imi").status_code == 200)

r = c.post("/api/questionnaire/imi", json={"answers": {}})
check("empty answers refused (400 empty)",
      r.status_code == 400 and r.json().get("error") == "empty", r.json())

r = c.post("/api/questionnaire/paas",
           json={"answers": {paas_id: 5}, "topic_id": "totally-fake-topic-xyz"})
check("unknown topic_id refused (400 unknown_topic)",
      r.status_code == 400 and r.json().get("error") == "unknown_topic", r.json())

good_topic = sorted(schedule.session_grid_topics())[0]
r = c.post("/api/questionnaire/paas",
           json={"answers": {paas_id: 5}, "topic_id": good_topic})
check("a real topic_id is accepted (200)", r.status_code == 200, (r.status_code, r.json()))
r2 = c.post("/api/questionnaire/paas",
            json={"answers": {paas_id: 5}, "topic_id": good_topic})
check("second submission of the same instrument+topic is 409 already_submitted",
      r2.status_code == 409 and r2.json().get("error") == "already_submitted", r2.json())

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
