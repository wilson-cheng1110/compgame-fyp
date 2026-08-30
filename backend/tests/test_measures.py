import os, sys, sqlite3, tempfile, shutil
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
os.environ["TOPIC_SCHEDULE_PATH"] = os.path.join(BE, "topic_schedule.json")
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

conn.close()
shutil.rmtree(tmp, ignore_errors=True)
print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
