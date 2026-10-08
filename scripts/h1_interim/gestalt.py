import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json
from collections import defaultdict, Counter
rows = json.load(open(EXPORT, encoding="utf-8"))
by = defaultdict(list)
for r in rows:
    if r["topic_id"]: by[(r["participant_id"], r["topic_id"])].append(r)
stuck = defaultdict(Counter); ntopic = Counter(); gtime = defaultdict(list); gtime_ok = defaultdict(list)
for (pid, t), evs in by.items():
    pre = [e for e in evs if e["event_type"] == "topic_pretest"]
    if not pre: continue
    arm = json.loads(pre[0]["meta"] or "{}").get("arm")
    if arm != "FLIP": continue
    ntopic[t] += 1
    after = [e for e in evs if e["server_ts"] > pre[0]["server_ts"]]
    types = {e["event_type"] for e in after}
    und = [e for e in after if e["event_type"] == "understanding_complete" and e["duration_ms"]]
    if "topic_posttest" in types:
        if und: gtime_ok[t].append(und[0]["duration_ms"] / 1000)
        continue
    stuck[t]["no_post"] += 1
    if "understanding_complete" in types: stuck[t]["game DONE, then no post"] += 1
    elif "activity_not_recorded" in types: stuck[t]["escape: activity_not_recorded"] += 1
    elif not after: stuck[t]["nothing at all after pre"] += 1
    else: stuck[t]["other: " + ",".join(sorted(types))] += 1
for t in sorted(ntopic, key=lambda t: -stuck[t]["no_post"]):
    if stuck[t]["no_post"] == 0: continue
    g = sorted(gtime_ok[t]); med = g[len(g)//2] if g else 0
    print(f"{t:18} FLIP {ntopic[t]:3}  no-post {stuck[t]['no_post']:2}  | " +
          "; ".join(f"{k}={v}" for k, v in stuck[t].items() if k != "no_post") +
          f" | completers' median game time {med:.0f}s")
med_all = {t: sorted(v)[len(v)//2] for t, v in gtime_ok.items() if v}
print("median game time (FLIP completers) by topic:", {t: round(v) for t, v in sorted(med_all.items(), key=lambda x: -x[1])})
