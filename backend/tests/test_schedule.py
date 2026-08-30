import os, sys, json, shutil, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
os.environ["TOPIC_SCHEDULE_PATH"] = os.path.join(BE, "topic_schedule.json")
import schedule as S
from datetime import datetime, timedelta

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

# realistic-ish cohort
SIDS = [f"24{i:06d}{chr(65 + i % 26)}" for i in range(300)]
NTOPICS = len(S._load()["topics"])

print("\n-- IV: within-student balance (every student ~half FLIP) --")
per_student = [sum(1 for i in range(NTOPICS) if S.arm_for(s, i) == S.FLIP) for s in SIDS]
check("every student gets 6 or 7 FLIP of 13", set(per_student) <= {6, 7}, sorted(set(per_student)))

print("\n-- IV: between-student balance (every topic ~half the cohort FLIP) --")
worst = None
for i in range(NTOPICS):
    n = sum(1 for s in SIDS if S.arm_for(s, i) == S.FLIP)
    frac = n / len(SIDS)
    if worst is None or abs(frac - .5) > abs(worst[1] - .5): worst = (i, frac)
check(f"every topic within 45-55% FLIP (worst topic {worst[0]} = {worst[1]:.0%})",
      0.45 <= worst[1] <= 0.55, worst)

print("\n-- IV: topic x condition fully crossed --")
crossed = all(
    0 < sum(1 for s in SIDS if S.arm_for(s, i) == S.FLIP) < len(SIDS)
    for i in range(NTOPICS))
check("no topic is all-FLIP or all-CONTROL", crossed)

print("\n-- IV: deterministic --")
check("same sid+topic gives same arm",  all(S.arm_for("24012345D", i) == S.arm_for("24012345D", i) for i in range(NTOPICS)))
check("case-insensitive",               S.arm_for("24012345d", 0) == S.arm_for("24012345D", 0))
check("whitespace-insensitive",         S.arm_for(" 24012345D ", 3) == S.arm_for("24012345D", 3))
check("arm changes across topics",      len({S.arm_for("24012345D", i) for i in range(NTOPICS)}) == 2)

print("\n-- windows: state machine --")
st = S.topic_state("24012345D", "A", "memory")
opens  = datetime.fromisoformat(st["opens"])
closes = datetime.fromisoformat(st["closes"])
def state_at(t): return S.topic_state("24012345D", "A", "memory", t)["state"]
check("before opens -> locked", state_at(opens - timedelta(minutes=1)) == "locked")
check("at opens      -> open",   state_at(opens) == "open")
check("mid-window    -> open",   state_at(opens + (closes-opens)/2) == "open")
check("at closes     -> open",   state_at(closes) == "open")
check("after closes  -> late",   state_at(closes + timedelta(minutes=1)) == "late")
check("48h before session start", (S._window_for(S._load(), S._load()['topics'][1], 'A')[2] - closes) == timedelta(hours=48))

print("\n-- windows: the gate --")
check("locked is not enterable", not S.is_enterable("24012345D","A","memory", opens - timedelta(days=1)))
check("open is enterable",       S.is_enterable("24012345D","A","memory", opens + timedelta(hours=1)))
check("late is enterable+flagged", S.is_enterable("24012345D","A","memory", closes + timedelta(days=1))
                                   and state_at(closes + timedelta(days=1)) == "late")
check("unknown topic -> None",   S.topic_state("24012345D","A","nope") is None)

print("\n-- windows: sections actually stagger --")
cl = {sec: S.topic_state("24012345D", sec, "gestalt")["closes"] for sec in ("A","B","C")}
check("3 distinct close times", len(set(cl.values())) == 3, cl)

