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
# sink_reconcile() reads the auth DB read-only (list_participants) to match streams to
# accounts. Point it at a fresh path with no `users` table so the account side is
# deterministically empty here (the sink-side counts are what this suite asserts; the
# account-matching side is covered against real accounts in test_researcher_api.py).
os.environ["AUTH_DB_PATH"] = os.path.join(tmp, "noauth.db")
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

print("\n-- AGE distribution + quartiles: the junk upper tail is visible --")
# Add a spread of ages incl. a junk '99', so the histogram + IQR have something to show.
# With the existing 24DEMOG01A(22) that makes ages [18,20,20,22,22,99].
for _sid, _age_v in (("24AGE0001A", "18"), ("24AGE0002A", "20"), ("24AGE0003A", "20"),
                     ("24AGE0004A", "22"), ("24AGE0005A", "99")):
    evm(_sid, "questionnaire_demographics", None, {"answers": {"AGE": _age_v}})
conn.commit()
_agefull = next(i for i in measures.demographics_summary(DB)["items"] if i["id"] == "AGE")
check("existing min/max/median/mean are kept",
      _agefull["min"] == 18 and _agefull["max"] == 99 and _agefull["median"] == 22
      and _agefull["mean"] == 33.5, _agefull)
check("quartiles are reported (q1/q3/IQR)",
      _agefull["q1"] == 20.0 and _agefull["q3"] == 22.0 and _agefull["iqr"] == 2.0, _agefull)
check("the distribution is a value->count histogram, ascending by value",
      _agefull["distribution"] == [{"value": 18, "count": 1}, {"value": 20, "count": 2},
                                   {"value": 22, "count": 2}, {"value": 99, "count": 1}],
      _agefull["distribution"])
check("the junk 99 shows in the tail (mean > median, IQR tight)",
      _agefull["distribution"][-1]["value"] == 99 and _agefull["mean"] > _agefull["median"],
      _agefull)

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

print("\n-- retention_summary: delayed Form-C score by arm + the interval covariate --")
# topic_posttest already exists for flip_sid/ctrl_sid on T from the block near the top
# (scores 5 and 4). Add a topic_retention weeks later for each, in OPPOSITE arms.
ev(flip_sid, "topic_retention", T, "2026-11-15T09:00:00+00:00", score=80.0)   # ~10 weeks later
ev(ctrl_sid, "topic_retention", T, "2026-11-15T09:10:00+00:00", score=40.0)
conn.commit()

ret = measures.retention_summary(DB)
check("n counts both retention rows", ret["n"] == 2, ret)
check("FLIP mean score reflects the FLIP row", ret["flip"]["mean_score"] == 80.0, ret["flip"])
check("CONTROL mean score reflects the CONTROL row", ret["control"]["mean_score"] == 40.0, ret["control"])
check("the interval covariate is computed (roughly 10 weeks from the post-check)",
      ret["with_interval"] == 2 and 9 <= ret["mean_weeks_since_post"] <= 11, ret)

print("\n-- affect_recall_summary: AR1-3 means by arm and by topic --")
evm(flip_sid, "questionnaire_affect_recall", T, {"answers": {"AR1": 5, "AR2": 4, "AR3": 2}})
evm(ctrl_sid, "questionnaire_affect_recall", T, {"answers": {"AR1": 3, "AR2": 3, "AR3": 3}})
conn.commit()

ar = measures.affect_recall_summary(DB)
check("scale_max is 5, the shared Likert", ar["scale_max"] == 5, ar)
check("FLIP AR1 mean reflects the FLIP row", ar["flip"]["items"]["AR1"]["mean"] == 5.0, ar["flip"])
check("CONTROL AR3 mean reflects the CONTROL row", ar["control"]["items"]["AR3"]["mean"] == 3.0, ar["control"])
_ar_topic = next(t for t in ar["by_topic"] if t["topic_id"] == T)
check("by_topic aggregates BOTH arms' responses for that topic (n=2 per item)",
      _ar_topic["items"]["AR2"]["n"] == 2, _ar_topic)

