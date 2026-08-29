import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_res")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, "enrolled.txt"), "w", encoding="utf-8") as fh:
    fh.write("24000001A,A\n24000002B,B\n")
os.environ.update({
    "AUTH_DB_PATH": os.path.join(d,"a.db"), "RESEARCH_DB_PATH": os.path.join(d,"r.db"),
    "ENROLMENT_PATH": os.path.join(d,"enrolled.txt"),
    "PARTICIPANT_SECRET_PATH": os.path.join(d,".secret"),
    "COOKIE_SECURE": "0",
})
os.environ.pop("EXPORT_TOKEN", None)
for f in ("a.db","r.db",".secret"):
    p = os.path.join(d,f)
    if os.path.exists(p): os.remove(p)
sys.path.insert(0, BE)
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth_store, research_store, research_api
from auth_api import router as auth_router

auth_store.init_db(); research_store.init_db()
app = FastAPI(); app.include_router(auth_router); app.include_router(research_api.router)
c = TestClient(app)

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

print("\n-- FIX 1a: events require a session --")
r = c.post("/api/research/event", json={"event_type":"assessment_complete","topic_id":"gestalt"})
check("no session -> 401", r.status_code == 401, r.status_code)
check("nothing recorded", len(research_store.fetch_all()) == 0)

print("\n-- FIX 1b: client CANNOT spoof identity --")
c.post("/api/auth/signup", json={"sid":"24000001A","password":"hunter2xyz"})
r = c.post("/api/research/event", json={
    "participant_id": "24000002B",              # claiming to be someone else
    "event_type": "assessment_complete", "topic_id": "gestalt", "score": 90})
check("accepted", r.status_code == 200, r.json())
row = research_store.fetch_all()[-1]
check("stored under the SESSION's sid, not the claim", row["participant_id"] == "24000001A", row["participant_id"])
check("spoofed sid absent from sink", all(e["participant_id"] != "24000002B" for e in research_store.fetch_all()))

print("\n-- FIX 2: export fails CLOSED when EXPORT_TOKEN unset --")
check("export -> 503 when unconfigured", c.get("/api/research/export").status_code == 503)
check("503 not 200 (never open by default)", c.get("/api/research/export").status_code != 200)

print("\n-- export token enforcement --")
os.environ["EXPORT_TOKEN"] = "s3cret-token"
check("no token -> 401", c.get("/api/research/export").status_code == 401)
check("wrong token -> 401", c.get("/api/research/export", headers={"X-Export-Token":"nope"}).status_code == 401)
r = c.get("/api/research/export", headers={"X-Export-Token":"s3cret-token"})
check("right token -> 200", r.status_code == 200, r.status_code)

print("\n-- FIX 2b: export is pseudonymised --")
rows = r.json()
check("rows returned", len(rows) >= 1, len(rows))
blob = json.dumps(rows)
check("NO real SID anywhere in export", "24000001A" not in blob and "24000002B" not in blob)
check("participant_id is the HMAC", rows[0]["participant_id"] == auth_store.pseudonym("24000001A"), rows[0]["participant_id"])
check("pseudonym is 16 hex chars", len(rows[0]["participant_id"]) == 16)
check("no identified escape hatch", c.get("/api/research/export?identified=1",
      headers={"X-Export-Token":"s3cret-token"}).json()[0]["participant_id"] != "24000001A")

print("\n-- csv path pseudonymised too --")
csv = c.get("/api/research/export?format=csv", headers={"X-Export-Token":"s3cret-token"}).text
check("no real SID in csv", "24000001A" not in csv)
check("csv has the pseudonym", auth_store.pseudonym("24000001A") in csv)
check("csv has a header row", csv.split("\n")[0].startswith("id,participant_id"))

print("\n-- pseudonym is stable across exports (pre/post joins survive) --")
again = c.get("/api/research/export", headers={"X-Export-Token":"s3cret-token"}).json()
check("same pseudonym second time", again[0]["participant_id"] == rows[0]["participant_id"])

print("\n-- summary leaks nothing --")
s = c.get("/api/research/summary")
check("summary 200", s.status_code == 200)
check("summary has no identifiers", "24000001A" not in json.dumps(s.json()), s.json())

print("\n-- consent withdrawal can actually be honoured --")
# The information sheet promises a participant may have their responses discarded,
# and /api/auth/withdraw replies "Ask the researcher to erase your recorded data".
# Until forget_participant existed there were ZERO delete statements in
# research_store, so that promise had no implementation behind it at all.
research_store.record_event({"participant_id": "24000002B", "event_type": "topic_pretest",
                             "topic_id": "gestalt", "score": 3})
research_store.record_event({"participant_id": "24000002B", "event_type": "topic_posttest",
                             "topic_id": "gestalt", "score": 5})
before_target = research_store.count_for("24000002B")
before_other = research_store.count_for("24000001A")
check("the participant has rows to erase", before_target >= 2, before_target)

removed = research_store.forget_participant("24000002b")   # lower case on purpose
check("forget removes their rows", removed == before_target,
      {"removed": removed, "had": before_target})
check("and they are gone", research_store.count_for("24000002B") == 0)
check("while everyone else is untouched",
      research_store.count_for("24000001A") == before_other, before_other)
check("forgetting twice is harmless", research_store.forget_participant("24000002B") == 0)

try:
    research_store.forget_participant("   ")
    check("an empty id is refused", False, "no exception raised")
except ValueError:
    check("an empty id is refused", True)

# The tombstone must outlive the erasure, or a withdrawn SID could sign up again
# and reappear in the data. Note withdraw() tombstones the users row, so the
# account has to exist first -- on an unknown SID it reports False and does
# nothing, which is correct but easy to write a vacuous test against.
check("withdrawing an account that does not exist reports so",
      auth_store.withdraw("24000009Z") is False)
auth_store.create_account("24000002B", "hunter2xyz")
check("withdraw tombstones a real account", auth_store.withdraw("24000002B") is True)
research_store.forget_participant("24000002B")
check("the withdrawn SID still cannot start a session",
      auth_store.start_session("24000002B", "hunter2xyz") is None)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