print("\n-- order is lecture order, all 13 present --")
states = S.topic_states("24012345D", "A")
check("13 topics returned", len(states) == 13, len(states))
check("order field is 1..13", [s["order"] for s in states] == list(range(1,14)))
# norman moved to session 6 beside mental-model on 2026-08-30 (Wilson): the Action
# Cycle is the umbrella over mental models and the evaluation heuristics, not a lecture
# of its own. memory is the first release now.
check("memory first", states[0]["topic_id"] == "memory", states[0]["topic_id"])
check("experiment-design last", states[-1]["topic_id"] == "experiment-design")
# mc_bank retired 2026-08-30: it duplicated checks.has_bank() and went stale the
# day the other nine banks landed. The live fact is asserted in test_checks.py
# ("every scheduled topic has a bank") and in test_topic_api.py ("has_bank flags
# all 13"), both of which read the bank file rather than a config flag.
check("mc_bank is gone from the topic state", "mc_bank" not in states[0], sorted(states[0]))
check("lecture_terms carried for gestalt",
      any(s["topic_id"]=="gestalt" and "pattern recognition" in s["lecture_terms"] for s in states))

print("\n-- validate() catches a collapsed stagger --")
tmp = tempfile.mkdtemp()
bad = os.path.join(tmp, "bad.json")
cfg = json.load(open(os.environ["TOPIC_SCHEDULE_PATH"], encoding="utf-8"))
cfg["sessions"]["3"]["B"] = cfg["sessions"]["3"]["A"]      # holiday collapses B onto A
json.dump(cfg, open(bad, "w", encoding="utf-8"))
S.CONFIG_PATH = bad; S._config = None; S._config_mtime = None
probs = S.validate()
check("collapsed stagger detected", any("share a close time" in p for p in probs), probs[:2])
cfg["sessions"].pop("3")
json.dump(cfg, open(bad, "w", encoding="utf-8"))
S._config = None; S._config_mtime = None
probs = S.validate()
check("missing session date detected", any("no date entry" in p for p in probs), probs[:2])
shutil.rmtree(tmp, ignore_errors=True)

print("\n-- a lecture date on a public holiday is a config problem, not a detail --")
# validate() reported the real config "sane" while section C's session 5 sat on
# Thursday 1 Oct 2026, National Day. The comment about "holiday displacement" was
# already in validate(); nothing checked for it.
import copy
# the previous block left CONFIG_PATH on a temp file it then deleted
S.CONFIG_PATH = os.path.join(BE, "topic_schedule.json")
tmp2 = tempfile.mkdtemp()
cfg2 = copy.deepcopy(S._load())
first = sorted(cfg2["sessions"], key=int)[0]
victim_section = sorted(cfg2["sessions"][first])[0]
victim_date = cfg2["sessions"][first][victim_section]
cfg2["no_class_dates"] = {victim_date: "General holiday (test)"}
path2 = os.path.join(tmp2, "sched.json")
with open(path2, "w", encoding="utf-8") as fh:
    json.dump(cfg2, fh)
os.environ["TOPIC_SCHEDULE_PATH"] = path2
S.CONFIG_PATH = path2
S._config = None; S._config_mtime = None   # _load caches on MTIME, and the two
# writes to this path can land inside one filesystem mtime tick -- in which case
# validate() re-reads nothing and judges the PREVIOUS config. `_load` is not an
# lru_cache, so the `cache_clear()` this line used to call never existed and the
# hasattr guard silently swallowed it: the negative control below then failed
# roughly one run in three. A flaky test teaches people to ignore red.
probs2 = S.validate()
check("a session on a no-class date is reported",
      any("not a teaching day" in p for p in probs2), probs2[:3])
check("and it names the section and the date",
      any(victim_date in p and victim_section in p for p in probs2), probs2[:3])

# and the negative control: with no holidays declared, that check stays silent
cfg2.pop("no_class_dates")
with open(path2, "w", encoding="utf-8") as fh:
    json.dump(cfg2, fh)
S._config = None; S._config_mtime = None   # see above -- mtime cache, not lru_cache
probs3 = S.validate()
check("no false positive when nothing is declared",
      not any("not a teaching day" in p for p in probs3), probs3[:3])
shutil.rmtree(tmp2, ignore_errors=True)


# ---------------------------------------------------------------------------
print("")
print("-- editing a lecture date from the teacher panel --")
# A COPY. These tests write, and writing the real topic_schedule.json from a test
# run would move the study's own dates -- the one file where a stray edit is
# expensive. Point the module at a temp copy and restore it afterwards.
tmp3 = tempfile.mkdtemp()
path3 = os.path.join(tmp3, "sched.json")
shutil.copy(os.path.join(BE, "topic_schedule.json"), path3)
real_path = os.path.join(BE, "topic_schedule.json")
S.CONFIG_PATH = path3
S._config = None; S._config_mtime = None