print("\n-- FROZEN ARM (SID-canon study-integrity fix): read in preference to arm_for --")
# A migrated account is one the SID-canon migration renamed letter->numeric. It leaves a
# `topic_arm_assigned` row keyed to the (post-migration) numeric sid carrying the arm the
# student was ACTUALLY run under. measures must read that FROZEN arm, not re-derive from the
# new sid -- re-deriving would flip ~half of ~155 real students' arm on every topic.
# MIGN: natural arm_for == FLIP, but frozen to the OPPOSITE (CONTROL). PLAIN: no frozen row.
MIGN = next(s for s in (f"2007{i:04d}" for i in range(3000)) if S.arm_for(s, idx) == S.FLIP)
PLAIN = next(s for s in (f"2008{i:04d}" for i in range(3000)) if S.arm_for(s, idx) == S.CONTROL)
FROZEN = S.CONTROL   # deliberately the opposite of MIGN's natural FLIP

ev(MIGN, "topic_pretest", T, "2026-09-02T09:00:00+00:00", score=2)
ev(MIGN, "topic_posttest", T, "2026-09-02T09:20:00+00:00", score=4)
evm(MIGN, "topic_arm_assigned", T, {"arm": FROZEN, "topic_index": idx, "source": "sid_canon_migrate"})
ev(PLAIN, "topic_pretest", T, "2026-09-02T09:00:00+00:00", score=2)
ev(PLAIN, "topic_posttest", T, "2026-09-02T09:20:00+00:00", score=4)
conn.commit()

migrows = {r["participant_id"]: r for r in measures.per_topic(DB)}
check("(b) per_topic reads the FROZEN arm, not arm_for", migrows[MIGN]["arm"] == FROZEN, migrows[MIGN])
check("...which is the OPPOSITE of the naive re-derivation", FROZEN != S.arm_for(MIGN, idx))
check("(c) a non-migrated account (no frozen row) falls back to arm_for",
      migrows[PLAIN]["arm"] == S.arm_for(PLAIN, idx), migrows[PLAIN])

# All four arm call sites go through the same _resolved_arm helper. Prove the three besides
# per_topic honour the freeze too, by landing MIGN's per-topic data in the FROZEN (control)
# bucket. Prior committed state on topic T: retention flip=[80]/ctrl=[40]; PAAS flip=[8]/
# ctrl=[3]; affect AR1 flip=[5]/ctrl=[3]. MIGN (frozen CONTROL) adds to the control side.
ev(MIGN, "topic_retention", T, "2026-11-20T09:00:00+00:00", score=70.0)
evm(MIGN, "questionnaire_paas", T, {"answers": {"P1": 9}})
evm(MIGN, "questionnaire_affect_recall", T, {"answers": {"AR1": 1, "AR2": 1, "AR3": 1}})
conn.commit()

ret2 = measures.retention_summary(DB)
check("retention_summary buckets the frozen account under CONTROL (mean 55), not FLIP",
      ret2["control"]["mean_score"] == 55.0 and ret2["flip"]["mean_score"] == 80.0, ret2)
qa2 = measures.questionnaire_by_arm(DB)
check("questionnaire_by_arm PAAS buckets it under CONTROL (mean 6), not FLIP",
      qa2["paas"]["control"]["mean_effort"] == 6.0 and qa2["paas"]["flip"]["mean_effort"] == 8.0, qa2["paas"])
ar2 = measures.affect_recall_summary(DB)
check("affect_recall_summary buckets it under CONTROL (AR1 mean 2), not FLIP",
      ar2["control"]["items"]["AR1"]["mean"] == 2.0 and ar2["flip"]["items"]["AR1"]["mean"] == 5.0, ar2)

