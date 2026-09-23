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

# CONSENT is now required before any event records (the ethics precondition, which
# this endpoint did not enforce before the 2026-08-30 sweep). Assert the refusal,
# then record consent so the spoof-identity test below can proceed.
r0 = c.post("/api/research/event", json={"event_type":"assessment_complete","topic_id":"gestalt"})
check("a signed-in but UN-consented event -> 403 no_consent", r0.status_code == 403, r0.json())
check("and nothing was recorded", len(research_store.fetch_all()) == 0)
c.post("/api/auth/consent", json={"agreed": True})

# An unknown topic_id is rejected, not silently stored (it would inflate the denominator).
ru = c.post("/api/research/event", json={"event_type":"understanding_complete","topic_id":"not-a-real-topic"})
check("unknown topic_id -> 400", ru.status_code == 400, ru.json())

r = c.post("/api/research/event", json={
    "participant_id": "24000002B",              # claiming to be someone else
    "event_type": "assessment_complete", "topic_id": "gestalt", "score": 90})
check("accepted", r.status_code == 200, r.json())
row = research_store.fetch_all()[-1]
# "24000001" not "24000001A": _canon_sid strips the check-letter at signup, so the
# SESSION's real sid -- what this must be stored under -- is the canonical form.
check("stored under the SESSION's sid, not the claim", row["participant_id"] == "24000001", row["participant_id"])
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
# Check BOTH the typed-with-letter form and the canonical (actually-stored) form --
# "24000001A" was never stored (never in blob trivially), "24000001" IS the real sid
# and is the substantive check that pseudonymisation actually held.
check("NO real SID anywhere in export",
      "24000001A" not in blob and "24000001" not in blob and "24000002B" not in blob)
# pseudonym() canonicalises internally, so the letter-suffixed and canonical forms of
# the same SID hash identically -- this is exactly the invariant _canon_sid exists for.
check("participant_id is the HMAC", rows[0]["participant_id"] == auth_store.pseudonym("24000001A")
      == auth_store.pseudonym("24000001"), rows[0]["participant_id"])
check("pseudonym is 16 hex chars", len(rows[0]["participant_id"]) == 16)
check("no identified escape hatch", c.get("/api/research/export?identified=1",
      headers={"X-Export-Token":"s3cret-token"}).json()[0]["participant_id"] != "24000001")

print("\n-- csv path pseudonymised too --")
csv = c.get("/api/research/export?format=csv", headers={"X-Export-Token":"s3cret-token"}).text
check("no real SID in csv", "24000001A" not in csv and "24000001" not in csv)
check("csv has the pseudonym", auth_store.pseudonym("24000001A") in csv)
check("csv has a header row", csv.split("\n")[0].startswith("id,participant_id"))

print("\n-- pseudonym is stable across exports (pre/post joins survive) --")
again = c.get("/api/research/export", headers={"X-Export-Token":"s3cret-token"}).json()
check("same pseudonym second time", again[0]["participant_id"] == rows[0]["participant_id"])

print("\n-- summary leaks nothing --")
s = c.get("/api/research/summary")
check("summary 200", s.status_code == 200)
check("summary has no identifiers",
      "24000001A" not in json.dumps(s.json()) and "24000001" not in json.dumps(s.json()), s.json())

print("\n-- paper 07: free-chat ask_turn is telemetry-gated (drop off / record on) --")
# The floating tutor widget logs one ask_turn per free-chat question (usage + latency, NO
# text). It is BEHAVIOURAL, so it obeys TELEMETRY_ENABLED exactly like the telemetry /
# game_result fields: dropped (200, id 0, nothing stored) when off, recorded when on.
_before = len(research_store.fetch_all())
research_api.TELEMETRY_ENABLED = False
r_off = c.post("/api/research/event", json={"event_type": "ask_turn", "topic_id": "memory",
               "duration_ms": 850, "meta": {"chars": 42, "sources": 3}})
check("ask_turn while telemetry OFF -> 200 (fire-and-forget, not a 4xx)",
      r_off.status_code == 200, r_off.status_code)
