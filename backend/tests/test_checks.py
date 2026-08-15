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
check("4 topics parsed", len(rep) == 4, list(rep))
check("all A/B balanced at 6", all(r["A"]==6 and r["B"]==6 for r in rep.values()), rep)
check("gestalt has 5 options", rep["gestalt"]["n_options"] == 5)
check("others have 4", all(rep[t]["n_options"]==4 for t in ("webers-law","problem-solving","memory")))
check("has_bank true for banked", C.has_bank("webers-law") and C.has_bank("gestalt"))
check("has_bank false for unbanked", not C.has_bank("norman") and not C.has_bank("hicks-law"))

print("\n-- THE KEY MUST NOT LEAK --")
for topic in ("webers-law","gestalt","problem-solving","memory"):
    for form in ("A","B"):
        items = C.items_for_student(topic, form)
        blob = json.dumps(items)
        leaked = any("correct" in i for i in items) or "✓" in blob
        check(f"{topic}/{form}: no key in student payload", not leaked)
check("unbanked topic returns None", C.items_for_student("norman","A") is None)

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
    C.grade_submission("norman","A",{}); check("raises for unbanked", False)
except ValueError: check("raises for unbanked", True)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