print("\n-- gain_detail: pre/post BY ARM + ceiling shares + differential attrition --")
# A clean topic (fitts-law, no prior events) with four FLIP-assigned students:
#   CEIL_A  pre 10 -> post 95 (activity first)   -> determinable, ceiling≥90
#   CEIL_B  pre 20 -> post 100 (activity first)  -> determinable, ceiling≥90 AND ==100
#   NOPOST  pre 30, activity, no post-check      -> attrition: no_posttest, not a pair
#   NOACT   pre 30 -> post 50, NO activity       -> attrition: no_activity, still a pair
GT = "fitts-law"
idxGT = measures.topic_index()[GT]
_gflip = [s for s in (f"24F{i:05d}A" for i in range(4000)) if S.arm_for(s, idxGT) == S.FLIP]
CEIL_A, CEIL_B, GNOPOST, GNOACT = _gflip[:4]
ev(CEIL_A, "topic_pretest", GT, "2026-09-01T09:00:00+00:00", score=10)
ev(CEIL_A, "understanding_complete", GT, "2026-09-01T09:05:00+00:00")
ev(CEIL_A, "topic_posttest", GT, "2026-09-01T09:10:00+00:00", score=95)
ev(CEIL_B, "topic_pretest", GT, "2026-09-01T09:00:00+00:00", score=20)
ev(CEIL_B, "understanding_complete", GT, "2026-09-01T09:05:00+00:00")
ev(CEIL_B, "topic_posttest", GT, "2026-09-01T09:10:00+00:00", score=100)
ev(GNOPOST, "topic_pretest", GT, "2026-09-01T09:00:00+00:00", score=30)
ev(GNOPOST, "understanding_complete", GT, "2026-09-01T09:05:00+00:00")
ev(GNOACT, "topic_pretest", GT, "2026-09-01T09:00:00+00:00", score=30)
ev(GNOACT, "topic_posttest", GT, "2026-09-01T09:10:00+00:00", score=50)
conn.commit()

gd = {(r["topic_id"], r["arm"]): r for r in measures.gain_detail(DB)}
_gf = gd[(GT, S.FLIP)]
check("assigned counts every pair with any event on that topic+arm", _gf["assigned"] == 4, _gf)
check("n_pairs counts only pairs with BOTH pre and post", _gf["n_pairs"] == 3, _gf)
check("pre/post means over the pairs", _gf["pre_mean"] == 20.0 and _gf["post_mean"] == 81.7, _gf)
check("mean normalised gain is reported, with its own denominator gain_n",
      _gf["gain"] is not None and _gf["gain_n"] == 3, _gf)
check("ceiling ≥90 counted with its share (of n_pairs)",
      _gf["ceiling_ge90"] == 2 and _gf["ceiling_ge90_share"] == round(2 / 3, 3), _gf)
check("ceiling ==100 counted separately", _gf["ceiling_eq100"] == 1, _gf)
check("differential attrition: no_activity by assigned arm", _gf["no_activity"] == 1, _gf)
check("differential attrition: no_posttest by assigned arm", _gf["no_posttest"] == 1, _gf)
check("gain_detail respects the frozen arm too (MIGN lands in memory/CONTROL, not FLIP)",
      (T, S.CONTROL) in gd and gd[(T, S.CONTROL)]["assigned"] >= 1
      and FROZEN == S.CONTROL, gd.get((T, S.CONTROL)))

print("\n-- sink_census: per-event-type capture health, distinct participants counted --")
cen = {r["event_type"]: r for r in measures.sink_census(DB)}
check("every census row carries n, participants, first_seen, last_seen",
      all({"event_type", "n", "participants", "first_seen", "last_seen"} <= set(r)
          for r in measures.sink_census(DB)))
check("distinct participants, not row count (demographics: 7 people, 7 rows)",
      cen["questionnaire_demographics"]["participants"] == 7
      and cen["questionnaire_demographics"]["n"] == 7, cen.get("questionnaire_demographics"))
check("first_seen <= last_seen for a repeated event_type",
      cen["topic_pretest"]["first_seen"] <= cen["topic_pretest"]["last_seen"], cen.get("topic_pretest"))
check("a wired event type is present (understanding_complete, the manipulation check)",
      "understanding_complete" in cen, list(cen))

