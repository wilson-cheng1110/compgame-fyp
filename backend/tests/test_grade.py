import os, sys, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)
import grade as G

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")

print("\n-- rubric parses --")
r = G._load_rubric()
check("4 topics have rubric sections", len(r) == 4, list(r))
check("every one has a probe", all(t["probe"] for t in r.values()))
check("webers has the load-bearing point", "proportion" in r["webers-law"]["points"])
check("gestalt has 4 points", len(r["gestalt"]["points"]) == 4, r["gestalt"]["points"].keys())
check("unbanked topic degrades, does not raise", G.rubric_for("norman") == {"probe": None, "points": {}})
check("probe_for returns None for unbanked", G.probe_for("hicks-law") is None)

print("\n-- the null filter (null != none) --")
probe = G.probe_for("webers-law")
for text, expect in [("", "blank"), ("   ", "blank"), ("idk", "no_attempt"),
                     ("I don't know", "no_attempt"), ("n/a", "no_attempt"),
                     ("???", "no_attempt"), ("because heavy", "too_short")]:
    gradeable, reason = G.is_gradeable(text, probe)
    check(f"{text!r:<18} -> null/{expect}", not gradeable and reason == expect, reason)

real = "Because it is about the ratio not the absolute amount you add each time."
check("a real answer is gradeable", G.is_gradeable(real, probe)[0])
wrong = "It feels different because your arm muscles get tired after holding it a while."
check("a WRONG but real attempt is still gradeable (-> 'none', not null)",
      G.is_gradeable(wrong, probe)[0])
check("pasting the probe back is null, not none",
      not G.is_gradeable(probe, probe)[0], G.is_gradeable(probe, probe))

print("\n-- prompt is blind by construction --")
p = G.build_prompt("webers-law", real)
for leak in ("24012345", "pre-test", "posttest", "post-test", "pretest", "FLIP", "CONTROL"):
    check(f"prompt carries no {leak!r}", leak.lower() not in p.lower())
check("prompt carries the rubric keys", "proportion" in p and "jnd" in p)
check("prompt carries the answer", real in p)
check("unbanked topic still builds a prompt", "grade on the levels alone"
      in G.build_prompt("norman", real).lower() or "no per-point rubric"
      in G.build_prompt("norman", real).lower())

print("\n-- parse_grade survives what small models actually emit --")
a = "the ratio matters more than the absolute amount"
cases = [
    ('{"level":"full","evidence":"the ratio matters","rubric_hit":["proportion"]}', "full"),
    ('```json\n{"level":"partial","evidence":"the ratio matters","rubric_hit":[]}\n```', "partial"),
    ('Sure! {"level":"none","evidence":"the ratio matters","rubric_hit":[]} hope that helps', "none"),
    ('{"level":"full","evidence":"the ratio matters","rubric_hit":["propor', "full"),   # truncated
    ('{"level":null,"evidence":"","rubric_hit":[]}', None),
    ('not json at all', None),
    ('', None),
    ('{"level":"EXCELLENT","evidence":"x","rubric_hit":[]}', None),   # invented level
]
for raw, expect in cases:
    got = G.parse_grade(raw, a)
    check(f"{raw[:38]!r:<42} -> {expect}", got["level"] == expect, got)

check("truncated JSON still recovers evidence",
      G.parse_grade('{"level":"full","evidence":"the ratio matters","rubric_hit":["propor', a)["evidence"]
      == "the ratio matters")

print("\n-- invented evidence is caught --")
good = G.parse_grade('{"level":"full","evidence":"the ratio matters","rubric_hit":[]}', a)
bad  = G.parse_grade('{"level":"full","evidence":"the student clearly understands Weber","rubric_hit":[]}', a)
check("real quote flagged verbatim", good["evidence_verbatim"] is True)
check("hallucinated quote flagged NOT verbatim", bad["evidence_verbatim"] is False, bad)
check("whitespace/case differences still count as verbatim",
      G.parse_grade('{"level":"full","evidence":"The  Ratio   Matters","rubric_hit":[]}', a)["evidence_verbatim"] is True)

print("\n-- blinding --")
recs = [{"id": i, "participant_id": f"2401234{i}", "topic_id": "webers-law",
         "event_type": "topic_pretest" if i % 2 else "topic_posttest",
         "phase": "A" if i % 2 else "B", "arm": "FLIP", "answer": f"answer number {i}"}
        for i in range(1, 21)]
blinded, mapping = G.blind(recs)
blob = json.dumps(blinded)
check("20 blinded", len(blinded) == 20)
check("only tag/topic_id/answer survive", all(set(b) == {"tag", "topic_id", "answer"} for b in blinded))
for leak in ("participant_id", "2401234", "pretest", "posttest", "FLIP", "phase", "arm"):
    check(f"blinded payload carries no {leak!r}", leak not in blob)
check("order is NOT collection order",
      [mapping[b["tag"]]["id"] for b in blinded] != list(range(1, 21)))
check("shuffle is reproducible under the same seed",
      [b["tag"] for b in G.blind(recs)[0]] == [b["tag"] for b in blinded])
check("a different seed gives a different order",
      [b["tag"] for b in G.blind(recs, seed="other")[0]] != [b["tag"] for b in blinded])

results = [{"tag": b["tag"], "level": "full", "evidence": "", "rubric_hit": []} for b in blinded]
joined = G.unblind(results, mapping)
check("unblind restores every label", len(joined) == 20
      and all("participant_id" in j and "phase" in j and j["grade"]["level"] == "full" for j in joined))
try:
    G.unblind([{"tag": "deadbeefdeadbeef", "level": "full"}], mapping)
    check("unknown tag raises rather than silently dropping", False)
except KeyError:
    check("unknown tag raises rather than silently dropping", True)

print("\n-- Cohen's kappa --")
perfect = ["full", "partial", "none", None, "full", "partial"]
k = G.cohen_kappa(perfect, list(perfect))
check("perfect agreement -> kappa 1.0", k["kappa"] == 1.0, k)
check("perfect agreement is 'usable'", k["verdict"] == "usable")
one_off = ["full", "partial", "none", None, "full", "none"]
k2 = G.cohen_kappa(perfect, one_off)
check("one disagreement drops kappa below 1", k2["kappa"] < 1.0, k2)
check("kappa below 0.6 is labelled descriptive-only",
      "descriptive" in G.cohen_kappa(["full","full","full","partial","none","full"],
                                     ["none","partial","full","full","full","none"])["verdict"])
flat = G.cohen_kappa(["full"]*5, ["full"]*5)
check("no-variance case returns None, not a fake 1.0", flat["kappa"] is None, flat)
check("None is a CATEGORY in kappa, not a skip",
      G.cohen_kappa([None, None, "full"], [None, "full", "full"])["n"] == 3)
try:
    G.cohen_kappa([1, 2], [1]); check("unequal lengths raise", False)
except ValueError: check("unequal lengths raise", True)

print("\n-- endpoint fails closed --")
check("GRADE_TOKEN unset by default in this env", G.GRADE_TOKEN == "")

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
