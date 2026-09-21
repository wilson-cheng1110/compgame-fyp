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
    # Second row is for the never-consented SID used by the `_status` consent-gate
    # check at the foot of this file. Third/fourth are fresh SIDs for the AGE
    # bounds-validation tests, kept separate from the main SID so a REFUSED
    # (400) demographics POST there can't be confused with one that already
    # holds a successful (one-time) demographics row.
    _fh.write("24012345D,A\n24099999D,A\n24055555D,A\n24066666D,A\n")
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

print("\n-- all seven instruments are present --")
bank = Q._load()["instruments"]
for name, n in (("imi", 12), ("coi", 8), ("arcs", 8), ("paas", 1), ("affect_recall", 3),
                ("demographics", 4), ("feedback", 4)):
    check(f"{name} has its {n} item(s)", len(bank.get(name, {}).get("items", [])) == n,
          len(bank.get(name, {}).get("items", [])))
check("paas is the 9-point scale, not the shared 1-5",
      len(bank["paas"]["scale"]) == 9 and len(bank["imi"]["scale"]) == 5)
check("every instrument cites its source",
      all(bank[k].get("cite") for k in bank), [k for k in bank if not bank[k].get("cite")])

print("\n-- item types (likert default, single, text) --")
demo_by_id = {it["id"]: it for it in bank["demographics"]["items"]}
check("AGE is free-typed `text`, not a bucketed `single`",
      demo_by_id["AGE"].get("type") == "text", demo_by_id["AGE"])
check("AGE carries the 15-100 bounded-integer contract (min/max on the item)",
      demo_by_id["AGE"].get("min") == 15 and demo_by_id["AGE"].get("max") == 100,
      demo_by_id["AGE"])
check("GENDER/GAMING/AITOOL are `single` and each carries its OWN options",
      all(demo_by_id[k].get("type") == "single" and len(demo_by_id[k].get("options", [])) > 1
          for k in ("GENDER", "GAMING", "AITOOL")),
      {k: demo_by_id[k] for k in ("GENDER", "GAMING", "AITOOL")})
check("every imi/coi/arcs/paas item is plain `likert` (no explicit type)",
      all(it.get("type") is None for name in ("imi", "coi", "arcs", "paas")
          for it in bank[name]["items"]))
check("every feedback item is `text`",
      all(it.get("type") == "text" for it in bank["feedback"]["items"]),
      bank["feedback"]["items"])
check("demographics/feedback carry no shared scale (per-item shapes instead)",
      bank["demographics"]["scale"] == [] and bank["feedback"]["scale"] == [])

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
check("every affect_recall item appears verbatim in 05_reflection-and-load.md",
      all(it["text"] in load for it in bank["affect_recall"]["items"]),
      [it["id"] for it in bank["affect_recall"]["items"] if it["text"] not in load])

demo_pack = io.open(os.path.join(PACK, "02_demographics.md"), encoding="utf-8").read()
fb_pack = io.open(os.path.join(PACK, "09_app-feedback.md"), encoding="utf-8").read()
demo_missing = [it["id"] for it in bank["demographics"]["items"] if it["text"] not in demo_pack]
check("every demographics item's text appears verbatim in 02_demographics.md",
      not demo_missing, demo_missing)
demo_opt_missing = [
    it["id"] for it in bank["demographics"]["items"] if it.get("type") == "single"
    and "; ".join(it["options"]) not in demo_pack
]
check("every demographics `single` item's options appear verbatim (as one \"; \"-joined "
      "cell) in 02_demographics.md",
      not demo_opt_missing, demo_opt_missing)
fb_missing = [it["id"] for it in bank["feedback"]["items"] if it["text"] not in fb_pack]
check("every feedback item's text appears verbatim in 09_app-feedback.md", not fb_missing, fb_missing)

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
check("raw answers are what gets recorded (bar AGE-style trim/normalisation)",
      '"answers": normalized_answers' in post_src)
check("one submission per participant per instrument", "already_submitted" in post_src)
check("out-of-range values are refused", "out_of_range" in post_src)
check("unknown item ids are refused", "unknown_items" in post_src)
check("an invalid text answer is refused separately from a numeric one",
      "invalid_text" in post_src)
check("a bounded text answer (AGE) that isn't a whole number is refused",
      "invalid_age" in post_src)

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

print("\n-- GET /api/questionnaire/demographics forwards type/options, strips the rest --")
r = c.get("/api/questionnaire/demographics")
check("200 once consented", r.status_code == 200, r.json())
served_items = {it["id"]: it for it in r.json()["items"]}
check("AGE is served as `text` with no options key",
      served_items["AGE"].get("type") == "text" and "options" not in served_items["AGE"],
      served_items["AGE"])
check("AGE's min/max bounds are forwarded so the client can mirror the check",
      served_items["AGE"].get("min") == 15 and served_items["AGE"].get("max") == 100,
      served_items["AGE"])
check("GENDER is served as `single` with its options list",
      served_items["GENDER"].get("type") == "single"
      and served_items["GENDER"].get("options") == demo_by_id["GENDER"]["options"],
      served_items["GENDER"])

print("\n-- demographics: categorical (`single`) + free-text (`text`) validation --")
r = c.post("/api/questionnaire/demographics", json={"answers": {"GENDER": 99}})
check("an out-of-range `single` answer is refused (400 out_of_range)",
      r.status_code == 400 and r.json().get("error") == "out_of_range", r.json())