print("\n-- sink_reconcile: counts-only sink-streams-vs-accounts, check-letter folded --")
# A person recorded under BOTH the numeric and the check-letter SID: two streams, one
# canonical person. This is the split_by_check_letter signal.
ev("20260001", "topic_complete", None, "2026-09-01T10:00:00+00:00")
ev("20260001D", "topic_complete", None, "2026-09-01T10:00:00+00:00")
conn.commit()
rec = measures.sink_reconcile(DB)
check("reconcile carries counts only (no *_id/sid string field names that hold SIDs)",
      set(rec) == {"sink_streams", "sink_canonical_people", "accounts_canonical",
                   "matched_to_account", "excess_no_account", "split_by_check_letter"}, rec)
check("all reconcile values are integers", all(isinstance(v, int) for v in rec.values()), rec)
check("canonicalising the check-letter folds the twin (streams > canonical people)",
      rec["sink_streams"] > rec["sink_canonical_people"], rec)
check("split_by_check_letter flags the numeric/letter twin", rec["split_by_check_letter"] >= 1, rec)
check("with no accounts here, every canonical person is excess_no_account",
      rec["matched_to_account"] == 0
      and rec["excess_no_account"] == rec["sink_canonical_people"], rec)

print("\n-- gain_by_population_arm (P05): the cross-population INTERACTION DV --")
# A fresh topic (language) with a controlled 2x2: population (UG sections A/B/C pooled vs MSc =
# MSC) x arm. section_map is INJECTED so this needs no auth DB. Four cells, each two pairs, with
# gains contrived to a clean interaction:
#   UG/FLIP    0.5   UG/CONTROL 0.1   -> UG gain gap 0.4
#   MSc/FLIP   0.4   MSc/CONTROL 0.3  -> MSc gain gap 0.1   -> interaction 0.3
LT = "language"
idxLT = measures.topic_index()[LT]
_lflip = [s for s in (f"25L{i:05d}A" for i in range(20000)) if S.arm_for(s, idxLT) == S.FLIP]
_lctrl = [s for s in (f"25L{i:05d}A" for i in range(20000)) if S.arm_for(s, idxLT) == S.CONTROL]
UGF1, UGF2, MSF1, MSF2 = _lflip[0], _lflip[1], _lflip[2], _lflip[3]
UGC1, UGC2, MSCC1, MSCC2 = _lctrl[0], _lctrl[1], _lctrl[2], _lctrl[3]
_secmap = {UGF1: "A", UGF2: "A", MSF1: "MSC", MSF2: "MSC",
           UGC1: "B", UGC2: "B", MSCC1: "MSC", MSCC2: "MSC"}


def _pair(sid, pre, post):
    ev(sid, "topic_pretest", LT, "2026-09-02T09:00:00+00:00", score=pre)
    ev(sid, "topic_posttest", LT, "2026-09-02T09:10:00+00:00", score=post)


_pair(UGF1, 20, 60); _pair(UGF2, 40, 70)      # UG FLIP    -> gain 0.5
_pair(UGC1, 10, 19); _pair(UGC2, 50, 55)      # UG CONTROL -> gain 0.1
_pair(MSF1, 20, 52); _pair(MSF2, 0, 40)       # MSc FLIP    -> gain 0.4
_pair(MSCC1, 0, 30); _pair(MSCC2, 50, 65)     # MSc CONTROL -> gain 0.3
conn.commit()

gpa = measures.gain_by_population_arm(DB, section_map=_secmap)
_cells = {(c["population"], c["arm"]): c for c in gpa["cells"]}
check("UG/FLIP cell: n=2 pairs, pre/post means, gain 0.5",
      _cells[("UG", S.FLIP)]["n"] == 2 and _cells[("UG", S.FLIP)]["pre_mean"] == 30.0
      and _cells[("UG", S.FLIP)]["post_mean"] == 65.0 and _cells[("UG", S.FLIP)]["gain"] == 0.5,
      _cells[("UG", S.FLIP)])
