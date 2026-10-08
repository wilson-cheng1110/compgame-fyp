"""Why is H1 null? Exploratory checks 1 (form equivalence) + 2 (game dose) on the export."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json, sys, warnings
from collections import defaultdict
import numpy as np, pandas as pd
import statsmodels.formula.api as smf
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.join(ROOT, "backend"))
import checks

rows = json.load(open(EXPORT, encoding="utf-8"))
ev = defaultdict(dict)          # (pid, topic) -> {pre: row, post: row}
und = defaultdict(list)         # (pid, topic) -> understanding_complete rows
for r in rows:
    k = (r["participant_id"], r["topic_id"])
    if r["event_type"] == "topic_pretest":
        ev[k]["pre"] = r
    elif r["event_type"] == "topic_posttest":
        ev[k]["post"] = r
    elif r["event_type"] == "understanding_complete":
        und[k].append(r)

items, pairs, mism = [], [], 0
for (pid, topic), e in ev.items():
    if "pre" not in e:
        continue
    pm = json.loads(e["pre"]["meta"] or "{}")
    arm = pm.get("arm")
    for side in ("pre", "post"):
        if side not in e:
            continue
        r = e[side]; m = json.loads(r["meta"] or "{}")
        form = m.get("form"); key = checks._key(topic, form)
        if not key:
            continue
        ans = m.get("answers") or {}
        right = {i: (ans.get(i) or "").strip().lower()[:1] == c for i, c in key.items()}
        if abs(100 * sum(right.values()) / len(key) - (r["score"] or 0)) > 0.6:
            mism += 1
        for i, ok in right.items():
            items.append(dict(pid=pid, topic=topic, arm=arm, side=side, form=form,
                              item=i, slot=int(i[1:]), ok=int(ok), late=bool(m.get("late"))))
    if "post" in e:
        post = e["post"]
        gt = [u for u in und[(pid, topic)] if u["server_ts"] < post["server_ts"]
              and u["server_ts"] > e["pre"]["server_ts"] and u["duration_ms"]]
        pairs.append(dict(pid=pid, topic=topic, arm=arm, pre=e["pre"]["score"], post=post["score"],
                          late=bool(pm.get("late")),
                          game_s=(gt[0]["duration_ms"] / 1000) if gt else None))
it = pd.DataFrame(items); pr = pd.DataFrame(pairs)
print(f"re-graded {len(it)} item responses; stored-score mismatches: {mism}")
print(f"late (after the pre-lecture deadline) pre-checks: {it[(it.side=='pre')].groupby(['pid','topic']).late.first().mean():.1%}")

# ---- CHECK 1: form equivalence. CONTROL has NOTHING between pre (Form A) and post (Form B).
print("\n=== CHECK 1: Form A (pre) vs Form B (post) item difficulty, CONTROL only ===")
c = it[it.arm == "CONTROL"]
tab = c.pivot_table(index=["topic", "slot"], columns="side", values="ok", aggfunc="mean")
tab["diff"] = tab["post"] - tab["pre"]
for t, x in tab.groupby(level=0):
    d = x["diff"].values
    print(f"  {t:18} A={x['pre'].mean():.0%} B={x['post'].mean():.0%}  B-A={x['diff'].mean():+.0%} | "
          f"per item pair: " + " ".join(f"{v:+.0%}" for v in d)
          + f" | spread(SD)={d.std():.2f}")
allc = tab["diff"]
print(f"  ALL item pairs: mean B-A {allc.mean():+.1%}, median {allc.median():+.1%}; "
      f"pairs with |B-A|>=15pp: {(allc.abs()>=.15).sum()}/{len(allc)}")
# Same comparison in FLIP: if B-A is the SAME size in both arms, the game adds ~nothing.
f = it[it.arm == "FLIP"].pivot_table(index=["topic", "slot"], columns="side", values="ok", aggfunc="mean")
f["diff"] = f["post"] - f["pre"]
both = pd.DataFrame({"control": tab["diff"], "flip": f["diff"]}).dropna()
print(f"  FLIP B-A mean {both.flip.mean():+.1%} vs CONTROL {both.control.mean():+.1%}; "
      f"item-pair correlation of the two arms' B-A = {both.corr().iloc[0,1]:.2f}")
print("  (high correlation = the same items move in both arms -> an item/form property, not the game)")

# ---- CHECK 2: dose. Within FLIP, does more time in the Understanding game go with a higher post?
print("\n=== CHECK 2: game time (FLIP, game played between pre and post) vs post score ===")
fl = pr[(pr.arm == "FLIP") & pr.game_s.notna()].copy()
print(f"  FLIP rows with a game between the checks: {len(fl)} of {len(pr[pr.arm=='FLIP'])}")
print(f"  game time s: median {fl.game_s.median():.0f}, IQR {fl.game_s.quantile(.25):.0f}-{fl.game_s.quantile(.75):.0f}, "
      f"<30s: {(fl.game_s<30).mean():.0%}, <60s: {(fl.game_s<60).mean():.0%}")
fl["logt"] = np.log(fl.game_s.clip(lower=1))
m = smf.mixedlm("post ~ logt + pre + C(topic)", fl, groups=fl["pid"]).fit()
print(f"  mixed: post ~ log(game s) + pre + topic + (1|student): coef {m.params['logt']:+.2f} pts per log-unit, "
      f"95%CI [{m.conf_int().loc['logt',0]:+.2f}, {m.conf_int().loc['logt',1]:+.2f}], p={m.pvalues['logt']:.3f}")
fl["q"] = pd.qcut(fl.game_s, 4, labels=["Q1 fastest", "Q2", "Q3", "Q4 longest"])
print("  by game-time quartile (mean pre -> post, n):")
for q, x in fl.groupby("q"):
    print(f"    {q:10} {x.game_s.median():5.0f}s  pre {x.pre.mean():5.1f} -> post {x.post.mean():5.1f}  (+{(x.post-x.pre).mean():.1f})  n={len(x)}")
cg = pr[pr.arm == "CONTROL"]
print(f"  CONTROL (no game between checks): pre {cg.pre.mean():.1f} -> post {cg.post.mean():.1f} (+{(cg.post-cg.pre).mean():.1f}) n={len(cg)}")
