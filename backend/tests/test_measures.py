import os, sys, sqlite3, tempfile, shutil
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
os.environ["TOPIC_SCHEDULE_PATH"] = os.path.join(BE, "topic_schedule.json")
# The papers-dashboard measures call enrolled_only(), which drops non-roster SIDs when a
# roster is active. Point it at a file that does not exist so the roster is INACTIVE here
# (no filtering) and the synthetic SIDs below are all counted -- otherwise every assertion
# reads zero. (In prod the roster IS active and that filtering is the point.)
os.environ["ENROLMENT_PATH"] = os.path.join(tempfile.gettempdir(), "compgame_no_roster_measures.txt")
import schedule as S
import measures
import check_measurement_coverage as CMC

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

DDL = """CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, participant_id TEXT NOT NULL,
    event_type TEXT NOT NULL, topic_id TEXT, mode TEXT, score REAL,
    played_understanding_first INTEGER, duration_ms INTEGER,
    client_ts TEXT, server_ts TEXT NOT NULL, meta TEXT)"""

tmp = tempfile.mkdtemp()
DB = os.path.join(tmp, "sink.db")
conn = sqlite3.connect(DB)
conn.execute(DDL)

def ev(sid, etype, topic, ts, score=None, puf=None):
    conn.execute(
        "INSERT INTO events (participant_id, event_type, topic_id, score,"
        " played_understanding_first, server_ts) VALUES (?,?,?,?,?,?)",
        (sid, etype, topic, score, puf, ts))

T = "memory"
idx = measures.topic_index()[T]

# Pick two SIDs the deterministic assignment puts in OPPOSITE arms, so the
# compliance assertions below are testing the derivation and not a coincidence.
flip_sid = next(s for s in (f"24E{i:05d}A" for i in range(400))
                if S.arm_for(s, idx) == S.FLIP)
ctrl_sid = next(s for s in (f"24E{i:05d}A" for i in range(400))
                if S.arm_for(s, idx) == S.CONTROL)

# FLIP done properly: activity, then the post-check.
ev(flip_sid, "topic_pretest", T, "2026-09-01T09:00:00+00:00", score=2)
ev(flip_sid, "understanding_complete", T, "2026-09-01T09:10:00+00:00")
ev(flip_sid, "topic_posttest", T, "2026-09-01T09:20:00+00:00", score=5)

# CONTROL done properly: post-check, then the activity.
ev(ctrl_sid, "topic_pretest", T, "2026-09-01T09:00:00+00:00", score=3)
ev(ctrl_sid, "topic_posttest", T, "2026-09-01T09:10:00+00:00", score=4)
ev(ctrl_sid, "understanding_complete", T, "2026-09-01T09:20:00+00:00")

# The ten-week failure, as data: everything except the activity.
ev("NOACT0001", "topic_pretest", T, "2026-09-01T09:00:00+00:00", score=1)
ev("NOACT0001", "topic_posttest", T, "2026-09-01T09:20:00+00:00", score=2)
ev("NOACT0001", "topic_complete", T, "2026-09-01T09:21:00+00:00")

# Took the unit's logged escape.
ev("ESCAPE001", "topic_pretest", T, "2026-09-01T09:00:00+00:00")
ev("ESCAPE001", "activity_not_recorded", T, "2026-09-01T09:05:00+00:00")
ev("ESCAPE001", "topic_posttest", T, "2026-09-01T09:20:00+00:00")

# Started but never sat the post-check.
ev("NOPOST001", "understanding_complete", T, "2026-09-01T09:10:00+00:00")
conn.commit()

rows = {r["participant_id"]: r for r in measures.per_topic(DB)}

print("\n-- played_first is DERIVED from timestamps, not claimed by a client --")
check("activity before the post-check reads as played first",
      rows[flip_sid]["played_first"] is True, rows[flip_sid])
check("activity after it does not",
      rows[ctrl_sid]["played_first"] is False, rows[ctrl_sid])
check("and the basis says where the answer came from",
      rows[flip_sid]["played_first_basis"] == "timestamps")

print("\n-- undeterminable is a THIRD state, and says why --")
check("no activity ever -> None, not False",
      rows["NOACT0001"]["played_first"] is None, rows["NOACT0001"])
check("...and names the reason",
      rows["NOACT0001"]["played_first_basis"] == "activity never recorded")
check("no post-check -> None with its own reason",
      rows["NOPOST001"]["played_first"] is None
      and rows["NOPOST001"]["played_first_basis"] == "post-check not sat")
# The whole point: "did not play" and "we never heard" must not collapse together,
# because for ten weeks every row looked like the second one.
check("'did not play' and 'never recorded' are NOT the same value",
      rows[ctrl_sid]["played_first"] is False
      and rows["NOACT0001"]["played_first"] is None)

print("\n-- arm is assigned, compliance is observed, and they are separate --")
check("the FLIP student's arm is FLIP", rows[flip_sid]["arm"] == S.FLIP)
check("the CONTROL student's arm is CONTROL", rows[ctrl_sid]["arm"] == S.CONTROL)
check("both complied", rows[flip_sid]["complied"] and rows[ctrl_sid]["complied"])
check("compliance is unknown when the order is unknown",
      rows["NOACT0001"]["complied"] is None)

print("\n-- a REPLAY must not rewrite history --")
# Replay landed in the same release as this derivation: a student can finish a
# CONTROL unit and then replay the activity from the close screen. Taking the LAST
# activity event would silently reclassify that run as FLIP.
ev(ctrl_sid, "understanding_complete", T, "2026-09-05T12:00:00+00:00")
conn.commit()
again = {r["participant_id"]: r for r in measures.per_topic(DB)}
check("replaying the activity later does not turn CONTROL into FLIP",
      again[ctrl_sid]["played_first"] is False, again[ctrl_sid])