check("gain carries its own denominator gain_n and a sample SD (0.0 here, both gains equal)",
      _cells[("UG", S.FLIP)]["gain_n"] == 2 and _cells[("UG", S.FLIP)]["gain_sd"] == 0.0,
      _cells[("UG", S.FLIP)])
check("MSc is a SEPARATE population (MSC section), not pooled into UG",
      _cells[("MSc", S.CONTROL)]["gain"] == 0.3 and _cells[("MSc", S.FLIP)]["gain"] == 0.4,
      {k: v["gain"] for k, v in _cells.items()})
check("the FLIP-CONTROL gain gap is computed per population",
      gpa["ug_gain_gap"] == 0.4 and gpa["msc_gain_gap"] == 0.1, gpa)
check("the INTERACTION is the difference of the two gaps (the cross-population DV)",
      gpa["interaction"] == 0.3, gpa)

print("\n-- game_psychophysics_summary (P09): per-paradigm DV split by assigned arm --")
# One FLIP participant per paradigm's own topic, with that paradigm's real game_result shape.


def _flip_on(topic):
    ix = measures.topic_index()[topic]
    return next(s for s in (f"25G{i:05d}A" for i in range(20000)) if S.arm_for(s, ix) == S.FLIP)


gS, gH, gF, gW = (_flip_on("stroop"), _flip_on("hicks-law"),
                  _flip_on("fitts-law"), _flip_on("webers-law"))
evm(gS, "assessment_complete", "stroop",
    {"game_result": {"game": "stroop", "consistent_avg_ms": 500, "inconsistent_avg_ms": 800, "trials": []}})
evm(gH, "assessment_complete", "hicks-law",
    {"game_result": {"game": "hicks", "trials": [
        {"comparison_id": "c1", "n_choices_a": 4, "n_choices_b": 12, "rt_ms": 600},
        {"comparison_id": "c2", "n_choices_a": 3, "n_choices_b": 9, "rt_ms": 400}]}})
evm(gF, "assessment_complete", "fitts-law",
    {"game_result": {"game": "fitts", "distance": {"A": 300, "B": 500}, "size": {"A": 400, "B": 600}}})
evm(gW, "assessment_complete", "webers-law",
    {"game_result": {"game": "weber",
                     "trials": [{"attribute": "size", "jnd_pct": 12.0},
                                {"attribute": "brightness", "jnd_pct": 8.0}], "jnd": {"size": 12.0}}})
conn.commit()

gp = measures.game_psychophysics_summary(DB)
check("Stroop: consistent/inconsistent mean RT + the congruency delta (800-500=300)",
      gp["stroop"]["flip"]["consistent_ms"] == 500.0
      and gp["stroop"]["flip"]["inconsistent_ms"] == 800.0
      and gp["stroop"]["flip"]["congruency_delta_ms"] == 300.0, gp["stroop"]["flip"])
check("Hick: mean RT bucketed by n_choices (n=4 -> 600ms from the comparison shape)",
      any(b["n_choices"] == 4 and b["mean_rt_ms"] == 600.0
          for b in gp["hick"]["flip"]["by_n_choices"]), gp["hick"]["flip"])
check("Fitts: mean MT by condition (distance 400, size 500)",
      {b["condition"]: b["mean_mt_ms"] for b in gp["fitts"]["flip"]["by_condition"]}
      == {"distance": 400.0, "size": 500.0}, gp["fitts"]["flip"])
check("Weber: mean JND over the trials' jnd_pct ((12+8)/2 = 10.0)",
      gp["weber"]["flip"]["mean_jnd_pct"] == 10.0 and gp["weber"]["flip"]["trials"] == 2,
      gp["weber"]["flip"])
check("each paradigm/arm carries N (distinct participants)",
      gp["stroop"]["flip"]["n"] == 1 and gp["stroop"]["control"]["n"] == 0, gp["stroop"])