grid = S.session_grid()
check("the grid lists every session with a date per section",
      len(grid["sessions"]) == len(S._load()["sessions"])
      and all(set(x["dates"]) == set(grid["sections"]) for x in grid["sessions"]),
      len(grid["sessions"]))
check("and it says which topics ride on each session",
      sum(len(x["topics"]) for x in grid["sessions"]) == NTOPICS,
      sum(len(x["topics"]) for x in grid["sessions"]))

before_date = S._load()["sessions"]["5"]["C"]
a5_before = S._load()["sessions"]["5"]["A"]

# Preview must not write. That is the whole point of the two-step: the panel asks
# what would happen, and nothing has happened yet.
prev = S.set_session_date(5, "C", "2026-10-02", commit=False)
check("a preview reports the change", prev["ok"] and prev["new"] == "2026-10-02", prev)
check("a preview writes NOTHING to disk",
      json.load(open(path3, encoding="utf-8"))["sessions"]["5"]["C"] == before_date)
check("a preview leaves the loaded config alone",
      S._load()["sessions"]["5"]["C"] == before_date)

# Bad input is refused by reason, not by exception -- it arrives off an HTTP body.
check("a bad date is refused", S.set_session_date(5, "C", "2 Oct", commit=True)["reason"] == "bad_date")
check("an unknown section is refused", S.set_session_date(5, "Z", "2026-10-02", commit=True)["reason"] == "no_such_section")
check("an unknown lecture is refused", S.set_session_date(99, "C", "2026-10-02", commit=True)["reason"] == "no_such_session")
check("a no-op is refused", S.set_session_date(5, "C", before_date, commit=True)["reason"] == "unchanged")
check("...and none of those wrote either",
      json.load(open(path3, encoding="utf-8"))["sessions"]["5"]["C"] == before_date)

# A date on a declared no-class day ADDS a validation problem, so the commit is
# refused. Pre-existing problems must not block an edit, but new ones must.
bad = S.set_session_date(5, "C", "2026-10-19", commit=True)   # Chung Yeung, declared
check("a date that breaks the schedule is refused",
      not bad["ok"] and bad["reason"] == "would_add_problems", bad.get("added_problems"))
check("and the refusal explains what would break", bool(bad.get("added_problems")), bad)
check("and it wrote nothing",
      json.load(open(path3, encoding="utf-8"))["sessions"]["5"]["C"] == before_date)

good = S.set_session_date(5, "C", "2026-10-02", commit=True)
check("a valid move commits", good["ok"] and good["committed"], good)
check("and it is on disk",
      json.load(open(path3, encoding="utf-8"))["sessions"]["5"]["C"] == "2026-10-02")
check("and the loader serves the new date immediately",
      S._load()["sessions"]["5"]["C"] == "2026-10-02")
check("and no temp file is left behind", not os.path.exists(path3 + ".tmp"))
check("the schedule is still valid afterwards", S.validate() == [])
check("the other sections did not move",
      json.load(open(path3, encoding="utf-8"))["sessions"]["5"]["A"] == a5_before)

# Moving a lecture FORWARD can take a topic away from a student mid-unit. That is
# the hazard the preview exists to surface, so it has to actually be surfaced.
soon = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
near = S.set_session_date(3, "A", soon, commit=False)
check("pulling a lecture forward reports the topics it would unlock",
      near["ok"] and any(a["from"] == "locked" and a["to"] != "locked"
                         for a in near["affected"]), near.get("affected"))
back = S.set_session_date(3, "A", "2027-01-05", commit=False)
check("and pushing one out reports no topic losing ground it already had",
      back["ok"] and all(a["from"] == "locked" for a in back["affected"]),
      back.get("affected"))

S.CONFIG_PATH = real_path
S._config = None; S._config_mtime = None
shutil.rmtree(tmp3, ignore_errors=True)
check("the real schedule is untouched by these tests",
      S._load()["sessions"]["5"]["C"] == "2026-10-01", S._load()["sessions"]["5"]["C"])

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