check("...and it is DROPPED (id 0), nothing added to the sink",
      r_off.json().get("id") == 0 and len(research_store.fetch_all()) == _before, r_off.json())

research_api.TELEMETRY_ENABLED = True
try:
    r_on = c.post("/api/research/event", json={"event_type": "ask_turn", "topic_id": "memory",
                  "duration_ms": 850, "meta": {"chars": 42, "sources": 3}})
    check("ask_turn while telemetry ON -> 200 and recorded",
          r_on.status_code == 200 and bool(r_on.json().get("id")), r_on.json())
    _row = research_store.fetch_all()[-1]
    check("the row is an ask_turn, attributed to the SESSION sid",
          _row["event_type"] == "ask_turn" and _row["participant_id"] == "24000001", _row["participant_id"])
    _meta = json.loads(_row["meta"] or "{}")
    check("meta carries usage metadata (chars/sources), NOT the question text",
          _meta.get("chars") == 42 and "question" not in _meta and "text" not in _meta, _meta)
finally:
    research_api.TELEMETRY_ENABLED = False

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
# "24000001" not "24000001A": research_store.count_for does its own plain
# strip+upper (not _canon_sid), so it must be asked about the SAME key the
# session's events are actually stored under -- the canonical form -- or this
# "untouched" baseline would silently be counting a key that holds nothing.
before_other = research_store.count_for("24000001")
check("the participant has rows to erase", before_target >= 2, before_target)
check("the OTHER participant genuinely has rows (this check would be vacuous "
      "otherwise)", before_other >= 1, before_other)

removed = research_store.forget_participant("24000002b")   # lower case on purpose
check("forget removes their rows", removed == before_target,
      {"removed": removed, "had": before_target})
check("and they are gone", research_store.count_for("24000002B") == 0)
check("while everyone else is untouched",
      research_store.count_for("24000001") == before_other, before_other)
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

print("\n-- C1: record_event_status signals created-vs-dup for once-only events --")
# The store-level backstop the submit_check/submit_probe 409 depends on. A once-only
# event that loses the race must report created=False and return the WINNER's row id,
# never a second row — that is what lets the endpoint refuse to reveal a graded result
# it never persisted.
rid1, cr1 = research_store.record_event_status(
    {"participant_id": "24C1TEST", "event_type": "topic_pretest", "topic_id": "memory", "score": 50})
rid2, cr2 = research_store.record_event_status(
    {"participant_id": "24C1TEST", "event_type": "topic_pretest", "topic_id": "memory", "score": 90})
check("first once-only write reports created=True", cr1 is True, (rid1, cr1))
check("duplicate once-only write reports created=False", cr2 is False, (rid2, cr2))
check("duplicate returns the winner's row id, not a new row", rid2 == rid1, (rid1, rid2))
_rows = [e for e in research_store.fetch_all()
         if e["participant_id"] == "24C1TEST" and e["event_type"] == "topic_pretest"]
check("only one row exists for the (sid, once-only event)", len(_rows) == 1, len(_rows))
check("the persisted row is the WINNER's (first score), not the loser's",
      _rows and _rows[0]["score"] == 50.0, _rows and _rows[0]["score"])
# A repeatable event (understanding_complete) is NOT under the index, so it always
# creates — the created flag must not falsely say dup there.
_, cr3 = research_store.record_event_status(
    {"participant_id": "24C1TEST", "event_type": "understanding_complete", "topic_id": "memory"})
_, cr4 = research_store.record_event_status(
    {"participant_id": "24C1TEST", "event_type": "understanding_complete", "topic_id": "memory"})
check("a repeatable event always reports created=True", cr3 is True and cr4 is True, (cr3, cr4))