print("\n-- questionnaire_subscales (P02): reverse-applied subscale means (the real H2/H3) --")
# IMI EI = [M3, M7, M11], M11 is REVERSE (and EI is untouched by the earlier flip_sid IMI row,
# which only carried M1/M2). P1: M3=5,M7=5,M11=1(->6-1=5) => person mean 5.0; P2: M3=3,M7=3,
# M11=3(->3) => person mean 3.0. Cohort EI mean (5.0+3.0)/2 = 4.0, sample SD sqrt(2)~1.414.
# If the reverse were NOT applied, P1 would be (5+5+1)/3=3.67 and the cohort mean 3.33 -> the
# 4.0 is proof the reverse WAS applied. CoI TP = [I1..I4], no reverse: one all-4 respondent -> 4.0.
evm("25IMI0001A", "questionnaire_imi", None, {"answers": {"M3": 5, "M7": 5, "M11": 1}})
evm("25IMI0002A", "questionnaire_imi", None, {"answers": {"M3": 3, "M7": 3, "M11": 3}})
evm("25COI0001A", "questionnaire_coi", None, {"answers": {"I1": 4, "I2": 4, "I3": 4, "I4": 4}})
evm("25ARC0001A", "questionnaire_arcs", None, {"answers": {"S1": 5, "S2": 5, "S3": 5, "S4": 5, "S5": 5}})
conn.commit()

subs = measures.questionnaire_subscales(DB)
check("IMI has 4 subscales, CoI 2, ARCS 2 (from the bank's subscales metadata)",
      len(subs["imi"]["subscales"]) == 4 and len(subs["coi"]["subscales"]) == 2
      and len(subs["arcs"]["subscales"]) == 2, {k: len(subs[k]["subscales"]) for k in ("imi", "coi", "arcs")})
_ei = next(s for s in subs["imi"]["subscales"] if s["subscale"] == "EI")
check("IMI EI subscale mean is REVERSE-applied (4.0, not the un-reversed 3.33)",
      _ei["mean"] == 4.0 and _ei["n"] == 2, _ei)
check("the subscale carries a sample SD (sqrt(2) ~ 1.414 over the two person-means)",
      _ei["sd"] == 1.414, _ei)
check("the reverse item is read from the bank (M9/M11), not hardcoded",
      subs["imi"]["reverse_items"] == ["M11", "M9"], subs["imi"]["reverse_items"])
_tp = next(s for s in subs["coi"]["subscales"] if s["subscale"] == "TP")
check("CoI TP (no reverse) mean is the plain item mean (4.0)", _tp["mean"] == 4.0, _tp)

print("\n-- NO SID LEAK: every slice returns counts, never a participant id --")
_blob = _json.dumps([measures.demographics_summary(DB), measures.questionnaire_by_arm(DB),
                     measures.reflection_summary(DB), measures.game_result_summary(DB),
                     measures.retention_summary(DB), measures.affect_recall_summary(DB),
                     measures.gain_detail(DB), measures.sink_census(DB),
                     measures.sink_reconcile(DB),
                     # the three new DV-completer slices — same aggregate-only invariant
                     measures.gain_by_population_arm(DB, section_map=_secmap),
                     measures.game_psychophysics_summary(DB),
                     measures.questionnaire_subscales(DB)])
for _sid in (flip_sid, ctrl_sid, "24DEMOG01A", "24DEMOG02A", "24NOREFL1A", MIGN, PLAIN,
             "24AGE0001A", "24AGE0005A", CEIL_A, CEIL_B, GNOPOST, GNOACT,
             # numeric (20260001) AND check-letter (20260001D) forms — both must be absent from
             # the three NEW slices too (they are now in _blob above), the hard invariant
             "20260001", "20260001D",
             # P05 / P09 / P02 synthetic SIDs
             UGF1, MSCC2, gS, gH, gF, gW, "25IMI0001A", "25COI0001A", "25ARC0001A"):
    check(f"{_sid} does not appear in any slice", _sid not in _blob, _blob[:200])

conn.close()
shutil.rmtree(tmp, ignore_errors=True)
print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