print("\n-- the escape is visible as its own fact --")
check("taking the escape is flagged", rows["ESCAPE001"]["skipped_activity"] is True)
check("and it does not count as having played",
      rows["ESCAPE001"]["played_first"] is None, rows["ESCAPE001"])

print("\n-- coverage is the number that would have caught the outage --")
cov = measures.coverage(DB)
check("counts every pair with any event", cov["pairs"] == 5, cov)
check("only the two with both timestamps are determinable", cov["determinable"] == 2, cov)
check("and it counts the ones with no activity at all", cov["no_activity"] == 2, cov)
check("and the escapes", cov["took_escape"] == 1, cov)

print("\n-- the checker fails on RELATIVE staleness, not an absolute age --")
# A sink where other events flow but a required one has gone quiet is the exact
# signature of the outage. An absolute threshold stays green through it.
old = CMC.DB
CMC.DB = DB
try:
    total, recent = CMC.counts(DB)
    check("counts are read straight from the sink", total["topic_pretest"][0] == 4, total.get("topic_pretest"))
    check("understanding_complete is listed as the manipulation check",
          CMC.SIGNALS["understanding_complete"][1] == "MANIPULATION CHECK")
    check("the not-built gaps are named rather than silent",
          set(CMC.NOT_BUILT) >= {"questionnaire_imi", "questionnaire_coi", "questionnaire_arcs"})
finally:
    CMC.DB = old

print("\n-- the papers-dashboard slices: aggregate-only, correct distributions --")
import json as _json


def evm(sid, etype, topic, meta):
    conn.execute(
        "INSERT INTO events (participant_id, event_type, topic_id, server_ts, meta)"
        " VALUES (?,?,?,?,?)",
        (sid, etype, topic, "2026-09-10T09:00:00+00:00", _json.dumps(meta)))


# demographics: S1 full, S2 declined age + only two of the four items.
evm("24DEMOG01A", "questionnaire_demographics", None,
    {"answers": {"AGE": "22", "GENDER": 1, "GAMING": 4, "AITOOL": 2}})
evm("24DEMOG02A", "questionnaire_demographics", None,
    {"answers": {"GENDER": 4, "GAMING": 1}})            # no AGE -> declined; GENDER=Prefer not to say
conn.commit()

dem = measures.demographics_summary(DB)
check("demographics counts distinct participants", dem["n"] == 2, dem["n"])
_age = next(i for i in dem["items"] if i["id"] == "AGE")
check("AGE answered vs declined is split", _age["answered"] == 1 and _age["declined"] == 1, _age)
check("AGE reports the typed value's summary", _age["min"] == 22 and _age["median"] == 22, _age)
_gender = next(i for i in dem["items"] if i["id"] == "GENDER")
check("GENDER 'Female' counted", _gender["options"][0]["count"] == 1, _gender)
check("GENDER 'Prefer not to say' is a real option bar, not a null",
      _gender["options"][3]["label"] == "Prefer not to say" and _gender["options"][3]["count"] == 1, _gender)
check("labels come from the bank (not hardcoded)",
      [o["label"] for o in _gender["options"]][:2] == ["Female", "Male"], _gender)

# paas per-topic -> splits by the arm assigned for THIS topic.
evm(flip_sid, "questionnaire_paas", T, {"answers": {"P1": 8}})
evm(ctrl_sid, "questionnaire_paas", T, {"answers": {"P1": 3}})
# imi cohort-level (no topic).
evm(flip_sid, "questionnaire_imi", None, {"answers": {"M1": 5, "M2": 4}})
conn.commit()

qa = measures.questionnaire_by_arm(DB)
check("PAAS effort splits by assigned arm — FLIP", qa["paas"]["flip"]["mean_effort"] == 8.0, qa["paas"])
check("PAAS effort splits by assigned arm — CONTROL", qa["paas"]["control"]["mean_effort"] == 3.0, qa["paas"])
check("IMI is cohort-level with no arm split", qa["imi"]["scope"] == "cohort" and qa["imi"]["n"] == 1, qa["imi"])

# reflection engagement (papers 03/07).
evm(flip_sid, "reflection_complete", T,
    {"transcript": [{"role": "human"}, {"role": "assistant"}, {"role": "human"}], "directAnswers": 1})
evm("24NOREFL1A", "reflection_skipped", T, {})
conn.commit()

rs = measures.reflection_summary(DB)
check("reflections completed counted", rs["reflections"] == 1, rs)
check("skips counted separately", rs["skipped"] == 1, rs)
check("mean human turns from the transcript", rs["mean_human_turns"] == 2.0, rs)
check("direct-answer use is a rate, not a transcript", rs["direct_answer_rate"] == 1.0, rs)

# game_result rides in meta.game_result on a completion event.
evm(flip_sid, "assessment_complete", T, {"game_result": {"rt_ms": 420, "trials": 10}})
conn.commit()

gr = measures.game_result_summary(DB)
check("game_result trials found via meta", gr["total_trials"] == 1, gr)
check("and the metric keys are surfaced (not the values)",
      set(gr["topics"][0]["metric_keys"]) == {"rt_ms", "trials"}, gr["topics"])

print("\n-- NO SID LEAK: every slice returns counts, never a participant id --")
_blob = _json.dumps([measures.demographics_summary(DB), measures.questionnaire_by_arm(DB),
                     measures.reflection_summary(DB), measures.game_result_summary(DB)])
for _sid in (flip_sid, ctrl_sid, "24DEMOG01A", "24DEMOG02A", "24NOREFL1A"):
    check(f"{_sid} does not appear in any slice", _sid not in _blob, _blob[:200])

conn.close()
shutil.rmtree(tmp, ignore_errors=True)
print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
