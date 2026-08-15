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
check("norman first", states[0]["topic_id"] == "norman")
check("experiment-design last", states[-1]["topic_id"] == "experiment-design")
check("mc_bank true for exactly 4", sum(1 for s in states if s["mc_bank"]) == 4)
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

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