print("\n-- EXCLUDED SIDS: test-traffic deny-list drops from the pseudonymised export --")
# Seed real events for synthetic test streams, recorded under BOTH the numeric and the
# check-letter form of one SID (one canonical person) plus a second SID recorded under its
# numeric form -- exclusion is by CANONICAL key, so naming either form on the list drops
# every stream that canonicalises to it. EXPORT_TOKEN is already set above, so the token
# export path is exercised too (it shares pseudonymised_rows with /api/researcher/export).
research_store.record_event({"participant_id": "71000001", "event_type": "topic_pretest",
                             "topic_id": "memory", "score": 1})
research_store.record_event({"participant_id": "71000001D", "event_type": "topic_posttest",
                             "topic_id": "memory", "score": 2})   # check-letter twin
research_store.record_event({"participant_id": "81000002", "event_type": "topic_pretest",
                             "topic_id": "memory", "score": 3})   # excluded via a letter list entry
_pseudo_71 = auth_store.pseudonym("71000001")     # == pseudonym("71000001D") (canonicalised)
_pseudo_81 = auth_store.pseudonym("81000002")
_pseudo_real = auth_store.pseudonym("24000001")   # the genuine session participant

_saved_excl_env = os.environ.pop("EXCLUDED_SIDS_PATH", None)
_saved_excl_cache = (auth_store._excluded, auth_store._excluded_key)
try:
    # DEFAULT / no file: point at a non-existent path -> empty set -> nothing dropped.
    os.environ["EXCLUDED_SIDS_PATH"] = os.path.join(d, "no_such_excluded.txt")
    auth_store._excluded, auth_store._excluded_key = set(), None
    check("no exclusion file -> excluded set empty (default no-op)",
          auth_store.excluded_sids() == set(), auth_store.excluded_sids())
    _blob_default = json.dumps(research_api.pseudonymised_rows())
    check("default: both test streams are present in the export (as pseudonyms)",
          _pseudo_71 in _blob_default and _pseudo_81 in _blob_default, "streams missing pre-exclusion")

    # Populate the list: numeric 71000001 (drops its 71000001D twin too) and the
    # check-letter 81000002D (drops the numeric-form 81000002 row).
    _excl_path = os.path.join(d, "excluded.txt")
    with open(_excl_path, "w", encoding="utf-8") as fh:
        fh.write("# synthetic test-traffic exclusion\n71000001\n81000002D  # check-letter form\n")
    os.environ["EXCLUDED_SIDS_PATH"] = _excl_path
    auth_store._excluded, auth_store._excluded_key = set(), None   # invalidate for the new path
    check("both forms canonicalise onto the excluded set",
          auth_store.excluded_sids() == {"71000001", "81000002"}, auth_store.excluded_sids())

    _blob_excl = json.dumps(research_api.pseudonymised_rows())
    check("the numeric-listed SID's rows are gone (its pseudonym absent) -- and so is its "
          "check-letter twin, since both share one canonical pseudonym",
          _pseudo_71 not in _blob_excl, "71000001 still exported")
    check("a check-letter LIST entry drops the numeric-form ROW (canonical exclusion, both ways)",
          _pseudo_81 not in _blob_excl, "81000002 still exported")
    check("a genuine participant is UNTOUCHED by the exclusion",
          _pseudo_real in _blob_excl, "the real session participant was dropped")
    # The token export endpoint shares the SAME boundary, so it must agree.
    _export = c.get("/api/research/export", headers={"X-Export-Token": "s3cret-token"}).text
    check("the token export drops the excluded streams too (shared pseudonymised_rows)",
          _pseudo_71 not in _export and _pseudo_81 not in _export, "export still names them")
    check("...while still exporting the genuine participant", _pseudo_real in _export, "real dropped")
    # No raw SID leaks either way (belt and braces on the deny-list path).
    check("no raw excluded SID appears in the excluded export",
          "71000001" not in _export and "81000002" not in _export, "raw SID leaked")
finally:
    if _saved_excl_env is None:
        os.environ.pop("EXCLUDED_SIDS_PATH", None)
    else:
        os.environ["EXCLUDED_SIDS_PATH"] = _saved_excl_env
    auth_store._excluded, auth_store._excluded_key = _saved_excl_cache

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
