import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
import checks as C

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

print("\n-- parsing --")
rep = C.bank_report()
check("13 topics parsed", len(rep) == 13, list(rep))
check("all A/B balanced at 6", all(r["A"]==6 and r["B"]==6 for r in rep.values()), rep)
check("gestalt has 5 options", rep["gestalt"]["n_options"] == 5)
check("every topic but gestalt has 4",
      all(r["n_options"]==4 for t,r in rep.items() if t != "gestalt"),
      {t:r["n_options"] for t,r in rep.items() if r["n_options"]!=4})
check("has_bank true for banked", C.has_bank("webers-law") and C.has_bank("gestalt"))
import schedule as _S
_sched = [t["id"] for t in _S._load()["topics"]]
check("every scheduled topic has a bank", all(C.has_bank(t) for t in _sched),
      [t for t in _sched if not C.has_bank(t)])
check("and the bank has nothing the schedule does not", set(rep) == set(_sched),
      set(rep) ^ set(_sched))
# The no-bank path still exists for a topic added before its items are written.
check("has_bank false for an unknown topic", not C.has_bank("not-a-topic"))

print("\n-- THE KEY MUST NOT LEAK --")
# Every topic, not the original four: the leak is a property of the SERVING code,
# but a bank authored later can still introduce a shape the stripper misses.
for topic in sorted(rep):
    for form in ("A","B"):
        items = C.items_for_student(topic, form)
        blob = json.dumps(items)
        leaked = any("correct" in i for i in items) or "✓" in blob
        check(f"{topic}/{form}: no key in student payload", not leaked)
check("unbanked topic returns None", C.items_for_student("not-a-topic","A") is None)

print("\n-- the ✓ agrees with the printed answer key --")
import re as _re
_text = open(C.BANK_PATH, encoding="utf-8").read()
_marks = [(m.start(), m.group(1)) for m in C._TOPIC_RE.finditer(_text)]
_bad = []
for _i, (_s, _tid) in enumerate(_marks):
    _end = _marks[_i+1][0] if _i+1 < len(_marks) else len(_text)
    _chunk = _text[_s:_end]
    for _form in ("A","B"):
        _m = _re.search(rf"\*Answer key {_form}:([^*]+)\*", _chunk)
        _declared = dict(p.strip().split("-") for p in _m.group(1).split(",") if p.strip())
        for _it in C._load()[_tid][_form]:
            if _declared.get(_it["id"]) != _it["correct"]:
                _bad.append((_tid, _it["id"], _declared.get(_it["id"]), _it["correct"]))
check("all 156 keys match the ✓", not _bad, _bad[:4])

# A student who answers (b) to everything must not beat chance by much. As
# first authored, 78 of 156 correct answers sat on (b) -- 50% for a fixed
# guess on a 25%-chance instrument, which would inflate every pre-test.
from collections import Counter as _Counter
_dist = _Counter(i["correct"] for f in C._load().values() for it in f.values() for i in it)
_top = _dist.most_common(1)[0]
check("no single letter answers more than 40% of items", _top[1] <= 0.40*156, (_top, dict(_dist)))

print("\n-- student payload still usable --")
items = C.items_for_student("webers-law","A")
check("6 items", len(items) == 6, len(items))
check("each has id/stem/options", all({"id","stem","options"} == set(i) for i in items))
check("4 options each", all(len(i["options"])==4 for i in items))
check("stems non-empty", all(len(i["stem"]) > 20 for i in items))
g = C.items_for_student("gestalt","A")
check("gestalt stems have no arrow residue", all("→" not in i["stem"] and "✓" not in i["stem"] for i in g), [i["stem"][-25:] for i in g][:2])

print("\n-- grading --")
KEY_A = {"A1":"b","A2":"a","A3":"b","A4":"c","A5":"b","A6":"b"}   # from the doc's answer key
g = C.grade_submission("webers-law","A", KEY_A, reveal=True)
check("all-correct scores 100", g["score"] == 100.0, g["score"])
check("correct count 6", g["correct"] == 6)
g = C.grade_submission("webers-law","A", {"A1":"a","A2":"a","A3":"a","A4":"a","A5":"a","A6":"a"}, reveal=True)
check("one-right scores 16.7", g["score"] == 16.7, g["score"])
check("gestalt key matches doc", C.score_only("gestalt","A", {"A1":"b","A2":"a","A3":"e","A4":"c","A5":"d","A6":"b"}) == 100.0)
check("blank answers score 0", C.score_only("memory","B", {}) == 0.0)
check("case/whitespace tolerated", C.score_only("webers-law","A", {k:f" {v.upper()} " for k,v in KEY_A.items()}) == 100.0)

print("\n-- feedback asymmetry (Part 8.5) --")
pre = C.grade_submission("webers-law","A", KEY_A, reveal=False)
check("pre-check hides score", "score" not in pre and "correct" not in pre, list(pre))
check("pre-check hides per-item correctness", all("was_correct" not in i and "correct_option" not in i for i in pre["items"]))
check("pre-check still records what was answered", pre["answered"] == 6)
post = C.grade_submission("webers-law","B", {}, reveal=True)
check("post-check reveals score", "score" in post)
check("post-check reveals correct option", all("correct_option" in i for i in post["items"]))

print("\n-- one submission only --")
events = [{"participant_id":"24012345D","event_type":"topic_pretest","topic_id":"webers-law"}]
check("resubmit detected", C.already_submitted(events,"24012345D","webers-law","topic_pretest"))
check("different topic ok", not C.already_submitted(events,"24012345D","gestalt","topic_pretest"))
check("different student ok", not C.already_submitted(events,"24067890X","webers-law","topic_pretest"))
check("post is separate from pre", not C.already_submitted(events,"24012345D","webers-law","topic_posttest"))

print("\n-- unbanked topic raises rather than scoring 0 --")
try:
    C.grade_submission("not-a-topic","A",{}); check("raises for unbanked", False)
except ValueError: check("raises for unbanked", True)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
