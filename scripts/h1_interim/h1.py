"""H1 per-student analysis on the pseudonymised export (2026-10-08). Descriptive/interim."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json, warnings
import numpy as np, pandas as pd
from scipy import stats
import statsmodels.formula.api as smf
warnings.filterwarnings("ignore")

rows = json.load(open(EXPORT, encoding="utf-8"))
pre, post = {}, {}
for r in rows:
    if r["event_type"] not in ("topic_pretest", "topic_posttest") or r["score"] is None:
        continue
    m = json.loads(r["meta"] or "{}")
    k = (r["participant_id"], r["topic_id"])
    if r["event_type"] == "topic_pretest":
        pre[k] = (r["score"], m.get("arm"), m.get("section"))
    else:
        post[k] = r["score"]

recs = []
for k, (s, arm, sec) in pre.items():
    if arm not in ("FLIP", "CONTROL"):
        continue
    recs.append(dict(pid=k[0], topic=k[1], pre=s, post=post.get(k), arm=arm, section=sec))
d = pd.DataFrame(recs)
d["flip"] = (d.arm == "FLIP").astype(int)
EXTRA = {"norman", "hicks-law"}   # CLAUDE.md: extra topics, not H1 evidence

def report(label, x):
    x = x.copy()
    print(f"\n=== {label}: {len(x)} topic-rows, {x.pid.nunique()} students, {x.topic.nunique()} topics ===")
    # 1. per-student paired: mean post on FLIP topics vs CONTROL topics, and mean (post-pre)
    g = x.groupby(["pid", "arm"]).agg(post=("post", "mean"), chg=("chg", "mean")).unstack()
    g = g.dropna()
    for col in ("post", "chg"):
        dif = g[(col, "FLIP")] - g[(col, "CONTROL")]
        t = stats.ttest_1samp(dif, 0)
        w = stats.wilcoxon(dif) if (dif != 0).any() else None
        print(f" paired per-student {col:4}: n={len(dif)}  FLIP-CONTROL mean={dif.mean():+.2f}  "
              f"95%CI [{dif.mean()-1.96*dif.sem():+.2f}, {dif.mean()+1.96*dif.sem():+.2f}]  "
              f"t p={t.pvalue:.3f}  wilcoxon p={w.pvalue if w else float('nan'):.3f}  dz={dif.mean()/dif.std():+.3f}")
    # 2. mixed model: post ~ flip + pre + topic FE + random intercept per student
    mm = smf.mixedlm("post ~ flip + pre + C(topic)", x, groups=x["pid"]).fit(reml=True)
    b, se = mm.params["flip"], mm.bse["flip"]
    print(f" mixed model  flip coef = {b:+.2f} pts  95%CI [{b-1.96*se:+.2f}, {b+1.96*se:+.2f}]  p={mm.pvalues['flip']:.3f}")
    # 3. ceiling-aware: P(post==100), GEE logistic clustered on student
    x["perfect"] = (x.post >= 100).astype(int)
    ge = smf.gee("perfect ~ flip + pre + C(topic)", "pid", x,
                 family=__import__("statsmodels.api").api.families.Binomial()).fit()
    b, se = ge.params["flip"], ge.bse["flip"]
    print(f" GEE P(post=100)  OR = {np.exp(b):.2f}  95%CI [{np.exp(b-1.96*se):.2f}, {np.exp(b+1.96*se):.2f}]  p={ge.pvalues['flip']:.3f}"
          f"  (rate FLIP {x[x.flip==1].perfect.mean():.0%} / CONTROL {x[x.flip==0].perfect.mean():.0%})")
    # 4. the old metric, for contrast: mean of per-student g (pre<100 only)
    gg = x[x.pre < 100].assign(g=lambda z: (z.post - z.pre) / (100 - z.pre))
    print(f" <g> (pre<100)  FLIP {gg[gg.flip==1].g.mean():.3f}  CONTROL {gg[gg.flip==0].g.mean():.3f}"
          f"   | median g FLIP {gg[gg.flip==1].g.median():.3f}  CONTROL {gg[gg.flip==0].g.median():.3f}")

comp = d.dropna(subset=["post"]).assign(chg=lambda z: z.post - z.pre)
itt = d.assign(post=d.post.fillna(d.pre)).assign(chg=lambda z: z.post - z.pre)
print("attrition (pretest but no posttest):",
      d[d.post.isna()].groupby("arm").size().to_dict(), "of", d.groupby("arm").size().to_dict())
report("COMPLETERS, H1 topics (no norman/hicks)", comp[~comp.topic.isin(EXTRA)])
report("ITT (missing post = pre), H1 topics", itt[~itt.topic.isin(EXTRA)])
report("COMPLETERS, all topics", comp)
report("COMPLETERS, UG only (A/B/C)", comp[~comp.topic.isin(EXTRA) & (comp.section != "MSC")])

# per-topic mixed-free check: flip coef from OLS post ~ flip + pre, per topic
print("\nper-topic OLS (post ~ flip + pre), completers:")
for t, x in comp.groupby("topic"):
    o = smf.ols("post ~ flip + pre", x).fit()
    print(f"  {t:18} n={len(x):3}  flip {o.params['flip']:+5.2f}  95%CI [{o.conf_int().loc['flip',0]:+.2f}, {o.conf_int().loc['flip',1]:+.2f}]  p={o.pvalues['flip']:.3f}")