r = c.post("/api/questionnaire/demographics", json={"answers": {"AGE": 21}})
check("a non-string `text` answer is refused (400 invalid_text)",
      r.status_code == 400 and r.json().get("error") == "invalid_text", r.json())
r = c.post("/api/questionnaire/demographics", json={"answers": {"AGE": "x" * 2001}})
check("a `text` answer over TEXT_MAX_LEN is refused (400 invalid_text)",
      r.status_code == 400 and r.json().get("error") == "invalid_text", r.json())
r = c.post("/api/questionnaire/demographics",
           json={"answers": {"AGE": "21", "GENDER": 1, "GAMING": 3, "AITOOL": 1}})
check("a valid mixed-type submission is accepted (200)", r.status_code == 200,
      (r.status_code, r.json()))
r2 = c.post("/api/questionnaire/demographics", json={"answers": {"GENDER": 1}})
check("one submission per participant, same as every other instrument (409)",
      r2.status_code == 409 and r2.json().get("error") == "already_submitted", r2.json())

print("\n-- AGE bounds: optional, but a non-empty value must be a whole number 15-100 --")
# Fresh participants throughout, kept separate from `c` above (finding: a REFUSED
# (400) POST here must never be confused with `c`'s already-spent one-time slot).
c3 = TestClient(app)
c3.post("/api/auth/signup", json={"sid": "24055555D", "password": "hunter2xyz"})
c3.post("/api/auth/consent", json={"agreed": True})

r = c3.post("/api/questionnaire/demographics", json={"answers": {"AGE": "twenty"}})
check("a non-numeric string is refused (400 invalid_age, not invalid_text)",
      r.status_code == 400 and r.json().get("error") == "invalid_age", r.json())
r = c3.post("/api/questionnaire/demographics", json={"answers": {"AGE": "10"}})
check("below the 15 floor is refused (400 invalid_age)",
      r.status_code == 400 and r.json().get("error") == "invalid_age"
      and r.json().get("min") == 15 and r.json().get("max") == 100, r.json())
r = c3.post("/api/questionnaire/demographics", json={"answers": {"AGE": "150"}})
check("above the 100 ceiling is refused (400 invalid_age)",
      r.status_code == 400 and r.json().get("error") == "invalid_age", r.json())
check("none of the refused AGE attempts spent the one-time slot",
      not any(e["event_type"] == "questionnaire_demographics"
              for e in research_store.fetch_for_participant("24055555D")))

r = c3.post("/api/questionnaire/demographics",
            json={"answers": {"AGE": " 22 ", "GENDER": 1, "GAMING": 1, "AITOOL": 1}})
check("a valid in-range age (22, with incidental whitespace) is accepted (200)",
      r.status_code == 200, (r.status_code, r.json()))
stored = [e for e in research_store.fetch_for_participant("24055555D")
          if e["event_type"] == "questionnaire_demographics"][0]
check("the stored value is trimmed/normalised, not the raw \" 22 \"",
      json.loads(stored["meta"])["answers"]["AGE"] == "22",
      json.loads(stored["meta"])["answers"])

# A second fresh participant: AGE explicitly submitted as an EMPTY string, proving
# "optional" holds even when the key is present, not just when it's omitted.
c4 = TestClient(app)
c4.post("/api/auth/signup", json={"sid": "24066666D", "password": "hunter2xyz"})
c4.post("/api/auth/consent", json={"agreed": True})
r = c4.post("/api/questionnaire/demographics",
            json={"answers": {"AGE": "", "GENDER": 1, "GAMING": 1, "AITOOL": 1}})
check("an explicit empty-string AGE is allowed (200) -- optional means optional",
      r.status_code == 200, (r.status_code, r.json()))

print("\n-- feedback: all-text, no shared scale, still one-submission --")
fb_answers = {"FB_AI": "It helped.", "FB_OVERALL": "Good overall."}   # partial is fine
r = c.post("/api/questionnaire/feedback", json={"answers": fb_answers})
check("a partial free-text submission is accepted (200) -- open text is optional per item",
      r.status_code == 200, (r.status_code, r.json()))
r2 = c.post("/api/questionnaire/feedback", json={"answers": {"FB_EXTRA": "one more thing"}})
check("second submission of feedback is 409 already_submitted",
      r2.status_code == 409 and r2.json().get("error") == "already_submitted", r2.json())

print("\n-- GET /api/questionnaire/_status --")
r = c.get("/api/questionnaire/_status")
check("200 once consented", r.status_code == 200, r.json())
check("reports demographics AND feedback as submitted",
      set(r.json().get("submitted", [])) >= {"demographics", "feedback"}, r.json())
check("does not report imi as submitted (never posted in this run)",
      "imi" not in r.json().get("submitted", []), r.json())
Q.ENABLED = False
r = c.get("/api/questionnaire/_status")
check("_status is 404 when questionnaires are disabled, same as every other route",
      r.status_code == 404, (r.status_code, r.json()))
Q.ENABLED = True

# A second, never-consented SID: _status must gate on consent like everything else.
c2 = TestClient(app)
c2.post("/api/auth/signup", json={"sid": "24099999D", "password": "hunter2xyz"})
r = c2.get("/api/questionnaire/_status")
check("_status refused before consent (403 no_consent), same as the item bank",
      r.status_code == 403 and r.json().get("error") == "no_consent", r.json())

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
